import Database from "better-sqlite3";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerHistoryCommand,
  runHistory,
} from "../src/cli/commands/history.js";

import { createProgram } from "../src/cli/program.js";
import type { CanonicalEventDraft } from "../src/core/events/canonical-event.js";

import { runMigrations } from "../src/storage/migrations.js";

import { CanonicalEventRepository } from "../src/storage/repositories/canonical-event-repository.js";

import { CanonicalHistoryQueryRepository } from "../src/storage/repositories/canonical-history-query-repository.js";

describe("canonical history CLI", () => {
  let database: Database.Database;

  let events: CanonicalEventRepository;

  beforeEach(() => {
    database = new Database(":memory:");

    database.pragma("foreign_keys = ON");

    runMigrations(database);

    database
      .prepare(
        `
            INSERT INTO sessions (
              id,
              title,
              workspace_path,
              status,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
      )
      .run(
        "casr-history-test",
        "History Test",
        String.raw`C:\workspace\history`,
        "active",
        "2026-08-29T01:00:00.000Z",
        "2026-08-29T02:00:00.000Z",
      );

    events = new CanonicalEventRepository(database);

    events.appendMany(
      [
        messageDraft(0, "first", "user"),

        lifecycleDraft(1),

        messageDraft(2, "second", "assistant"),

        messageDraft(3, "third", "developer"),

        toolDraft(4),
      ].map((draft, sequence) => ({
        sessionId: "casr-history-test",

        sequence,

        importedAt: "2026-08-29T03:00:00.000Z",

        draft,
      })),
    );
  });

  afterEach(() => {
    database.close();
  });

  function baseDraft(
    sourcePosition: number,
  ): Omit<CanonicalEventDraft, "kind" | "role" | "payload"> {
    return {
      occurredAt: `2026-08-29T01:00:0${sourcePosition}.000Z`,

      source: {
        adapter: "codex",

        nativeSessionId: "native-history",

        nativeSource: "history.jsonl",

        sourcePosition,

        fingerprint: `fingerprint-${sourcePosition}`,

        nativeOrdinal: null,

        nativeTopLevelType: "response_item",

        nativePayloadType: null,

        nativePayloadId: null,

        nativeTurnId: null,

        nativeCallId: null,
      },

      raw: {
        secretEvidence: `raw-${sourcePosition}`,
      },
    };
  }

  function messageDraft(
    sourcePosition: number,
    text: string,
    role: "user" | "assistant" | "developer",
  ): CanonicalEventDraft {
    return {
      ...baseDraft(sourcePosition),

      kind: "message",
      role,

      payload: {
        text,
      },
    };
  }

  function lifecycleDraft(sourcePosition: number): CanonicalEventDraft {
    return {
      ...baseDraft(sourcePosition),

      kind: "lifecycle",

      role: null,

      payload: {
        scope: "turn",
        status: "started",
      },
    };
  }

  function toolDraft(sourcePosition: number): CanonicalEventDraft {
    return {
      ...baseDraft(sourcePosition),

      kind: "tool_call",

      role: null,

      payload: {
        name: "example_tool",

        input: {},
      },
    };
  }

  it("returns the latest events in chronological order", () => {
    const repository = new CanonicalHistoryQueryRepository(database);

    const result = repository.getHistory("casr-history-test", {
      limit: 3,
    });

    expect(result?.totalMatching).toBe(5);

    expect(result?.events.map((event) => event.sequence)).toEqual([2, 3, 4]);
  });

  it("filters canonical history by kind", () => {
    const repository = new CanonicalHistoryQueryRepository(database);

    const result = repository.getHistory("casr-history-test", {
      kind: "message",

      limit: 10,
    });

    expect(result?.totalMatching).toBe(3);

    expect(result?.events.map((event) => event.sequence)).toEqual([0, 2, 3]);
  });

  it("returns null for an unknown CASR session", () => {
    const repository = new CanonicalHistoryQueryRepository(database);

    expect(repository.getHistory("missing")).toBeNull();
  });

  it("rejects invalid query limits", () => {
    const repository = new CanonicalHistoryQueryRepository(database);

    expect(() =>
      repository.getHistory("casr-history-test", {
        limit: 0,
      }),
    ).toThrow(/between 1 and 1000/);

    expect(() =>
      repository.getHistory("casr-history-test", {
        limit: 1001,
      }),
    ).toThrow(/between 1 and 1000/);
  });

  it("renders human-readable history without raw native evidence", () => {
    const lines: string[] = [];

    runHistory(
      "casr-history-test",
      {
        limit: 2,
      },
      {
        openDatabase: () => database,

        log: (value) => {
          lines.push(value);
        },
      },
    );

    const output = lines.join("\n");

    expect(output).toContain("CASR History");

    expect(output).toContain("third");

    expect(output).toContain("example_tool");

    expect(output).not.toContain("secretEvidence");
  });

  it("renders JSON without raw evidence by default", () => {
    const lines: string[] = [];

    runHistory(
      "casr-history-test",
      {
        limit: 1,
        json: true,
      },
      {
        openDatabase: () => database,

        log: (value) => {
          lines.push(value);
        },
      },
    );

    const parsed = JSON.parse(lines[0] ?? "{}") as {
      shown: number;

      events: Array<Record<string, unknown>>;
    };

    expect(parsed.shown).toBe(1);

    expect(parsed.events[0]).not.toHaveProperty("raw");
  });

  it("includes raw evidence only when explicitly requested", () => {
    const lines: string[] = [];

    runHistory(
      "casr-history-test",
      {
        limit: 1,
        json: true,
        raw: true,
      },
      {
        openDatabase: () => database,

        log: (value) => {
          lines.push(value);
        },
      },
    );

    const parsed = JSON.parse(lines[0] ?? "{}") as {
      events: Array<Record<string, unknown>>;
    };

    expect(parsed.events[0]).toHaveProperty("raw");
  });

  it("requires --json when raw evidence is requested", () => {
    expect(() =>
      runHistory(
        "casr-history-test",
        {
          raw: true,
        },
        {
          openDatabase: () => database,

          log: vi.fn(),
        },
      ),
    ).toThrow(/--raw requires --json/);
  });

  it("rejects unknown canonical event kinds", () => {
    expect(() =>
      runHistory(
        "casr-history-test",
        {
          kind: "codex_response_item",
        },
        {
          openDatabase: () => database,

          log: vi.fn(),
        },
      ),
    ).toThrow(/Unknown canonical event kind/);
  });

  it("registers history as a top-level CLI command", () => {
    const program = createProgram();

    expect(program.commands.map((command) => command.name())).toContain(
      "history",
    );

    /*
     * Also prove the registration helper
     * itself is independently reusable.
     */
    const isolated = new (
      program.constructor as typeof import("commander").Command
    )();

    registerHistoryCommand(isolated);

    expect(isolated.commands.map((command) => command.name())).toContain(
      "history",
    );
  });
});
