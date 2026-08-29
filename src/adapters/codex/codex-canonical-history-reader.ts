import type {
  CanonicalHistoryReadBatch,
  CanonicalHistoryReadRequest,
} from "../../services/canonical-import-service.js";

import { readCodexRollout } from "./codex-rollout-reader.js";
import { normalizeCodexEvent } from "./events/normalize-codex-event.js";
import { parseCodexNativeEvent } from "./events/parse-codex-event.js";

/**
 * Codex implementation of CanonicalHistoryReader.
 *
 * Codex vocabulary ends here.
 *
 * The generic import service receives only
 * CanonicalEventDraft values and source progress.
 */
export function readCodexCanonicalHistoryBatch(
  request: CanonicalHistoryReadRequest,
): CanonicalHistoryReadBatch {
  if (request.adapter !== "codex") {
    throw new Error(
      `Codex history reader cannot read adapter ${request.adapter}.`,
    );
  }

  const rollout = readCodexRollout(request.nativeSource, {
    startOffset: request.startOffset,

    startRecordIndex: request.startRecordIndex,
  });

  const drafts = rollout.records.map((record) => {
    const nativeEvent = parseCodexNativeEvent(record);

    return normalizeCodexEvent(nativeEvent, {
      nativeSessionId: request.nativeSessionId,

      nativeSource: request.nativeSource,
    });
  });

  const stopReason =
    rollout.malformedRecord !== null
      ? "malformed_record"
      : rollout.deferredTail !== null
        ? "deferred_tail"
        : "eof";

  return {
    drafts,

    fileSize: rollout.fileSize,

    nextOffset: rollout.nextOffset,

    nextRecordIndex: rollout.nextRecordIndex,

    stopReason,
  };
}
