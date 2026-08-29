import { describe, expect, it } from "vitest";

import type { CodexRolloutRecord } from "../src/adapters/codex/codex-rollout-reader.js";
import { parseCodexNativeEvent } from "../src/adapters/codex/events/parse-codex-event.js";

function createRecord(
  parsed: unknown,
  overrides: Partial<CodexRolloutRecord> = {},
): CodexRolloutRecord {
  const rawLine = JSON.stringify(parsed);

  const root =
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;

  return {
    recordIndex: 0,
    byteOffsetStart: 0,
    byteOffsetEnd: Buffer.byteLength(rawLine, "utf8"),
    timestamp: typeof root?.timestamp === "string" ? root.timestamp : null,
    nativeTopLevelType: typeof root?.type === "string" ? root.type : null,
    nativeOrdinal: typeof root?.ordinal === "number" ? root.ordinal : null,
    rawLine,
    parsed,
    fingerprint: `sha256:${"a".repeat(64)}`,
    ...overrides,
  };
}

describe("Codex native event parser", () => {
  it("classifies response_item message records", () => {
    const record = createRecord({
      timestamp: "2026-08-29T01:00:00.000Z",
      type: "response_item",
      ordinal: 1,
      payload: {
        type: "message",
        id: "item-1",
        role: "assistant",
        content: [],
      },
    });

    const event = parseCodexNativeEvent(record);

    expect(event.family).toBe("response_item");

    expect(event.nativePayloadType).toBe("message");

    expect(event.payloadId).toBe("item-1");

    expect(event.role).toBe("assistant");

    expect(event.record).toBe(record);
  });

  it("extracts function call linkage metadata", () => {
    const record = createRecord({
      type: "response_item",
      payload: {
        type: "function_call",
        id: "item-call",
        call_id: "call-123",
        turn_id: "turn-456",
        name: "example",
        arguments: "{}",
      },
    });

    const event = parseCodexNativeEvent(record);

    expect(event.family).toBe("response_item");

    expect(event.nativePayloadType).toBe("function_call");

    expect(event.payloadId).toBe("item-call");

    expect(event.callId).toBe("call-123");

    expect(event.turnId).toBe("turn-456");
  });

  it("extracts function call output linkage metadata", () => {
    const record = createRecord({
      type: "response_item",
      payload: {
        type: "function_call_output",
        call_id: "call-123",
        output: "result",
      },
    });

    const event = parseCodexNativeEvent(record);

    expect(event.nativePayloadType).toBe("function_call_output");

    expect(event.callId).toBe("call-123");

    expect(event.payloadId).toBeNull();
  });

  it("extracts nested item_completed metadata", () => {
    const record = createRecord({
      type: "event_msg",
      payload: {
        type: "item_completed",
        turn_id: "turn-1",
        item: {
          type: "AgentMessage",
          id: "nested-item-1",
          role: "assistant",
        },
      },
    });

    const event = parseCodexNativeEvent(record);

    expect(event.family).toBe("event_msg");

    expect(event.nativePayloadType).toBe("item_completed");

    expect(event.nestedItemType).toBe("AgentMessage");

    expect(event.nestedItemId).toBe("nested-item-1");

    expect(event.turnId).toBe("turn-1");

    expect(event.role).toBe("assistant");
  });

  it("classifies native state and metadata families without requiring payload subtype", () => {
    const sessionMeta = parseCodexNativeEvent(
      createRecord({
        type: "session_meta",
        payload: {
          id: "meta-1",
          session_id: "native-session-1",
        },
      }),
    );

    expect(sessionMeta.family).toBe("session_meta");

    expect(sessionMeta.nativePayloadType).toBeNull();

    expect(sessionMeta.payloadId).toBe("meta-1");

    const turnContext = parseCodexNativeEvent(
      createRecord({
        type: "turn_context",
        payload: {
          turn_id: "turn-2",
        },
      }),
    );

    expect(turnContext.family).toBe("turn_context");

    expect(turnContext.turnId).toBe("turn-2");

    const compacted = parseCodexNativeEvent(
      createRecord({
        type: "compacted",
        payload: {
          message: "replacement",
        },
      }),
    );

    expect(compacted.family).toBe("compacted");
  });

  it("preserves unknown payload subtypes inside known event families", () => {
    const record = createRecord({
      type: "event_msg",
      payload: {
        type: "future_codex_event",
        future_field: true,
      },
    });

    const event = parseCodexNativeEvent(record);

    expect(event.family).toBe("event_msg");

    expect(event.nativePayloadType).toBe("future_codex_event");

    expect(event.payload).toEqual({
      type: "future_codex_event",
      future_field: true,
    });
  });

  it("preserves unknown top-level native records", () => {
    const record = createRecord({
      type: "future_top_level_type",
      payload: {
        type: "future_payload_type",
        value: 123,
      },
    });

    const event = parseCodexNativeEvent(record);

    expect(event.family).toBe("unknown");

    expect(event.nativeTopLevelType).toBe("future_top_level_type");

    expect(event.nativePayloadType).toBe("future_payload_type");

    expect(event.payload).toEqual({
      type: "future_payload_type",
      value: 123,
    });

    expect(event.record.parsed).toEqual(record.parsed);
  });

  it("handles valid non-object JSON without throwing", () => {
    const record = createRecord("valid-json");

    const event = parseCodexNativeEvent(record);

    expect(event.family).toBe("unknown");

    expect(event.nativeTopLevelType).toBeNull();

    expect(event.nativePayloadType).toBeNull();

    expect(event.payload).toBeNull();

    expect(event.payloadId).toBeNull();
    expect(event.turnId).toBeNull();
    expect(event.callId).toBeNull();
    expect(event.role).toBeNull();
  });
});
