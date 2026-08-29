import { Command } from "commander";

import {
  type DoctorOptions,
  printDoctorResult,
  runDoctorChecks,
} from "./commands/doctor.js";
import { runInspect } from "./commands/inspect.js";
import { runSessions } from "./commands/sessions.js";
import { runSync, type SyncOptions } from "./commands/sync.js";

export function createProgram(): Command {
  const program = new Command()
    .name("casr")
    .description("Canonical Agent Session Runtime")
    .version("0.1.0");

  program
    .command("doctor")
    .description("Check CASR and Codex environment")
    .option("--codex-home <path>", "Override Codex home directory")
    .action((options: DoctorOptions) => {
      const result = runDoctorChecks(options);
      printDoctorResult(result);
    });

  program
    .command("sync")
    .description("Import and update native agent sessions")
    .option("--codex-home <path>", "Override Codex home directory")
    .action((options: SyncOptions) => {
      runSync(options);
    });

  program
    .command("sessions")
    .description("List CASR sessions")
    .action(() => {
      runSessions();
    });

  program
    .command("inspect")
    .description("Inspect a CASR session")
    .argument("<session-id>", "CASR session ID")
    .action((sessionId: string) => {
      runInspect(sessionId);
    });

  return program;
}
