import { mkdirSync } from "node:fs";
import { join } from "node:path";

import Database from "better-sqlite3";

import { resolveCasrHome } from "./casr-home.js";

export function openCasrDatabase(): Database.Database {
  const casrHome = resolveCasrHome();

  mkdirSync(casrHome, {
    recursive: true,
  });

  const databasePath = join(casrHome, "casr.sqlite");

  const database = new Database(databasePath);

  database.pragma("foreign_keys = ON");

  return database;
}
