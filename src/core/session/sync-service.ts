import type { SessionRegistryRepository } from "../../storage/repositories/session-registry-repository.js";
import type { NativeSession } from "./native-session.js";

export interface SyncSummary {
  discovered: number;
  imported: number;
  updated: number;
  unchanged: number;
}

export function syncNativeSessions(
  repository: SessionRegistryRepository,
  nativeSessions: NativeSession[],
): SyncSummary {
  const summary: SyncSummary = {
    discovered: nativeSessions.length,
    imported: 0,
    updated: 0,
    unchanged: 0,
  };

  for (const nativeSession of nativeSessions) {
    const result = repository.syncNativeSession(nativeSession);

    summary[result] += 1;
  }

  return summary;
}
