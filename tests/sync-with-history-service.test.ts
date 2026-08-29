import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";

import Database from "better-sqlite3";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readCodexCanonicalHistoryBatch } from "../src/adapters/codex/codex-canonical-history-reader.js";

import type { NativeSession } from "../src/core/session/native-session.js";

import { syncNativeSessionsWithHistory } from "../src/services/sync-with-history-service.js";

import { runMigrations } from "../src/storage/migrations.js";

import { CanonicalEventRepository } from "../src/storage/repositories/canonical-event-repository.js";

import { ImportCursorRepository } from "../src/storage/repositories/import-cursor-repository.js";

import { SessionRegistryRepository } from "../src/storage/repositories/session-registry-repository.js";

describe("session sync with canonical history", () => {
  let database: Database.Database;

  let repository: SessionRegistryRepository;

  let temporaryDirectory: string;

  let sourceOne: string;
  let sourceTwo: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "casr-sync-history-"));

    sourceOne = join(temporaryDirectory, "one.jsonl");

    sourceTwo = join(temporaryDirectory, "two.jsonl");

    database = new Database(":memory:");

    database.pragma("foreign_keys = ON");

    runMigrations(database);

    repository = new SessionRegistryRepository(database);
  });

  afterEach(() => {
    database.close();

    rmSync(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  });

  function messageRecord(text: string): string {
    return JSON.stringify({
      timestamp: "2026-08-29T01:00:00.000Z",

      type: "response_item",

      payload: {
        type: "message",
        role: "user",

        content: [
          {
            type: "input_text",
            text,
          },
        ],
      },
    });
  }

  function lifecycleRecord(turnId: string = "turn-1"): string {
    return JSON.stringify({
      timestamp: "2026-08-29T01:00:01.000Z",

      type: "event_msg",

      payload: {
        type: "task_started",

        turn_id: turnId,
      },
    });
  }

  function writeRecords(path: string, records: string[]): void {
    writeFileSync(path, `${records.join("\n")}\n`, "utf8");
  }

  function nativeSession(id: string, path: string): NativeSession {
    return {
      adapter: "codex",

      nativeSessionId: id,

      title: `Session ${id}`,

      workspacePath: String.raw`C:\workspace\test`,

      nativePath: path,

      provider: "openai",

      model: "gpt-test",

      reasoningEffort: "medium",

      source: "cli",

      threadSource: "user",

      historyMode: "paginated",

      projectId: null,

      archived: false,

      createdAt: "2026-08-29T01:00:00.000Z",

      updatedAt: "2026-08-29T02:00:00.000Z",
    };
  }

  function sync(sessions: NativeSession[]) {
    return syncNativeSessionsWithHistory(
      database,
      repository,
      sessions,
      readCodexCanonicalHistoryBatch,
      {
        importedAt: "2026-08-29T10:00:00.000Z",
      },
    );
  }

  it("syncs native registry and canonical history together", () => {
    writeRecords(sourceOne, [messageRecord("one"), lifecycleRecord()]);

    writeRecords(sourceTwo, [messageRecord("two")]);

    const result = sync([
      nativeSession("native-1", sourceOne),

      nativeSession("native-2", sourceTwo),
    ]);

    expect(result).toMatchObject({
      discovered: 2,
      imported: 2,
      updated: 0,
      unchanged: 0,

      history: {
        sources: 2,
        succeeded: 2,
        failed: 0,

        recordsRead: 3,
        inserted: 3,
        alreadyKnown: 0,

        eof: 2,
        malformed: 0,
        deferred: 0,
      },

      failures: [],
    });

    expect(
      database
        .prepare(
          `
                SELECT COUNT(*) AS count
                FROM sessions
              `,
        )
        .get(),
    ).toEqual({
      count: 2,
    });

    expect(
      new CanonicalEventRepository(database).listBySession(
        repository.findSessionIdByNativeIdentity("codex", "native-1") ?? "",
      ),
    ).toHaveLength(2);
  });

  it("does not re-read history when every source cursor is already at EOF", () => {
    writeRecords(sourceOne, [messageRecord("one")]);

    writeRecords(sourceTwo, [messageRecord("two")]);

    const sessions = [
      nativeSession("native-1", sourceOne),

      nativeSession("native-2", sourceTwo),
    ];

    sync(sessions);

    const second = sync(sessions);

    expect(second).toMatchObject({
      discovered: 2,
      imported: 0,
      updated: 0,
      unchanged: 2,

      history: {
        sources: 2,
        succeeded: 2,
        failed: 0,

        recordsRead: 0,
        inserted: 0,
        alreadyKnown: 0,

        eof: 2,
      },
    });

    expect(
      new CanonicalEventRepository(database).countBySession(
        repository.findSessionIdByNativeIdentity("codex", "native-1") ?? "",
      ),
    ).toBe(1);
  });

  it("imports only the delta from the changed native source", () => {
    writeRecords(sourceOne, [messageRecord("one")]);

    writeRecords(sourceTwo, [messageRecord("two")]);

    const sessions = [
      nativeSession("native-1", sourceOne),

      nativeSession("native-2", sourceTwo),
    ];

    sync(sessions);

    appendFileSync(sourceOne, `${lifecycleRecord("turn-new")}\n`, "utf8");

    const second = sync(sessions);

    expect(second.history.recordsRead).toBe(1);

    expect(second.history.inserted).toBe(1);

    expect(second.history.failed).toBe(0);

    const firstSessionId = repository.findSessionIdByNativeIdentity(
      "codex",
      "native-1",
    );

    const secondSessionId = repository.findSessionIdByNativeIdentity(
      "codex",
      "native-2",
    );

    expect(firstSessionId).not.toBeNull();

    expect(secondSessionId).not.toBeNull();

    const events = new CanonicalEventRepository(database);

    expect(events.countBySession(firstSessionId ?? "")).toBe(2);

    expect(events.countBySession(secondSessionId ?? "")).toBe(1);
  });

  it("isolates a history source failure and continues syncing other sessions", () => {
    writeRecords(sourceOne, [messageRecord("healthy")]);

    const missingPath = join(temporaryDirectory, "missing.jsonl");

    const result = sync([
      nativeSession("native-good", sourceOne),

      nativeSession("native-bad", missingPath),
    ]);

    expect(result.discovered).toBe(2);

    expect(result.imported).toBe(2);

    expect(result.history.sources).toBe(2);

    expect(result.history.succeeded).toBe(1);

    expect(result.history.failed).toBe(1);

    expect(result.history.inserted).toBe(1);

    expect(result.failures).toHaveLength(1);

    expect(result.failures[0]?.nativeSessionId).toBe("native-bad");

    expect(
      database
        .prepare(
          `
                SELECT COUNT(*) AS count
                FROM sessions
              `,
        )
        .get(),
    ).toEqual({
      count: 2,
    });
  });

  it("reports malformed history while preserving its safe prefix", () => {
    writeFileSync(
      sourceOne,
      [
        messageRecord("before"),
        "{broken-json}",
        messageRecord("after"),
        "",
      ].join("\n"),
      "utf8",
    );

    writeRecords(sourceTwo, [messageRecord("healthy")]);

    const result = sync([
      nativeSession("native-1", sourceOne),

      nativeSession("native-2", sourceTwo),
    ]);

    expect(result.history.failed).toBe(0);

    expect(result.history.malformed).toBe(1);

    expect(result.history.eof).toBe(1);

    expect(result.history.recordsRead).toBe(2);

    expect(result.history.inserted).toBe(2);
  });

  it("stores canonical history under the correct logical CASR session", () => {
    writeRecords(sourceOne, [messageRecord("one")]);

    writeRecords(sourceTwo, [messageRecord("two")]);

    sync([
      nativeSession("native-1", sourceOne),

      nativeSession("native-2", sourceTwo),
    ]);

    const sessionOne = repository.findSessionIdByNativeIdentity(
      "codex",
      "native-1",
    );

    const sessionTwo = repository.findSessionIdByNativeIdentity(
      "codex",
      "native-2",
    );

    expect(sessionOne).not.toBeNull();

    expect(sessionTwo).not.toBeNull();

    expect(sessionOne).not.toBe(sessionTwo);

    const events = new CanonicalEventRepository(database);

    const one = events.listBySession(sessionOne ?? "");

    const two = events.listBySession(sessionTwo ?? "");

    expect(one).toHaveLength(1);
    expect(two).toHaveLength(1);

    expect(one[0]?.source.nativeSessionId).toBe("native-1");

    expect(two[0]?.source.nativeSessionId).toBe("native-2");

    expect(
      new ImportCursorRepository(database).listBySession(sessionOne ?? ""),
    ).toHaveLength(1);
  });
});
