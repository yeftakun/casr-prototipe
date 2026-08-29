import type { CodexRolloutRecord } from "../codex-rollout-reader.js";

export const CODEX_NATIVE_EVENT_FAMILIES = [
  "response_item",
  "event_msg",
  "session_meta",
  "turn_context",
  "world_state",
  "compacted",
  "unknown",
] as const;

export type CodexNativeEventFamily =
  (typeof CODEX_NATIVE_EVENT_FAMILIES)[number];

/**
 * Adapter-local representation of a parsed Codex rollout event.
 *
 * This type intentionally contains Codex-native vocabulary.
 * It MUST remain inside the Codex adapter boundary.
 *
 * It is not a CanonicalEvent.
 */
export interface CodexNativeEvent {
  /**
   * Known Codex top-level family or "unknown".
   */
  family: CodexNativeEventFamily;

  /**
   * Exact native top-level `type` when available.
   *
   * Example:
   * response_item
   * event_msg
   * compacted
   */
  nativeTopLevelType: string | null;

  /**
   * Native payload subtype when available.
   *
   * Example:
   * message
   * function_call
   * task_started
   */
  nativePayloadType: string | null;

  /**
   * Native payload preserved without semantic normalization.
   */
  payload: unknown;

  /**
   * Optional direct payload identity.
   *
   * This is linkage/provenance metadata only.
   * It is NOT a universal native record identity.
   */
  payloadId: string | null;

  /**
   * Native turn grouping metadata.
   */
  turnId: string | null;

  /**
   * Native tool call/result relationship metadata.
   */
  callId: string | null;

  /**
   * Native message role when directly observable.
   */
  role: string | null;

  /**
   * Newer Codex `item_completed` records may wrap an item.
   */
  nestedItemType: string | null;
  nestedItemId: string | null;

  /**
   * Original reader record.
   *
   * Retained so parsing never destroys raw source evidence.
   */
  record: CodexRolloutRecord;
}
