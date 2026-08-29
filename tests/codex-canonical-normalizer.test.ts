import { describe, expect, it } from "vitest";

import type { CodexRolloutRecord } from "../src/adapters/codex/codex-rollout-reader.js";
import { normalizeCodexEvent } from "../src/adapters/codex/events/normalize-codex-event.js";
import { parseCodexNativeEvent } from "../src/adapters/codex/events/parse-codex-event.js";

function createRecord(parsed: unknown, index = 0): CodexRolloutRecord {
  const rawLine = JSON.stringify(parsed);

  const root =
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;

  return {
    recordIndex: index,
    byteOffsetStart: 0,
    byteOffsetEnd: Buffer.byteLength(rawLine, "utf8"),
    timestamp: typeof root?.timestamp === "string" ? root.timestamp : null,
    nativeTopLevelType: typeof root?.type === "string" ? root.type : null,
    nativeOrdinal: typeof root?.ordinal === "number" ? root.ordinal : null,
    rawLine,
    parsed,
    fingerprint: `sha256:${"a".repeat(64)}`,
  };
}

function normalize(parsed: unknown, index = 0) {
  const nativeEvent = parseCodexNativeEvent(createRecord(parsed, index));

  return normalizeCodexEvent(nativeEvent, {
    nativeSessionId: "native-session-1",
    nativeSource: "rollout-example.jsonl",
  });
}

