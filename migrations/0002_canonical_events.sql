CREATE TABLE canonical_events (
  id TEXT PRIMARY KEY,

  session_id TEXT NOT NULL,

  sequence INTEGER NOT NULL
    CHECK (sequence >= 0),

  event_kind TEXT NOT NULL
    CHECK (
      event_kind IN (
        'message',
        'tool_call',
        'tool_result',
        'reasoning',
        'lifecycle',
        'state',
        'metadata',
        'unknown'
      )
    ),

  role TEXT
    CHECK (
      role IS NULL
      OR role IN (
        'user',
        'assistant',
        'developer',
        'system',
        'unknown'
      )
    ),

  occurred_at TEXT,
  imported_at TEXT NOT NULL,

  payload_json TEXT NOT NULL,
  raw_json TEXT NOT NULL,

  adapter TEXT NOT NULL,
  native_session_id TEXT NOT NULL,
  native_source TEXT NOT NULL,
  source_position INTEGER NOT NULL
    CHECK (source_position >= 0),

  fingerprint TEXT NOT NULL,

  native_ordinal INTEGER,
  native_top_level_type TEXT,
  native_payload_type TEXT,
  native_payload_id TEXT,
  native_turn_id TEXT,
  native_call_id TEXT,

  FOREIGN KEY (session_id)
    REFERENCES sessions(id)
    ON DELETE CASCADE,

  UNIQUE (
    session_id,
    sequence
  ),

  UNIQUE (
    adapter,
    native_session_id,
    native_source,
    source_position
  )
);
