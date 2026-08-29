import {
  appendFileSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";

import Database from "better-sqlite3";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runInspect } from "../src/cli/commands/inspect.js";

import type { CanonicalEventDraft } from "../src/core/events/canonical-event.js";

import type { NativeSession } from "../src/core/session/native-session.js";

import { SessionDiagnosticsService } from "../src/services/session-diagnostics-service.js";

import { runMigrations } from "../src/storage/migrations.js";

import { CanonicalEventRepository } from "../src/storage/repositories/canonical-event-repository.js";

import { ImportCursorRepository } from "../src/storage/repositories/import-cursor-repository.js";

import { SessionRegistryRepository } from "../src/storage/repositories/session-registry-repository.js";

describe("session import diagnostics", () => {
  let database: Database.Database;

  let temporaryDirectory: string;

  let sourcePath: string;

  let registry: SessionRegistryRepository;

  let sessionId: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "casr-diagnostics-"));

    sourcePath = join(temporaryDirectory, "rollout.jsonl");

    writeFileSync(sourcePath, "0123456789", "utf8");

    database = new Database(":memory:");

    database.pragma("foreign_keys = ON");

    runMigrations(database);

    registry = new SessionRegistryRepository(database);

    registry.syncNativeSession(nativeSession());

    const resolved = registry.findSessionIdByNativeIdentity(
      "codex",
      "native-diagnostics",
    );

    if (!resolved) {
      throw new Error("Test CASR session was not created.");
    }

    sessionId = resolved;
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

      nativeSessionId: "native-diagnostics",

      title: "Diagnostics Test",

      workspacePath: String.raw`C:\workspace\diagnostics`,

      nativePath: sourcePath,

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

  function draft(sourcePosition: number): CanonicalEventDraft {
    return {
      kind: "message",

      role: "user",

      occurredAt: "2026-08-29T01:00:00.000Z",

      payload: {
        text: `message-${sourcePosition}`,
      },

      source: {
        adapter: "codex",

        nativeSessionId: "native-diagnostics",

        nativeSource: sourcePath,

        sourcePosition,

        fingerprint: `fingerprint-${sourcePosition}`,

        nativeOrdinal: null,

        nativeTopLevelType: "response_item",

        nativePayloadType: "message",

        nativePayloadId: null,

        nativeTurnId: null,

        nativeCallId: null,
      },

      raw: {},
    };
  }

  function addEvents(count: number): void {
    const repository = new CanonicalEventRepository(database);

    repository.appendMany(
      Array.from(
        {
          length: count,
        },
        (_, sequence) => ({
          sessionId,
          sequence,

          importedAt: `2026-08-29T03:00:0${sequence}.000Z`,

          draft: draft(sequence),
        }),
      ),
    );
  }

  function saveCursor(input: {
    byteOffset: number;
    recordIndex: number;
    sourceFileSize: number;
  }): void {
    new ImportCursorRepository(database).save({
      sessionId,

      adapter: "codex",

      nativeSessionId: "native-diagnostics",

      nativeSource: sourcePath,

      byteOffset: input.byteOffset,

      recordIndex: input.recordIndex,

      sourceFileSize: input.sourceFileSize,

      lastRecordFingerprint:
        input.recordIndex > 0 ? "fingerprint-anchor" : null,

      savedAt: "2026-08-29T04:00:00.000Z",
    });
  }

  function inspect() {
    const result = new SessionDiagnosticsService(database).inspect(sessionId);

    if (!result) {
      throw new Error("Diagnostics unexpectedly returned null.");
    }

    return result;
  }

  it("reports NOT_IMPORTED before canonical history and cursor exist", () => {
    const result = inspect();

    expect(result.canonicalHistory.eventCount).toBe(0);

    expect(result.imports[0]?.status).toBe("NOT_IMPORTED");
  });

  it("reports MISSING_CURSOR when canonical history exists without a cursor", () => {
    addEvents(2);

    expect(inspect().imports[0]?.status).toBe("MISSING_CURSOR");
  });

  it("reports EOF when cursor and current file size are aligned", () => {
    addEvents(1);

    saveCursor({
      byteOffset: 10,
      recordIndex: 1,
      sourceFileSize: 10,
    });

    const source = inspect().imports[0];

    expect(source?.status).toBe("EOF");

    expect(source?.lagBytes).toBe(0);

    expect(source?.anchorPresent).toBe(true);
  });

  it("reports BEHIND when cursor is behind the checkpointed source size", () => {
    saveCursor({
      byteOffset: 5,
      recordIndex: 1,
      sourceFileSize: 10,
    });

    const source = inspect().imports[0];

    expect(source?.status).toBe("BEHIND");

    expect(source?.lagBytes).toBe(5);
  });

  it("reports SOURCE_GREW when native source has appended bytes after checkpoint", () => {
    saveCursor({
      byteOffset: 10,
      recordIndex: 1,
      sourceFileSize: 10,
    });

    appendFileSync(sourcePath, "ABCDE", "utf8");

    const source = inspect().imports[0];

    expect(source?.status).toBe("SOURCE_GREW");

    expect(source?.currentFileSize).toBe(15);

    expect(source?.lagBytes).toBe(5);
  });

  it("reports SOURCE_MISSING when the native source disappears", () => {
    saveCursor({
      byteOffset: 10,
      recordIndex: 1,
      sourceFileSize: 10,
    });

    unlinkSync(sourcePath);

    expect(inspect().imports[0]?.status).toBe("SOURCE_MISSING");
  });

  it("reports SOURCE_TRUNCATED when current file is smaller than the checkpoint", () => {
    saveCursor({
      byteOffset: 10,
      recordIndex: 1,
      sourceFileSize: 10,
    });

    writeFileSync(sourcePath, "123", "utf8");

    expect(inspect().imports[0]?.status).toBe("SOURCE_TRUNCATED");
  });

  it("summarizes canonical event count and sequence range without loading event payloads", () => {
    addEvents(3);

    const history = inspect().canonicalHistory;

    expect(history.eventCount).toBe(3);

    expect(history.firstSequence).toBe(0);

    expect(history.lastSequence).toBe(2);

    expect(history.lastImportedAt).toBe("2026-08-29T03:00:02.000Z");
  });

  it("prints human-readable diagnostics through inspect", () => {
    addEvents(1);

    saveCursor({
      byteOffset: 10,
      recordIndex: 1,
      sourceFileSize: 10,
    });

    const lines: string[] = [];

    runInspect(
      sessionId,
      {},
      {
        openDatabase: () => database,

        log: (value) => {
          lines.push(value);
        },

        error: () => {},

        setExitCode: () => {},
      },
    );

    const output = lines.join("\n");

    expect(output).toContain("Canonical History");

    expect(output).toContain("Import Diagnostics");

    expect(output).toContain("Status            : EOF");

    expect(output).toContain("Events          : 1");
  });

  it("prints structured diagnostics JSON", () => {
    addEvents(1);

    saveCursor({
      byteOffset: 10,
      recordIndex: 1,
      sourceFileSize: 10,
    });

    const lines: string[] = [];

    runInspect(
      sessionId,
      {
        json: true,
      },
      {
        openDatabase: () => database,

        log: (value) => {
          lines.push(value);
        },

        error: () => {},

        setExitCode: () => {},
      },
    );

    const parsed = JSON.parse(lines[0] ?? "{}") as {
      canonicalHistory: {
        eventCount: number;
      };

      imports: Array<{
        status: string;
      }>;
    };

    expect(parsed.canonicalHistory.eventCount).toBe(1);

    expect(parsed.imports[0]?.status).toBe("EOF");
  });
});
