import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { NativeSession } from "../src/core/session/native-session.js";
import { createCasrSessionId } from "../src/core/session/session-id.js";
import { runMigrations } from "../src/storage/migrations.js";
import { SessionRegistryRepository } from "../src/storage/repositories/session-registry-repository.js";

describe("CASR session registry", () => {
  let database: Database.Database;
  let repository: SessionRegistryRepository;

  const nativeSession: NativeSession = {
    adapter: "codex",
    nativeSessionId: "native-session-1",
    title: "Test session",
    workspacePath: String.raw`C:\workspace\test`,
    nativePath: String.raw`C:\codex\sessions\test.jsonl`,
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

  beforeEach(() => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");

    runMigrations(database);

    repository = new SessionRegistryRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  it("creates a prefixed UUIDv7 CASR session ID", () => {
    const sessionId = createCasrSessionId();

    expect(sessionId).toMatch(
      /^casr_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("creates a CASR session and native binding", () => {
    const sessionId = repository.createFromNativeSession(nativeSession);

    const session = database
      .prepare(
        `
          SELECT
            id,
            title,
            workspace_path,
            status
          FROM sessions
          WHERE id = ?
        `,
      )
      .get(sessionId) as {
      id: string;
      title: string;
      workspace_path: string;
      status: string;
    };

    expect(session.id).toBe(sessionId);
    expect(session.title).toBe("Test session");
    expect(session.workspace_path).toBe(String.raw`C:\workspace\test`);
    expect(session.status).toBe("active");

    const binding = database
      .prepare(
        `
          SELECT
            session_id,
            adapter,
            native_session_id,
            provider,
            model
          FROM native_sessions
          WHERE session_id = ?
        `,
      )
      .get(sessionId) as {
      session_id: string;
      adapter: string;
      native_session_id: string;
      provider: string;
      model: string | null;
    };

    expect(binding.session_id).toBe(sessionId);
    expect(binding.adapter).toBe("codex");
    expect(binding.native_session_id).toBe("native-session-1");
    expect(binding.provider).toBe("openai");
    expect(binding.model).toBe("gpt-test");
  });

  it("preserves remaining native metadata as JSON", () => {
    const sessionId = repository.createFromNativeSession(nativeSession);

    const row = database
      .prepare(
        `
          SELECT metadata_json
          FROM native_sessions
          WHERE session_id = ?
        `,
      )
      .get(sessionId) as {
      metadata_json: string;
    };

    expect(JSON.parse(row.metadata_json)).toEqual({
      reasoningEffort: "medium",
      source: "cli",
      threadSource: "user",
      historyMode: "paginated",
      projectId: null,
      archived: false,
    });
  });

  it("finds an existing session by native identity", () => {
    const sessionId = repository.createFromNativeSession(nativeSession);

    expect(
      repository.findSessionIdByNativeIdentity("codex", "native-session-1"),
    ).toBe(sessionId);

    expect(
      repository.findSessionIdByNativeIdentity("codex", "does-not-exist"),
    ).toBeNull();
  });
});
