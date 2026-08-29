import type Database from "better-sqlite3";

export const REQUIRED_CODEX_THREAD_COLUMNS = [
  "id",
  "title",
  "cwd",
  "model_provider",
  "model",
  "reasoning_effort",
  "rollout_path",
  "source",
  "thread_source",
  "history_mode",
  "project_id",
  "archived",
  "created_at",
  "updated_at",
] as const;

interface TableInfoRow {
  name: string;
}

export interface CodexSchemaInspection {
  threadsTableExists: boolean;
  supported: boolean;
  missingColumns: string[];
}

export function inspectCodexSchema(
  database: Database.Database,
): CodexSchemaInspection {
  const table = database
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'threads'
        LIMIT 1
      `,
    )
    .get() as { name: string } | undefined;

  if (!table) {
    return {
      threadsTableExists: false,
      supported: false,
      missingColumns: [...REQUIRED_CODEX_THREAD_COLUMNS],
    };
  }

  const columns = database
    .prepare("PRAGMA table_info(threads)")
    .all() as TableInfoRow[];

  const availableColumns = new Set(columns.map((column) => column.name));

  const missingColumns = REQUIRED_CODEX_THREAD_COLUMNS.filter(
    (column) => !availableColumns.has(column),
  );

  return {
    threadsTableExists: true,
    supported: missingColumns.length === 0,
    missingColumns,
  };
}

export function assertSupportedCodexSchema(database: Database.Database): void {
  const inspection = inspectCodexSchema(database);

  if (!inspection.threadsTableExists) {
    throw new Error(
      "Unsupported Codex storage schema: required table `threads` was not found.",
    );
  }

  if (!inspection.supported) {
    throw new Error(
      [
        "Unsupported Codex storage schema.",
        `Missing required columns: ${inspection.missingColumns.join(", ")}`,
        "The installed Codex CLI storage schema may have changed.",
      ].join(" "),
    );
  }
}
