import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../src/storage/migrations.js";

import {
  ImportCursorAnchorMutationError,
  ImportCursorOwnershipError,
  ImportCursorRegressionError,
  ImportCursorRepository,
} from "../src/storage/repositories/import-cursor-repository.js";

describe("Import cursor repository", () => {
  let database: Database.Database;
  let repository: ImportCursorRepository;

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
        "casr-test",
        "Cursor test",
        String.raw`C:\workspace\cursor`,
        "active",
        "2026-08-29T01:00:00.000Z",
        "2026-08-29T01:00:00.000Z",
      );

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
        "casr-other",
        "Other cursor owner",
        String.raw`C:\workspace\other`,
        "active",
        "2026-08-29T01:00:00.000Z",
        "2026-08-29T01:00:00.000Z",
      );

    repository = new ImportCursorRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  function save(
    overrides: Partial<{
      sessionId: string;
      byteOffset: number;
      recordIndex: number;
      sourceFileSize: number;
      lastRecordFingerprint: string | null;
      savedAt: string;
    }> = {},
  ) {
    return repository.save({
      sessionId: overrides.sessionId ?? "casr-test",

      adapter: "codex",

      nativeSessionId: "native-session-1",

      nativeSource: "rollout-example.jsonl",

      byteOffset: overrides.byteOffset ?? 0,

      recordIndex: overrides.recordIndex ?? 0,

      sourceFileSize: overrides.sourceFileSize ?? 1000,

      lastRecordFingerprint:
        overrides.lastRecordFingerprint === undefined
          ? null
          : overrides.lastRecordFingerprint,

      savedAt: overrides.savedAt ?? "2026-08-29T02:00:00.000Z",
    });
  }

  it("creates an initial cursor", () => {
    const result = save();

    expect(result.status).toBe("created");

    expect(result.cursor.id).toMatch(
      /^cursor_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    expect(result.cursor.byteOffset).toBe(0);

    expect(result.cursor.recordIndex).toBe(0);

    expect(result.cursor.lastRecordFingerprint).toBeNull();
  });

  it("advances a cursor monotonically", () => {
    save();

    const result = save({
      byteOffset: 500,
      recordIndex: 5,
      lastRecordFingerprint: "sha256:anchor-5",
      savedAt: "2026-08-29T03:00:00.000Z",
    });

    expect(result.status).toBe("updated");

    expect(result.cursor.byteOffset).toBe(500);

    expect(result.cursor.recordIndex).toBe(5);

    expect(result.cursor.lastRecordFingerprint).toBe("sha256:anchor-5");

    expect(result.cursor.updatedAt).toBe("2026-08-29T03:00:00.000Z");
  });

  it("returns unchanged for identical progress", () => {
    const first = save({
      byteOffset: 500,
      recordIndex: 5,
      lastRecordFingerprint: "sha256:anchor-5",
    });

    const second = save({
      byteOffset: 500,
      recordIndex: 5,
      lastRecordFingerprint: "sha256:anchor-5",
      savedAt: "2026-08-29T05:00:00.000Z",
    });

    expect(second.status).toBe("unchanged");

    expect(second.cursor.id).toBe(first.cursor.id);

    expect(second.cursor.updatedAt).toBe(first.cursor.updatedAt);
  });

  it("rejects byte offset regression", () => {
    save({
      byteOffset: 500,
      recordIndex: 5,
      lastRecordFingerprint: "sha256:anchor-5",
    });

    expect(() => {
      save({
        byteOffset: 400,
        recordIndex: 5,
        lastRecordFingerprint: "sha256:anchor-5",
      });
    }).toThrow(ImportCursorRegressionError);
  });

  it("rejects record index regression", () => {
    save({
      byteOffset: 500,
      recordIndex: 5,
      lastRecordFingerprint: "sha256:anchor-5",
    });

    expect(() => {
      save({
        byteOffset: 600,
        recordIndex: 4,
        lastRecordFingerprint: "sha256:anchor-4",
      });
    }).toThrow(ImportCursorRegressionError);
  });

  it("detects anchor mutation at the same physical cursor position", () => {
    save({
      byteOffset: 500,
      recordIndex: 5,
      lastRecordFingerprint: "sha256:original",
    });

    expect(() => {
      save({
        byteOffset: 500,
        recordIndex: 5,
        lastRecordFingerprint: "sha256:mutated",
      });
    }).toThrow(ImportCursorAnchorMutationError);
  });

  it("rejects cursor offsets beyond observed file size", () => {
    expect(() => {
      save({
        byteOffset: 1001,
        sourceFileSize: 1000,
      });
    }).toThrow(/byteOffset cannot exceed sourceFileSize/);
  });

  it("rejects observed native source size regression", () => {
    save({
      byteOffset: 500,
      recordIndex: 5,
      sourceFileSize: 1000,
      lastRecordFingerprint: "sha256:anchor-5",
    });

    expect(() => {
      save({
        byteOffset: 500,
        recordIndex: 5,
        sourceFileSize: 900,
        lastRecordFingerprint: "sha256:anchor-5",
      });
    }).toThrow(ImportCursorRegressionError);
  });

  it("protects cursor ownership between CASR sessions", () => {
    save({
      byteOffset: 500,
      recordIndex: 5,
      lastRecordFingerprint: "sha256:anchor-5",
    });

    expect(() => {
      save({
        sessionId: "casr-other",
        byteOffset: 600,
        recordIndex: 6,
        lastRecordFingerprint: "sha256:anchor-6",
      });
    }).toThrow(ImportCursorOwnershipError);
  });

  it("lists cursors by session and cascades deletion", () => {
    save();

    expect(repository.listBySession("casr-test")).toHaveLength(1);

    database
      .prepare(
        `
          DELETE FROM sessions
          WHERE id = ?
        `,
      )
      .run("casr-test");

    expect(repository.listBySession("casr-test")).toHaveLength(0);
  });
});
