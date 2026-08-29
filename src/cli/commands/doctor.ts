import { spawnSync } from "node:child_process";

import {
  type CodexHomeSource,
  type CodexStorageStatus,
  inspectCodexStorage,
  resolveCodexHome,
} from "../../adapters/codex/codex-environment.js";

export interface DoctorOptions {
  codexHome?: string;
}

export interface DoctorResult {
  nodeVersion: string;
  codexAvailable: boolean;
  codexVersion: string | null;
  codexHomeSource: CodexHomeSource;
  storage: CodexStorageStatus;
}

export function runDoctorChecks(options: DoctorOptions = {}): DoctorResult {
  const nodeVersion = process.version;

  const codex = spawnSync("codex", ["--version"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  const codexAvailable = codex.status === 0;

  const codexVersion = codexAvailable ? codex.stdout.trim() : null;

  const codexHome = resolveCodexHome(options.codexHome);
  const storage = inspectCodexStorage(codexHome.path);

  return {
    nodeVersion,
    codexAvailable,
    codexVersion,
    codexHomeSource: codexHome.source,
    storage,
  };
}

export function printDoctorResult(result: DoctorResult): void {
  console.log("CASR Doctor");
  console.log("");

  console.log("Runtime");
  console.log(`[OK] Node.js ${result.nodeVersion}`);

  console.log("");
  console.log("Codex");

  if (result.codexAvailable) {
    console.log(`[OK] ${result.codexVersion}`);
  } else {
    console.log("[FAIL] Codex CLI not found");
  }

  console.log(
    `[OK] CODEX_HOME ${result.storage.codexHome} (${result.codexHomeSource})`,
  );

  console.log("");
  console.log("Storage");

  console.log(
    result.storage.stateDbExists
      ? "[OK] state_5.sqlite"
      : "[FAIL] state_5.sqlite not found",
  );

  console.log(
    result.storage.sessionsDirectoryExists
      ? "[OK] sessions/"
      : "[FAIL] sessions/ not found",
  );

  console.log(
    result.storage.stateDbReadable
      ? "[OK] state_5.sqlite readable (read-only)"
      : "[FAIL] state_5.sqlite could not be opened",
  );

  console.log(
    result.storage.threadsTableExists
      ? "[OK] threads table"
      : "[FAIL] threads table not found",
  );

  if (result.storage.stateDbReadable && result.storage.threadsTableExists) {
    if (result.storage.schemaSupported) {
      console.log("[OK] Codex storage schema compatible");
    } else {
      console.log("[FAIL] Codex storage schema unsupported");

      if (result.storage.missingColumns.length > 0) {
        console.log(
          `[INFO] Missing columns: ${result.storage.missingColumns.join(", ")}`,
        );
      }
    }
  }

  if (result.storage.threadCount !== null) {
    console.log(
      `[INFO] ${result.storage.threadCount} native Codex sessions detected`,
    );
  }

  if (result.storage.error) {
    console.log(`[ERROR] ${result.storage.error}`);
  }
}
