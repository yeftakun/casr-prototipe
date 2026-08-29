import type Database from "better-sqlite3";

export interface CanonicalHistoryDiagnosticSummary {
  eventCount: number;
  firstSequence: number | null;
  lastSequence: number | null;
  lastImportedAt: string | null;
}

export interface NativeDiagnosticSource {
  adapter: string;
  nativeSessionId: string;
  nativeSource: string;
}

interface HistorySummaryRow {
  event_count: number;
  first_sequence: number | null;
  last_sequence: number | null;
  last_imported_at: string | null;
}

interface NativeSourceRow {
  adapter: string;
  native_session_id: string;
  native_path: string;
}

/**
 * Lightweight diagnostics queries.
 *
 * Deliberately does not deserialize canonical payload/raw JSON.
 */
export class SessionDiagnosticsRepository {
  constructor(private readonly database: Database.Database) {}

  getHistorySummary(sessionId: string): CanonicalHistoryDiagnosticSummary {
    const row = this.database
      .prepare(
        `
            SELECT
              COUNT(*) AS event_count,
              MIN(sequence) AS first_sequence,
              MAX(sequence) AS last_sequence,
              MAX(imported_at) AS last_imported_at
            FROM canonical_events
            WHERE session_id = ?
          `,
      )
      .get(sessionId) as HistorySummaryRow;

    return {
      eventCount: row.event_count,

      firstSequence: row.first_sequence,

      lastSequence: row.last_sequence,

      lastImportedAt: row.last_imported_at,
    };
  }

  listNativeSources(sessionId: string): NativeDiagnosticSource[] {
    const rows = this.database
      .prepare(
        `
            SELECT
              adapter,
              native_session_id,
              native_path
            FROM native_sessions
            WHERE session_id = ?
            ORDER BY created_at ASC, id ASC
          `,
      )
      .all(sessionId) as NativeSourceRow[];

    return rows.map((row) => ({
      adapter: row.adapter,

      nativeSessionId: row.native_session_id,

      nativeSource: row.native_path,
    }));
  }
}
