import type Database from "better-sqlite3";

import type { NativeSession } from "../../core/session/native-session.js";
import {
  createCasrSessionId,
  createNativeBindingId,
} from "../../core/session/session-id.js";

export type SyncDisposition = "imported" | "updated" | "unchanged";

interface NativeBindingLookupRow {
  session_id: string;
}

interface ExistingSessionRow {
  session_id: string;
  title: string;
  workspace_path: string;
  status: string;
  session_created_at: string;
  session_updated_at: string;
  native_path: string;
  provider: string;
  model: string | null;
  metadata_json: string;
  native_created_at: string;
  native_updated_at: string;
}

function getSessionStatus(nativeSession: NativeSession): string {
  return nativeSession.archived ? "archived" : "active";
}

function getMetadataJson(nativeSession: NativeSession): string {
  return JSON.stringify({
    reasoningEffort: nativeSession.reasoningEffort,
    source: nativeSession.source,
    threadSource: nativeSession.threadSource,
    historyMode: nativeSession.historyMode,
    projectId: nativeSession.projectId,
    archived: nativeSession.archived,
  });
}

export class SessionRegistryRepository {
  constructor(private readonly database: Database.Database) {}

  findSessionIdByNativeIdentity(
    adapter: string,
    nativeSessionId: string,
  ): string | null {
    const row = this.database
      .prepare(
        `
          SELECT session_id
          FROM native_sessions
          WHERE adapter = ?
            AND native_session_id = ?
        `,
      )
      .get(adapter, nativeSessionId) as NativeBindingLookupRow | undefined;

    return row?.session_id ?? null;
  }

  createFromNativeSession(nativeSession: NativeSession): string {
    const sessionId = createCasrSessionId();
    const bindingId = createNativeBindingId();

    const create = this.database.transaction(() => {
      this.database
        .prepare(
          `
            INSERT INTO sessions (
              id,
              title,
              workspace_path,
              status,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          sessionId,
          nativeSession.title,
          nativeSession.workspacePath,
          getSessionStatus(nativeSession),
          nativeSession.createdAt,
          nativeSession.updatedAt,
        );

      this.database
        .prepare(
          `
            INSERT INTO native_sessions (
              id,
              session_id,
              adapter,
              native_session_id,
              native_path,
              provider,
              model,
              metadata_json,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          bindingId,
          sessionId,
          nativeSession.adapter,
          nativeSession.nativeSessionId,
          nativeSession.nativePath,
          nativeSession.provider,
          nativeSession.model,
          getMetadataJson(nativeSession),
          nativeSession.createdAt,
          nativeSession.updatedAt,
        );
    });

    create();

    return sessionId;
  }

  syncNativeSession(nativeSession: NativeSession): SyncDisposition {
    const existing = this.database
      .prepare(
        `
          SELECT
            s.id AS session_id,
            s.title,
            s.workspace_path,
            s.status,
            s.created_at AS session_created_at,
            s.updated_at AS session_updated_at,
            ns.native_path,
            ns.provider,
            ns.model,
            ns.metadata_json,
            ns.created_at AS native_created_at,
            ns.updated_at AS native_updated_at
          FROM native_sessions ns
          JOIN sessions s
            ON s.id = ns.session_id
          WHERE ns.adapter = ?
            AND ns.native_session_id = ?
        `,
      )
      .get(nativeSession.adapter, nativeSession.nativeSessionId) as
      | ExistingSessionRow
      | undefined;

    if (!existing) {
      this.createFromNativeSession(nativeSession);
      return "imported";
    }

    const metadataJson = getMetadataJson(nativeSession);
    const status = getSessionStatus(nativeSession);

    const changed =
      existing.title !== nativeSession.title ||
      existing.workspace_path !== nativeSession.workspacePath ||
      existing.status !== status ||
      existing.session_created_at !== nativeSession.createdAt ||
      existing.session_updated_at !== nativeSession.updatedAt ||
      existing.native_path !== nativeSession.nativePath ||
      existing.provider !== nativeSession.provider ||
      existing.model !== nativeSession.model ||
      existing.metadata_json !== metadataJson ||
      existing.native_created_at !== nativeSession.createdAt ||
      existing.native_updated_at !== nativeSession.updatedAt;

    if (!changed) {
      return "unchanged";
    }

    const update = this.database.transaction(() => {
      this.database
        .prepare(
          `
            UPDATE sessions
            SET
              title = ?,
              workspace_path = ?,
              status = ?,
              created_at = ?,
              updated_at = ?
            WHERE id = ?
          `,
        )
        .run(
          nativeSession.title,
          nativeSession.workspacePath,
          status,
          nativeSession.createdAt,
          nativeSession.updatedAt,
          existing.session_id,
        );

      this.database
        .prepare(
          `
            UPDATE native_sessions
            SET
              native_path = ?,
              provider = ?,
              model = ?,
              metadata_json = ?,
              created_at = ?,
              updated_at = ?
            WHERE adapter = ?
              AND native_session_id = ?
          `,
        )
        .run(
          nativeSession.nativePath,
          nativeSession.provider,
          nativeSession.model,
          metadataJson,
          nativeSession.createdAt,
          nativeSession.updatedAt,
          nativeSession.adapter,
          nativeSession.nativeSessionId,
        );
    });

    update();

    return "updated";
  }
}
