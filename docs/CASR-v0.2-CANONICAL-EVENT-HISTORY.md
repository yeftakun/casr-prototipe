# CASR v0.2 — Canonical Event History
## Full Implementation Planning Draft

**Project:** CASR — Canonical Agent Session Runtime  
**Target version:** v0.2.x  
**Baseline:** v0.1.1  
**Primary scope:** Canonical Event History for OpenAI Codex CLI  
**Out of scope:** Cross-account fallback, context compiler, cross-provider, GUI, cloud sync  
**Document type:** Implementation planning / technical execution guide  

---

# 1. Purpose of v0.2

CASR v0.1.x proves that CASR can:

- discover native Codex sessions,
- assign independent CASR logical session IDs,
- persist logical/native bindings,
- inspect sessions,
- resume native sessions,
- restore native workspace,
- keep Codex storage read-only.

However, CASR v0.1.x still does **not own the actual session history**.

Current mental model:

```text
CASR Session
     ↓
Native Codex Session
```

The goal of v0.2 is to change that into:

```text
CASR Session
├── Native Binding
└── Canonical Events
```

This is the first version where CASR begins to become a true:

```text
Canonical Agent Session Runtime
```

instead of only:

```text
Logical Session Registry
+
Native Session Launcher
```

---

# 2. Core Goal

The core goal of v0.2 is:

> Import the native Codex session history into CASR-owned local storage as a lossless, append-only, idempotent canonical event stream.

Conceptually:

```text
Codex Native History
        ↓
READ ONLY
        ↓
Codex Adapter
        ↓
Native Event Parser
        ↓
Normalizer
        ↓
Canonical Event Stream
        ↓
CASR SQLite
```

The result should be durable enough that CASR can preserve the logical history of a session even if the native Codex session later becomes unavailable.

---

# 3. Fundamental Invariant

The most important invariant in v0.2:

```text
Canonical(t+1)
=
Canonical(t)
+
NewRawEvents(t)
```

Meaning:

- existing canonical events are not rewritten,
- newly discovered native events are appended,
- repeated import must not duplicate events,
- summarization must not replace raw history,
- unsupported event types must not be silently discarded.

---

# 4. What v0.2 Is NOT

v0.2 is deliberately **not** the version for:

```text
context compilation
summarization engine
retrieval
semantic search
cross-account fallback
new Codex session creation
model switching
provider switching
second adapter
cloud sync
GUI
daemon
vector database
```

v0.2 focuses on one difficult problem:

```text
CAN CASR OWN THE LOSSLESS SESSION EVENT HISTORY?
```

Everything else comes later.

---

# 5. v0.2 Success Statement

At the end of v0.2, CASR should be able to say:

```text
CASR Session:
casr_ABC

Native Binding:
Codex Session 111

Native Events Observed:
438

Canonical Events Stored:
438

New Events Imported:
14

Duplicates:
0

Unknown Events Preserved:
3
```

Running the same import again without native changes should produce:

```text
Native Events Observed:
438

New Events Imported:
0

Duplicates / Already Known:
438
```

No duplicate canonical rows should be created.

---

# 6. Architecture Target

The target architecture for v0.2:

```text
                CODEX_HOME
                    │
                    │ READ ONLY
                    ▼
             Codex Native Session
                    │
                    ▼
               Rollout JSONL
                    │
                    ▼
            Codex Event Reader
                    │
                    ▼
            Native Event Parser
                    │
                    ▼
              Event Normalizer
                    │
                    ▼
            CanonicalEvent[]
                    │
                    ▼
             Import Service
              │         │
              │         └── Import Cursor
              │
              ▼
          CASR Registry
           casr.sqlite
              │
              ▼
       canonical_events
```

---

# 7. Boundary Rules

## 7.1 Codex storage remains read-only

Hard rule:

```text
CODEX_HOME = READ ONLY
CASR_HOME  = READ / WRITE
```

Never update:

```text
state_5.sqlite
session_index.jsonl
rollout JSONL
auth.json
```

inside Codex storage.

---

## 7.2 Provider-specific vocabulary stops at the adapter

Codex-specific event names may exist inside:

```text
src/adapters/codex/
```

but must not leak into:

```text
src/core/
```

For example, the canonical core should not expose names such as:

```text
event_msg
response_item
turn_context
```

Those are native/provider vocabulary.

The adapter maps them to CASR canonical vocabulary.

---

## 7.3 Preserve unknown native events

If Codex introduces an event type that CASR does not yet understand:

```text
UNKNOWN
```

CASR must not silently skip it.

Preferred behavior:

```text
preserve raw payload
+
preserve source metadata
+
mark canonical type as unknown
```

This allows future reparsing or migration.

---

## 7.4 No destructive normalization

Normalization may produce a provider-neutral representation.

