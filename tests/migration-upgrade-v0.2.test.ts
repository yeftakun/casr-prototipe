import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../src/storage/migrations.js";

describe("CASR v0.1 to v0.2 migration upgrade", () => {
  let database: Database.Database;

  beforeEach(() => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");

    const migrationV1Path = fileURLToPath(
      new URL("../migrations/0001_initial.sql", import.meta.url),
    );

    const migrationV1Sql = readFileSync(migrationV1Path, "utf8");

    database.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    database.exec(migrationV1Sql);

    database
      .prepare(
        `
          INSERT INTO schema_migrations (
            version,
            name,
            applied_at
          )
          VALUES (?, ?, ?)
        `,
      )
      .run(1, "initial", "2026-08-29T00:00:00.000Z");

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
        "casr-existing",
        "Existing v0.1 session",
        String.raw`C:\workspace\existing`,
        "active",
        "2026-08-29T01:00:00.000Z",
        "2026-08-29T02:00:00.000Z",
      );

    database
      .prepare(
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
      )
      .run(
        "binding-existing",
        "casr-existing",
        "codex",
        "native-existing",
        String.raw`C:\codex\sessions\existing.jsonl`,
        "openai",
        "gpt-test",
        JSON.stringify({
          source: "cli",
        }),
        "2026-08-29T01:00:00.000Z",
        "2026-08-29T02:00:00.000Z",
      );
  });

  afterEach(() => {
    database.close();
  });

  it("upgrades an existing v0.1 registry without losing data", () => {
    runMigrations(database);

    const migrations = database
      .prepare(
        `
          SELECT
            version,
            name
          FROM schema_migrations
          ORDER BY version
        `,
      )
      .all();

    expect(migrations).toEqual([
      {
        version: 1,
        name: "initial",
      },
      {
        version: 2,
        name: "canonical_events",
      },
    ]);

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
      .get("casr-existing") as {
      id: string;
      title: string;
      workspace_path: string;
      status: string;
    };

    expect(session).toEqual({
      id: "casr-existing",
      title: "Existing v0.1 session",
      workspace_path: String.raw`C:\workspace\existing`,
      status: "active",
    });

    const binding = database
      .prepare(
        `
          SELECT
            id,
            session_id,
            adapter,
            native_session_id,
            native_path,
            provider,
            model
          FROM native_sessions
          WHERE id = ?
        `,
      )
      .get("binding-existing") as {
      id: string;
      session_id: string;
      adapter: string;
      native_session_id: string;
      native_path: string;
      provider: string;
      model: string | null;
    };

    expect(binding).toEqual({
      id: "binding-existing",
      session_id: "casr-existing",
      adapter: "codex",
      native_session_id: "native-existing",
      native_path: String.raw`C:\codex\sessions\existing.jsonl`,
      provider: "openai",
      model: "gpt-test",
    });

    const canonicalTable = database
      .prepare(
        `
          SELECT name
          FROM sqlite_master
          WHERE type = 'table'
            AND name = 'canonical_events'
        `,
      )
      .get() as
      | {
          name: string;
        }
      | undefined;

    expect(canonicalTable?.name).toBe("canonical_events");

    const canonicalCount = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM canonical_events
        `,
      )
      .get() as {
      count: number;
    };

    expect(canonicalCount.count).toBe(0);
  });

  it("allows canonical events to reference a pre-existing v0.1 session after upgrade", () => {
    runMigrations(database);

    database
      .prepare(
        `
          INSERT INTO canonical_events (
            id,
            session_id,
            sequence,
            event_kind,
            role,
            occurred_at,
            imported_at,
            payload_json,
            raw_json,
            adapter,
            native_session_id,
            native_source,
            source_position,
            fingerprint,
            native_ordinal,
            native_top_level_type,
            native_payload_type,
            native_payload_id,
            native_turn_id,
            native_call_id
          )
          VALUES (
            @id,
            @sessionId,
            @sequence,
            @eventKind,
            @role,
            @occurredAt,
            @importedAt,
            @payloadJson,
            @rawJson,
            @adapter,
            @nativeSessionId,
            @nativeSource,
            @sourcePosition,
            @fingerprint,
            @nativeOrdinal,
            @nativeTopLevelType,
            @nativePayloadType,
            @nativePayloadId,
            @nativeTurnId,
            @nativeCallId
          )
        `,
      )
      .run({
        id: "event-existing-session",
        sessionId: "casr-existing",
        sequence: 0,
        eventKind: "message",
        role: "user",
        occurredAt: "2026-08-29T03:00:00.000Z",
        importedAt: "2026-08-29T03:01:00.000Z",
        payloadJson: JSON.stringify({
          text: "upgrade test",
        }),
        rawJson: JSON.stringify({
          type: "response_item",
        }),
        adapter: "codex",
        nativeSessionId: "native-existing",
        nativeSource: String.raw`C:\codex\sessions\existing.jsonl`,
        sourcePosition: 0,
        fingerprint: "upgrade-fingerprint",
        nativeOrdinal: null,
        nativeTopLevelType: "response_item",
        nativePayloadType: "message",
        nativePayloadId: null,
        nativeTurnId: null,
        nativeCallId: null,
      });

    const event = database
      .prepare(
        `
          SELECT
            session_id,
            sequence,
            event_kind,
            adapter,
            native_session_id
          FROM canonical_events
          WHERE id = ?
        `,
      )
      .get("event-existing-session") as {
      session_id: string;
      sequence: number;
      event_kind: string;
      adapter: string;
      native_session_id: string;
    };

    expect(event).toEqual({
      session_id: "casr-existing",
      sequence: 0,
      event_kind: "message",
      adapter: "codex",
      native_session_id: "native-existing",
    });
  });
});
