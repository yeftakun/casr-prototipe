import { resumeCodexSession } from "../../adapters/codex/codex-process.js";
import { getResumeTarget } from "../../core/session/resume-target.js";
import { openCasrDatabase } from "../../storage/database.js";
import { runMigrations } from "../../storage/migrations.js";
import { SessionQueryRepository } from "../../storage/repositories/session-query-repository.js";

export function runResume(sessionId: string): void {
  const database = openCasrDatabase();

  let target: ReturnType<typeof getResumeTarget> | null = null;

  try {
    runMigrations(database);

    const repository = new SessionQueryRepository(database);
    const session = repository.getSessionById(sessionId);

    if (!session) {
      console.error(`Session not found: ${sessionId}`);
      process.exitCode = 1;
      return;
    }

    target = getResumeTarget(session);
  } finally {
    database.close();
  }

  if (!target) {
    return;
  }

  if (target.adapter !== "codex") {
    console.error(`Resume is not supported for adapter: ${target.adapter}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Resuming Codex session: ${target.nativeSessionId}`);

  const result = resumeCodexSession(
    target.nativeSessionId,
    target.workspacePath,
  );

  if (result.status !== 0) {
    process.exitCode = result.status;
  }
}
