import type {
  SourceContentProbeRequest,
  SourceContentProbeResult,
  SourceReadIssue,
} from "../../services/session-diagnostics-service.js";

import { readCodexRollout } from "./codex-rollout-reader.js";

export function probeCodexSourceHealth(
  request: SourceContentProbeRequest,
): SourceContentProbeResult {
  if (request.adapter !== "codex") {
    throw new Error(
      `Codex source health probe cannot inspect adapter ${request.adapter}.`,
    );
  }

  const rollout = readCodexRollout(request.nativeSource, {
    startOffset: request.startOffset,

    startRecordIndex: request.startRecordIndex,
  });

  let issue: SourceReadIssue | null = null;

  if (rollout.malformedRecord) {
    issue = {
      reason: "malformed_record",

      recordIndex: rollout.malformedRecord.recordIndex,

      byteOffsetStart: rollout.malformedRecord.byteOffsetStart,

      byteOffsetEnd: rollout.malformedRecord.byteOffsetEnd,

      error: rollout.malformedRecord.error,
    };
  } else if (rollout.deferredTail) {
    issue = {
      reason: "deferred_tail",

      recordIndex: rollout.deferredTail.recordIndex,

      byteOffsetStart: rollout.deferredTail.byteOffsetStart,

      byteOffsetEnd: rollout.deferredTail.byteOffsetEnd,

      error: rollout.deferredTail.error,
    };
  }

  return {
    pendingRecordCount: rollout.records.length,

    issue,
  };
}
