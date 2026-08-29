import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import Database from "better-sqlite3";

export type CodexHomeSource = "cli" | "env" | "default";

export interface ResolvedCodexHome {
  path: string;
  source: CodexHomeSource;
}

export interface CodexStorageStatus {
  codexHome: string;
  stateDbPath: string;
  sessionsPath: string;
  stateDbExists: boolean;
  sessionsDirectoryExists: boolean;
  stateDbReadable: boolean;
  threadsTableExists: boolean;
  threadCount: number | null;
  error: string | null;
}

function expandHome(input: string): string {
  if (input === "~") {
    return homedir();
  }

  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return join(homedir(), input.slice(2));
  }

  return input;
}

export function resolveCodexHome(cliValue?: string): ResolvedCodexHome {
  const cliPath = cliValue?.trim();

  if (cliPath) {
    const expanded = expandHome(cliPath);

    return {
      path: isAbsolute(expanded) ? expanded : resolve(expanded),
      source: "cli",
    };
  }

  const envPath = process.env.CODEX_HOME?.trim();

  if (envPath) {
    const expanded = expandHome(envPath);

    return {
      path: isAbsolute(expanded) ? expanded : resolve(expanded),
      source: "env",
    };
  }

  return {
    path: join(homedir(), ".codex"),
    source: "default",
  };
}

export function inspectCodexStorage(codexHome: string): CodexStorageStatus {
  const stateDbPath = join(codexHome, "state_5.sqlite");
  const sessionsPath = join(codexHome, "sessions");

  const stateDbExists =
    existsSync(stateDbPath) && statSync(stateDbPath).isFile();

  const sessionsDirectoryExists =
    existsSync(sessionsPath) && statSync(sessionsPath).isDirectory();

  let stateDbReadable = false;
  let threadsTableExists = false;
  let threadCount: number | null = null;
  let error: string | null = null;

  if (stateDbExists) {
    let database: Database.Database | null = null;

    try {
      database = new Database(stateDbPath, {
        readonly: true,
        fileMustExist: true,
      });

      stateDbReadable = true;

      const table = database
        .prepare(
          `
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name = 'threads'
          `,
        )
        .get() as { name: string } | undefined;

      threadsTableExists = table?.name === "threads";

      if (threadsTableExists) {
        const result = database
          .prepare("SELECT COUNT(*) AS count FROM threads")
          .get() as { count: number };

        threadCount = result.count;
      }
    } catch (caughtError) {
      error =
        caughtError instanceof Error
          ? caughtError.message
          : String(caughtError);
    } finally {
      database?.close();
    }
  }

  return {
    codexHome,
    stateDbPath,
    sessionsPath,
    stateDbExists,
    sessionsDirectoryExists,
    stateDbReadable,
    threadsTableExists,
    threadCount,
    error,
  };
}
