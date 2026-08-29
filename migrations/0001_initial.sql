CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  workspace_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE native_sessions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  adapter TEXT NOT NULL,
  native_session_id TEXT NOT NULL,
  native_path TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (session_id)
    REFERENCES sessions(id)
    ON DELETE CASCADE,

  UNIQUE (adapter, native_session_id)
);

CREATE INDEX idx_native_sessions_session_id
  ON native_sessions(session_id);
