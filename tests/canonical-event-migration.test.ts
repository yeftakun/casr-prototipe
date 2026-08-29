import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../src/storage/migrations.js";

interface EventOverrides {
  id?: string;
  sessionId?: string;
  sequence?: number;
  eventKind?: string;
  role?: string | null;
  adapter?: string;
  nativeSessionId?: string;
  nativeSource?: string;
  sourcePosition?: number;
  fingerprint?: string;
}

describe("canonical event migration", () => {
  let database: Database.Database;
  let eventCounter: number;

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
        "Canonical event test",
        String.raw`C:\workspace\test`,
        "active",
        "2026-08-29T01:00:00.000Z",
        "2026-08-29T01:00:00.000Z",
      );

    eventCounter = 0;
  });

  afterEach(() => {
    database.close();
  });

  function insertEvent(overrides: EventOverrides = {}): void {
    const index = eventCounter++;

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
        id: overrides.id ?? `event-${index}`,
        sessionId: overrides.sessionId ?? "casr-test",
        sequence: overrides.sequence ?? index,
        eventKind: overrides.eventKind ?? "message",
        role: overrides.role === undefined ? "user" : overrides.role,
        occurredAt: "2026-08-29T01:00:00.000Z",
        importedAt: "2026-08-29T02:00:00.000Z",
        payloadJson: JSON.stringify({
          text: "test",
        }),
        rawJson: JSON.stringify({
          type: "response_item",
        }),
        adapter: overrides.adapter ?? "codex",
        nativeSessionId: overrides.nativeSessionId ?? "native-1",
        nativeSource: overrides.nativeSource ?? "rollout-example.jsonl",
        sourcePosition: overrides.sourcePosition ?? index,
        fingerprint: overrides.fingerprint ?? `fingerprint-${index}`,
        nativeOrdinal: null,
        nativeTopLevelType: "response_item",
        nativePayloadType: "message",
        nativePayloadId: null,
        nativeTurnId: "turn-1",
        nativeCallId: null,
      });
  }

  it("records canonical event migration", () => {
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
      {
        version: 3,
        name: "import_cursors",
      },
    ]);
  });

  it("runs migrations idempotently", () => {
    runMigrations(database);

    const result = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM schema_migrations
        `,
      )
      .get() as {
      count: number;
    };

    expect(result.count).toBe(3);
  });

  it("stores canonical event provenance", () => {
    insertEvent();

    const event = database
      .prepare(
        `
          SELECT
            session_id,
            sequence,
            event_kind,
            role,
            adapter,
            native_session_id,
            native_source,
            source_position,
            fingerprint,
            native_top_level_type,
            native_payload_type,
            native_turn_id
          FROM canonical_events
          WHERE id = ?
        `,
      )
      .get("event-0") as {
      session_id: string;
      sequence: number;
      event_kind: string;
      role: string | null;
      adapter: string;
      native_session_id: string;
      native_source: string;
      source_position: number;
      fingerprint: string;
      native_top_level_type: string | null;
      native_payload_type: string | null;
      native_turn_id: string | null;
    };

    expect(event).toEqual({
      session_id: "casr-test",
      sequence: 0,
      event_kind: "message",
      role: "user",
      adapter: "codex",
      native_session_id: "native-1",
      native_source: "rollout-example.jsonl",
      source_position: 0,
      fingerprint: "fingerprint-0",
      native_top_level_type: "response_item",
      native_payload_type: "message",
      native_turn_id: "turn-1",
    });
  });

  it("rejects provider vocabulary as canonical event kind", () => {
    expect(() => {
      insertEvent({
        eventKind: "response_item",
      });
    }).toThrow(/CHECK constraint failed/);
  });

  it("prevents duplicate canonical sequence within a session", () => {
    insertEvent({
      sequence: 0,
      sourcePosition: 0,
    });

    expect(() => {
      insertEvent({
        sequence: 0,
        sourcePosition: 1,
      });
    }).toThrow(/UNIQUE constraint failed/);
  });

  it("prevents duplicate native source position even with a different fingerprint", () => {
    insertEvent({
      sequence: 0,
      sourcePosition: 12,
      fingerprint: "fingerprint-original",
    });

    expect(() => {
      insertEvent({
        sequence: 1,
        sourcePosition: 12,
        fingerprint: "fingerprint-mutated",
      });
    }).toThrow(/UNIQUE constraint failed/);
  });

  it("deletes canonical events when their CASR session is deleted", () => {
    insertEvent();

    database
      .prepare(
        `
          DELETE FROM sessions
          WHERE id = ?
        `,
      )
      .run("casr-test");

    const result = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM canonical_events
        `,
      )
      .get() as {
      count: number;
    };

    expect(result.count).toBe(0);
  });
});
