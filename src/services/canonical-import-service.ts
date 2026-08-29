import type Database from "better-sqlite3";

import type { CanonicalEventDraft } from "../core/events/canonical-event.js";

import {
  CanonicalEventRepository,
  CanonicalSourceMutationError,
  CanonicalSourceOwnershipError,
} from "../storage/repositories/canonical-event-repository.js";

import { ImportCursorRepository } from "../storage/repositories/import-cursor-repository.js";

export type CanonicalImportStopReason =
  | "eof"
  | "malformed_record"
  | "deferred_tail";

export interface CanonicalHistoryReadRequest {
  adapter: string;
  nativeSessionId: string;
  nativeSource: string;

  startOffset: number;
  startRecordIndex: number;
}

export interface CanonicalHistoryReadBatch {
  drafts: CanonicalEventDraft[];

  fileSize: number;

  nextOffset: number;
  nextRecordIndex: number;

  stopReason: CanonicalImportStopReason;
}

export type CanonicalHistoryReader = (
  request: CanonicalHistoryReadRequest,
) => CanonicalHistoryReadBatch;

export interface CanonicalImportRequest {
  sessionId: string;

  adapter: string;
  nativeSessionId: string;
  nativeSource: string;

  /**
   * Optional deterministic timestamp
   * for testing/import reproducibility.
   */
  importedAt?: string;
}

export interface CanonicalImportResult {
  sessionId: string;

  adapter: string;
  nativeSessionId: string;
  nativeSource: string;

  startOffset: number;
  startRecordIndex: number;

  endOffset: number;
  endRecordIndex: number;

  observedFileSize: number;

  recordsRead: number;

  inserted: number;
  alreadyKnown: number;

  cursorStatus: "created" | "updated" | "unchanged";

  stopReason: CanonicalImportStopReason;
}

function assertNonNegativeSafeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer.`);
  }
}

/**
 * Provider-neutral incremental canonical importer.
 *
 * Provider-specific reading/parsing/normalization is
 * injected through CanonicalHistoryReader.
 *
 * Database guarantees:
 *
 *   canonical event inserts
 *   +
 *   import cursor advancement
 *
 * happen inside one outer transaction.
 */
export class CanonicalImportService {
  private readonly events: CanonicalEventRepository;

  private readonly cursors: ImportCursorRepository;

  constructor(
    private readonly database: Database.Database,

    private readonly historyReader: CanonicalHistoryReader,
  ) {
    this.events = new CanonicalEventRepository(database);

    this.cursors = new ImportCursorRepository(database);
  }

  importSource(request: CanonicalImportRequest): CanonicalImportResult {
    const transaction = this.database.transaction(() =>
      this.importInsideTransaction(request),
    );

    /*
     * Acquire the SQLite write lock before
     * reading current cursor/event state.
     *
     * This prevents another writer from
     * changing import state between our
     * read and write phases.
     */
    return transaction.immediate();
  }

  private importInsideTransaction(
    request: CanonicalImportRequest,
  ): CanonicalImportResult {
    const existingCursor = this.cursors.findByNativeSource(
      request.adapter,
      request.nativeSessionId,
      request.nativeSource,
    );

    const startOffset = existingCursor?.byteOffset ?? 0;

    const startRecordIndex = existingCursor?.recordIndex ?? 0;

    const batch = this.historyReader({
      adapter: request.adapter,

      nativeSessionId: request.nativeSessionId,

      nativeSource: request.nativeSource,

      startOffset,
      startRecordIndex,
    });

    this.validateBatch(request, batch, startOffset, startRecordIndex);

    const nextSequence = this.events.getNextSequence(request.sessionId);

    let nextNewSequence = nextSequence;

    let alreadyKnown = 0;

    const newEvents: Array<{
      sessionId: string;
      sequence: number;
      importedAt?: string;
      draft: CanonicalEventDraft;
    }> = [];

    for (const draft of batch.drafts) {
      const source = draft.source;

      const existing = this.events.findByNativeSourcePosition(
        source.adapter,
        source.nativeSessionId,
        source.nativeSource,
        source.sourcePosition,
      );

      if (existing) {
        if (existing.source.fingerprint !== source.fingerprint) {
          throw new CanonicalSourceMutationError(
            source.adapter,
            source.nativeSessionId,
            source.nativeSource,
            source.sourcePosition,
          );
        }

        if (existing.sessionId !== request.sessionId) {
          throw new CanonicalSourceOwnershipError(
            existing.sessionId,
            request.sessionId,
          );
        }

        alreadyKnown++;
        continue;
      }

      newEvents.push({
        sessionId: request.sessionId,

        sequence: nextNewSequence,

        ...(request.importedAt
          ? {
              importedAt: request.importedAt,
            }
          : {}),

        draft,
      });

      nextNewSequence++;
    }

    /*
     * CanonicalEventRepository has its own
     * transaction for standalone callers.
     *
     * better-sqlite3 supports nested transactions
     * through savepoints, so this remains part of
     * our outer import transaction.
     */
    const inserted = this.events.appendMany(newEvents);

    const lastFingerprint =
      batch.drafts.at(-1)?.source.fingerprint ??
      existingCursor?.lastRecordFingerprint ??
      null;

    const cursorResult = this.cursors.save({
      sessionId: request.sessionId,

      adapter: request.adapter,

      nativeSessionId: request.nativeSessionId,

      nativeSource: request.nativeSource,

      byteOffset: batch.nextOffset,

      recordIndex: batch.nextRecordIndex,

      sourceFileSize: batch.fileSize,

      lastRecordFingerprint: lastFingerprint,

      ...(request.importedAt
        ? {
            savedAt: request.importedAt,
          }
        : {}),
    });

    return {
      sessionId: request.sessionId,

      adapter: request.adapter,

      nativeSessionId: request.nativeSessionId,

      nativeSource: request.nativeSource,

      startOffset,
      startRecordIndex,

      endOffset: batch.nextOffset,

      endRecordIndex: batch.nextRecordIndex,

      observedFileSize: batch.fileSize,

      recordsRead: batch.drafts.length,

      inserted: inserted.inserted,

      alreadyKnown,

      cursorStatus: cursorResult.status,

      stopReason: batch.stopReason,
    };
  }

  private validateBatch(
    request: CanonicalImportRequest,
    batch: CanonicalHistoryReadBatch,
    startOffset: number,
    startRecordIndex: number,
  ): void {
    assertNonNegativeSafeInteger("fileSize", batch.fileSize);

    assertNonNegativeSafeInteger("nextOffset", batch.nextOffset);

    assertNonNegativeSafeInteger("nextRecordIndex", batch.nextRecordIndex);

    if (batch.nextOffset < startOffset) {
      throw new Error("Canonical history reader moved byte offset backward.");
    }

    if (batch.nextRecordIndex < startRecordIndex) {
      throw new Error("Canonical history reader moved record index backward.");
    }

    if (batch.nextOffset > batch.fileSize) {
      throw new Error(
        "Canonical history reader returned nextOffset beyond fileSize.",
      );
    }

    const expectedRecordCount = batch.nextRecordIndex - startRecordIndex;

    if (expectedRecordCount !== batch.drafts.length) {
      throw new Error(
        [
          "Canonical history reader record count mismatch.",
          `expected=${expectedRecordCount}`,
          `actual=${batch.drafts.length}`,
        ].join(" "),
      );
    }

    for (let index = 0; index < batch.drafts.length; index++) {
      const draft = batch.drafts[index];

      if (!draft) {
        throw new Error(`Missing canonical draft at index ${index}.`);
      }

      const expectedSourcePosition = startRecordIndex + index;

      if (draft.source.adapter !== request.adapter) {
        throw new Error(
          `Canonical draft adapter mismatch at source position ${expectedSourcePosition}.`,
        );
      }

      if (draft.source.nativeSessionId !== request.nativeSessionId) {
        throw new Error(
          `Canonical draft native session mismatch at source position ${expectedSourcePosition}.`,
        );
      }

      if (draft.source.nativeSource !== request.nativeSource) {
        throw new Error(
          `Canonical draft native source mismatch at source position ${expectedSourcePosition}.`,
        );
      }

      if (draft.source.sourcePosition !== expectedSourcePosition) {
        throw new Error(
          [
            "Canonical draft source position mismatch.",
            `expected=${expectedSourcePosition}`,
            `actual=${draft.source.sourcePosition}`,
          ].join(" "),
        );
      }
    }
  }
}