It must not destroy the raw source record.

Prefer:

```text
normalized payload
+
raw native payload
```

not:

```text
normalized payload only
```

---

# 8. Proposed v0.2 Milestones

The implementation should be split into the following checkpoints:

```text
STEP 0 — Rollout Discovery Spike
STEP 1 — Canonical Event Domain Model
STEP 2 — Database Migration
STEP 3 — Codex Rollout Reader
STEP 4 — Native Event Parser
STEP 5 — Canonical Normalizer
STEP 6 — Event Repository
STEP 7 — Import Cursor
STEP 8 — Canonical Import Service
STEP 9 — Integrate with Sync
STEP 10 — History CLI
STEP 11 — Import Diagnostics
STEP 12 — Corruption / Partial File Handling
STEP 13 — Golden Fixtures
STEP 14 — Real Native Validation
STEP 15 — v0.2 Acceptance & Documentation
```

Do not skip STEP 0.

---

# 9. STEP 0 — Codex Rollout Discovery Spike

## Objective

Understand the real structure of Codex rollout JSONL before designing the canonical schema too aggressively.

This is an investigation step.

No production abstraction should be committed until enough real rollout samples are inspected.

---

## 9.1 Select sample sessions

Use multiple native sessions:

```text
small session
medium session
long session
session with tool calls
session with errors
session with resumed work
session with different models
```

If possible include the already validated session used during v0.1 experimentation.

---

## 9.2 Inspect rollout files

Read them without modifying them.

Example PowerShell:

```powershell
Get-Content "<rollout-path>" -TotalCount 20
```

Or inspect selected lines.

Do not dump credentials or auth files.

---

## 9.3 Inventory native event types

Create an investigation table:

```text
Native Type
Frequency
Example Shape
Meaning
Canonical Candidate
Must Preserve Raw?
```

Example conceptual entries:

```text
response_item
event_msg
turn_context
...
```

Do not assume these names remain stable.

---

## 9.4 Questions to answer

Before leaving STEP 0:

```text
How are events ordered?
Is there a native event ID?
Are timestamps always present?
Can one JSONL line represent multiple logical items?
How are tool calls represented?
How are tool results represented?
How are user messages represented?
How are assistant messages represented?
How are system/developer instructions represented?
How are context changes represented?
Are there malformed / partial lines?
Is the last line sometimes incomplete while Codex is running?
Does resume append to the same rollout file?
Can rollout files be rotated?
Can the same logical event appear more than once?
```

---

## 9.5 Deliverable

Create:

```text
docs/v0.2/rollout-discovery.md
```

Recommended contents:

```text
observed native event types
sample redacted payloads
ordering behavior
timestamp behavior
ID behavior
partial-line behavior
mapping hypotheses
open questions
```

---

## 9.6 Exit criteria

STEP 0 passes when we can confidently describe:

```text
how to read
how to identify
how to order
how to preserve
```

Codex native history.

---

# 10. STEP 1 — Canonical Event Domain Model

## Objective

Define the smallest provider-neutral canonical event interface.

Do not over-model.

---

## 10.1 Proposed canonical event categories

Initial candidates:

```text
user_message
assistant_message
system_message
developer_message
tool_call
tool_result
execution
state
metadata
unknown
```

Not all of these must survive after the discovery spike.

The final set should be driven by actual native data.

---

## 10.2 Proposed TypeScript shape

Draft only:

```ts
export type CanonicalEventType =
  | "user_message"
  | "assistant_message"
  | "system_message"
  | "developer_message"
  | "tool_call"
  | "tool_result"
  | "execution"
  | "state"
  | "metadata"
  | "unknown";

export interface CanonicalEvent {
  id: string;
  sessionId: string;
  sequence: number;
  type: CanonicalEventType;

  occurredAt: string | null;
  importedAt: string;

  payload: unknown;

  source: {
    adapter: string;
    nativeSessionId: string;
    nativeEventKey: string;
    nativeEventType: string | null;
  };

  raw: unknown;
}
```

Do not finalize until STEP 0.

---

## 10.3 Canonical event identity

CASR needs stable event identity.

Possible strategy:

```text
native event ID
```

if Codex provides a stable unique ID.

Otherwise derive:

```text
adapter
+
nativeSessionId
+
native source location
+
line index / byte offset
+
content fingerprint
```

The exact strategy must be documented.

---

## 10.4 Event ordering

CASR needs deterministic ordering.

Potential hierarchy:

```text
1. Native file order
2. Native sequence / index
3. Timestamp
4. Import order as final fallback
```

Do not sort only by timestamp.

Two events may share the same timestamp.

---

## 10.5 Required invariant

For a given native binding:

```text
event N
must remain before
event N+1
```

unless discovery proves the native format has stronger ordering semantics.

---

## 10.6 Deliverables

Possible files:

