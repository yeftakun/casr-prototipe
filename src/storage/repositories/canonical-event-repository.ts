import type Database from "better-sqlite3";
import { v7 as uuidv7 } from "uuid";

import {
  type CanonicalEvent,
  type CanonicalEventDraft,
  type CanonicalEventKind,
  type CanonicalMessageRole,
  isCanonicalEventKind,
  isCanonicalMessageRole,
  type JsonValue,
} from "../../core/events/canonical-event.js";

export interface AppendCanonicalEventInput {
  sessionId: string;
  sequence: number;
  draft: CanonicalEventDraft;

  /**
   * Optional for deterministic tests/import transactions.
   * Defaults to the current time.
   */
  importedAt?: string;
}

export interface AppendCanonicalEventResult {
  status: "inserted" | "already_known";
  event: CanonicalEvent;
}

export interface AppendCanonicalEventBatchResult {
  inserted: number;
  alreadyKnown: number;
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

export class CanonicalSourceMutationError extends Error {
  constructor(
    adapter: string,
    nativeSessionId: string,
    nativeSource: string,
    sourcePosition: number,
  ) {
    super(
      [
        "Native source mutation detected",
        `adapter=${adapter}`,
        `nativeSessionId=${nativeSessionId}`,
        `nativeSource=${nativeSource}`,
        `sourcePosition=${sourcePosition}`,
      ].join(" "),
    );

    this.name = "CanonicalSourceMutationError";
  }
}

export class CanonicalSourceOwnershipError extends Error {
  constructor(existingSessionId: string, requestedSessionId: string) {
    super(
      `Native source is already owned by CASR session ${existingSessionId}; requested ${requestedSessionId}.`,
    );

    this.name = "CanonicalSourceOwnershipError";
  }
}

function parseEventKind(value: string): CanonicalEventKind {
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

function parseJsonValue(value: string): JsonValue {
  return JSON.parse(value) as JsonValue;
}

function rowToCanonicalEvent(row: CanonicalEventRow): CanonicalEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    sequence: row.sequence,
    kind: parseEventKind(row.event_kind),
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

function createCanonicalEventId(): string {
  return `event_${uuidv7()}`;
}

/**
 * Append-only canonical event persistence.
 *
 * Deliberately exposes no generic update/delete API.
 */
export class CanonicalEventRepository {
  constructor(private readonly database: Database.Database) {}

  append(input: AppendCanonicalEventInput): AppendCanonicalEventResult {
    return this.appendOne(input);
  }

  appendMany(
    inputs: readonly AppendCanonicalEventInput[],
  ): AppendCanonicalEventBatchResult {
    const transaction = this.database.transaction(
      (batch: readonly AppendCanonicalEventInput[]) => {
        let inserted = 0;
        let alreadyKnown = 0;

        const events: CanonicalEvent[] = [];

        for (const input of batch) {
          const result = this.appendOne(input);

          if (result.status === "inserted") {
            inserted++;
          } else {
            alreadyKnown++;
          }

          events.push(result.event);
        }

        return {
          inserted,
          alreadyKnown,
          events,
        };
      },
    );

    return transaction(inputs);
  }

  countBySession(sessionId: string): number {
    const row = this.database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM canonical_events
          WHERE session_id = ?
        `,
      )
      .get(sessionId) as {
      count: number;
    };

    return row.count;
  }

  getNextSequence(sessionId: string): number {
    const row = this.database
      .prepare(
        `
          SELECT
            COALESCE(
              MAX(sequence),
              -1
            ) + 1 AS next_sequence
          FROM canonical_events
          WHERE session_id = ?
        `,
      )
      .get(sessionId) as {
      next_sequence: number;
    };

    return row.next_sequence;
  }

  listBySession(sessionId: string): CanonicalEvent[] {
    const rows = this.database
      .prepare(
        `
          SELECT *
          FROM canonical_events
          WHERE session_id = ?
          ORDER BY sequence ASC
        `,
      )
      .all(sessionId) as CanonicalEventRow[];

    return rows.map(rowToCanonicalEvent);
  }

  findByNativeSourcePosition(
    adapter: string,
    nativeSessionId: string,
    nativeSource: string,
    sourcePosition: number,
  ): CanonicalEvent | null {
    const row = this.findNativeSourceRow(
      adapter,
      nativeSessionId,
      nativeSource,
      sourcePosition,
    );

    return row ? rowToCanonicalEvent(row) : null;
  }

  private appendOne(
    input: AppendCanonicalEventInput,
  ): AppendCanonicalEventResult {
    if (!Number.isSafeInteger(input.sequence) || input.sequence < 0) {
      throw new Error("sequence must be a non-negative safe integer.");
    }

    const source = input.draft.source;

    const existing = this.findNativeSourceRow(
      source.adapter,
      source.nativeSessionId,
      source.nativeSource,
      source.sourcePosition,
    );

    if (existing) {
      if (existing.fingerprint !== source.fingerprint) {
        throw new CanonicalSourceMutationError(
          source.adapter,
          source.nativeSessionId,
          source.nativeSource,
          source.sourcePosition,
        );
      }

      if (existing.session_id !== input.sessionId) {
        throw new CanonicalSourceOwnershipError(
          existing.session_id,
          input.sessionId,
        );
      }

      return {
        status: "already_known",
        event: rowToCanonicalEvent(existing),
      };
    }

    const event: CanonicalEvent = {
      id: createCanonicalEventId(),
      sessionId: input.sessionId,
      sequence: input.sequence,
      importedAt: input.importedAt ?? new Date().toISOString(),
      ...input.draft,
    };

    this.database
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
        id: event.id,
        sessionId: event.sessionId,
        sequence: event.sequence,
        eventKind: event.kind,
        role: event.role,
        occurredAt: event.occurredAt,
        importedAt: event.importedAt,

        payloadJson: JSON.stringify(event.payload),

        rawJson: JSON.stringify(event.raw),

        adapter: event.source.adapter,

        nativeSessionId: event.source.nativeSessionId,

        nativeSource: event.source.nativeSource,

        sourcePosition: event.source.sourcePosition,

        fingerprint: event.source.fingerprint,

        nativeOrdinal: event.source.nativeOrdinal,

        nativeTopLevelType: event.source.nativeTopLevelType,

        nativePayloadType: event.source.nativePayloadType,

        nativePayloadId: event.source.nativePayloadId,

        nativeTurnId: event.source.nativeTurnId,

        nativeCallId: event.source.nativeCallId,
      });

    return {
      status: "inserted",
      event,
    };
  }

  private findNativeSourceRow(
    adapter: string,
    nativeSessionId: string,
    nativeSource: string,
    sourcePosition: number,
  ): CanonicalEventRow | undefined {
    return this.database
      .prepare(
        `
          SELECT *
          FROM canonical_events
          WHERE adapter = ?
            AND native_session_id = ?
            AND native_source = ?
            AND source_position = ?
        `,
      )
      .get(adapter, nativeSessionId, nativeSource, sourcePosition) as
      | CanonicalEventRow
      | undefined;
  }
}
