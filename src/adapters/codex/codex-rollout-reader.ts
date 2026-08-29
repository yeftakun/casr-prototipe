import { createHash } from "node:crypto";
import { closeSync, fstatSync, openSync, readSync } from "node:fs";

const DEFAULT_CHUNK_SIZE = 64 * 1024;

export interface CodexRolloutReaderOptions {
  /**
   * Byte offset to resume reading from.
   *
   * Must point to a JSONL record boundary.
   */
  startOffset?: number;

  /**
   * CASR source position corresponding to startOffset.
   *
   * This is separate from Codex native ordinal.
   */
  startRecordIndex?: number;

  /**
   * Primarily useful for testing chunk-boundary behavior.
   */
  chunkSize?: number;
}

export interface CodexRolloutRecord {
  /**
   * CASR-observed physical JSONL record order.
   *
   * This is NOT the Codex native ordinal.
   */
  recordIndex: number;

  byteOffsetStart: number;
  byteOffsetEnd: number;

  timestamp: string | null;
  nativeTopLevelType: string | null;
  nativeOrdinal: number | null;

  rawLine: string;
  parsed: unknown;

  /**
   * SHA-256 of the exact JSON record bytes,
   * excluding CR/LF delimiters.
   */
  fingerprint: string;
}

export interface CodexRolloutMalformedRecord {
  recordIndex: number;

  byteOffsetStart: number;
  byteOffsetEnd: number;

  rawLine: string;
  error: string;
}

export interface CodexRolloutDeferredTail {
  recordIndex: number;

  byteOffsetStart: number;
  byteOffsetEnd: number;

  rawLine: string;
  error: string;
}

export interface CodexRolloutReadResult {
  records: CodexRolloutRecord[];

  malformedRecord: CodexRolloutMalformedRecord | null;
  deferredTail: CodexRolloutDeferredTail | null;

  fileSize: number;

  /**
   * Last safe byte offset from which the next read may resume.
   *
   * It never advances beyond malformed or deferred data.
   */
  nextOffset: number;

  /**
   * Record index corresponding to nextOffset.
   */
  nextRecordIndex: number;
}

interface ParsedLineSuccess {
  kind: "record";
  record: Omit<CodexRolloutRecord, "recordIndex">;
}

interface ParsedLineBlank {
  kind: "blank";
}

interface ParsedLineFailure {
  kind: "invalid";
  rawLine: string;
  error: string;
}

type ParsedLine = ParsedLineSuccess | ParsedLineBlank | ParsedLineFailure;

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createFingerprint(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function parseNativeOrdinal(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }

  return null;
}

function parseLine(
  lineBytes: Buffer,
  byteOffsetStart: number,
  byteOffsetEnd: number,
): ParsedLine {
  let content = lineBytes;

  if (content.length > 0 && content[content.length - 1] === 0x0d) {
    content = content.subarray(0, content.length - 1);
  }

  if (content.length === 0) {
    return {
      kind: "blank",
    };
  }

  const rawLine = content.toString("utf8");

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawLine) as unknown;
  } catch (caughtError) {
    return {
      kind: "invalid",
      rawLine,
      error:
        caughtError instanceof Error
          ? caughtError.message
          : String(caughtError),
    };
  }

  const root = isJsonObject(parsed) ? parsed : null;

  const timestamp =
    root && typeof root.timestamp === "string" ? root.timestamp : null;

  const nativeTopLevelType =
    root && typeof root.type === "string" ? root.type : null;

  const nativeOrdinal = root ? parseNativeOrdinal(root.ordinal) : null;

  return {
    kind: "record",
    record: {
      byteOffsetStart,
      byteOffsetEnd,
      timestamp,
      nativeTopLevelType,
      nativeOrdinal,
      rawLine,
      parsed,
      fingerprint: createFingerprint(content),
    },
  };
}