```text
src/core/events/canonical-event.ts
src/core/events/event-types.ts
```

Naming may change.

---

## 10.7 Tests

Test at minimum:

```text
valid event type
unknown type allowed
source metadata required
sequence deterministic
raw payload retained
```

---

# 11. STEP 2 — Database Migration

## Objective

Persist canonical events inside CASR_HOME.

---

## 11.1 New migration

Suggested:

```text
migrations/0002_canonical_events.sql
```

---

## 11.2 Proposed table

Draft:

```sql
CREATE TABLE canonical_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,

  sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,

  payload_json TEXT NOT NULL,
  raw_json TEXT NOT NULL,

  adapter TEXT NOT NULL,
  native_session_id TEXT NOT NULL,
  native_event_key TEXT NOT NULL,
  native_event_type TEXT,

  occurred_at TEXT,
  imported_at TEXT NOT NULL,

  FOREIGN KEY (session_id)
    REFERENCES sessions(id)
    ON DELETE CASCADE
);
```

---

## 11.3 Uniqueness

Add a uniqueness rule that prevents duplicate imports.

Example concept:

```sql
UNIQUE (
  adapter,
  native_session_id,
  native_event_key
)
```

The exact key depends on STEP 0.

---

## 11.4 Ordering index

Likely useful:

```sql
CREATE INDEX idx_canonical_events_session_sequence
ON canonical_events(session_id, sequence);
```

---

## 11.5 Native binding index

Possible:

```sql
CREATE INDEX idx_canonical_events_native_binding
ON canonical_events(adapter, native_session_id);
```

---

## 11.6 Raw JSON storage

For v0.2, storing JSON as TEXT is acceptable.

Do not introduce:

```text
document database
event store service
Kafka
vector DB
```

for this problem.

SQLite is enough.

---

## 11.7 Migration tests

Must test:

```text
fresh database
existing v0.1 database upgrade
migration idempotency
foreign keys
unique duplicate protection
event ordering query
```

---

# 12. STEP 3 — Codex Rollout Reader

## Objective

Read native rollout JSONL safely and incrementally.

This layer should only understand:

```text
files
lines
offsets
JSON parsing
```

It should not yet normalize provider semantics.

---

## 12.1 Suggested module

Possible:

```text
src/adapters/codex/codex-rollout-reader.ts
```

---

## 12.2 Input

```ts
rolloutPath
startPosition?
```

---

## 12.3 Output

Conceptually:

```ts
interface NativeRolloutRecord {
  position: number;
  rawLine: string;
  parsed: unknown;
}
```

Position may ultimately become:

```text
line number
byte offset
native sequence
```

depending on discovery.

---

## 12.4 Reader responsibilities

The reader should:

```text
open file read-only
iterate in source order
parse JSON per record
identify malformed line
report last safe position
never mutate file
```

---

## 12.5 Partial final line

This is important.

If Codex is actively writing:

```text
{"type":"something","payload":
```

the final line may be incomplete.

CASR should not immediately treat this as catastrophic corruption.

Possible behavior:

```text
complete lines
→ import

partial trailing line
→ defer until next sync
```

But malformed records in the middle of a file may indicate actual corruption.

---

## 12.6 Reader test cases

Use fixtures:

```text
empty file
one valid line
many valid lines
blank line
malformed middle line
partial final line
unicode
very long line
CRLF
LF
```

---

# 13. STEP 4 — Native Event Parser

## Objective

Convert raw JSONL records into a typed Codex-native internal representation.

This layer remains provider-specific.

Example location:

```text
src/adapters/codex/events/
```

Possible files:

```text
codex-native-event.ts
parse-codex-event.ts
```

---

## 13.1 Parser output

Concept:

```ts
interface CodexNativeEvent {
  nativeType: string | null;
  nativeKey: string;
  timestamp: string | null;
  payload: unknown;
  raw: unknown;
  position: number;
}
```

---

## 13.2 Unknown events

The parser must support:

```text
recognized
unrecognized
```

Unknown does not mean invalid.

Unknown should still produce a native event object.

---

## 13.3 Invalid JSON

Invalid JSON is different from unknown event.

Distinguish:

```text
unknown valid record
```

from:

```text
invalid / malformed record
```

---

## 13.4 Parser tests

Use one fixture per observed native event class.

Avoid only synthetic tests.

---

# 14. STEP 5 — Canonical Normalizer

## Objective

Map Codex-native event vocabulary into CASR canonical vocabulary.

Flow:

```text
CodexNativeEvent
       ↓
Normalizer
       ↓
CanonicalEventCandidate
```

---

## 14.1 Example mapping concept

Illustrative only:

```text
Codex user input
→ user_message

Codex assistant response
→ assistant_message

Codex tool invocation
→ tool_call

Codex tool output
→ tool_result

unrecognized native event
→ unknown
```

