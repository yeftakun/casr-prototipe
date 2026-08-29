import { describe, expect, it } from "vitest";

import { getResumeTarget } from "../src/core/session/resume-target.js";
import type { SessionDetail } from "../src/core/session/session-view.js";

describe("resume target", () => {
  it("resolves a native binding from a CASR session", () => {
    const session: SessionDetail = {
      id: "casr-test",
      title: "Test Session",
      workspacePath: String.raw`C:\workspace\test`,
      status: "active",
      createdAt: "2026-08-29T01:00:00.000Z",
      updatedAt: "2026-08-29T02:00:00.000Z",
      nativeBinding: {
        adapter: "codex",
        nativeSessionId: "native-test-id",
        nativePath: String.raw`C:\codex\test.jsonl`,
        provider: "openai",
        model: "gpt-test",
        metadata: {},
        createdAt: "2026-08-29T01:00:00.000Z",
        updatedAt: "2026-08-29T02:00:00.000Z",
      },
    };

    expect(getResumeTarget(session)).toEqual({
      adapter: "codex",
      nativeSessionId: "native-test-id",
      workspacePath: String.raw`C:\workspace\test`,
    });
  });
});
