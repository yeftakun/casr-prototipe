import type Database from "better-sqlite3";

import type { NativeSession } from "../core/session/native-session.js";

import { syncNativeSessions } from "../core/session/sync-service.js";
import type { SessionRegistryRepository } from "../storage/repositories/session-registry-repository.js";
import type {
  CanonicalHistoryReader,
  CanonicalImportStopReason,
} from "./canonical-import-service.js";
import { CanonicalImportService } from "./canonical-import-service.js";

export interface SyncHistoryFailure {
  adapter: string;
  nativeSessionId: string;
  error: string;
}

export interface SyncHistorySummary {
  sources: number;
  succeeded: number;
  failed: number;

  recordsRead: number;
  inserted: number;
  alreadyKnown: number;

  eof: number;
  malformed: number;
  deferred: number;
}

export interface SyncWithHistoryResult {
  discovered: number;
  imported: number;
  updated: number;
  unchanged: number;

  history: SyncHistorySummary;

  failures: SyncHistoryFailure[];
}

export interface SyncWithHistoryOptions {
  importedAt?: string;
}

function incrementStopReason(
  history: SyncHistorySummary,
  reason: CanonicalImportStopReason,
): void {
  switch (reason) {
    case "eof":
      history.eof++;
      break;

    case "malformed_record":
      history.malformed++;
      break;

    case "deferred_tail":
      history.deferred++;
      break;
  }
}

/**
 * Synchronize native session metadata/bindings first,
 * then incrementally import canonical history for each
 * discovered native source.
 *
 * A history failure for one native session is isolated:
 * other sources continue importing.
 *
 * Each individual CanonicalImportService call remains
 * transactional for:
 *
 *   canonical event batch + cursor advancement
 */
export function syncNativeSessionsWithHistory(
  database: Database.Database,
  repository: SessionRegistryRepository,
  nativeSessions: NativeSession[],
  historyReader: CanonicalHistoryReader,
  options: SyncWithHistoryOptions = {},
): SyncWithHistoryResult {
  const sessionResult = syncNativeSessions(repository, nativeSessions);

  const importer = new CanonicalImportService(database, historyReader);

  const history: SyncHistorySummary = {
    sources: nativeSessions.length,
    succeeded: 0,
    failed: 0,

    recordsRead: 0,
    inserted: 0,
    alreadyKnown: 0,

    eof: 0,
    malformed: 0,
    deferred: 0,
  };

  const failures: SyncHistoryFailure[] = [];

  for (const nativeSession of nativeSessions) {
    const sessionId = repository.findSessionIdByNativeIdentity(
      nativeSession.adapter,
      nativeSession.nativeSessionId,
    );

    if (!sessionId) {
      history.failed++;

      failures.push({
        adapter: nativeSession.adapter,

        nativeSessionId: nativeSession.nativeSessionId,

        error:
          "CASR session identity could not be resolved after native session sync.",
      });

      continue;
    }

    try {
      const result = importer.importSource({
        sessionId,

        adapter: nativeSession.adapter,

        nativeSessionId: nativeSession.nativeSessionId,

        nativeSource: nativeSession.nativePath,

        ...(options.importedAt
          ? {
              importedAt: options.importedAt,
            }
          : {}),
      });

      history.succeeded++;

      history.recordsRead += result.recordsRead;

      history.inserted += result.inserted;

      history.alreadyKnown += result.alreadyKnown;

      incrementStopReason(history, result.stopReason);
    } catch (error) {
      history.failed++;

      failures.push({
        adapter: nativeSession.adapter,

        nativeSessionId: nativeSession.nativeSessionId,

        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ...sessionResult,
    history,
    failures,
  };
}