Actual mapping must come from STEP 0.

---

## 14.2 Preserve source provenance

Each canonical event should retain:

```text
adapter
nativeSessionId
nativeEventType
nativeEventKey
sourcePosition
```

This is essential for:

```text
debugging
re-import
future migration
auditability
```

---

## 14.3 Preserve raw payload

Example:

```ts
{
  type: "assistant_message",
  payload: {
    text: "..."
  },
  raw: {
    // original Codex-native structure
  }
}
```

---

## 14.4 Unknown mapping

Unknown event:

```ts
{
  type: "unknown",
  payload: {
    nativeType: "future_codex_type"
  },
  raw: originalRecord
}
```

---

# 15. STEP 6 — Canonical Event Repository

## Objective

Create CASR-owned storage API for canonical events.

Possible file:

```text
src/storage/repositories/canonical-event-repository.ts
```

or matching the current repository organization.

---

## 15.1 Responsibilities

Repository should provide only persistence operations.

Examples:

```text
appendEvent()
appendEvents()
findBySessionId()
countBySessionId()
findLastSequence()
existsByNativeKey()
```

Do not place Codex parsing inside repository code.

---

## 15.2 Append-only policy

Do not add a generic:

```text
updateCanonicalEvent()
```

unless a strong reason appears.

Default v0.2 rule:

```text
canonical_events = append only
```

---

## 15.3 Batch transaction

Importing many events should use a SQLite transaction.

Concept:

```text
BEGIN
insert event 1
insert event 2
...
update cursor
COMMIT
```

Cursor and inserted events should commit atomically where possible.

---

## 15.4 Duplicate behavior

Duplicate native event should produce one of:

```text
ignored
already known
duplicate count incremented
```

not:

```text
second canonical row
```

---

# 16. STEP 7 — Import Cursor

## Objective

Avoid full reprocessing on every sync.

---

## 16.1 Why cursor is needed

Without a cursor:

```text
10 events
→ read 10

100 events
→ read 100

10,000 events
→ read 10,000

100,000 events
→ read 100,000
```

every sync.

That becomes inefficient.

---

## 16.2 Proposed table

Draft:

```sql
CREATE TABLE event_import_cursors (
  adapter TEXT NOT NULL,
  native_session_id TEXT NOT NULL,
  source_path TEXT NOT NULL,

  cursor_kind TEXT NOT NULL,
  cursor_value TEXT NOT NULL,

  updated_at TEXT NOT NULL,

  PRIMARY KEY (
    adapter,
    native_session_id,
    source_path
  )
);
```

Could be included in migration 0002 or separate migration 0003.

---

## 16.3 Cursor options

Possible cursor strategies:

```text
line number
byte offset
native event sequence
native event ID
```

Prefer the most stable strategy proven by discovery.

---

## 16.4 Cursor recovery

If file changes unexpectedly:

```text
stored cursor > file size
rollout replaced
file path changed
```

CASR should detect the inconsistency.

Do not blindly continue.

Possible recovery mode:

```text
re-scan with deduplication
```

Because canonical event uniqueness still protects against duplication.

---

# 17. STEP 8 — Canonical Import Service

## Objective

Orchestrate the full import pipeline.

Possible:

```text
src/core/events/import-canonical-history.ts
```

or service layer matching current architecture.

---

## 17.1 Pipeline

```text
CASR Session
     ↓
Native Binding
     ↓
rollout path
     ↓
load cursor
     ↓
read new native records
     ↓
parse
     ↓
normalize
     ↓
deduplicate
     ↓
append canonical events
     ↓
advance cursor
```

---

## 17.2 Import result

Suggested result object:

```ts
interface CanonicalImportResult {
  nativeSessionId: string;

  recordsRead: number;
  imported: number;
  alreadyKnown: number;
  unknown: number;
  deferred: number;
  malformed: number;

  cursorBefore: string | null;
  cursorAfter: string | null;
}
```

---

## 17.3 Transaction boundary

Recommended:

```text
parse outside DB transaction if expensive

then:

BEGIN
insert canonical rows
advance cursor
COMMIT
```

Do not update cursor if inserts fail.

---

# 18. STEP 9 — Integrate with `casr sync`

## Objective

Extend existing sync without destroying current behavior.

Current sync:

```text
discover native sessions
       ↓
sync registry metadata
```

v0.2 sync:

```text
discover native sessions
       ↓
sync registry metadata
       ↓
import canonical history
```

---

## 18.1 Suggested separation

Do not turn one function into a giant sync method.

Prefer:

```text
NativeSessionSyncService
CanonicalHistoryImportService
```

or equivalent boundaries.

---

## 18.2 Sync output

Possible:

```text
CASR Sync

Sessions
Discovered : 76
Imported   : 0
Updated    : 2
Unchanged  : 74

Canonical History
Records Read   : 39
Events Imported: 31
Already Known  : 8
Unknown        : 2
Deferred       : 0
Malformed      : 0
```

---

## 18.3 Performance

Do not print one line per event by default.

Summary first.

Verbose mode can come later.

---

# 19. STEP 10 — History CLI

## Objective

Allow user/developer to inspect canonical history without raw SQLite.

Suggested command:

```text
casr history <casr-id>
```

---

## 19.1 Basic output

Example:

```text
CASR History

Session:
casr_ABC

Events:
#001 user_message
#002 assistant_message
#003 tool_call
#004 tool_result
#005 assistant_message
```

---

## 19.2 Useful options

Possible:

```text
--limit <n>
--type <event-type>
--raw
--json
```

Do not implement every option immediately.

Minimum useful command:

```text
history <id>
```

---

## 19.3 Inspect integration

`casr inspect` may later display:

```text
Canonical History

Events       : 438
Unknown      : 3
Last Imported: ...
```

---

# 20. STEP 11 — Import Diagnostics

## Objective

Make native parsing failures diagnosable.

`doctor` currently validates:

```text
Codex CLI
CODEX_HOME
state DB
threads schema
```

v0.2 may add rollout-level diagnostics.

Possible checks:

```text
rollout path exists
rollout readable
JSONL readable
cursor valid
```

Do not make doctor scan all events deeply.

---

## 20.1 Suggested diagnostic command

If needed:

```text
casr inspect <id>
```

could report:

```text
Native Rollout
Path        : ...
Readable    : yes
Cursor      : 438
Canonical   : 438
Unknown     : 3
```

---

# 21. STEP 12 — Corruption and Partial File Handling

## Objective

Avoid destroying import progress due to imperfect native files.

---

## 21.1 Partial trailing record

Expected handling:

```text
valid events
valid events
valid events
partial final JSON line
```

Import valid events.

Do not advance cursor beyond unsafe trailing data.

Report:

```text
Deferred: 1
```

---

## 21.2 Malformed middle record

Example:

```text
valid
invalid
valid
```

Options:

### Strict mode

Stop at invalid record.

Pros:

```text
preserves exact ordering confidence
```

Cons:

```text
blocks later valid events
```

### Tolerant mode

Preserve malformed raw line as a special unknown/error canonical record.

Potentially better for lossless import.

Decision should be made after real discovery.

---

## 21.3 Missing rollout file

Do not delete canonical events.

Report native source unavailable.

Canonical history remains.

---

## 21.4 Rollout path changed

Potential behavior:

```text
new source path detected
→ treat as new import source
→ deduplicate by native event key
```

Do not assume file path itself is canonical identity.

---

# 22. STEP 13 — Golden Fixtures

## Objective

Protect parser behavior against future refactoring.

Golden fixtures are real, redacted native examples stored under tests.

Suggested:

```text
tests/fixtures/codex/
```

Examples:

```text
user-message.jsonl
assistant-message.jsonl
tool-call.jsonl
tool-result.jsonl
mixed-session.jsonl
unknown-event.jsonl
partial-final-line.jsonl
```

---

## 22.1 Redaction

Fixtures must not contain:

```text
email
auth token
personal secret
absolute private path where unnecessary
API key
credential
```

---

## 22.2 Golden tests

For each fixture:

```text
input native record
       ↓
expected canonical record
```

This creates a regression contract.

---

# 23. STEP 14 — Real Native Validation

## Objective

Validate v0.2 against real Codex sessions.

Synthetic tests alone are not enough.

---

## 23.1 Validation Case A — Existing session

Run:

```text
casr sync
```

Check:

```text
canonical events imported
count stable
no mutation of Codex files
```

Run again.

Expected:

```text
0 new events
```

---

## 23.2 Validation Case B — Continue native session

1. Resume a Codex session.
2. Send new user message.
3. Receive assistant response.
4. Exit.
5. Run `casr sync`.

Expected:

```text
only newly appended native records are imported
```

---

## 23.3 Validation Case C — Tool calls

Use a native session containing tool interaction.

Expected canonical stream contains meaningful:

```text
tool_call
tool_result
```

or the final canonical categories selected after discovery.

---

## 23.4 Validation Case D — Unknown event

If real unknown native event exists:

```text
preserve it
```

If not, use fixture.

---

## 23.5 Validation Case E — Incremental sync

Run multiple cycles:

```text
work
sync
work
sync
work
sync
```

Verify:

```text
monotonic event count
no duplication
cursor advances
```

---

# 24. STEP 15 — v0.2 Acceptance

v0.2 is not done simply because:

```text
parser works
```

It is done when the full invariant is validated.

---

# 25. Definition of Done

All boxes should be satisfied:

