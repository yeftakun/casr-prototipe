import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

function expandHome(input: string): string {
  if (input === "~") {
    return homedir();
  }

  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return join(homedir(), input.slice(2));
  }

  return input;
}

export function resolveCasrHome(): string {
  const envValue = process.env.CASR_HOME?.trim();

  if (envValue) {
    const expanded = expandHome(envValue);

    return isAbsolute(expanded) ? expanded : resolve(expanded);
  }

  return join(homedir(), ".casr");
}
