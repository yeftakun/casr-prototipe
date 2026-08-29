import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";

import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readCodexCanonicalHistoryBatch } from "../src/adapters/codex/codex-canonical-history-reader.js";
import type { CanonicalEventDraft } from "../src/core/events/canonical-event.js";

import { CanonicalImportService } from "../src/services/canonical-import-service.js";
import { runMigrations } from "../src/storage/migrations.js";
import {
  CanonicalEventRepository,
  CanonicalSourceMutationError,
} from "../src/storage/repositories/canonical-event-repository.js";
import {
  ImportCursorOwnershipError,
  ImportCursorRepository,
} from "../src/storage/repositories/import-cursor-repository.js";

describe("Canonical import service", () => {
  let database: Database.Database;

  let temporaryDirectory: string;
  let rolloutPath: string;

  let service: CanonicalImportService;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "casr-import-test-"));

    rolloutPath = join(temporaryDirectory, "rollout.jsonl");

    database = new Database(":memory:");

    database.pragma("foreign_keys = ON");

    runMigrations(database);

    createSession("casr-test");

    createSession("casr-other");

    service = new CanonicalImportService(
      database,
      readCodexCanonicalHistoryBatch,
    );
  });

  afterEach(() => {
    database.close();

    rmSync(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  });

  function createSession(id: string): void {
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
        id,
        id,
        String.raw`C:\workspace\test`,
        "active",
        "2026-08-29T01:00:00.000Z",
        "2026-08-29T01:00:00.000Z",
      );
  }

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

  function lifecycleRecord(): string {
    return JSON.stringify({
      timestamp: "2026-08-29T01:00:01.000Z",

      type: "event_msg",

      payload: {
        type: "task_started",
        turn_id: "turn-1",
      },
    });
  }

  function writeRecords(records: string[]): void {
    writeFileSync(rolloutPath, `${records.join("\n")}\n`, "utf8");
  }

  function runImport(sessionId = "casr-test") {
    return service.importSource({
      sessionId,

      adapter: "codex",

      nativeSessionId: "native-session-1",

      nativeSource: rolloutPath,

      importedAt: "2026-08-29T10:00:00.000Z",
    });
  }

  it("imports a complete native source and advances cursor to EOF", () => {
    writeRecords([messageRecord("one"), lifecycleRecord()]);

    const result = runImport();

    expect(result.inserted).toBe(2);

    expect(result.alreadyKnown).toBe(0);

    expect(result.recordsRead).toBe(2);

    expect(result.endRecordIndex).toBe(2);

    expect(result.endOffset).toBe(result.observedFileSize);

    expect(result.stopReason).toBe("eof");

    const events = new CanonicalEventRepository(database);

    expect(events.countBySession("casr-test")).toBe(2);

    expect(
      events.listBySession("casr-test").map((event) => event.sequence),
    ).toEqual([0, 1]);
  });

  it("is a no-op when an EOF cursor is imported again", () => {
    writeRecords([messageRecord("one"), lifecycleRecord()]);

    const first = runImport();

    const second = runImport();

    expect(first.inserted).toBe(2);

    expect(second.inserted).toBe(0);

    expect(second.alreadyKnown).toBe(0);

    expect(second.recordsRead).toBe(0);

    expect(second.cursorStatus).toBe("unchanged");

    expect(second.startRecordIndex).toBe(2);

    expect(second.endRecordIndex).toBe(2);
  });

  it("imports only records appended after the persisted cursor", () => {
    writeRecords([messageRecord("one")]);

    const first = runImport();

    appendFileSync(rolloutPath, `${lifecycleRecord()}\n`, "utf8");

    const second = runImport();

    expect(first.inserted).toBe(1);

    expect(second.recordsRead).toBe(1);

    expect(second.inserted).toBe(1);

    expect(second.startRecordIndex).toBe(1);

    expect(second.endRecordIndex).toBe(2);

    expect(
      new CanonicalEventRepository(database).countBySession("casr-test"),
    ).toBe(2);
  });

  it("recovers from a missing cursor without duplicating canonical history", () => {
    writeRecords([messageRecord("one"), lifecycleRecord()]);

    runImport();

    database.exec("DELETE FROM import_cursors;");

    const recovered = runImport();

    expect(recovered.recordsRead).toBe(2);

    expect(recovered.inserted).toBe(0);

    expect(recovered.alreadyKnown).toBe(2);

    expect(recovered.cursorStatus).toBe("created");

    expect(
      new CanonicalEventRepository(database).countBySession("casr-test"),
    ).toBe(2);
  });

  it("imports the safe prefix and stops before a malformed middle record", () => {
    const validBefore = messageRecord("before");

    const validAfter = messageRecord("after");

    writeFileSync(
      rolloutPath,
      [validBefore, "{broken-json}", validAfter, ""].join("\n"),
      "utf8",
    );

    const result = runImport();

    expect(result.recordsRead).toBe(1);

    expect(result.inserted).toBe(1);

    expect(result.endRecordIndex).toBe(1);

    expect(result.stopReason).toBe("malformed_record");

    expect(
      new CanonicalEventRepository(database).countBySession("casr-test"),
    ).toBe(1);
  });

  it("defers an incomplete tail and imports it after the native record becomes complete", () => {
    const first = messageRecord("before");

    const partial =
      '{"timestamp":"2026-08-29T01:00:01.000Z","type":"event_msg","payload":{"type":"task_started"';

    writeFileSync(rolloutPath, `${first}\n${partial}`, "utf8");

    const initial = runImport();

    expect(initial.recordsRead).toBe(1);

    expect(initial.stopReason).toBe("deferred_tail");

    appendFileSync(rolloutPath, "}}\n", "utf8");

    const completed = runImport();

    expect(completed.recordsRead).toBe(1);

    expect(completed.inserted).toBe(1);

    expect(completed.stopReason).toBe("eof");

    expect(completed.endRecordIndex).toBe(2);
  });

  it("detects native source mutation when cursor recovery re-reads an existing source position", () => {
    writeRecords([messageRecord("original")]);

    runImport();

    database.exec("DELETE FROM import_cursors;");

    writeRecords([messageRecord("mutated")]);

    expect(() => {
      runImport();
    }).toThrow(CanonicalSourceMutationError);

    expect(
      new CanonicalEventRepository(database).countBySession("casr-test"),
    ).toBe(1);

    expect(
      new ImportCursorRepository(database).findByNativeSource(
        "codex",
        "native-session-1",
        rolloutPath,
      ),
    ).toBeNull();
  });

  it("rolls back newly inserted canonical events when cursor ownership rejects the update", () => {
    writeRecords([messageRecord("one")]);

    const fileSize = Buffer.byteLength(`${messageRecord("one")}\n`, "utf8");

    new ImportCursorRepository(database).save({
      sessionId: "casr-other",

      adapter: "codex",

      nativeSessionId: "native-session-1",

      nativeSource: rolloutPath,

      byteOffset: 0,
      recordIndex: 0,

      sourceFileSize: fileSize,

      lastRecordFingerprint: null,

      savedAt: "2026-08-29T09:00:00.000Z",
    });

    expect(() => {
      runImport("casr-test");
    }).toThrow(ImportCursorOwnershipError);

    expect(
      new CanonicalEventRepository(database).countBySession("casr-test"),
    ).toBe(0);
  });

  it("does not create a cursor when canonical event persistence fails", () => {
    writeRecords([messageRecord("one")]);

    expect(() => {
      runImport("casr-missing");
    }).toThrow();

    expect(
      database
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM canonical_events
          `,
        )
        .get(),
    ).toEqual({
      count: 0,
    });

    expect(
      new ImportCursorRepository(database).findByNativeSource(
        "codex",
        "native-session-1",
        rolloutPath,
      ),
    ).toBeNull();
  });

  it("rejects provenance returned by a misbehaving history reader before writing anything", () => {
    const badDraft: CanonicalEventDraft = {
      kind: "message",
      role: "user",

      occurredAt: "2026-08-29T01:00:00.000Z",

      payload: {
        text: "bad provenance",
      },

      source: {
        adapter: "wrong-adapter",

        nativeSessionId: "native-session-1",

        nativeSource: rolloutPath,

        sourcePosition: 0,

        fingerprint: "fingerprint",

        nativeOrdinal: null,

        nativeTopLevelType: null,

        nativePayloadType: null,

        nativePayloadId: null,

        nativeTurnId: null,

        nativeCallId: null,
      },

      raw: {},
    };

    const badService = new CanonicalImportService(database, () => ({
      drafts: [badDraft],

      fileSize: 10,
      nextOffset: 10,
      nextRecordIndex: 1,

      stopReason: "eof",
    }));

    expect(() => {
      badService.importSource({
        sessionId: "casr-test",

        adapter: "codex",

        nativeSessionId: "native-session-1",

        nativeSource: rolloutPath,
      });
    }).toThrow(/adapter mismatch/);

    expect(
      new CanonicalEventRepository(database).countBySession("casr-test"),
    ).toBe(0);

    expect(
      new ImportCursorRepository(database).findByNativeSource(
        "codex",
        "native-session-1",
        rolloutPath,
      ),
    ).toBeNull();
  });
});