```text
[ ] Codex rollout format documented from real samples
[ ] Canonical vocabulary defined
[ ] Provider vocabulary isolated inside adapter
[ ] canonical_events migration exists
[ ] Event identity strategy documented
[ ] Ordering semantics documented
[ ] Raw native payload preserved
[ ] Unknown native events preserved
[ ] Codex rollout reader is read-only
[ ] Partial trailing record handled
[ ] Canonical repository append-only
[ ] Duplicate imports prevented
[ ] Import cursor implemented
[ ] Cursor advancement is transactional
[ ] Canonical import service implemented
[ ] Sync imports canonical history
[ ] `casr history` works
[ ] Inspect shows canonical event statistics
[ ] Golden fixtures exist
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Real native validation passes
[ ] Repeated sync imports zero duplicates
[ ] Existing v0.1 resume behavior still works
[ ] CODEX_HOME remains read-only
[ ] Documentation updated
```

---

# 26. Proposed File Layout

This is a draft, not a mandatory exact structure.

```text
src/
├── adapters/
│   └── codex/
│       ├── codex-adapter.ts
│       ├── codex-environment.ts
│       ├── codex-schema.ts
│       ├── codex-rollout-reader.ts
│       └── events/
│           ├── codex-native-event.ts
│           ├── parse-codex-event.ts
│           └── normalize-codex-event.ts
│
├── core/
│   └── events/
│       ├── canonical-event.ts
│       ├── canonical-event-type.ts
│       └── canonical-import-service.ts
│
├── storage/
│   ├── repositories/
│   │   ├── canonical-event-repository.ts
│   │   └── import-cursor-repository.ts
│   └── ...
│
└── cli/
    └── commands/
        ├── history.ts
        └── ...
```

Migrations:

```text
migrations/
├── 0001_initial.sql
└── 0002_canonical_events.sql
```

Tests:

```text
tests/
├── codex-rollout-reader.test.ts
├── codex-event-parser.test.ts
├── codex-event-normalizer.test.ts
├── canonical-event-repository.test.ts
├── canonical-import-service.test.ts
├── canonical-import-integration.test.ts
└── fixtures/
    └── codex/
```

---

# 27. Proposed Implementation Checkpoints

To keep development controlled, commit in small checkpoints.

---

## CP-v0.2-0 — Rollout discovery

No production code required.

Deliver:

```text
docs/v0.2/rollout-discovery.md
```

Commit:

```text
docs: document Codex rollout event discovery
```

---

## CP-v0.2-1 — Canonical event model

Deliver:

```text
canonical event types
source metadata
tests
```

Commit:

```text
feat: add canonical event domain model
```

---

## CP-v0.2-2 — Canonical storage migration

Deliver:

```text
canonical_events
indexes
migration tests
```

Commit:

```text
feat: add canonical event storage
```

---

## CP-v0.2-3 — Rollout reader

Deliver:

```text
read-only JSONL reader
partial-tail handling
tests
```

Commit:

```text
feat: add Codex rollout reader
```

---

## CP-v0.2-4 — Codex parser

Deliver:

```text
native event parser
unknown preservation
golden fixtures
```

Commit:

```text
feat: parse Codex rollout events
```

---

## CP-v0.2-5 — Canonical normalizer

Deliver:

```text
Codex → canonical mapping
raw preservation
tests
```

Commit:

```text
feat: normalize Codex events
```

---

## CP-v0.2-6 — Event repository

Deliver:

```text
append
query
dedupe
ordering
```

Commit:

```text
feat: add canonical event repository
```

---

## CP-v0.2-7 — Import cursor

Deliver:

```text
cursor persistence
recovery behavior
tests
```

Commit:

```text
feat: add incremental event import cursor
```

---

## CP-v0.2-8 — Import service

Deliver:

```text
reader
parser
normalizer
repository
cursor
```

working together.

Commit:

```text
feat: import canonical session history
```

---

## CP-v0.2-9 — Sync integration

Deliver:

```text
casr sync
```

imports native metadata and canonical events.

Commit:

```text
feat: sync canonical Codex history
```

---

## CP-v0.2-10 — History CLI

Deliver:

```text
casr history <id>
```

Commit:

```text
feat: add canonical history command
```

---

## CP-v0.2-11 — Hardening

Deliver:

```text
partial file handling
corrupt record handling
missing rollout handling
diagnostics
```

Commit:

```text
fix: harden canonical event import
```

---

## CP-v0.2-12 — Validation

Deliver:

```text
docs/v0.2/v0.2-validation.md
```

Commit:

```text
docs: validate canonical history MVP
```

---

# 28. Testing Strategy

v0.2 requires more than unit tests.

Use four levels.

---

## 28.1 Unit tests

Test individual:

```text
reader
parser
normalizer
repository
cursor
```

---

