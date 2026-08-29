export const CANONICAL_EVENT_KINDS = [
  "message",
  "tool_call",
  "tool_result",
  "reasoning",
  "lifecycle",
  "state",
  "metadata",
  "unknown",
] as const;

export type CanonicalEventKind = (typeof CANONICAL_EVENT_KINDS)[number];

export const CANONICAL_MESSAGE_ROLES = [
  "user",
  "assistant",
  "developer",
  "system",
  "unknown",
] as const;

export type CanonicalMessageRole = (typeof CANONICAL_MESSAGE_ROLES)[number];

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface CanonicalEventSource {
  /**
   * Adapter that produced this canonical event.
   *
   * Example:
   * codex
   */
  adapter: string;

  /**
   * Native session identity owned by the adapter/provider.
   */
  nativeSessionId: string;

  /**
   * Native source identity.
   *
   * For Codex v0.2 this is expected to represent the rollout source.
   * The native path itself must remain lossless.
   */
  nativeSource: string;

  /**
   * Zero-based physical position inside the native event source.
   *
   * This is the primary ordering evidence discovered during
   * the Codex rollout spike.
   */
  sourcePosition: number;

  /**
   * Stable fingerprint of the original raw native record.
   *
   * Intended for deduplication / mutation diagnostics.
   */
  fingerprint: string;

  /**
   * Optional native ordering metadata.
   *
   * Newer Codex rollouts expose `ordinal`.
   * Older rollouts do not.
   */
  nativeOrdinal: number | null;

  /**
   * Native/provider vocabulary is retained only as provenance.
   *
   * These values must not become CASR core event kinds.
   */
  nativeTopLevelType: string | null;
  nativePayloadType: string | null;

  /**
   * Optional native relationship metadata.
   *
   * None of these fields are universal event identities.
   */
  nativePayloadId: string | null;
  nativeTurnId: string | null;
  nativeCallId: string | null;
}

/**
 * Provider-neutral event produced by an adapter before persistence.
 *
 * The adapter/normalizer does NOT assign:
 *
 * - CASR event ID
 * - CASR session ID
 * - canonical sequence
 * - imported timestamp
 *
 * Those belong to the CASR persistence/import layer.
 */
export interface CanonicalEventDraft {
  kind: CanonicalEventKind;

  /**
   * Only meaningful for message events.
   *
   * Non-message events normally use null.
   */
  role: CanonicalMessageRole | null;

  /**
   * Native timestamp when available.
   *
   * Timestamp is temporal metadata, not the primary ordering key.
   */
  occurredAt: string | null;

  /**
   * Provider-neutral semantic representation.
   */
  payload: JsonValue;

  /**
   * Native source provenance and relationship metadata.
   */
  source: CanonicalEventSource;

  /**
   * Complete parsed native record.
   *
   * This must remain available so unknown or newly supported native
   * records can be reinterpreted later without information loss.
   */
  raw: JsonValue;
}

/**
 * Persisted CASR canonical event.
 *
 * Canonical sequence is CASR-owned and must not be confused with
 * native source position or native ordinal.
 */
export interface CanonicalEvent extends CanonicalEventDraft {
  id: string;
  sessionId: string;
  sequence: number;
  importedAt: string;
}

export function isCanonicalEventKind(
  value: string,
): value is CanonicalEventKind {
  return (CANONICAL_EVENT_KINDS as readonly string[]).includes(value);
}

export function isCanonicalMessageRole(
  value: string,
): value is CanonicalMessageRole {
  return (CANONICAL_MESSAGE_ROLES as readonly string[]).includes(value);
}
