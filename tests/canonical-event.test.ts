import { describe, expect, it } from "vitest";
import {
  CANONICAL_EVENT_KINDS,
  CANONICAL_MESSAGE_ROLES,
  type CanonicalEventDraft,
  isCanonicalEventKind,
  isCanonicalMessageRole,
} from "../src/core/events/canonical-event.js";

describe("Canonical event domain model", () => {
  it("defines the provider-neutral canonical event kinds", () => {
    expect(CANONICAL_EVENT_KINDS).toEqual([
      "message",
      "tool_call",
      "tool_result",
      "reasoning",
      "lifecycle",
      "state",
      "metadata",
      "unknown",
    ]);
  });

  it("supports message roles observed in native Codex history", () => {
    expect(CANONICAL_MESSAGE_ROLES).toContain("user");
    expect(CANONICAL_MESSAGE_ROLES).toContain("assistant");
    expect(CANONICAL_MESSAGE_ROLES).toContain("developer");
  });

  it("rejects provider-specific vocabulary as canonical kinds", () => {
    expect(isCanonicalEventKind("message")).toBe(true);

    expect(isCanonicalEventKind("response_item")).toBe(false);

    expect(isCanonicalEventKind("event_msg")).toBe(false);

    expect(isCanonicalEventKind("turn_context")).toBe(false);
  });

  it("validates canonical message roles", () => {
    expect(isCanonicalMessageRole("user")).toBe(true);

    expect(isCanonicalMessageRole("developer")).toBe(true);

    expect(isCanonicalMessageRole("codex_internal")).toBe(false);
  });

  it("preserves native provenance without making it canonical identity", () => {
    const event: CanonicalEventDraft = {
      kind: "tool_call",
      role: null,
      occurredAt: "2026-08-29T05:53:00.000Z",
      payload: {
        name: "example-tool",
      },
      source: {
        adapter: "codex",
        nativeSessionId: "native-session-example",
        nativeSource: "rollout-example.jsonl",
        sourcePosition: 12,
        fingerprint: "sha256-example",
        nativeOrdinal: null,
        nativeTopLevelType: "response_item",
        nativePayloadType: "function_call",
        nativePayloadId: null,
        nativeTurnId: "turn-example",
        nativeCallId: "call-example",
      },
      raw: {
        type: "response_item",
      },
    };

    expect(event.kind).toBe("tool_call");

    expect(event.source.nativeTopLevelType).toBe("response_item");

    expect(event.source.nativeCallId).toBe("call-example");

    expect(event.source.sourcePosition).toBe(12);
  });

  it("allows an unmatched tool call", () => {
    const event: CanonicalEventDraft = {
      kind: "tool_call",
      role: null,
      occurredAt: null,
      payload: {},
      source: {
        adapter: "codex",
        nativeSessionId: "native-session-example",
        nativeSource: "rollout-example.jsonl",
        sourcePosition: 3,
        fingerprint: "sha256-example",
        nativeOrdinal: 3,
        nativeTopLevelType: "response_item",
        nativePayloadType: "function_call",
        nativePayloadId: null,
        nativeTurnId: "turn-example",
        nativeCallId: "call-without-output",
      },
      raw: {},
    };

    expect(event.kind).toBe("tool_call");

    expect(event.source.nativeCallId).toBe("call-without-output");
  });

  it("allows lossless unknown native records", () => {
    const event: CanonicalEventDraft = {
      kind: "unknown",
      role: null,
      occurredAt: null,
      payload: {
        nativeType: "future_codex_event",
      },
      source: {
        adapter: "codex",
        nativeSessionId: "native-session-example",
        nativeSource: "rollout-example.jsonl",
        sourcePosition: 99,
        fingerprint: "sha256-example",
        nativeOrdinal: null,
        nativeTopLevelType: "future_codex_event",
        nativePayloadType: null,
        nativePayloadId: null,
        nativeTurnId: null,
        nativeCallId: null,
      },
      raw: {
        type: "future_codex_event",
        payload: {
          future: true,
        },
      },
    };

    expect(event.kind).toBe("unknown");

    expect(event.raw).toEqual({
      type: "future_codex_event",
      payload: {
        future: true,
      },
    });
  });
});
