import type Database from "better-sqlite3";

import type {
  SessionDetail,
  SessionListItem,
} from "../../core/session/session-view.js";

interface SessionListRow {
  id: string;
  title: string;
  workspace_path: string;
  status: string;
  adapter: string;
  updated_at: string;
}

interface SessionDetailRow {
  id: string;
  title: string;
  workspace_path: string;
  status: string;
  session_created_at: string;
  session_updated_at: string;
  adapter: string;
  native_session_id: string;
  native_path: string;
  provider: string;
  model: string | null;
  metadata_json: string;
  native_created_at: string;
  native_updated_at: string;
}

export class SessionQueryRepository {
  constructor(private readonly database: Database.Database) {}

  listSessions(): SessionListItem[] {
    const rows = this.database
      .prepare(
        `
          SELECT
            s.id,
            s.title,
            s.workspace_path,
            s.status,
            ns.adapter,
            s.updated_at
          FROM sessions s
          JOIN native_sessions ns
            ON ns.session_id = s.id
          ORDER BY s.updated_at DESC
        `,
      )
      .all() as SessionListRow[];

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      workspacePath: row.workspace_path,
      status: row.status,
      adapter: row.adapter,
      updatedAt: row.updated_at,
    }));
  }

  getSessionById(sessionId: string): SessionDetail | null {
    const row = this.database
      .prepare(
        `
          SELECT
            s.id,
            s.title,
            s.workspace_path,
            s.status,
            s.created_at AS session_created_at,
            s.updated_at AS session_updated_at,
            ns.adapter,
            ns.native_session_id,
            ns.native_path,
            ns.provider,
            ns.model,
            ns.metadata_json,
            ns.created_at AS native_created_at,
            ns.updated_at AS native_updated_at
          FROM sessions s
          JOIN native_sessions ns
            ON ns.session_id = s.id
          WHERE s.id = ?
        `,
      )
      .get(sessionId) as SessionDetailRow | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title,
      workspacePath: row.workspace_path,
      status: row.status,
      createdAt: row.session_created_at,
      updatedAt: row.session_updated_at,
      nativeBinding: {
        adapter: row.adapter,
        nativeSessionId: row.native_session_id,
        nativePath: row.native_path,
        provider: row.provider,
        model: row.model,
        metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
        createdAt: row.native_created_at,
        updatedAt: row.native_updated_at,
      },
    };
  }
}
