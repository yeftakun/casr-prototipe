import { spawnSync } from "node:child_process";

export interface CodexResumeResult {
  status: number;
}

function normalizeProcessCwd(workspacePath: string): string {
  if (process.platform === "win32" && workspacePath.startsWith("\\\\?\\")) {
    return workspacePath.slice(4);
  }

  return workspacePath;
}

export function resumeCodexSession(
  nativeSessionId: string,
  workspacePath: string,
): CodexResumeResult {
  const result = spawnSync("codex", ["resume", nativeSessionId], {
    stdio: "inherit",
    shell: process.platform === "win32",
    cwd: normalizeProcessCwd(workspacePath),
  });

  if (result.error) {
    throw result.error;
  }

  return {
    status: result.status ?? 1,
  };
}
