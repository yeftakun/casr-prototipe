import { openCasrDatabase } from "../../storage/database.js";
import { runMigrations } from "../../storage/migrations.js";
import { SessionQueryRepository } from "../../storage/repositories/session-query-repository.js";

export function runInspect(sessionId: string): void {
  const database = openCasrDatabase();

  try {
    runMigrations(database);

    const repository = new SessionQueryRepository(database);
    const session = repository.getSessionById(sessionId);

    if (!session) {
      console.error(`Session not found: ${sessionId}`);
      process.exitCode = 1;
      return;
    }

    console.log("CASR Session");
    console.log("");
    console.log(`ID        : ${session.id}`);
    console.log(`Title     : ${session.title}`);
    console.log(`Workspace : ${session.workspacePath}`);
    console.log(`Status    : ${session.status}`);
    console.log(`Created   : ${session.createdAt}`);
    console.log(`Updated   : ${session.updatedAt}`);

    console.log("");
    console.log("Native Binding");
    console.log("");
    console.log(`Agent     : ${session.nativeBinding.adapter}`);
    console.log(`Native ID : ${session.nativeBinding.nativeSessionId}`);
    console.log(`Path      : ${session.nativeBinding.nativePath}`);
    console.log(`Provider  : ${session.nativeBinding.provider}`);
    console.log(`Model     : ${session.nativeBinding.model ?? "unknown"}`);
    console.log(`Created   : ${session.nativeBinding.createdAt}`);
    console.log(`Updated   : ${session.nativeBinding.updatedAt}`);

    console.log("");
    console.log("Metadata");
    console.log("");
    console.log(JSON.stringify(session.nativeBinding.metadata, null, 2));
  } finally {
    database.close();
  }
}
