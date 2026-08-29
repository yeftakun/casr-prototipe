import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveCodexHome } from "../src/adapters/codex/codex-environment.js";

const originalCodexHome = process.env.CODEX_HOME;

afterEach(() => {
  if (originalCodexHome === undefined) {
    delete process.env.CODEX_HOME;
  } else {
    process.env.CODEX_HOME = originalCodexHome;
  }
});

describe("resolveCodexHome", () => {
  it("uses CLI value with highest priority", () => {
    process.env.CODEX_HOME = "env-codex-home";

    const result = resolveCodexHome("cli-codex-home");

    expect(result.source).toBe("cli");
    expect(result.path).toBe(resolve("cli-codex-home"));
  });

  it("uses CODEX_HOME environment variable when CLI value is absent", () => {
    process.env.CODEX_HOME = "env-codex-home";

    const result = resolveCodexHome();

    expect(result.source).toBe("env");
    expect(result.path).toBe(resolve("env-codex-home"));
  });

  it("defaults to ~/.codex when no override exists", () => {
    delete process.env.CODEX_HOME;

    const result = resolveCodexHome();

    expect(result.source).toBe("default");
    expect(result.path).toBe(join(homedir(), ".codex"));
  });
});
