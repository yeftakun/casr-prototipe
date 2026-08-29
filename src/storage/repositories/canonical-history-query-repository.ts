import type Database from "better-sqlite3";

import {
  type CanonicalEvent,
  type CanonicalEventKind,
  type CanonicalMessageRole,
  isCanonicalEventKind,
  isCanonicalMessageRole,
  type JsonValue,
} from "../../core/events/canonical-event.js";

export interface CanonicalHistoryQueryOptions {
  limit?: number;
  kind?: CanonicalEventKind;
}

export interface CanonicalHistoryQueryResult {
  sessionId: string;
  totalMatching: number;
  events: CanonicalEvent[];
}

interface CanonicalEventRow {
  id: string;
  session_id: string;
  sequence: number;
  event_kind: string;
  role: string | null;
  occurred_at: string | null;
  imported_at: string;

  payload_json: string;
  raw_json: string;

  adapter: string;
  native_session_id: string;
  native_source: string;
  source_position: number;
  fingerprint: string;

  native_ordinal: number | null;
  native_top_level_type: string | null;
  native_payload_type: string | null;
  native_payload_id: string | null;
  native_turn_id: string | null;
  native_call_id: string | null;
}

function parseJsonValue(value: string): JsonValue {
  return JSON.parse(value) as JsonValue;
}

function parseKind(value: string): CanonicalEventKind {
  if (!isCanonicalEventKind(value)) {
    throw new Error(`Invalid canonical event kind in storage: ${value}`);
  }

  return value;
}

function parseRole(value: string | null): CanonicalMessageRole | null {
  if (value === null) {
    return null;
  }

  if (!isCanonicalMessageRole(value)) {
    throw new Error(`Invalid canonical message role in storage: ${value}`);
  }

  return value;
}

function rowToEvent(row: CanonicalEventRow): CanonicalEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    sequence: row.sequence,

    kind: parseKind(row.event_kind),

    role: parseRole(row.role),

    occurredAt: row.occurred_at,

    importedAt: row.imported_at,

    payload: parseJsonValue(row.payload_json),

    raw: parseJsonValue(row.raw_json),

    source: {
      adapter: row.adapter,

      nativeSessionId: row.native_session_id,

      nativeSource: row.native_source,

      sourcePosition: row.source_position,

      fingerprint: row.fingerprint,

      nativeOrdinal: row.native_ordinal,

      nativeTopLevelType: row.native_top_level_type,

      nativePayloadType: row.native_payload_type,

      nativePayloadId: row.native_payload_id,

      nativeTurnId: row.native_turn_id,

      nativeCallId: row.native_call_id,
    },
  };
}

function validateLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error("History limit must be an integer between 1 and 1000.");
  }
}

/**
 * Read-only canonical history query model.
 *
 * History is selected from newest backwards for efficient
 * LIMIT behavior, then returned chronologically.
 */
export class CanonicalHistoryQueryRepository {
  constructor(private readonly database: Database.Database) {}

  getHistory(
    sessionId: string,
    options: CanonicalHistoryQueryOptions = {},
  ): CanonicalHistoryQueryResult | null {
    const limit = options.limit ?? 50;

    validateLimit(limit);

    const session = this.database
      .prepare(
        `
            SELECT id
            FROM sessions
            WHERE id = ?
          `,
      )
      .get(sessionId) as
      | {
          id: string;
        }
      | undefined;

    if (!session) {
      return null;
    }

    const parameters: Array<string | number> = [sessionId];

    let filter = "session_id = ?";

    if (options.kind !== undefined) {
      filter += " AND event_kind = ?";

      parameters.push(options.kind);
    }

    const count = this.database
      .prepare(
        `
            SELECT COUNT(*) AS count
            FROM canonical_events
            WHERE ${filter}
          `,
      )
      .get(...parameters) as {
      count: number;
    };

    const rows = this.database
      .prepare(
        `
            SELECT *
            FROM canonical_events
            WHERE ${filter}
            ORDER BY sequence DESC
            LIMIT ?
          `,
      )
      .all(...parameters, limit) as CanonicalEventRow[];

    return {
      sessionId,

      totalMatching: count.count,

      events: rows.map(rowToEvent).reverse(),
    };
  }
}
