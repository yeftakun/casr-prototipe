CREATE TABLE import_cursors (
  id TEXT PRIMARY KEY,

  session_id TEXT NOT NULL,

  adapter TEXT NOT NULL,
  native_session_id TEXT NOT NULL,
  native_source TEXT NOT NULL,

  byte_offset INTEGER NOT NULL
    CHECK (byte_offset >= 0),

  record_index INTEGER NOT NULL
    CHECK (record_index >= 0),

  source_file_size INTEGER NOT NULL
    CHECK (source_file_size >= 0),

  last_record_fingerprint TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (session_id)
    REFERENCES sessions(id)
    ON DELETE CASCADE,

  UNIQUE (
    adapter,
    native_session_id,
    native_source
  )
);

CREATE INDEX idx_import_cursors_session_id
  ON import_cursors(session_id);