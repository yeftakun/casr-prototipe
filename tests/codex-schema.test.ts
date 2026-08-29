import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertSupportedCodexSchema,
  inspectCodexSchema,
  REQUIRED_CODEX_THREAD_COLUMNS,
} from "../src/adapters/codex/codex-schema.js";

describe("Codex schema compatibility", () => {
  let database: Database.Database;

  beforeEach(() => {
    database = new Database(":memory:");
  });

  afterEach(() => {
    database.close();
  });

  it("reports missing threads table", () => {
    const result = inspectCodexSchema(database);

    expect(result.threadsTableExists).toBe(false);
    expect(result.supported).toBe(false);
    expect(result.missingColumns).toEqual([...REQUIRED_CODEX_THREAD_COLUMNS]);
  });

  it("reports missing required columns", () => {
    database.exec(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        title TEXT
      );
    `);

    const result = inspectCodexSchema(database);

    expect(result.threadsTableExists).toBe(true);
    expect(result.supported).toBe(false);

    expect(result.missingColumns).toContain("cwd");
    expect(result.missingColumns).toContain("rollout_path");
    expect(result.missingColumns).toContain("updated_at");
  });

  it("accepts the supported MVP Codex schema", () => {
    database.exec(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        title TEXT,
        cwd TEXT,
        model_provider TEXT,
        model TEXT,
        reasoning_effort TEXT,
        rollout_path TEXT,
        source TEXT,
        thread_source TEXT,
        history_mode TEXT,
        project_id TEXT,
        archived INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      );
    `);

    const result = inspectCodexSchema(database);

    expect(result).toEqual({
      threadsTableExists: true,
      supported: true,
      missingColumns: [],
    });

    expect(() => assertSupportedCodexSchema(database)).not.toThrow();
  });

  it("throws a clear compatibility error", () => {
    database.exec(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        title TEXT
      );
    `);

    expect(() => assertSupportedCodexSchema(database)).toThrow(
      /Unsupported Codex storage schema/,
    );

    expect(() => assertSupportedCodexSchema(database)).toThrow(/rollout_path/);
  });
});
