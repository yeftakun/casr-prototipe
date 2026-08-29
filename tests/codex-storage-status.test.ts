import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { inspectCodexStorage } from "../src/adapters/codex/codex-environment.js";

describe("Codex storage status", () => {
  const temporaryDirectories: string[] = [];

  function createCodexHome(): string {
    const directory = mkdtempSync(join(tmpdir(), "casr-codex-home-"));

    temporaryDirectories.push(directory);

    mkdirSync(join(directory, "sessions"));

    return directory;
  }

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, {
        recursive: true,
        force: true,
      });
    }
  });

  it("reports a compatible Codex schema", () => {
    const codexHome = createCodexHome();
    const databasePath = join(codexHome, "state_5.sqlite");

    const database = new Database(databasePath);

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

    database.close();

    const status = inspectCodexStorage(codexHome);

    expect(status.stateDbReadable).toBe(true);
    expect(status.threadsTableExists).toBe(true);
    expect(status.schemaSupported).toBe(true);
    expect(status.missingColumns).toEqual([]);
    expect(status.threadCount).toBe(0);
  });

  it("reports an incompatible Codex schema", () => {
    const codexHome = createCodexHome();
    const databasePath = join(codexHome, "state_5.sqlite");

    const database = new Database(databasePath);

    database.exec(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        title TEXT
      );
    `);

    database.close();

    const status = inspectCodexStorage(codexHome);

    expect(status.stateDbReadable).toBe(true);
    expect(status.threadsTableExists).toBe(true);
    expect(status.schemaSupported).toBe(false);
    expect(status.missingColumns).toContain("rollout_path");
  });
});
