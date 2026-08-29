import { join } from "node:path";

import Database from "better-sqlite3";

import type { NativeSession } from "../../core/session/native-session.js";
import { assertSupportedCodexSchema } from "./codex-schema.js";
import type { CodexThreadRow } from "./codex-types.js";

function unixSecondsToIso(value: number): string {
  return new Date(value * 1000).toISOString();
}

function normalizeThread(row: CodexThreadRow): NativeSession {
  return {
    adapter: "codex",
    nativeSessionId: row.id,
    title: row.title,
    workspacePath: row.cwd,
    nativePath: row.rollout_path,
    provider: row.model_provider,
    model: row.model,
    reasoningEffort: row.reasoning_effort,
    source: row.source,
    threadSource: row.thread_source,
    historyMode: row.history_mode,
    projectId: row.project_id,
    archived: row.archived !== 0,
    createdAt: unixSecondsToIso(row.created_at),
    updatedAt: unixSecondsToIso(row.updated_at),
  };
}

export class CodexAdapter {
  constructor(private readonly codexHome: string) {}

  discoverSessions(): NativeSession[] {
    const stateDbPath = join(this.codexHome, "state_5.sqlite");

    const database = new Database(stateDbPath, {
      readonly: true,
      fileMustExist: true,
    });

    try {
      assertSupportedCodexSchema(database);
      const rows = database
        .prepare(
          `
            SELECT
              id,
              title,
              cwd,
              model_provider,
              model,
              reasoning_effort,
              rollout_path,
              source,
              thread_source,
              history_mode,
              project_id,
              archived,
              created_at,
              updated_at
            FROM threads
            ORDER BY updated_at DESC
          `,
        )
        .all() as CodexThreadRow[];

      return rows.map(normalizeThread);
    } finally {
      database.close();
    }
  }
}