describe("Codex canonical normalizer", () => {
  it("normalizes response_item messages", () => {
    const event = normalize(
      {
        timestamp: "2026-08-29T01:00:00.000Z",
        type: "response_item",
        ordinal: 4,
        payload: {
          type: "message",
          id: "message-1",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "Hello",
            },
          ],
        },
      },
      12,
    );

    expect(event.kind).toBe("message");

    expect(event.role).toBe("assistant");

    expect(event.payload).toEqual({
      text: "Hello",
    });

    expect(event.source.sourcePosition).toBe(12);

    expect(event.source.nativeOrdinal).toBe(4);
  });

  it("normalizes event_msg user and agent messages", () => {
    const user = normalize({
      type: "event_msg",
      payload: {
        type: "user_message",
        message: "Question",
      },
    });

    const assistant = normalize({
      type: "event_msg",
      payload: {
        type: "agent_message",
        message: "Answer",
      },
    });

    expect(user.kind).toBe("message");
    expect(user.role).toBe("user");
    expect(user.payload).toEqual({
      text: "Question",
    });

    expect(assistant.kind).toBe("message");
    expect(assistant.role).toBe("assistant");
    expect(assistant.payload).toEqual({
      text: "Answer",
    });
  });

  it("normalizes native tool calls into provider-neutral tool_call events", () => {
    const functionCall = normalize({
      type: "response_item",
      payload: {
        type: "function_call",
        call_id: "call-1",
        name: "read_file",
        arguments: '{"path":"README.md"}',
      },
    });

    expect(functionCall.kind).toBe("tool_call");

    expect(functionCall.payload).toEqual({
      name: "read_file",
      input: {
        path: "README.md",
      },
    });

    expect(functionCall.source.nativeCallId).toBe("call-1");

    const customCall = normalize({
      type: "response_item",
      payload: {
        type: "custom_tool_call",
        call_id: "call-2",
        name: "custom",
        input: {
          value: 42,
        },
      },
    });

    expect(customCall.kind).toBe("tool_call");

    expect(customCall.payload).toEqual({
      name: "custom",
      input: {
        value: 42,
      },
    });
  });

  it("normalizes native tool outputs into tool_result events", () => {
    const event = normalize({
      type: "response_item",
      payload: {
        type: "function_call_output",
        call_id: "call-1",
        output: "done",
      },
    });

    expect(event.kind).toBe("tool_result");

    expect(event.payload).toEqual({
      output: "done",
    });

    expect(event.source.nativeCallId).toBe("call-1");
  });

  it("normalizes reasoning without exposing Codex event vocabulary", () => {
    const event = normalize({
      type: "response_item",
      payload: {
        type: "reasoning",
        summary: ["summary"],
        content: ["detail"],
      },
    });

    expect(event.kind).toBe("reasoning");

    expect(event.payload).toEqual({
      summary: ["summary"],
      content: ["detail"],
    });
  });

  it("normalizes lifecycle records", () => {
    expect(
      normalize({
        type: "event_msg",
        payload: {
          type: "task_started",
        },
      }).payload,
    ).toEqual({
      scope: "turn",
      status: "started",
    });

    expect(
      normalize({
        type: "event_msg",
        payload: {
          type: "turn_aborted",
        },
      }).payload,
    ).toEqual({
      scope: "turn",
      status: "aborted",
    });

    expect(
      normalize({
        type: "event_msg",
        payload: {
          type: "context_compacted",
        },
      }).payload,
    ).toEqual({
      scope: "context",
      status: "compacted",
    });

    expect(
      normalize({
        type: "event_msg",
        payload: {
          type: "thread_rolled_back",
        },
      }).payload,
    ).toEqual({
      scope: "thread",
      status: "rolled_back",
    });
  });

  it("normalizes item_completed without treating it as a duplicate message", () => {
    const event = normalize({
      type: "event_msg",
      payload: {
        type: "item_completed",
        item: {
          type: "AgentMessage",
          id: "item-1",
        },
      },
    });

    expect(event.kind).toBe("lifecycle");

    expect(event.payload).toEqual({
      scope: "item",
      status: "completed",
      itemKind: "message",
    });

    expect(event.source.nativePayloadId).toBe("item-1");
  });

  it("normalizes state and metadata records", () => {
    const turnState = normalize({
      type: "turn_context",
      payload: {
        turn_id: "turn-1",
      },
    });

    expect(turnState.kind).toBe("state");

    expect(turnState.payload).toEqual({
      scope: "turn",
    });

    const session = normalize({
      type: "session_meta",
      payload: {
        cwd: "C:\\workspace",
      },
    });

    expect(session.kind).toBe("metadata");

    expect(session.payload).toEqual({
      scope: "session",
      workingDirectory: "C:\\workspace",
    });

    const tokens = normalize({
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          anything: true,
        },
      },
    });

    expect(tokens.kind).toBe("metadata");

    expect(tokens.payload).toEqual({
      metric: "tokens",
    });
  });

  it("maps unknown native semantics to unknown while preserving raw source", () => {
    const original = {
      type: "event_msg",
      payload: {
        type: "future_codex_event",
        future: true,
      },
    };

    const event = normalize(original);

    expect(event.kind).toBe("unknown");

    expect(event.payload).toEqual({});

    expect(event.raw).toEqual(original);

    expect(event.source.nativeTopLevelType).toBe("event_msg");

    expect(event.source.nativePayloadType).toBe("future_codex_event");
  });

  it("preserves complete native provenance separately from canonical semantics", () => {
    const event = normalize(
      {
        timestamp: "2026-08-29T01:00:00.000Z",
        type: "response_item",
        ordinal: 8,
        payload: {
          type: "function_call",
          id: "payload-1",
          turn_id: "turn-1",
          call_id: "call-1",
          name: "example",
          arguments: "{}",
        },
      },
      21,
    );

    expect(event.occurredAt).toBe("2026-08-29T01:00:00.000Z");

    expect(event.source).toEqual({
      adapter: "codex",
      nativeSessionId: "native-session-1",
      nativeSource: "rollout-example.jsonl",
      sourcePosition: 21,
      fingerprint: `sha256:${"a".repeat(64)}`,
      nativeOrdinal: 8,
      nativeTopLevelType: "response_item",
      nativePayloadType: "function_call",
      nativePayloadId: "payload-1",
      nativeTurnId: "turn-1",
      nativeCallId: "call-1",
    });

    expect(event.kind).toBe("tool_call");
  });
});
