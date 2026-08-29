import { describe, expect, it } from "vitest";

import { createProgram } from "../src/cli/program.js";

describe("CASR CLI", () => {
  it("uses the expected CLI identity", () => {
    const program = createProgram();

    expect(program.name()).toBe("casr");
    expect(program.description()).toBe("Canonical Agent Session Runtime");
    expect(program.version()).toBe("0.2.0");
  });

  it("registers all CLI commands", () => {
    const program = createProgram();

    expect(program.commands.map((command) => command.name())).toEqual([
      "doctor",
      "sync",
      "sessions",
      "inspect",
      "resume",
      "history",
    ]);
  });
});
