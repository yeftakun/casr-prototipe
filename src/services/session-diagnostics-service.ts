import { existsSync, statSync } from "node:fs";

import type Database from "better-sqlite3";

import type { SessionDetail } from "../core/session/session-view.js";

import {
  type ImportCursor,
  ImportCursorRepository,
} from "../storage/repositories/import-cursor-repository.js";

import {
  type CanonicalHistoryDiagnosticSummary,
  type NativeDiagnosticSource,
  SessionDiagnosticsRepository,
} from "../storage/repositories/session-diagnostics-repository.js";

import { SessionQueryRepository } from "../storage/repositories/session-query-repository.js";

export const IMPORT_DIAGNOSTIC_STATUSES = [
  "NOT_IMPORTED",
  "MISSING_CURSOR",
  "EOF",
  "BEHIND",
  "SOURCE_GREW",
  "SOURCE_MISSING",
  "SOURCE_TRUNCATED",
  "MALFORMED_RECORD",
  "DEFERRED_TAIL",
] as const;

export type ImportDiagnosticStatus =
  (typeof IMPORT_DIAGNOSTIC_STATUSES)[number];

export type SourceReadIssueReason = "malformed_record" | "deferred_tail";

export interface SourceReadIssue {
  reason: SourceReadIssueReason;

  recordIndex: number;

  byteOffsetStart: number;

  byteOffsetEnd: number;

  error: string;
}

export interface SourceContentProbeRequest {
  adapter: string;

  nativeSessionId: string;

  nativeSource: string;

  startOffset: number;

  startRecordIndex: number;
}

export interface SourceContentProbeResult {
  pendingRecordCount: number;

  issue: SourceReadIssue | null;
}

export type SourceContentProbe = (
  request: SourceContentProbeRequest,
) => SourceContentProbeResult | null;

export interface SourceFileSnapshot {
  exists: boolean;

  size: number | null;

  error: string | null;
}

export type SourceFileStat = (nativeSource: string) => SourceFileSnapshot;

export interface ImportSourceDiagnostic {
  adapter: string;

  nativeSessionId: string;

  nativeSource: string;

  status: ImportDiagnosticStatus;

  cursorPresent: boolean;

  recordIndex: number | null;

  byteOffset: number | null;

  checkpointFileSize: number | null;

  currentFileSize: number | null;

  lagBytes: number | null;

  pendingRecords: number | null;

  anchorPresent: boolean;

  cursorUpdatedAt: string | null;

  issueReason: SourceReadIssueReason | null;

  issueRecordIndex: number | null;

  issueByteOffsetStart: number | null;

  issueByteOffsetEnd: number | null;

  issueError: string | null;

  sourceError: string | null;
}

export interface SessionDiagnostics {
  session: SessionDetail;

  canonicalHistory: CanonicalHistoryDiagnosticSummary;

  imports: ImportSourceDiagnostic[];
}

