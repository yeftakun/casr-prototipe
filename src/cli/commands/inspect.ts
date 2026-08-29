import type Database from "better-sqlite3";

import {
  type ImportSourceDiagnostic,
  SessionDiagnosticsService,
} from "../../services/session-diagnostics-service.js";

import { openCasrDatabase } from "../../storage/database.js";

import { runMigrations } from "../../storage/migrations.js";

export interface InspectOptions {
  json?: boolean;
}

export interface InspectDependencies {
  openDatabase?: () => Database.Database;

  log?: (value: string) => void;

  error?: (value: string) => void;

  setExitCode?: (code: number) => void;
}

function displayNumber(value: number | null): string {
  return value === null ? "-" : String(value);
}

function printImportDiagnostic(
  diagnostic: ImportSourceDiagnostic,
  log: (value: string) => void,
  index: number,
): void {
  log(`Source ${index + 1}`);

  log("");

  log(`Agent             : ${diagnostic.adapter}`);

  log(`Native ID         : ${diagnostic.nativeSessionId}`);

  log(`Path              : ${diagnostic.nativeSource}`);

  log(`Status            : ${diagnostic.status}`);

  log(
    `Cursor            : ${diagnostic.cursorPresent ? "PRESENT" : "MISSING"}`,
  );

  log(`Record Index      : ${displayNumber(diagnostic.recordIndex)}`);

  log(`Byte Offset       : ${displayNumber(diagnostic.byteOffset)}`);

  log(`Checkpoint Size   : ${displayNumber(diagnostic.checkpointFileSize)}`);

  log(`Current Size      : ${displayNumber(diagnostic.currentFileSize)}`);

  log(`Lag Bytes         : ${displayNumber(diagnostic.lagBytes)}`);

  log(`Anchor            : ${diagnostic.anchorPresent ? "SET" : "EMPTY"}`);

  log(`Cursor Updated    : ${diagnostic.cursorUpdatedAt ?? "-"}`);

  if (diagnostic.sourceError) {
    log(`Source Error      : ${diagnostic.sourceError}`);
  }
}

export function runInspect(
  sessionId: string,
  options: InspectOptions = {},
  dependencies: InspectDependencies = {},
): void {
  const openDatabase = dependencies.openDatabase ?? openCasrDatabase;

  const log = dependencies.log ?? console.log;

  const error = dependencies.error ?? console.error;

  const setExitCode =
    dependencies.setExitCode ??
    ((code: number) => {
      process.exitCode = code;
    });

  const database = openDatabase();

  try {
    runMigrations(database);

    const service = new SessionDiagnosticsService(database);

    const result = service.inspect(sessionId);

    if (!result) {
      error(`Session not found: ${sessionId}`);

      setExitCode(1);
      return;
    }

    if (options.json) {
      log(JSON.stringify(result, null, 2));

      return;
    }

    const session = result.session;

    log("CASR Session");
    log("");

    log(`ID        : ${session.id}`);

    log(`Title     : ${session.title}`);

    log(`Workspace : ${session.workspacePath}`);

    log(`Status    : ${session.status}`);

    log(`Created   : ${session.createdAt}`);

    log(`Updated   : ${session.updatedAt}`);

    log("");
    log("Native Binding");
    log("");

    log(`Agent     : ${session.nativeBinding.adapter}`);

    log(`Native ID : ${session.nativeBinding.nativeSessionId}`);

    log(`Path      : ${session.nativeBinding.nativePath}`);

    log(`Provider  : ${session.nativeBinding.provider}`);

    log(`Model     : ${session.nativeBinding.model ?? "unknown"}`);

    log(`Created   : ${session.nativeBinding.createdAt}`);

    log(`Updated   : ${session.nativeBinding.updatedAt}`);

    log("");
    log("Canonical History");
    log("");

    log(`Events          : ${result.canonicalHistory.eventCount}`);

    log(
      `First Sequence  : ${displayNumber(result.canonicalHistory.firstSequence)}`,
    );

    log(
      `Last Sequence   : ${displayNumber(result.canonicalHistory.lastSequence)}`,
    );

    log(`Last Imported   : ${result.canonicalHistory.lastImportedAt ?? "-"}`);

    log("");
    log("Import Diagnostics");
    log("");

    if (result.imports.length === 0) {
      log("No native import sources.");
    } else {
      result.imports.forEach((diagnostic, index) => {
        if (index > 0) {
          log("");
        }

        printImportDiagnostic(diagnostic, log, index);
      });
    }

    log("");
    log("Metadata");
    log("");

    log(JSON.stringify(session.nativeBinding.metadata, null, 2));
  } finally {
    database.close();
  }
}
