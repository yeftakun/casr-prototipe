import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type Database from "better-sqlite3";

interface Migration {
  version: number;
  name: string;
  fileName: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: "initial",
    fileName: "0001_initial.sql",
  },
  {
    version: 2,
    name: "canonical_events",
    fileName: "0002_canonical_events.sql",
  },
];

function getMigrationPath(fileName: string): string {
  return fileURLToPath(
    new URL(`../../migrations/${fileName}`, import.meta.url),
  );
}

export function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const hasMigration = database.prepare(`
    SELECT version
    FROM schema_migrations
    WHERE version = ?
  `);

  const recordMigration = database.prepare(`
    INSERT INTO schema_migrations (
      version,
      name,
      applied_at
    )
    VALUES (?, ?, ?)
  `);

  for (const migration of migrations) {
    const existing = hasMigration.get(migration.version);

    if (existing) {
      continue;
    }

    const sql = readFileSync(getMigrationPath(migration.fileName), "utf8");

    const applyMigration = database.transaction(() => {
      database.exec(sql);

      recordMigration.run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    });

    applyMigration();
  }
}
