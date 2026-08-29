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
] as const;

export type ImportDiagnosticStatus =
  (typeof IMPORT_DIAGNOSTIC_STATUSES)[number];

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

  anchorPresent: boolean;

  cursorUpdatedAt: string | null;

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

export class SessionDiagnosticsService {
  private readonly sessions: SessionQueryRepository;

  private readonly diagnostics: SessionDiagnosticsRepository;

  private readonly cursors: ImportCursorRepository;

  constructor(
    database: Database.Database,

    private readonly sourceFileStat: SourceFileStat = defaultSourceFileStat,
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
      this.inspectSource(sessionId, source, canonicalHistory),
    );

    return {
      session,
      canonicalHistory,
      imports,
    };
  }

  private inspectSource(
    sessionId: string,
    source: NativeDiagnosticSource,
    history: CanonicalHistoryDiagnosticSummary,
  ): ImportSourceDiagnostic {
    const cursor = this.cursors.findByNativeSource(
      source.adapter,
      source.nativeSessionId,
      source.nativeSource,
    );

    /*
     * File metadata inspection only.
     * No rollout content is read here.
     */
    const snapshot = this.sourceFileStat(source.nativeSource);

    return {
      adapter: source.adapter,

      nativeSessionId: source.nativeSessionId,

      nativeSource: source.nativeSource,

      status: deriveStatus(history, cursor, snapshot),

      cursorPresent: cursor !== null,

      recordIndex: cursor?.recordIndex ?? null,

      byteOffset: cursor?.byteOffset ?? null,

      checkpointFileSize: cursor?.sourceFileSize ?? null,

      currentFileSize: snapshot.size,

      lagBytes: calculateLagBytes(cursor, snapshot),

      anchorPresent: cursor?.lastRecordFingerprint !== null && cursor !== null,

      cursorUpdatedAt: cursor?.updatedAt ?? null,

      sourceError: snapshot.error,
    };
  }
}
