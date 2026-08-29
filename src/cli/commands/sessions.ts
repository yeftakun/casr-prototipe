import { openCasrDatabase } from "../../storage/database.js";
import { runMigrations } from "../../storage/migrations.js";
import { SessionQueryRepository } from "../../storage/repositories/session-query-repository.js";

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

export function runSessions(): void {
  const database = openCasrDatabase();

  try {
    runMigrations(database);

    const repository = new SessionQueryRepository(database);
    const sessions = repository.listSessions();

    console.log("CASR Sessions");
    console.log("");
    console.log(`Total: ${sessions.length}`);
    console.log("");

    if (sessions.length === 0) {
      console.log("No sessions found.");
      console.log("Run `casr sync` first.");
      return;
    }

    for (const session of sessions) {
      console.log(session.id);
      console.log(`  Agent     : ${session.adapter}`);
      console.log(`  Title     : ${truncate(singleLine(session.title), 80)}`);
      console.log(`  Workspace : ${session.workspacePath}`);
      console.log(`  Status    : ${session.status}`);
      console.log(`  Updated   : ${session.updatedAt}`);
      console.log("");
    }
  } finally {
    database.close();
  }
}
