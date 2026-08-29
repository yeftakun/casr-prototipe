import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";

import Database from "better-sqlite3";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readCodexCanonicalHistoryBatch } from "../src/adapters/codex/codex-canonical-history-reader.js";

import { probeCodexSourceHealth } from "../src/adapters/codex/codex-source-health-probe.js";

import type { NativeSession } from "../src/core/session/native-session.js";

import { CanonicalImportService } from "../src/services/canonical-import-service.js";

import {
  SessionDiagnosticsService,
  type SourceContentProbe,
} from "../src/services/session-diagnostics-service.js";

import { runMigrations } from "../src/storage/migrations.js";

import { CanonicalEventRepository } from "../src/storage/repositories/canonical-event-repository.js";

import { ImportCursorRepository } from "../src/storage/repositories/import-cursor-repository.js";

import { SessionRegistryRepository } from "../src/storage/repositories/session-registry-repository.js";

describe("corruption and partial native history handling", () => {
  let database: Database.Database;

  let temporaryDirectory: string;

  let rolloutPath: string;

  let sessionId: string;

  let importer: CanonicalImportService;

  const sourceProbe: SourceContentProbe = (request) =>
    request.adapter === "codex" ? probeCodexSourceHealth(request) : null;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "casr-corruption-"));

    rolloutPath = join(temporaryDirectory, "rollout.jsonl");

    writeFileSync(rolloutPath, "", "utf8");

    database = new Database(":memory:");

    database.pragma("foreign_keys = ON");

    runMigrations(database);

    const registry = new SessionRegistryRepository(database);

    registry.syncNativeSession(nativeSession());

    const resolved = registry.findSessionIdByNativeIdentity(
      "codex",
      "native-corruption",
    );

    if (!resolved) {
      throw new Error("Test logical session was not created.");
    }

    sessionId = resolved;

    importer = new CanonicalImportService(
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

  function nativeSession(): NativeSession {
    return {
      adapter: "codex",

      nativeSessionId: "native-corruption",

      title: "Corruption Test",

      workspacePath: String.raw`C:\workspace\corruption`,

      nativePath: rolloutPath,

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

  function runImport() {
    return importer.importSource({
      sessionId,

      adapter: "codex",

      nativeSessionId: "native-corruption",

      nativeSource: rolloutPath,

      importedAt: "2026-08-30T05:00:00.000Z",
    });
  }

  function inspect() {
    const result = new SessionDiagnosticsService(
      database,
      undefined,
      sourceProbe,
    ).inspect(sessionId);

    if (!result) {
      throw new Error("Diagnostics returned null.");
    }

    return result;
  }

  it("stops repeatedly at a malformed record without skipping or duplicating evidence", () => {
    const before = messageRecord("before");

    const after = messageRecord("after");

    const prefix = `${before}\n`;

    writeFileSync(
      rolloutPath,
      [before, "{broken-json}", after, ""].join("\n"),
      "utf8",
    );

    const first = runImport();

    expect(first.stopReason).toBe("malformed_record");

    expect(first.inserted).toBe(1);

    expect(first.endRecordIndex).toBe(1);

    expect(first.endOffset).toBe(Buffer.byteLength(prefix, "utf8"));

    const diagnostic = inspect().imports[0];

    expect(diagnostic?.status).toBe("MALFORMED_RECORD");

    expect(diagnostic?.issueReason).toBe("malformed_record");

    expect(diagnostic?.issueRecordIndex).toBe(1);

    const second = runImport();

    expect(second.recordsRead).toBe(0);

    expect(second.inserted).toBe(0);

    expect(second.stopReason).toBe("malformed_record");

    expect(second.cursorStatus).toBe("unchanged");

    expect(
      new CanonicalEventRepository(database).countBySession(sessionId),
    ).toBe(1);
  });

  it("defers an incomplete final record and imports it once it becomes complete", () => {
    const first = messageRecord("before");

    const partial =
      '{"timestamp":"2026-08-29T01:00:01.000Z","type":"event_msg","payload":{"type":"task_started"';

    writeFileSync(rolloutPath, `${first}\n${partial}`, "utf8");

    const initial = runImport();

    expect(initial.inserted).toBe(1);

    expect(initial.stopReason).toBe("deferred_tail");

    let diagnostic = inspect().imports[0];

    expect(diagnostic?.status).toBe("DEFERRED_TAIL");

    expect(diagnostic?.issueReason).toBe("deferred_tail");

    appendFileSync(rolloutPath, "}}\n", "utf8");

    diagnostic = inspect().imports[0];

    expect(diagnostic?.status).toBe("SOURCE_GREW");

    expect(diagnostic?.pendingRecords).toBe(1);

    expect(diagnostic?.issueReason).toBeNull();

    const completed = runImport();

    expect(completed.inserted).toBe(1);

    expect(completed.stopReason).toBe("eof");

    diagnostic = inspect().imports[0];

    expect(diagnostic?.status).toBe("EOF");

    expect(diagnostic?.pendingRecords).toBe(0);

    expect(
      new CanonicalEventRepository(database).countBySession(sessionId),
    ).toBe(2);
  });

  it("does not rewind a cursor or delete canonical history when the native source is truncated", () => {
    const first = messageRecord("one");

    const second = lifecycleRecord();

    writeFileSync(rolloutPath, `${first}\n${second}\n`, "utf8");

    const imported = runImport();

    expect(imported.inserted).toBe(2);

    const cursorRepository = new ImportCursorRepository(database);

    const beforeCursor = cursorRepository.findByNativeSource(
      "codex",
      "native-corruption",
      rolloutPath,
    );

    expect(beforeCursor).not.toBeNull();

    writeFileSync(rolloutPath, `${first}\n`, "utf8");

    expect(inspect().imports[0]?.status).toBe("SOURCE_TRUNCATED");

    expect(() => runImport()).toThrow();

    const afterCursor = cursorRepository.findByNativeSource(
      "codex",
      "native-corruption",
      rolloutPath,
    );

    expect(afterCursor).toEqual(beforeCursor);

    expect(
      new CanonicalEventRepository(database).countBySession(sessionId),
    ).toBe(2);
  });

  it("reports pending safe records before a malformed appended record and imports only that safe prefix", () => {
    const first = messageRecord("one");

    writeFileSync(rolloutPath, `${first}\n`, "utf8");

    runImport();

    const second = messageRecord("two");

    appendFileSync(rolloutPath, `${second}\n{broken-json}\n`, "utf8");

    let diagnostic = inspect().imports[0];

    expect(diagnostic?.status).toBe("MALFORMED_RECORD");

    expect(diagnostic?.pendingRecords).toBe(1);

    expect(diagnostic?.issueRecordIndex).toBe(2);

    const result = runImport();

    expect(result.recordsRead).toBe(1);

    expect(result.inserted).toBe(1);

    expect(result.stopReason).toBe("malformed_record");

    diagnostic = inspect().imports[0];

    expect(diagnostic?.pendingRecords).toBe(0);

    expect(diagnostic?.status).toBe("MALFORMED_RECORD");

    expect(
      new CanonicalEventRepository(database).countBySession(sessionId),
    ).toBe(2);
  });
});