## 28.2 Fixture tests

Realistic JSONL → expected canonical records.

---

## 28.3 Integration tests

Temporary:

```text
fake CODEX_HOME
fake rollout JSONL
temporary CASR_HOME
SQLite registry
```

Then:

```text
sync
assert canonical DB
sync again
assert no duplicates
```

---

## 28.4 Real native validation

Use actual Codex sessions read-only.

This remains mandatory.

---

# 29. Quality Gate

Every implementation checkpoint should pass:

```powershell
npm.cmd run format
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

And GitHub Actions should remain green.

Do not postpone failing tests until the end.

---

# 30. Safety Gate

Before each real native validation:

```text
[ ] No code writes to CODEX_HOME
[ ] SQLite Codex DB opened readonly
[ ] Rollout opened read-only
[ ] No auth.json access
[ ] No credential copying
[ ] No mutation of native history
```

---

# 31. Performance Expectations

v0.2 does not need extreme optimization.

But avoid obviously poor behavior.

Desired:

```text
incremental import
batch SQLite transaction
indexed session history
no whole-history rewrite
```

Avoid premature:

```text
worker threads
stream processing framework
distributed queue
event broker
```

---

# 32. Observability

Import should expose enough information to debug.

Useful counters:

```text
recordsRead
imported
alreadyKnown
unknown
deferred
malformed
cursorBefore
cursorAfter
```

Optional later:

```text
durationMs
bytesRead
```

---

# 33. Canonical Event Ordering Rules

The ordering rule must be documented in code and docs.

Preferred conceptual rule:

```text
source order is primary
```

Do not reconstruct conversation order purely from timestamps.

Potential canonical sequence assignment:

```text
existing last sequence = 420

new native events:
A
B
C

canonical:
421
422
423
```

Sequence is CASR-owned.

---

# 34. Event Deletion Policy

For v0.2:

```text
NO automatic canonical event deletion
```

Even if native history later disappears.

If native event was imported, CASR retains it.

Manual destructive maintenance commands are out of scope.

---

# 35. Native Event Mutation Problem

A native source might theoretically change a previously observed event.

v0.2 should not silently overwrite canonical history.

Possible detection:

```text
same nativeEventKey
different fingerprint
```

Report:

```text
native mutation detected
```

Do not resolve automatically until behavior is understood.

---

# 36. Fingerprinting

If native event identity is weak, a content fingerprint may be useful.

Concept:

```text
SHA-256(
  stable serialized native record
)
```

Potential uses:

```text
dedupe
mutation detection
diagnostics
```

Do not expose cryptographic hashing as a product feature.

---

# 37. Canonical Payload Philosophy

Canonical payload should contain meaning needed by CASR.

Raw contains source fidelity.

Example:

```json
{
  "type": "user_message",
  "payload": {
    "text": "Implement the parser."
  },
  "raw": {
    "...": "original Codex record"
  }
}
```

This supports both:

```text
future context compilation
```

and:

```text
future reparsing
```

---

# 38. Why Raw Preservation Matters

Suppose Codex introduces:

```text
event type X
```

CASR v0.2 does not understand it.

We store:

```text
type = unknown
raw = complete native payload
```

In v0.2.3, parser support is added.

A migration or reprocessing tool can later derive richer meaning from preserved raw data.

Without raw preservation, that information is lost permanently.

---

# 39. Reprocessing Policy

v0.2 should not automatically rewrite all existing canonical events when parser logic changes.

Future strategy may involve:

```text
canonical parser version
derived projection version
```

but that is not required for first v0.2.

For now, document the limitation.

---

# 40. CLI Experience Target

Minimal end-user workflow:

```powershell
npm.cmd run dev -- doctor
npm.cmd run dev -- sync
npm.cmd run dev -- sessions
npm.cmd run dev -- inspect <id>
npm.cmd run dev -- history <id>
npm.cmd run dev -- resume <id>
```

New important command:

```text
history
```

---

# 41. Example Full Workflow

User works in Codex.

Native rollout becomes:

```text
record 1
record 2
record 3
record 4
```

Run:

```text
casr sync
```

CASR imports:

```text
canonical 1
canonical 2
canonical 3
canonical 4
```

User continues working.

Native rollout:

```text
record 1
record 2
record 3
record 4
record 5
record 6
```

Run:

```text
casr sync
```

CASR should only append:

```text
canonical 5
canonical 6
```

Result:

```text
canonical history:
1
2
3
4
5
6
```

---

# 42. Failure Scenario

Suppose record 7 is partial.

Native file:

```text
1
2
3
4
5
6
7(partial)
```

Sync:

```text
import 1–6 / or only new safe records
defer 7
```

Later Codex completes record 7.

Next sync:

```text
import 7
```

No event is lost.

---

# 43. What v0.2 Enables Later

Once canonical event ownership is real, future versions become possible.

v0.3:

```text
Canonical Events
       ↓
