import { Command } from "commander";

export function createProgram(): Command {
  return new Command()
    .name("casr")
    .description("Canonical Agent Session Runtime")
    .version("0.1.0");
}
