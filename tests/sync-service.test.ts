import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { NativeSession } from "../src/core/session/native-session.js";
import { syncNativeSessions } from "../src/core/session/sync-service.js";
import { runMigrations } from "../src/storage/migrations.js";
import { SessionRegistryRepository } from "../src/storage/repositories/session-registry-repository.js";

describe("CASR session sync", () => {
  let database: Database.Database;
  let repository: SessionRegistryRepository;

  const sessionOne: NativeSession = {
    adapter: "codex",
    nativeSessionId: "native-1",
    title: "Session One",
    workspacePath: String.raw`C:\workspace\one`,
    nativePath: String.raw`C:\codex\one.jsonl`,
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

  const sessionTwo: NativeSession = {
    ...sessionOne,
    nativeSessionId: "native-2",
    title: "Session Two",
    workspacePath: String.raw`C:\workspace\two`,
    nativePath: String.raw`C:\codex\two.jsonl`,
    createdAt: "2026-08-29T03:00:00.000Z",
    updatedAt: "2026-08-29T04:00:00.000Z",
  };

  beforeEach(() => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");

    runMigrations(database);

    repository = new SessionRegistryRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  it("imports sessions once and leaves them unchanged on repeated sync", () => {
    const first = syncNativeSessions(repository, [sessionOne, sessionTwo]);

    expect(first).toEqual({
      discovered: 2,
      imported: 2,
      updated: 0,
      unchanged: 0,
    });

    const second = syncNativeSessions(repository, [sessionOne, sessionTwo]);

    expect(second).toEqual({
      discovered: 2,
      imported: 0,
      updated: 0,
      unchanged: 2,
    });

    const sessionCount = database
      .prepare("SELECT COUNT(*) AS count FROM sessions")
      .get() as { count: number };

    const bindingCount = database
      .prepare("SELECT COUNT(*) AS count FROM native_sessions")
      .get() as { count: number };

    expect(sessionCount.count).toBe(2);
    expect(bindingCount.count).toBe(2);
  });

  it("updates an existing binding without changing its CASR identity", () => {
    syncNativeSessions(repository, [sessionOne]);

    const originalSessionId = repository.findSessionIdByNativeIdentity(
      "codex",
      "native-1",
    );

    const changedSession: NativeSession = {
      ...sessionOne,
      title: "Session One Updated",
      model: "gpt-test-new",
      updatedAt: "2026-08-29T05:00:00.000Z",
    };

    const result = syncNativeSessions(repository, [changedSession]);

    expect(result).toEqual({
      discovered: 1,
      imported: 0,
      updated: 1,
      unchanged: 0,
    });

    const currentSessionId = repository.findSessionIdByNativeIdentity(
      "codex",
      "native-1",
    );

    expect(currentSessionId).toBe(originalSessionId);

    const row = database
      .prepare(
        `
          SELECT
            s.title,
            s.updated_at,
            ns.model
          FROM sessions s
          JOIN native_sessions ns
            ON ns.session_id = s.id
          WHERE s.id = ?
        `,
      )
      .get(currentSessionId) as {
      title: string;
      updated_at: string;
      model: string | null;
    };

    expect(row.title).toBe("Session One Updated");
    expect(row.model).toBe("gpt-test-new");
    expect(row.updated_at).toBe("2026-08-29T05:00:00.000Z");
  });
});
