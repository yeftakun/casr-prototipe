import { CodexAdapter } from "../../adapters/codex/codex-adapter.js";
import { resolveCodexHome } from "../../adapters/codex/codex-environment.js";
import { syncNativeSessions } from "../../core/session/sync-service.js";
import { openCasrDatabase } from "../../storage/database.js";
import { runMigrations } from "../../storage/migrations.js";
import { SessionRegistryRepository } from "../../storage/repositories/session-registry-repository.js";

export interface SyncOptions {
  codexHome?: string;
}

export function runSync(options: SyncOptions = {}): void {
  const codexHome = resolveCodexHome(options.codexHome);

  const adapter = new CodexAdapter(codexHome.path);
  const nativeSessions = adapter.discoverSessions();

  const database = openCasrDatabase();

  try {
    runMigrations(database);

    const repository = new SessionRegistryRepository(database);

    const result = syncNativeSessions(repository, nativeSessions);

    console.log("CASR Sync");
    console.log("");
    console.log(`Discovered : ${result.discovered}`);
    console.log(`Imported   : ${result.imported}`);
    console.log(`Updated    : ${result.updated}`);
    console.log(`Unchanged  : ${result.unchanged}`);
  } finally {
    database.close();
  }
}
