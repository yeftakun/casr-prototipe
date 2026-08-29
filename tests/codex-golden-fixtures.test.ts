import { readFileSync } from "node:fs";

import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readCodexCanonicalHistoryBatch } from "../src/adapters/codex/codex-canonical-history-reader.js";

import { readCodexRollout } from "../src/adapters/codex/codex-rollout-reader.js";

import { normalizeCodexEvent } from "../src/adapters/codex/events/normalize-codex-event.js";

import { parseCodexNativeEvent } from "../src/adapters/codex/events/parse-codex-event.js";

const fixtureRoot = join(process.cwd(), "tests", "fixtures", "codex");

const expectedRoot = join(fixtureRoot, "expected");

interface CanonicalGolden {
  fixture: string;

  stopReason: "eof";

  drafts: unknown[];
}

interface ReaderGolden {
  fixture: string;

  stopReason: "malformed_record" | "deferred_tail";

  recordCount: number;

  nextOffset: number;

  nextRecordIndex: number;

  fileSize: number;

  issue: {
    recordIndex: number;

    byteOffsetStart: number;

    byteOffsetEnd: number;

    rawLine: string;
  };

  canonical: Array<{
    kind: string;

    role: string | null;

    payload: unknown;

    sourcePosition: number;
  }>;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readCanonicalGolden(name: string): CanonicalGolden {
  return loadJson<CanonicalGolden>(
    join(expectedRoot, `${name}.canonical.json`),
  );
}

function normalizeFixture(name: string) {
  const fixtureName = `${name}.jsonl`;

  const path = join(fixtureRoot, fixtureName);

  const rollout = readCodexRollout(path);

  expect(rollout.malformedRecord).toBeNull();

  expect(rollout.deferredTail).toBeNull();

  expect(rollout.nextOffset).toBe(rollout.fileSize);

  return rollout.records.map((record) =>
    normalizeCodexEvent(parseCodexNativeEvent(record), {
      nativeSessionId: "golden-native-session",

      /*
       * Deliberately stable across operating systems.
       */
      nativeSource: fixtureName,
    }),
  );
}

function projectBatchCanonical(
  drafts: ReturnType<typeof readCodexCanonicalHistoryBatch>["drafts"],
) {
  return drafts.map((draft) => ({
    kind: draft.kind,

    role: draft.role,

    payload: draft.payload,

    sourcePosition: draft.source.sourcePosition,
  }));
}

describe("Codex golden fixtures", () => {
  const canonicalFixtures = [
    "legacy-basic",
    "modern-basic",
    "tools",
    "lifecycle",
    "state-metadata",
  ] as const;

  for (const name of canonicalFixtures) {
    it(`matches the ${name} canonical golden output`, () => {
      const expected = readCanonicalGolden(name);

      const drafts = normalizeFixture(name);

      expect(expected.fixture).toBe(`${name}.jsonl`);

      expect(expected.stopReason).toBe("eof");

      expect(drafts).toEqual(expected.drafts);

      for (const draft of drafts) {
        expect(draft.source.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
      }
    });
  }

  it("matches the malformed-middle reader golden output without skipping later evidence", () => {
    const expected = loadJson<ReaderGolden>(
      join(expectedRoot, "malformed-middle.reader.json"),
    );

    const path = join(fixtureRoot, expected.fixture);

    const rollout = readCodexRollout(path);

    expect(rollout.records.length).toBe(expected.recordCount);

    expect(rollout.nextOffset).toBe(expected.nextOffset);

    expect(rollout.nextRecordIndex).toBe(expected.nextRecordIndex);

    expect(rollout.fileSize).toBe(expected.fileSize);

    expect(rollout.malformedRecord?.recordIndex).toBe(
      expected.issue.recordIndex,
    );

    expect(rollout.malformedRecord?.byteOffsetStart).toBe(
      expected.issue.byteOffsetStart,
    );

    expect(rollout.malformedRecord?.byteOffsetEnd).toBe(
      expected.issue.byteOffsetEnd,
    );

    expect(rollout.malformedRecord?.rawLine).toBe(expected.issue.rawLine);

    expect(rollout.deferredTail).toBeNull();

    const batch = readCodexCanonicalHistoryBatch({
      adapter: "codex",

      nativeSessionId: "golden-native-session",

      nativeSource: path,

      startOffset: 0,

      startRecordIndex: 0,
    });

    expect(batch.stopReason).toBe(expected.stopReason);

    expect(projectBatchCanonical(batch.drafts)).toEqual(expected.canonical);
  });

  it("matches the deferred-tail reader golden output without consuming incomplete bytes", () => {
    const expected = loadJson<ReaderGolden>(
      join(expectedRoot, "deferred-tail.reader.json"),
    );

    const path = join(fixtureRoot, expected.fixture);

    const rollout = readCodexRollout(path);

    expect(rollout.records.length).toBe(expected.recordCount);

    expect(rollout.nextOffset).toBe(expected.nextOffset);

    expect(rollout.nextRecordIndex).toBe(expected.nextRecordIndex);

    expect(rollout.fileSize).toBe(expected.fileSize);

    expect(rollout.malformedRecord).toBeNull();

    expect(rollout.deferredTail?.recordIndex).toBe(expected.issue.recordIndex);

    expect(rollout.deferredTail?.byteOffsetStart).toBe(
      expected.issue.byteOffsetStart,
    );

    expect(rollout.deferredTail?.byteOffsetEnd).toBe(
      expected.issue.byteOffsetEnd,
    );

    expect(rollout.deferredTail?.rawLine).toBe(expected.issue.rawLine);

    const batch = readCodexCanonicalHistoryBatch({
      adapter: "codex",

      nativeSessionId: "golden-native-session",

      nativeSource: path,

      startOffset: 0,

      startRecordIndex: 0,
    });

    expect(batch.stopReason).toBe(expected.stopReason);

    expect(projectBatchCanonical(batch.drafts)).toEqual(expected.canonical);

    expect(batch.nextOffset).toBe(expected.nextOffset);
  });
});
