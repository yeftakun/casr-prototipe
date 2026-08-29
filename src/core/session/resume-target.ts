import type { SessionDetail } from "./session-view.js";

export interface ResumeTarget {
  adapter: string;
  nativeSessionId: string;
  workspacePath: string;
}

export function getResumeTarget(session: SessionDetail): ResumeTarget {
  return {
    adapter: session.nativeBinding.adapter,
    nativeSessionId: session.nativeBinding.nativeSessionId,
    workspacePath: session.workspacePath,
  };
}
