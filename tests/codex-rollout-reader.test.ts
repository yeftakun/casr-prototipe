import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readCodexRollout } from "../src/adapters/codex/codex-rollout-reader.js";

describe("Codex rollout reader", () => {
  const temporaryDirectories: string[] = [];

  function createRollout(content: string): string {
    const directory = mkdtempSync(join(tmpdir(), "casr-rollout-reader-"));

    temporaryDirectories.push(directory);

    const path = join(directory, "rollout.jsonl");

    writeFileSync(path, content, "utf8");

    return path;
  }

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, {
        recursive: true,
        force: true,
      });
    }
  });

  it("reads valid JSONL records in physical source order", () => {
    const lines = [
      JSON.stringify({
        timestamp: "2026-08-29T01:00:00.000Z",
        type: "session_meta",
        ordinal: 0,
        payload: {},
      }),
      JSON.stringify({
        timestamp: "2026-08-29T01:00:01.000Z",
        type: "event_msg",
        ordinal: 1,
        payload: {},
      }),
      JSON.stringify({
        timestamp: "2026-08-29T01:00:02.000Z",
        type: "response_item",
        ordinal: 2,
        payload: {},
      }),
    ];

    const path = createRollout(`${lines.join("\n")}\n`);

    const result = readCodexRollout(path);

    expect(result.records).toHaveLength(3);

    expect(result.records.map((record) => record.recordIndex)).toEqual([
      0, 1, 2,
    ]);

    expect(result.records.map((record) => record.nativeTopLevelType)).toEqual([
      "session_meta",
      "event_msg",
      "response_item",
    ]);

    expect(result.records.map((record) => record.nativeOrdinal)).toEqual([
      0, 1, 2,
    ]);

    expect(result.records[0]?.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);

    expect(result.malformedRecord).toBeNull();

    expect(result.deferredTail).toBeNull();

    expect(result.nextOffset).toBe(result.fileSize);

    expect(result.nextRecordIndex).toBe(3);
  });

  it("supports legacy records without ordinal", () => {
    const line = JSON.stringify({
      timestamp: "2026-05-27T13:01:35.000Z",
      type: "response_item",
      payload: {
        type: "message",
      },
    });

    const path = createRollout(`${line}\n`);

    const result = readCodexRollout(path);

    expect(result.records[0]?.nativeOrdinal).toBeNull();

    expect(result.records[0]?.nativeTopLevelType).toBe("response_item");
  });

  it("handles CRLF, UTF-8 and chunk boundaries", () => {
    const firstLine = JSON.stringify({
      timestamp: "2026-08-29T01:00:00.000Z",
      type: "session_meta",
      payload: {
        note: "café ???",
      },
    });

    const secondLine = JSON.stringify({
      timestamp: "2026-08-29T01:00:01.000Z",
      type: "event_msg",
      payload: {
        note: "?",
      },
    });

    const content = `${firstLine}\r\n${secondLine}\r\n`;

    const path = createRollout(content);

    const result = readCodexRollout(path, {
      chunkSize: 7,
    });

    expect(result.records).toHaveLength(2);

    expect(result.records[0]?.rawLine).toBe(firstLine);

    expect(result.records[1]?.rawLine).toBe(secondLine);

    const firstEnd = Buffer.byteLength(`${firstLine}\r\n`, "utf8");

    expect(result.records[0]?.byteOffsetStart).toBe(0);

    expect(result.records[0]?.byteOffsetEnd).toBe(firstEnd);

    expect(result.records[1]?.byteOffsetStart).toBe(firstEnd);

    expect(result.nextOffset).toBe(Buffer.byteLength(content, "utf8"));
  });

  it("defers an invalid trailing record without advancing the safe cursor", () => {
    const validLine = JSON.stringify({
      timestamp: "2026-08-29T01:00:00.000Z",
      type: "event_msg",
      payload: {},
    });

    const partialLine =
      '{"timestamp":"2026-08-29T01:00:01.000Z","type":"response_item"';

    const prefix = `${validLine}\n`;

    const path = createRollout(`${prefix}${partialLine}`);

    const result = readCodexRollout(path);

    expect(result.records).toHaveLength(1);

    expect(result.malformedRecord).toBeNull();

    expect(result.deferredTail).not.toBeNull();

    expect(result.deferredTail?.recordIndex).toBe(1);

    expect(result.nextOffset).toBe(Buffer.byteLength(prefix, "utf8"));

    expect(result.nextRecordIndex).toBe(1);
  });

  it("halts safely at a malformed middle record", () => {
    const first = JSON.stringify({
      timestamp: "2026-08-29T01:00:00.000Z",
      type: "event_msg",
      payload: {},
    });

    const third = JSON.stringify({
      timestamp: "2026-08-29T01:00:02.000Z",
      type: "response_item",
      payload: {},
    });

    const malformed = '{"broken":';

    const prefix = `${first}\n`;

    const path = createRollout(`${prefix}${malformed}\n${third}\n`);

    const result = readCodexRollout(path);

    expect(result.records).toHaveLength(1);

    expect(result.malformedRecord).not.toBeNull();

    expect(result.malformedRecord?.recordIndex).toBe(1);

    expect(result.nextOffset).toBe(Buffer.byteLength(prefix, "utf8"));

    expect(result.nextRecordIndex).toBe(1);

    expect(
      result.records.some(
        (record) => record.nativeTopLevelType === "response_item",
      ),
    ).toBe(false);
  });

  it("accepts a valid final JSON record without a newline", () => {
    const line = JSON.stringify({
      timestamp: "2026-08-29T01:00:00.000Z",
      type: "event_msg",
      payload: {},
    });

    const path = createRollout(line);

    const result = readCodexRollout(path);

    expect(result.records).toHaveLength(1);

    expect(result.deferredTail).toBeNull();

    expect(result.nextOffset).toBe(Buffer.byteLength(line, "utf8"));

    expect(result.nextRecordIndex).toBe(1);
  });

  it("resumes incrementally from a safe byte offset", () => {
    const first = JSON.stringify({
      timestamp: "2026-08-29T01:00:00.000Z",
      type: "event_msg",
      ordinal: 0,
      payload: {},
    });

    const second = JSON.stringify({
      timestamp: "2026-08-29T01:00:01.000Z",
      type: "response_item",
      ordinal: 1,
      payload: {},
    });

    const path = createRollout(`${first}\n${second}\n`);

    const initial = readCodexRollout(path);

    expect(initial.records).toHaveLength(2);

    const third = JSON.stringify({
      timestamp: "2026-08-29T01:00:02.000Z",
      type: "event_msg",
      ordinal: 2,
      payload: {},
    });

    appendFileSync(path, `${third}\n`, "utf8");

    const resumed = readCodexRollout(path, {
      startOffset: initial.nextOffset,
      startRecordIndex: initial.nextRecordIndex,
    });

    expect(resumed.records).toHaveLength(1);

    expect(resumed.records[0]?.recordIndex).toBe(2);

    expect(resumed.records[0]?.nativeOrdinal).toBe(2);

    expect(resumed.records[0]?.nativeTopLevelType).toBe("event_msg");

    expect(resumed.nextOffset).toBe(resumed.fileSize);

    expect(resumed.nextRecordIndex).toBe(3);
  });

  it("rejects a resume offset that points into the middle of a record", () => {
    const line = JSON.stringify({
      timestamp: "2026-08-29T01:00:00.000Z",
      type: "event_msg",
      payload: {},
    });

    const path = createRollout(`${line}\n`);

    expect(() =>
      readCodexRollout(path, {
        startOffset: 5,
        startRecordIndex: 0,
      }),
    ).toThrow(/JSONL record boundary/);
  });
});