function validateIntegerOption(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer.`);
  }
}

export function readCodexRollout(
  rolloutPath: string,
  options: CodexRolloutReaderOptions = {},
): CodexRolloutReadResult {
  const startOffset = options.startOffset ?? 0;

  const startRecordIndex = options.startRecordIndex ?? 0;

  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;

  validateIntegerOption("startOffset", startOffset);

  validateIntegerOption("startRecordIndex", startRecordIndex);

  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    throw new Error("chunkSize must be a positive safe integer.");
  }

  const fileDescriptor = openSync(rolloutPath, "r");

  try {
    const fileSize = fstatSync(fileDescriptor).size;

    if (startOffset > fileSize) {
      throw new Error(
        `startOffset ${startOffset} exceeds rollout file size ${fileSize}.`,
      );
    }

    /**
     * When resuming from inside an existing file,
     * require a known JSONL boundary.
     *
     * startOffset === fileSize is allowed because
     * it represents a fully consumed file.
     */
    if (startOffset > 0 && startOffset < fileSize) {
      const previousByte = Buffer.allocUnsafe(1);

      readSync(fileDescriptor, previousByte, 0, 1, startOffset - 1);

      if (previousByte[0] !== 0x0a) {
        throw new Error("startOffset must point to a JSONL record boundary.");
      }
    }

    const records: CodexRolloutRecord[] = [];

    let malformedRecord: CodexRolloutMalformedRecord | null = null;

    let deferredTail: CodexRolloutDeferredTail | null = null;

    let nextOffset = startOffset;
    let nextRecordIndex = startRecordIndex;

    let filePosition = startOffset;

    let carry = Buffer.alloc(0);
    let carryStartOffset = startOffset;

    let halted = false;

    while (filePosition < fileSize && !halted) {
      const bytesToRead = Math.min(chunkSize, fileSize - filePosition);

      const chunk = Buffer.allocUnsafe(bytesToRead);

      const bytesRead = readSync(
        fileDescriptor,
        chunk,
        0,
        bytesToRead,
        filePosition,
      );

      if (bytesRead === 0) {
        break;
      }

      const data = Buffer.concat([carry, chunk.subarray(0, bytesRead)]);

      const dataStartOffset = carryStartOffset;

      let lineStart = 0;

      while (!halted) {
        const newlineIndex = data.indexOf(0x0a, lineStart);

        if (newlineIndex === -1) {
          break;
        }

        const byteOffsetStart = dataStartOffset + lineStart;

        const byteOffsetEnd = dataStartOffset + newlineIndex + 1;

        const parsedLine = parseLine(
          data.subarray(lineStart, newlineIndex),
          byteOffsetStart,
          byteOffsetEnd,
        );

        if (parsedLine.kind === "blank") {
          nextOffset = byteOffsetEnd;

          lineStart = newlineIndex + 1;

          continue;
        }

        if (parsedLine.kind === "invalid") {
          malformedRecord = {
            recordIndex: nextRecordIndex,
            byteOffsetStart,
            byteOffsetEnd,
            rawLine: parsedLine.rawLine,
            error: parsedLine.error,
          };

          nextOffset = byteOffsetStart;

          halted = true;

          break;
        }

        records.push({
          recordIndex: nextRecordIndex,
          ...parsedLine.record,
        });

        nextRecordIndex++;
        nextOffset = byteOffsetEnd;

        lineStart = newlineIndex + 1;
      }

      if (halted) {
        break;
      }

      carry = data.subarray(lineStart);

      carryStartOffset = dataStartOffset + lineStart;

      filePosition += bytesRead;
    }

    /**
     * Process a final record that has no newline.
     *
     * Valid JSON is accepted.
     * Invalid JSON is treated as a deferred tail,
     * because Codex may still be writing it.
     */
    if (!halted && carry.length > 0) {
      const parsedLine = parseLine(carry, carryStartOffset, fileSize);

      if (parsedLine.kind === "blank") {
        nextOffset = fileSize;
      } else if (parsedLine.kind === "invalid") {
        deferredTail = {
          recordIndex: nextRecordIndex,
          byteOffsetStart: carryStartOffset,
          byteOffsetEnd: fileSize,
          rawLine: parsedLine.rawLine,
          error: parsedLine.error,
        };

        nextOffset = carryStartOffset;
      } else {
        records.push({
          recordIndex: nextRecordIndex,
          ...parsedLine.record,
        });

        nextRecordIndex++;
        nextOffset = fileSize;
      }
    }

    return {
      records,
      malformedRecord,
      deferredTail,
      fileSize,
      nextOffset,
      nextRecordIndex,
    };
  } finally {
    closeSync(fileDescriptor);
  }
}