Working State / Checkpoint
```

v0.4:

```text
Canonical Events
+
Checkpoint
       ↓
Context Compiler
```

v0.5:

```text
Context Compiler
       ↓
New Native Codex Session
       ↓
Cross-account fallback
```

Therefore v0.2 is the foundation of the entire cross-account roadmap.

---

# 44. Risks

## Risk 1 — Codex internal format changes

Mitigation:

```text
adapter boundary
schema diagnostics
unknown preservation
golden fixtures
```

---

## Risk 2 — Native IDs are unstable

Mitigation:

```text
source provenance
fingerprints
dedupe strategy
```

---

## Risk 3 — Partial JSONL writes

Mitigation:

```text
safe cursor
defer incomplete tail
```

---

## Risk 4 — Huge rollout files

Mitigation:

```text
incremental cursor
batch transaction
indexes
```

---

## Risk 5 — Premature canonical abstraction

Mitigation:

```text
discovery spike first
minimal canonical vocabulary
preserve raw
```

---

# 45. Decisions That Must Be Made During v0.2

The following are intentionally unresolved until STEP 0:

```text
exact canonical event types
native event identity strategy
cursor format
line vs byte offset
malformed middle record policy
event fingerprint strategy
whether metadata events become canonical events
exact schema columns
```

Do not guess these too early.

---

# 46. Decisions Already Fixed

These should not be reopened casually:

```text
CASR_HOME owns writable state
CODEX_HOME remains read-only
raw canonical history is append-only
unknown native events are preserved
provider vocabulary stops at adapter boundary
sync must remain idempotent
canonical session ID remains independent
```

---

# 47. Versioning Suggestion

Possible release sequence:

```text
v0.2.0-alpha.1
rollout reader + parser

v0.2.0-alpha.2
canonical storage + importer

v0.2.0-beta.1
sync integration + history CLI

v0.2.0
validated canonical event history
```

This is optional.

If development remains private/simple, a single:

```text
v0.2.0
```

release after all checkpoints is sufficient.

---

# 48. v0.2 Documentation Structure

Suggested:

```text
docs/
└── v0.2/
    ├── rollout-discovery.md
    ├── canonical-event-model.md
    ├── import-design.md
    ├── parser-fixtures.md
    └── v0.2-validation.md
```

Avoid putting all implementation evidence into README.

README should only summarize the feature once stable.

---

# 49. Recommended Execution Order

Strict recommended sequence:

```text
1. Inspect real rollout files.
2. Document event shapes.
3. Decide native identity/order rules.
4. Define minimal canonical event model.
5. Add canonical storage.
6. Build read-only rollout reader.
7. Build Codex parser.
8. Build normalizer.
9. Add repository.
10. Add cursor.
11. Add importer.
12. Integrate sync.
13. Add history CLI.
14. Harden failure cases.
15. Validate against real Codex sessions.
16. Update docs.
17. Tag v0.2.0.
```

---

# 50. Do Not Do This

Avoid:

```text
build context compiler in v0.2
add second provider
rewrite all v0.1 code
create generic AdapterRegistry prematurely
store auth credentials
mutate Codex rollout
delete unknown events
replace raw history with summaries
use timestamp as sole ordering key
import entire history blindly every sync
```

---

# 51. Final Acceptance Demo

The v0.2 demo should be simple and convincing.

### Phase A

Start with existing Codex session.

Run:

```text
casr sync
```

Show:

```text
CASR logical session
native binding
canonical event count
```

### Phase B

Run:

```text
casr history <casr-id>
```

Show chronological canonical events.

### Phase C

Run sync again.

Show:

```text
Imported: 0
```

### Phase D

Resume Codex.

Add new conversation/tool activity.

Exit.

Run:

```text
casr sync
```

Show:

```text
only new events imported
```

### Phase E

Run:

```text
casr history <casr-id>
```

Show the canonical timeline expanded without duplicates.

---

# 52. End State of v0.2

Before v0.2:

```text
CASR
  ↓
points to Codex history
```

After v0.2:

```text
CASR
├── owns logical session identity
├── owns canonical event history
└── points to Codex native binding
```

This is the architectural transition that matters.

---

# 53. One-Sentence Definition

> CASR v0.2 is complete when a Codex session can be imported into an append-only, lossless, provider-neutral CASR canonical event stream and incrementally synchronized without duplicate or destructive modification.

---

# 54. Immediate Next Action

Do **not** start by creating `canonical_events`.

Start with:

```text
STEP 0 — Codex Rollout Discovery Spike
```

The first concrete task for v0.2 should be:

```text
select several real rollout files
inventory native record types
document ordering and identity behavior
```

Only after that should the database and canonical event model be finalized.
