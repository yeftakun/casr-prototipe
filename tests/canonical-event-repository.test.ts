import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CanonicalEventDraft } from "../src/core/events/canonical-event.js";
import { runMigrations } from "../src/storage/migrations.js";
import {
  CanonicalEventRepository,
  CanonicalSourceMutationError,
} from "../src/storage/repositories/canonical-event-repository.js";

describe("Canonical event repository", () => {
  let database: Database.Database;
  let repository: CanonicalEventRepository;

  beforeEach(() => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");

    runMigrations(database);

    database
      .prepare(
        `
          INSERT INTO sessions (
            id,
            title,
            workspace_path,
            status,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "casr-test",
        "Canonical repository test",
        String.raw`C:\workspace\test`,
        "active",
        "2026-08-29T01:00:00.000Z",
        "2026-08-29T01:00:00.000Z",
      );

    repository = new CanonicalEventRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  function createDraft(
    sourcePosition: number,
    options: {
      fingerprint?: string;
      kind?: "message" | "tool_call";
      nativeCallId?: string | null;
    } = {},
  ): CanonicalEventDraft {
    const kind = options.kind ?? "message";

    return {
      kind,
      role: kind === "message" ? "user" : null,
      occurredAt: "2026-08-29T01:00:00.000Z",

      payload:
        kind === "message"
          ? {
              text: `message-${sourcePosition}`,
            }
          : {
              name: "example",
              input: {},
            },

      source: {
        adapter: "codex",
        nativeSessionId: "native-session-1",
        nativeSource: "rollout-example.jsonl",
        sourcePosition,
        fingerprint: options.fingerprint ?? `fingerprint-${sourcePosition}`,
        nativeOrdinal: null,
        nativeTopLevelType: "response_item",
        nativePayloadType: kind === "message" ? "message" : "function_call",
        nativePayloadId: null,
        nativeTurnId: "turn-1",
        nativeCallId: options.nativeCallId ?? null,
      },

      raw: {
        type: "response_item",
        position: sourcePosition,
      },
    };
  }

  it("appends and reads a persisted canonical event", () => {
    const result = repository.append({
      sessionId: "casr-test",
      sequence: 0,
      importedAt: "2026-08-29T02:00:00.000Z",
      draft: createDraft(0),
    });

    expect(result.status).toBe("inserted");

    expect(result.event.id).toMatch(
      /^event_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const stored = repository.listBySession("casr-test");

    expect(stored).toHaveLength(1);

    expect(stored[0]).toEqual(result.event);

    expect(stored[0]?.importedAt).toBe("2026-08-29T02:00:00.000Z");
  });

  it("treats the same native source and fingerprint as already known", () => {
    const draft = createDraft(4);

    const first = repository.append({
      sessionId: "casr-test",
      sequence: 0,
      draft,
    });

    const second = repository.append({
      sessionId: "casr-test",
      sequence: 99,
      draft,
    });

    expect(first.status).toBe("inserted");

    expect(second.status).toBe("already_known");

    expect(second.event.id).toBe(first.event.id);

    expect(second.event.sequence).toBe(0);

    expect(repository.countBySession("casr-test")).toBe(1);
  });

  it("detects native source mutation at an existing physical position", () => {
    repository.append({
      sessionId: "casr-test",
      sequence: 0,
      draft: createDraft(7, {
        fingerprint: "fingerprint-original",
      }),
    });

    expect(() => {
      repository.append({
        sessionId: "casr-test",
        sequence: 1,
        draft: createDraft(7, {
          fingerprint: "fingerprint-mutated",
        }),
      });
    }).toThrow(CanonicalSourceMutationError);

    expect(repository.countBySession("casr-test")).toBe(1);
  });

  it("rejects duplicate canonical sequence from a different native record", () => {
    repository.append({
      sessionId: "casr-test",
      sequence: 0,
      draft: createDraft(0),
    });

    expect(() => {
      repository.append({
        sessionId: "casr-test",
        sequence: 0,
        draft: createDraft(1),
      });
    }).toThrow(/UNIQUE constraint failed/);
  });

  it("appends a batch atomically and preserves canonical sequence order", () => {
    const result = repository.appendMany([
      {
        sessionId: "casr-test",
        sequence: 0,
        draft: createDraft(10),
      },
      {
        sessionId: "casr-test",
        sequence: 1,
        draft: createDraft(11, {
          kind: "tool_call",
          nativeCallId: "call-1",
        }),
      },
      {
        sessionId: "casr-test",
        sequence: 2,
        draft: createDraft(12),
      },
    ]);

    expect(result.inserted).toBe(3);

    expect(result.alreadyKnown).toBe(0);

    expect(
      repository.listBySession("casr-test").map((event) => event.sequence),
    ).toEqual([0, 1, 2]);
  });

  it("handles already-known records inside a batch without duplicating them", () => {
    const known = createDraft(20);

    repository.append({
      sessionId: "casr-test",
      sequence: 0,
      draft: known,
    });

    const result = repository.appendMany([
      {
        sessionId: "casr-test",
        sequence: 500,
        draft: known,
      },
      {
        sessionId: "casr-test",
        sequence: 1,
        draft: createDraft(21),
      },
    ]);

    expect(result.inserted).toBe(1);

    expect(result.alreadyKnown).toBe(1);

    expect(repository.countBySession("casr-test")).toBe(2);
  });

  it("rolls back an entire batch when one new event conflicts", () => {
    repository.append({
      sessionId: "casr-test",
      sequence: 0,
      draft: createDraft(30),
    });

    expect(() => {
      repository.appendMany([
        {
          sessionId: "casr-test",
          sequence: 1,
          draft: createDraft(31),
        },
        {
          sessionId: "casr-test",
          sequence: 0,
          draft: createDraft(32),
        },
      ]);
    }).toThrow(/UNIQUE constraint failed/);

    expect(repository.countBySession("casr-test")).toBe(1);

    expect(
      repository.findByNativeSourcePosition(
        "codex",
        "native-session-1",
        "rollout-example.jsonl",
        31,
      ),
    ).toBeNull();
  });

  it("reports the next canonical sequence and finds events by native position", () => {
    expect(repository.getNextSequence("casr-test")).toBe(0);

    repository.appendMany([
      {
        sessionId: "casr-test",
        sequence: 0,
        draft: createDraft(40),
      },
      {
        sessionId: "casr-test",
        sequence: 1,
        draft: createDraft(41),
      },
    ]);

    expect(repository.getNextSequence("casr-test")).toBe(2);

    const event = repository.findByNativeSourcePosition(
      "codex",
      "native-session-1",
      "rollout-example.jsonl",
      41,
    );

    expect(event).not.toBeNull();

    expect(event?.source.sourcePosition).toBe(41);

    expect(event?.sequence).toBe(1);
  });
});
