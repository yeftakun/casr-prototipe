import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CodexAdapter } from "../src/adapters/codex/codex-adapter.js";

describe("CodexAdapter", () => {
  let codexHome: string;

  beforeEach(() => {
    codexHome = mkdtempSync(join(tmpdir(), "casr-codex-test-"));

    const database = new Database(join(codexHome, "state_5.sqlite"));

    database.exec(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        cwd TEXT NOT NULL,
        model_provider TEXT NOT NULL,
        model TEXT,
        reasoning_effort TEXT,
        rollout_path TEXT NOT NULL,
        source TEXT NOT NULL,
        thread_source TEXT,
        history_mode TEXT NOT NULL,
        project_id TEXT,
        archived INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    const insert = database.prepare(`
      INSERT INTO threads (
        id,
        title,
        cwd,
        model_provider,
        model,
        reasoning_effort,
        rollout_path,
        source,
        thread_source,
        history_mode,
        project_id,
        archived,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @title,
        @cwd,
        @model_provider,
        @model,
        @reasoning_effort,
        @rollout_path,
        @source,
        @thread_source,
        @history_mode,
        @project_id,
        @archived,
        @created_at,
        @updated_at
      );
    `);

    insert.run({
      id: "session-older",
      title: "Older session",
      cwd: String.raw`C:\workspace\older`,
      model_provider: "openai",
      model: null,
      reasoning_effort: null,
      rollout_path: String.raw`C:\codex\sessions\older.jsonl`,
      source: "cli",
      thread_source: null,
      history_mode: "legacy",
      project_id: null,
      archived: 1,
      created_at: 1_700_000_000,
      updated_at: 1_700_000_100,
    });

    insert.run({
      id: "session-newer",
      title: "Newer session",
      cwd: String.raw`\\?\C:\workspace\newer`,
      model_provider: "openai",
      model: "gpt-test",
      reasoning_effort: "medium",
      rollout_path: String.raw`\\?\C:\codex\sessions\newer.jsonl`,
      source: "vscode",
      thread_source: "user",
      history_mode: "paginated",
      project_id: "project-1",
      archived: 0,
      created_at: 1_800_000_000,
      updated_at: 1_800_000_200,
    });

    database.close();
  });

  afterEach(() => {
    rmSync(codexHome, {
      recursive: true,
      force: true,
    });
  });

  it("discovers and normalizes native Codex sessions", () => {
    const adapter = new CodexAdapter(codexHome);

    const sessions = adapter.discoverSessions();

    expect(sessions).toHaveLength(2);

    expect(sessions[0]).toEqual({
      adapter: "codex",
      nativeSessionId: "session-newer",
      title: "Newer session",
      workspacePath: String.raw`\\?\C:\workspace\newer`,
      nativePath: String.raw`\\?\C:\codex\sessions\newer.jsonl`,
      provider: "openai",
      model: "gpt-test",
      reasoningEffort: "medium",
      source: "vscode",
      threadSource: "user",
      historyMode: "paginated",
      projectId: "project-1",
      archived: false,
      createdAt: new Date(1_800_000_000 * 1000).toISOString(),
      updatedAt: new Date(1_800_000_200 * 1000).toISOString(),
    });
  });

  it("preserves nullable fields and converts archived state", () => {
    const adapter = new CodexAdapter(codexHome);

    const sessions = adapter.discoverSessions();
    const older = sessions[1];

    expect(older.nativeSessionId).toBe("session-older");
    expect(older.model).toBeNull();
    expect(older.reasoningEffort).toBeNull();
    expect(older.threadSource).toBeNull();
    expect(older.projectId).toBeNull();
    expect(older.archived).toBe(true);
  });

  it("orders sessions by most recently updated first", () => {
    const adapter = new CodexAdapter(codexHome);

    const sessions = adapter.discoverSessions();

    expect(sessions.map((session) => session.nativeSessionId)).toEqual([
      "session-newer",
      "session-older",
    ]);
  });
});