function defaultSourceFileStat(nativeSource: string): SourceFileSnapshot {
  try {
    if (!existsSync(nativeSource)) {
      return {
        exists: false,

        size: null,

        error: null,
      };
    }

    const stat = statSync(nativeSource);

    if (!stat.isFile()) {
      return {
        exists: false,

        size: null,

        error: "Native source exists but is not a regular file.",
      };
    }

    return {
      exists: true,

      size: stat.size,

      error: null,
    };
  } catch (error) {
    return {
      exists: false,

      size: null,

      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function deriveStatus(
  history: CanonicalHistoryDiagnosticSummary,

  cursor: ImportCursor | null,

  snapshot: SourceFileSnapshot,

  probe: SourceContentProbeResult | null,
): ImportDiagnosticStatus {
  if (!cursor) {
    return history.eventCount === 0 ? "NOT_IMPORTED" : "MISSING_CURSOR";
  }

  if (!snapshot.exists) {
    return "SOURCE_MISSING";
  }

  const currentSize = snapshot.size;

  if (currentSize === null) {
    return "SOURCE_MISSING";
  }

  if (currentSize < cursor.byteOffset || currentSize < cursor.sourceFileSize) {
    return "SOURCE_TRUNCATED";
  }

  if (probe?.issue?.reason === "malformed_record") {
    return "MALFORMED_RECORD";
  }

  if (probe?.issue?.reason === "deferred_tail") {
    return "DEFERRED_TAIL";
  }

  if (currentSize > cursor.sourceFileSize) {
    return "SOURCE_GREW";
  }

  if (cursor.byteOffset === currentSize) {
    return "EOF";
  }

  return "BEHIND";
}

function calculateLagBytes(
  cursor: ImportCursor | null,

  snapshot: SourceFileSnapshot,
): number | null {
  if (!cursor || !snapshot.exists || snapshot.size === null) {
    return null;
  }

  if (snapshot.size < cursor.byteOffset) {
    return null;
  }

  return snapshot.size - cursor.byteOffset;
}

interface ProbeOutcome {
  result: SourceContentProbeResult | null;

  error: string | null;
}

export class SessionDiagnosticsService {
  private readonly sessions: SessionQueryRepository;

  private readonly diagnostics: SessionDiagnosticsRepository;

  private readonly cursors: ImportCursorRepository;

  constructor(
    database: Database.Database,

    private readonly sourceFileStat: SourceFileStat = defaultSourceFileStat,

    private readonly sourceContentProbe: SourceContentProbe = () => null,
  ) {
    this.sessions = new SessionQueryRepository(database);

    this.diagnostics = new SessionDiagnosticsRepository(database);

    this.cursors = new ImportCursorRepository(database);
  }

  inspect(sessionId: string): SessionDiagnostics | null {
    const session = this.sessions.getSessionById(sessionId);

    if (!session) {
      return null;
    }

    const canonicalHistory = this.diagnostics.getHistorySummary(sessionId);

    const nativeSources = this.diagnostics.listNativeSources(sessionId);

    const imports = nativeSources.map((source) =>
      this.inspectSource(source, canonicalHistory),
    );

    return {
      session,
      canonicalHistory,
      imports,
    };
  }

  private inspectSource(
    source: NativeDiagnosticSource,

    history: CanonicalHistoryDiagnosticSummary,
  ): ImportSourceDiagnostic {
    const cursor = this.cursors.findByNativeSource(
      source.adapter,
      source.nativeSessionId,
      source.nativeSource,
    );

    /*
     * Metadata inspection is always read-only.
     */
    const snapshot = this.sourceFileStat(source.nativeSource);

    /*
     * Content probing begins ONLY from the persisted
     * safe cursor boundary.
     *
     * It never writes to CODEX_HOME or advances CASR state.
     */
    const probeOutcome = this.probeSource(source, cursor, snapshot);

    const probe = probeOutcome.result;

    const issue = probe?.issue ?? null;

    return {
      adapter: source.adapter,

      nativeSessionId: source.nativeSessionId,

      nativeSource: source.nativeSource,

      status: deriveStatus(history, cursor, snapshot, probe),

      cursorPresent: cursor !== null,

      recordIndex: cursor?.recordIndex ?? null,

      byteOffset: cursor?.byteOffset ?? null,

      checkpointFileSize: cursor?.sourceFileSize ?? null,

      currentFileSize: snapshot.size,

      lagBytes: calculateLagBytes(cursor, snapshot),

      pendingRecords: probe?.pendingRecordCount ?? null,

      anchorPresent: cursor !== null && cursor.lastRecordFingerprint !== null,

      cursorUpdatedAt: cursor?.updatedAt ?? null,

      issueReason: issue?.reason ?? null,

      issueRecordIndex: issue?.recordIndex ?? null,

      issueByteOffsetStart: issue?.byteOffsetStart ?? null,

      issueByteOffsetEnd: issue?.byteOffsetEnd ?? null,

      issueError: issue?.error ?? null,

      sourceError: snapshot.error ?? probeOutcome.error,
    };
  }

  private probeSource(
    source: NativeDiagnosticSource,

    cursor: ImportCursor | null,

    snapshot: SourceFileSnapshot,
  ): ProbeOutcome {
    if (!cursor || !snapshot.exists || snapshot.size === null) {
      return {
        result: null,

        error: null,
      };
    }

    /*
     * Never ask a reader to start beyond the physical file.
     * Truncation is diagnosed from metadata instead.
     */
    if (
      snapshot.size < cursor.byteOffset ||
      snapshot.size < cursor.sourceFileSize
    ) {
      return {
        result: null,

        error: null,
      };
    }

    try {
      return {
        result: this.sourceContentProbe({
          adapter: source.adapter,

          nativeSessionId: source.nativeSessionId,

          nativeSource: source.nativeSource,

          startOffset: cursor.byteOffset,

          startRecordIndex: cursor.recordIndex,
        }),

        error: null,
      };
    } catch (error) {
      return {
        result: null,

        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
