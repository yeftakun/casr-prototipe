import type { CodexRolloutRecord } from "../codex-rollout-reader.js";
import {
  CODEX_NATIVE_EVENT_FAMILIES,
  type CodexNativeEvent,
  type CodexNativeEventFamily,
} from "./codex-native-event.js";

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

function hasOwn(object: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(object, key);
}

export function isKnownCodexNativeEventFamily(
  value: string,
): value is Exclude<CodexNativeEventFamily, "unknown"> {
  return (
    value !== "unknown" &&
    (CODEX_NATIVE_EVENT_FAMILIES as readonly string[]).includes(value)
  );
}

/**
 * Parse one valid physical Codex rollout record into
 * an adapter-local native event representation.
 *
 * Important:
 *
 * - this function does not canonicalize semantics;
 * - unknown valid records are preserved;
 * - provider-native vocabulary remains inside this adapter;
 * - native IDs are treated as linkage metadata only.
 */
export function parseCodexNativeEvent(
  record: CodexRolloutRecord,
): CodexNativeEvent {
  const root = asObject(record.parsed);

  const nativeTopLevelType =
    record.nativeTopLevelType ?? readString(root, "type");

  const family =
    nativeTopLevelType !== null &&
    isKnownCodexNativeEventFamily(nativeTopLevelType)
      ? nativeTopLevelType
      : "unknown";

  let payload: unknown = null;

  if (root && hasOwn(root, "payload")) {
    payload = root.payload;
  }

  const payloadObject = asObject(payload);

  const nativePayloadType = readString(payloadObject, "type");

  const nestedItem =
    payloadObject && hasOwn(payloadObject, "item")
      ? asObject(payloadObject.item)
      : null;

  const payloadId = readString(payloadObject, "id");

  const nestedItemId = readString(nestedItem, "id");

  const nestedItemType = readString(nestedItem, "type");

  const turnId =
    readString(payloadObject, "turn_id") ?? readString(nestedItem, "turn_id");

  const callId =
    readString(payloadObject, "call_id") ?? readString(nestedItem, "call_id");

  const role =
    readString(payloadObject, "role") ?? readString(nestedItem, "role");

  return {
    family,
    nativeTopLevelType,
    nativePayloadType,
    payload,
    payloadId,
    turnId,
    callId,
    role,
    nestedItemType,
    nestedItemId,
    record,
  };
}
