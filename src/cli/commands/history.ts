import type Database from "better-sqlite3";

import { type Command, InvalidArgumentError } from "commander";

import {
  type CanonicalEvent,
  type CanonicalEventKind,
  isCanonicalEventKind,
  type JsonValue,
} from "../../core/events/canonical-event.js";

import { openCasrDatabase } from "../../storage/database.js";

import { runMigrations } from "../../storage/migrations.js";

import { CanonicalHistoryQueryRepository } from "../../storage/repositories/canonical-history-query-repository.js";

export interface HistoryOptions {
  limit?: number;
  kind?: string;
  json?: boolean;
  raw?: boolean;
}

export interface HistoryDependencies {
  openDatabase?: () => Database.Database;

  log?: (value: string) => void;
}

function parseLimit(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new InvalidArgumentError(
      "limit must be an integer between 1 and 1000",
    );
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 1000) {
    throw new InvalidArgumentError(
      "limit must be an integer between 1 and 1000",
    );
  }

  return parsed;
}

function resolveKind(
  value: string | undefined,
): CanonicalEventKind | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isCanonicalEventKind(value)) {
    throw new Error(
      [
        `Unknown canonical event kind: ${value}.`,
        "Expected one of:",
        "message, tool_call, tool_result, reasoning, lifecycle, state, metadata, unknown.",
      ].join(" "),
    );
  }

  return value;
}

function asObject(value: JsonValue): {
  [key: string]: JsonValue;
} | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value;
}

function readString(
  object: {
    [key: string]: JsonValue;
  } | null,
  key: string,
): string | null {
  if (!object) {
    return null;
  }

  const value = object[key];

  return typeof value === "string" ? value : null;
}

function summarizeEvent(event: CanonicalEvent): string {
  const payload = asObject(event.payload);

  let summary: string;

  switch (event.kind) {
    case "message":
      summary = readString(payload, "text") ?? "message";
      break;

    case "tool_call":
      summary = `tool: ${readString(payload, "name") ?? "unknown"}`;
      break;

    case "tool_result":
      summary = "tool result";
      break;

    case "reasoning":
      summary = "reasoning";
      break;

    case "lifecycle": {
      const scope = readString(payload, "scope");

      const status = readString(payload, "status");

      summary =
        [scope, status]
          .filter((part): part is string => part !== null)
          .join(" ") || "lifecycle";

      break;
    }

    case "state":
      summary = readString(payload, "scope") ?? "state";
      break;

    case "metadata":
      summary =
        readString(payload, "metric") ??
        readString(payload, "scope") ??
        "metadata";
      break;

    case "unknown":
      summary = "unknown";
      break;
  }

  const normalized = summary.replace(/\s+/g, " ").trim();

  if (normalized.length <= 100) {
    return normalized;
  }

  return `${normalized.slice(0, 97)}...`;
}

function projectJsonEvent(
  event: CanonicalEvent,
  includeRaw: boolean,
): Record<string, unknown> {
  if (includeRaw) {
    return event;
  }

  return {
    id: event.id,
    sessionId: event.sessionId,
    sequence: event.sequence,
    kind: event.kind,
    role: event.role,
    occurredAt: event.occurredAt,
    importedAt: event.importedAt,
    payload: event.payload,
    source: event.source,
  };
}

export function runHistory(
  sessionId: string,
  options: HistoryOptions = {},
  dependencies: HistoryDependencies = {},
): void {
  const limit = options.limit ?? 50;

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error("History limit must be an integer between 1 and 1000.");
  }

  if (options.raw && !options.json) {
    throw new Error("--raw requires --json.");
  }

  const kind = resolveKind(options.kind);

  const openDatabase = dependencies.openDatabase ?? openCasrDatabase;

  const log = dependencies.log ?? console.log;

  const database = openDatabase();

  try {
    runMigrations(database);

    const repository = new CanonicalHistoryQueryRepository(database);

    const result = repository.getHistory(sessionId, {
      limit,

      ...(kind
        ? {
            kind,
          }
        : {}),
    });

    if (!result) {
      throw new Error(`CASR session not found: ${sessionId}`);
    }

    if (options.json) {
      log(
        JSON.stringify(
          {
            sessionId,

            kind: kind ?? null,

            totalMatching: result.totalMatching,

            shown: result.events.length,

            events: result.events.map((event) =>
              projectJsonEvent(event, options.raw === true),
            ),
          },
          null,
          2,
        ),
      );

      return;
    }

    log("CASR History");
    log("");
    log(`Session          : ${sessionId}`);

    log(`Kind             : ${kind ?? "all"}`);

    log(`Matching events  : ${result.totalMatching}`);

    log(`Shown            : ${result.events.length}`);

    log("");

    if (result.events.length === 0) {
      log("No canonical history events found.");

      return;
    }

    for (const event of result.events) {
      const role = event.role ?? "-";

      const occurredAt = event.occurredAt ?? "-";

      log(
        [
          String(event.sequence).padStart(6),
          event.kind.padEnd(11),
          role.padEnd(10),
          occurredAt,
          summarizeEvent(event),
        ].join("  "),
      );
    }
  } finally {
    database.close();
  }
}

export function registerHistoryCommand(program: Command): void {
  program
    .command("history <session-id>")
    .description("Show canonical history for a CASR session")
    .option(
      "-n, --limit <count>",
      "number of latest events to show (1-1000)",
      parseLimit,
      50,
    )
    .option("-k, --kind <kind>", "filter by canonical event kind")
    .option("--json", "output structured JSON")
    .option("--raw", "include raw native evidence in JSON output")
    .action((sessionId: string, options: HistoryOptions) => {
      runHistory(sessionId, options);
    });
}
