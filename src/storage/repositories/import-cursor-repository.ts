import type Database from "better-sqlite3";
import { v7 as uuidv7 } from "uuid";

export interface ImportCursor {
  id: string;
  sessionId: string;

  adapter: string;
  nativeSessionId: string;
  nativeSource: string;

  /**
   * Safe byte offset from which native reading may resume.
   */
  byteOffset: number;

  /**
   * Physical record index corresponding to byteOffset.
   *
   * This is the NEXT native record index to read.
   */
  recordIndex: number;

  /**
   * Native file size observed when this cursor was saved.
   */
  sourceFileSize: number;

  /**
   * Fingerprint of the last successfully consumed native record.
   *
   * Null is valid when no native record has been consumed yet.
   */
  lastRecordFingerprint: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface SaveImportCursorInput {
  sessionId: string;

  adapter: string;
  nativeSessionId: string;
  nativeSource: string;

  byteOffset: number;
  recordIndex: number;
  sourceFileSize: number;

  lastRecordFingerprint: string | null;

  /**
   * Optional deterministic timestamp for tests/import transactions.
   */
  savedAt?: string;
}

export interface SaveImportCursorResult {
  status: "created" | "updated" | "unchanged";
  cursor: ImportCursor;
}

interface ImportCursorRow {
  id: string;
  session_id: string;

  adapter: string;
  native_session_id: string;
  native_source: string;

  byte_offset: number;
  record_index: number;
  source_file_size: number;

  last_record_fingerprint: string | null;

  created_at: string;
  updated_at: string;
}

export class ImportCursorRegressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportCursorRegressionError";
  }
}

export class ImportCursorAnchorMutationError extends Error {
  constructor() {
    super(
      "Import cursor anchor fingerprint changed at the same native source position.",
    );

    this.name = "ImportCursorAnchorMutationError";
  }
}

export class ImportCursorOwnershipError extends Error {
  constructor(existingSessionId: string, requestedSessionId: string) {
    super(
      `Native import cursor belongs to CASR session ${existingSessionId}; requested ${requestedSessionId}.`,
    );

    this.name = "ImportCursorOwnershipError";
  }
}

function createCursorId(): string {
  return `cursor_${uuidv7()}`;
}

function assertNonNegativeSafeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer.`);
  }
}

function rowToImportCursor(row: ImportCursorRow): ImportCursor {
  return {
    id: row.id,
    sessionId: row.session_id,

    adapter: row.adapter,
    nativeSessionId: row.native_session_id,
    nativeSource: row.native_source,

    byteOffset: row.byte_offset,
    recordIndex: row.record_index,
    sourceFileSize: row.source_file_size,

    lastRecordFingerprint: row.last_record_fingerprint,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * CASR-owned incremental native import cursor storage.
 *
 * No generic rewind/reset API is intentionally exposed.
 *
 * Recovery from native truncation/mutation must be an explicit
 * importer policy rather than a silent cursor overwrite.
 */
export class ImportCursorRepository {
  constructor(private readonly database: Database.Database) {}

  findByNativeSource(
    adapter: string,
    nativeSessionId: string,
    nativeSource: string,
  ): ImportCursor | null {
    const row = this.findRow(adapter, nativeSessionId, nativeSource);

    return row ? rowToImportCursor(row) : null;
  }

  listBySession(sessionId: string): ImportCursor[] {
    const rows = this.database
      .prepare(
        `
          SELECT *
          FROM import_cursors
          WHERE session_id = ?
          ORDER BY created_at ASC, id ASC
        `,
      )
      .all(sessionId) as ImportCursorRow[];

    return rows.map(rowToImportCursor);
  }

  save(input: SaveImportCursorInput): SaveImportCursorResult {
    this.validateInput(input);

    const existing = this.findRow(
      input.adapter,
      input.nativeSessionId,
      input.nativeSource,
    );

    if (!existing) {
      const timestamp = input.savedAt ?? new Date().toISOString();

      const cursor: ImportCursor = {
        id: createCursorId(),
        sessionId: input.sessionId,

        adapter: input.adapter,
        nativeSessionId: input.nativeSessionId,
        nativeSource: input.nativeSource,

        byteOffset: input.byteOffset,
        recordIndex: input.recordIndex,
        sourceFileSize: input.sourceFileSize,

        lastRecordFingerprint: input.lastRecordFingerprint,

        createdAt: timestamp,
        updatedAt: timestamp,
      };

      this.database
        .prepare(
          `
            INSERT INTO import_cursors (
              id,
              session_id,
              adapter,
              native_session_id,
              native_source,
              byte_offset,
              record_index,
              source_file_size,
              last_record_fingerprint,
              created_at,
              updated_at
            )
            VALUES (
              @id,
              @sessionId,
              @adapter,
              @nativeSessionId,
              @nativeSource,
              @byteOffset,
              @recordIndex,
              @sourceFileSize,
              @lastRecordFingerprint,
              @createdAt,
              @updatedAt
            )
          `,
        )
        .run(cursor);

      return {
        status: "created",
        cursor,
      };
    }

    if (existing.session_id !== input.sessionId) {
      throw new ImportCursorOwnershipError(
        existing.session_id,
        input.sessionId,
      );
    }

    if (
      input.byteOffset < existing.byte_offset ||
      input.recordIndex < existing.record_index
    ) {
      throw new ImportCursorRegressionError(
        [
          "Import cursor cannot move backward.",
          `existingOffset=${existing.byte_offset}`,
          `requestedOffset=${input.byteOffset}`,
          `existingRecordIndex=${existing.record_index}`,
          `requestedRecordIndex=${input.recordIndex}`,
        ].join(" "),
      );
    }

    if (input.sourceFileSize < existing.source_file_size) {
      throw new ImportCursorRegressionError(
        [
          "Observed native source file size regressed.",
          `existingSize=${existing.source_file_size}`,
          `requestedSize=${input.sourceFileSize}`,
        ].join(" "),
      );
    }

    if (
      input.recordIndex > existing.record_index &&
      input.byteOffset === existing.byte_offset
    ) {
      throw new ImportCursorRegressionError(
        "recordIndex cannot advance without byteOffset advancing.",
      );
    }

    const samePhysicalPosition =
      input.byteOffset === existing.byte_offset &&
      input.recordIndex === existing.record_index;

    if (
      samePhysicalPosition &&
      existing.last_record_fingerprint !== input.lastRecordFingerprint
    ) {
      throw new ImportCursorAnchorMutationError();
    }

    const unchanged =
      samePhysicalPosition &&
      input.sourceFileSize === existing.source_file_size &&
      input.lastRecordFingerprint === existing.last_record_fingerprint;

    if (unchanged) {
      return {
        status: "unchanged",
        cursor: rowToImportCursor(existing),
      };
    }

    const updatedAt = input.savedAt ?? new Date().toISOString();

    this.database
      .prepare(
        `
          UPDATE import_cursors
          SET
            byte_offset = @byteOffset,
            record_index = @recordIndex,
            source_file_size = @sourceFileSize,
            last_record_fingerprint = @lastRecordFingerprint,
            updated_at = @updatedAt
          WHERE id = @id
        `,
      )
      .run({
        id: existing.id,

        byteOffset: input.byteOffset,

        recordIndex: input.recordIndex,

        sourceFileSize: input.sourceFileSize,

        lastRecordFingerprint: input.lastRecordFingerprint,

        updatedAt,
      });

    const updated = this.findRow(
      input.adapter,
      input.nativeSessionId,
      input.nativeSource,
    );

    if (!updated) {
      throw new Error("Import cursor disappeared after update.");
    }

    return {
      status: "updated",
      cursor: rowToImportCursor(updated),
    };
  }

  private validateInput(input: SaveImportCursorInput): void {
    assertNonNegativeSafeInteger("byteOffset", input.byteOffset);

    assertNonNegativeSafeInteger("recordIndex", input.recordIndex);

    assertNonNegativeSafeInteger("sourceFileSize", input.sourceFileSize);

    if (input.byteOffset > input.sourceFileSize) {
      throw new Error("byteOffset cannot exceed sourceFileSize.");
    }

    if (input.recordIndex > 0 && input.lastRecordFingerprint === null) {
      throw new Error(
        "lastRecordFingerprint is required after at least one native record has been consumed.",
      );
    }
  }

  private findRow(
    adapter: string,
    nativeSessionId: string,
    nativeSource: string,
  ): ImportCursorRow | undefined {
    return this.database
      .prepare(
        `
          SELECT *
          FROM import_cursors
          WHERE adapter = ?
            AND native_session_id = ?
            AND native_source = ?
        `,
      )
      .get(adapter, nativeSessionId, nativeSource) as
      | ImportCursorRow
      | undefined;
  }
}
