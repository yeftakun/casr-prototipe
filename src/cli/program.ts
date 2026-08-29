import { Command } from "commander";

import {
  type DoctorOptions,
  printDoctorResult,
  runDoctorChecks,
} from "./commands/doctor.js";

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

  return program;
}
