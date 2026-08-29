import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../src/storage/migrations.js";
import { SessionQueryRepository } from "../src/storage/repositories/session-query-repository.js";

describe("SessionQueryRepository", () => {
  let database: Database.Database;

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
        "casr-old",
        "Older Session",
        String.raw`C:\workspace\old`,
        "active",
        "2026-08-29T01:00:00.000Z",
        "2026-08-29T02:00:00.000Z",
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
        "casr-new",
        "Newer Session",
        String.raw`C:\workspace\new`,
        "active",
        "2026-08-29T03:00:00.000Z",
        "2026-08-29T04:00:00.000Z",
      );

    const insertBinding = database.prepare(
      `
        INSERT INTO native_sessions (
          id,
          session_id,
          adapter,
          native_session_id,
          native_path,
          provider,
          model,
          metadata_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );

    insertBinding.run(
      "binding-old",
      "casr-old",
      "codex",
      "native-old",
      String.raw`C:\codex\old.jsonl`,
      "openai",
      "gpt-test",
      "{}",
      "2026-08-29T01:00:00.000Z",
      "2026-08-29T02:00:00.000Z",
    );

    insertBinding.run(
      "binding-new",
      "casr-new",
      "codex",
      "native-new",
      String.raw`C:\codex\new.jsonl`,
      "openai",
      "gpt-test",
      "{}",
      "2026-08-29T03:00:00.000Z",
      "2026-08-29T04:00:00.000Z",
    );
  });

  afterEach(() => {
    database.close();
  });

  it("lists sessions ordered by most recently updated", () => {
    const repository = new SessionQueryRepository(database);

    const sessions = repository.listSessions();

    expect(sessions).toHaveLength(2);

    expect(sessions.map((session) => session.id)).toEqual([
      "casr-new",
      "casr-old",
    ]);
  });

  it("returns human-facing session metadata", () => {
    const repository = new SessionQueryRepository(database);

    const [session] = repository.listSessions();

    expect(session).toEqual({
      id: "casr-new",
      title: "Newer Session",
      workspacePath: String.raw`C:\workspace\new`,
      status: "active",
      adapter: "codex",
      updatedAt: "2026-08-29T04:00:00.000Z",
    });
  });

  it("returns session detail by CASR ID", () => {
    const repository = new SessionQueryRepository(database);

    const session = repository.getSessionById("casr-new");

    expect(session?.id).toBe("casr-new");
    expect(session?.nativeBinding.adapter).toBe("codex");
    expect(session?.nativeBinding.nativeSessionId).toBe("native-new");
    expect(session?.nativeBinding.provider).toBe("openai");
    expect(session?.nativeBinding.model).toBe("gpt-test");
  });

  it("returns null for unknown CASR ID", () => {
    const repository = new SessionQueryRepository(database);

    expect(repository.getSessionById("casr-does-not-exist")).toBeNull();
  });
});
