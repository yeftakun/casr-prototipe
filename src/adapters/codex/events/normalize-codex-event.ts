import {
  type CanonicalEventDraft,
  type CanonicalMessageRole,
  isCanonicalMessageRole,
  type JsonValue,
} from "../../../core/events/canonical-event.js";
import type { CodexNativeEvent } from "./codex-native-event.js";

export interface NormalizeCodexEventContext {
  nativeSessionId: string;
  nativeSource: string;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(
  object: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!object) {
    return null;
  }

  const value = object[key];

  return typeof value === "string" ? value : null;
}

function readBoolean(
  object: Record<string, unknown> | null,
  key: string,
): boolean | null {
  if (!object) {
    return null;
  }

  const value = object[key];

  return typeof value === "boolean" ? value : null;
}

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (typeof value === "object" && value !== null) {
    const result: {
      [key: string]: JsonValue;
    } = {};

    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) {
        continue;
      }

      result[key] = toJsonValue(item);
    }

    return result;
  }

  return null;
}

function parseToolInput(value: unknown): JsonValue {
  if (typeof value !== "string") {
    return toJsonValue(value);
  }

  try {
    return toJsonValue(JSON.parse(value) as unknown);
  } catch {
    return value;
  }
}

function extractText(payload: unknown): string | null {
  const object = asObject(payload);

  if (!object) {
    return null;
  }

  const message = readString(object, "message");

  if (message !== null) {
    return message;
  }

  const content = object.content;

  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const parts: string[] = [];

  for (const item of content) {
    if (typeof item === "string") {
      parts.push(item);
      continue;
    }

    const itemObject = asObject(item);

    if (!itemObject) {
      continue;
    }

    const text = readString(itemObject, "text");

    if (text !== null) {
      parts.push(text);
    }
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

function normalizeRole(event: CodexNativeEvent): CanonicalMessageRole {
  if (event.role !== null && isCanonicalMessageRole(event.role)) {
    return event.role;
  }

  if (event.nativePayloadType === "user_message") {
    return "user";
  }

  if (event.nativePayloadType === "agent_message") {
    return "assistant";
  }

  return "unknown";
}

function normalizeNestedItemKind(value: string | null): string {
  switch (value) {
    case "UserMessage":
    case "AgentMessage":
      return "message";

    case "Reasoning":
      return "reasoning";

    case "Plan":
      return "plan";

    default:
      return "unknown";
  }
}

function baseDraft(
  event: CodexNativeEvent,
  context: NormalizeCodexEventContext,
): Omit<CanonicalEventDraft, "kind" | "role" | "payload"> {
  return {
    occurredAt: event.record.timestamp,

    source: {
      adapter: "codex",

      nativeSessionId: context.nativeSessionId,

      nativeSource: context.nativeSource,

      sourcePosition: event.record.recordIndex,

      fingerprint: event.record.fingerprint,

      nativeOrdinal: event.record.nativeOrdinal,

      nativeTopLevelType: event.nativeTopLevelType,

      nativePayloadType: event.nativePayloadType,

      nativePayloadId: event.payloadId ?? event.nestedItemId,

      nativeTurnId: event.turnId,

      nativeCallId: event.callId,
    },

    raw: toJsonValue(event.record.parsed),
  };
}

export function normalizeCodexEvent(
  event: CodexNativeEvent,
  context: NormalizeCodexEventContext,
): CanonicalEventDraft {
  const base = baseDraft(event, context);

  const payloadObject = asObject(event.payload);

  if (
    event.nativePayloadType === "message" ||
    event.nativePayloadType === "user_message" ||
    event.nativePayloadType === "agent_message"
  ) {
    return {
      ...base,
      kind: "message",
      role: normalizeRole(event),
      payload: {
        text: extractText(event.payload),
      },
    };
  }

  if (
    event.nativePayloadType === "function_call" ||
    event.nativePayloadType === "custom_tool_call"
  ) {
    const input =
      event.nativePayloadType === "function_call"
        ? parseToolInput(payloadObject?.arguments)
        : toJsonValue(payloadObject?.input);

    return {
      ...base,
      kind: "tool_call",
      role: null,
      payload: {
        name: readString(payloadObject, "name") ?? "unknown",
        input,
      },
    };
  }

  if (
    event.nativePayloadType === "function_call_output" ||
    event.nativePayloadType === "custom_tool_call_output"
  ) {
    return {
      ...base,
      kind: "tool_result",
      role: null,
      payload: {
        output: toJsonValue(payloadObject?.output),
      },
    };
  }

  if (event.nativePayloadType === "reasoning") {
    return {
      ...base,
      kind: "reasoning",
      role: null,
      payload: {
        summary: toJsonValue(payloadObject?.summary),
        content: toJsonValue(payloadObject?.content),
      },
    };
  }

  if (event.nativePayloadType === "task_started") {
    return {
      ...base,
      kind: "lifecycle",
      role: null,
      payload: {
        scope: "turn",
        status: "started",
      },
    };
  }

  if (event.nativePayloadType === "task_complete") {
    return {
      ...base,
      kind: "lifecycle",
      role: null,
      payload: {
        scope: "turn",
        status: "completed",
      },
    };
  }

  if (event.nativePayloadType === "turn_aborted") {
    return {
      ...base,
      kind: "lifecycle",
      role: null,
      payload: {
        scope: "turn",
        status: "aborted",
      },
    };
  }

  if (event.nativePayloadType === "item_completed") {
    return {
      ...base,
      kind: "lifecycle",
      role: null,
      payload: {
        scope: "item",
        status: "completed",
        itemKind: normalizeNestedItemKind(event.nestedItemType),
      },
    };
  }

  if (
    event.nativePayloadType === "context_compacted" ||
    event.family === "compacted"
  ) {
    return {
      ...base,
      kind: "lifecycle",
      role: null,
      payload: {
        scope: "context",
        status: "compacted",
      },
    };
  }

  if (event.nativePayloadType === "thread_rolled_back") {
    return {
      ...base,
      kind: "lifecycle",
      role: null,
      payload: {
        scope: "thread",
        status: "rolled_back",
      },
    };
  }

  if (event.nativePayloadType === "patch_apply_end") {
    return {
      ...base,
      kind: "lifecycle",
      role: null,
      payload: {
        scope: "patch",
        status: "completed",
        success: readBoolean(payloadObject, "success"),
      },
    };
  }

  if (event.family === "turn_context" || event.family === "world_state") {
    return {
      ...base,
      kind: "state",
      role: null,
      payload: {
        scope: event.family === "turn_context" ? "turn" : "world",
      },
    };
  }

  if (event.nativePayloadType === "thread_settings_applied") {
    return {
      ...base,
      kind: "state",
      role: null,
      payload: {
        scope: "settings",
        status: "applied",
      },
    };
  }

  if (event.family === "session_meta") {
    return {
      ...base,
      kind: "metadata",
      role: null,
      payload: {
        scope: "session",
        workingDirectory: readString(payloadObject, "cwd"),
      },
    };
  }

  if (event.nativePayloadType === "token_count") {
    return {
      ...base,
      kind: "metadata",
      role: null,
      payload: {
        metric: "tokens",
      },
    };
  }

  return {
    ...base,
    kind: "unknown",
    role: null,
    payload: {},
  };
}
