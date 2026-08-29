import { CodexAdapter } from "../../adapters/codex/codex-adapter.js";

import { readCodexCanonicalHistoryBatch } from "../../adapters/codex/codex-canonical-history-reader.js";

import { resolveCodexHome } from "../../adapters/codex/codex-environment.js";

import { syncNativeSessionsWithHistory } from "../../services/sync-with-history-service.js";

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

    const result = syncNativeSessionsWithHistory(
      database,
      repository,
      nativeSessions,
      readCodexCanonicalHistoryBatch,
    );

    console.log("CASR Sync");
    console.log("");

    console.log(`Discovered       : ${result.discovered}`);

    console.log(`Imported         : ${result.imported}`);

    console.log(`Updated          : ${result.updated}`);

    console.log(`Unchanged        : ${result.unchanged}`);

    console.log("");
    console.log("Canonical History");
    console.log("");

    console.log(`Sources          : ${result.history.sources}`);

    console.log(`Succeeded        : ${result.history.succeeded}`);

    console.log(`Failed           : ${result.history.failed}`);

    console.log(`Records read     : ${result.history.recordsRead}`);

    console.log(`Events inserted  : ${result.history.inserted}`);

    console.log(`Already known    : ${result.history.alreadyKnown}`);

    console.log(`EOF              : ${result.history.eof}`);

    console.log(`Malformed        : ${result.history.malformed}`);

    console.log(`Deferred tail    : ${result.history.deferred}`);

    if (result.failures.length > 0) {
      console.log("");
      console.log("History Failures");

      for (const failure of result.failures) {
        console.log(
          `- ${failure.adapter}:${failure.nativeSessionId}: ${failure.error}`,
        );
      }
    }
  } finally {
    database.close();
  }
}
