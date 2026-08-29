# CASR Backlog

**Project:** Canonical Agent Session Runtime (CASR)

Dokumen ini menampung ide, enhancement, technical debt, dan kemungkinan fitur masa depan.

Backlog **bukan roadmap aktif**.

Sebuah item di backlog tidak otomatis masuk milestone berikutnya.

Prinsip:

```text
BACKLOG != COMMITMENT
```

Setiap item harus melalui architecture review dan scope selection sebelum diimplementasikan.

---

# 1. Backlog Rules

Gunakan status:

```text
IDEA
REVIEW
PLANNED
DEFERRED
REJECTED
DONE
```

Gunakan priority:

```text
P0 = architecture / correctness critical
P1 = high value
P2 = useful
P3 = convenience / polish
```

Gunakan target hanya jika sudah benar-benar disetujui.

Contoh:

```text
Target: V0.2
```

atau:

```text
Target: Unscheduled
```

---

# 2. Architecture / Core

## BL-CORE-001 — Canonical Event Store

**Status:** REVIEW  
**Priority:** P0  
**Target:** Candidate V0.2

Membuat CASR-owned append-only canonical event history.

Desired principle:

```text
Canonical(t+1)
=
Canonical(t)
+
NewRawEvents(t)
```

Requirements:

```text
lossless original history
append-only semantics
stable ordering
source adapter metadata
native event traceability
non-destructive processing
```

Canonical schema belum boleh ditetapkan sebelum rollout discovery selesai.

---

## BL-CORE-002 — Canonical Event Import

**Status:** REVIEW  
**Priority:** P0  
**Target:** Candidate V0.2

Import native Codex rollout events menjadi canonical CASR events.

Flow:

```text
Codex Rollout JSONL
       ↓
Codex Event Parser
       ↓
Canonical Normalizer
       ↓
CASR Event Store
```

Harus mendukung incremental import tanpa duplicate.

---

## BL-CORE-003 — Stable Event Identity

**Status:** IDEA  
**Priority:** P0  
**Target:** Unscheduled

Definisikan strategy identity untuk canonical events.

Candidate considerations:

```text
native event ID
source sequence
content hash
adapter namespace
CASR-generated UUID
```

Harus mampu menjamin deduplication pada repeated import.

---

## BL-CORE-004 — Execution History

**Status:** REVIEW  
**Priority:** P1  
**Target:** Candidate V0.2

Pisahkan conversation history dari execution/runtime history jika diperlukan.

Possible data:

```text
agent invocation
model
reasoning effort
workspace
start/end timestamp
exit status
native session binding
```

---

## BL-CORE-005 — Token Metrics

**Status:** REVIEW  
**Priority:** P1  
**Target:** Candidate V0.2

Persist token-related events and aggregates.

Potential metrics:

```text
input tokens
output tokens
cached tokens
reasoning tokens
total usage
per turn usage
per execution usage
per canonical session usage
```

Schema harus mengikuti data nyata yang tersedia.

---

## BL-CORE-006 — Non-destructive Snapshot Layer

**Status:** IDEA  
**Priority:** P1  
**Target:** Candidate V0.3

Create derived snapshots without deleting original canonical events.

Principle:

```text
Raw Canonical History
        |
        +----> Snapshot A
        |
        +----> Snapshot B
```

Raw history tetap immutable.

---

## BL-CORE-007 — Basic Compaction

**Status:** IDEA  
**Priority:** P1  
**Target:** Candidate V0.3

Derived compaction untuk mengurangi context size.

Rule:

```text
compaction != deletion
```

Compacted artifacts harus dapat dilacak kembali ke source canonical events.

---

## BL-CORE-008 — Context Compiler

**Status:** IDEA  
**Priority:** P0  
**Target:** Candidate V0.4

Compile canonical history menjadi model-specific context.

Target conceptual API:

```text
Compile(
  CanonicalSession,
  TargetModel,
  TargetWindow,
  CurrentTask
)
```

---

## BL-CORE-009 — Context Budgeting

**Status:** IDEA  
**Priority:** P1  
**Target:** Candidate V0.4

Context compiler dapat mengalokasikan budget untuk:

```text
system context
recent turns
summaries
retrieved events
tool history
current task
reserve output tokens
```

---

## BL-CORE-010 — Retrieval Layer

**Status:** IDEA  
**Priority:** P1  
**Target:** Candidate V0.5

Selective retrieval dari canonical history.

Jangan langsung menggunakan vector database sebelum retrieval requirements jelas.

Candidate approaches:

```text
structured filters
FTS
recency
event type
workspace
semantic retrieval
hybrid retrieval
```

---

# 3. Adapter Layer

## BL-ADAPTER-001 — Codex Rollout Discovery Spike

**Status:** PLANNED  
**Priority:** P0  
**Target:** Before V0.2 implementation

Inventaris event types dari multiple real Codex rollout files.

Sampling harus mencakup:

```text
recent CLI sessions
older sessions
long sessions
tool-call sessions
reasoning sessions
different history modes
different source/thread_source values
archived session if available
```

Output:

```text
event type inventory
field inventory
optional/required field observations
ordering observations
candidate canonical mapping
unknown event list
```

---

## BL-ADAPTER-002 — Codex Schema Compatibility Layer

**Status:** IDEA  
**Priority:** P1  
**Target:** Unscheduled

Pisahkan Codex version/schema compatibility dari core adapter logic jika schema berubah antar versi.

Potential strategy:

```text
version detector
schema capability checks
compatibility mapper
```

Implement hanya setelah ada bukti kebutuhan.

---

## BL-ADAPTER-003 — Second Agent Adapter

**Status:** IDEA  
**Priority:** P1  
**Target:** Candidate V0.6

Candidate:

```text
Claude Code
OpenCode
```

Selection harus berdasarkan:

```text
local history accessibility
resume semantics
event structure
workspace metadata
read-only discoverability
```

---

## BL-ADAPTER-004 — Generic Resume Interface

**Status:** IDEA  
**Priority:** P2  
**Target:** Unscheduled

Current resume implementation supports Codex.

Future adapter contract could expose:

```text
discover()
resume()
importEvents()
capabilities()
```

Jangan membuat abstraction sebelum second adapter benar-benar dimulai.

---

# 4. Session Management

## BL-SESSION-001 — Session Search

**Status:** IDEA  
**Priority:** P2  
**Target:** Unscheduled

Potential CLI:

```text
casr sessions --search <text>
```

Search fields:

```text
title
workspace
native ID
CASR ID
```

---

## BL-SESSION-002 — Filter by Adapter

**Status:** IDEA  
**Priority:** P3  
**Target:** Unscheduled

Potential CLI:

```text
casr sessions --agent codex
```

Lebih berguna setelah multiple adapters tersedia.

---

## BL-SESSION-003 — Filter by Workspace

**Status:** IDEA  
**Priority:** P2  
**Target:** Unscheduled

Potential CLI:

```text
casr sessions --workspace <path>
```

---

## BL-SESSION-004 — Archived Session Filter

**Status:** IDEA  
**Priority:** P2  
**Target:** Unscheduled

Potential options:

```text
--archived
--active
--all
```

---

## BL-SESSION-005 — CASR Session Rename

**Status:** IDEA  
**Priority:** P2  
**Target:** Unscheduled

Rename CASR-owned title without modifying native runtime title.

Need distinguish:

```text
canonical title
native title
```

---

## BL-SESSION-006 — Multiple Native Bindings per CASR Session

**Status:** IDEA  
**Priority:** P0  
**Target:** Future cross-provider phase

Target architecture:

```text
CASR Session
   ├── Codex binding
   ├── Claude binding
   └── OpenCode binding
```

This becomes strategically important for provider-independent logical sessions.

---

## BL-SESSION-007 — Binding History

**Status:** IDEA  
**Priority:** P1  
**Target:** Future

Track historical native bindings rather than only current association.

Useful for migration and execution traceability.

---

# 5. CLI / UX

## BL-CLI-001 — Compact Table Output

**Status:** IDEA  
**Priority:** P3  
**Target:** Unscheduled

Current `casr sessions` intentionally uses simple terminal formatting.

Potential future output:

```text
ID | Agent | Title | Workspace | Updated
```

Avoid dependency unless clearly useful.

---

## BL-CLI-002 — JSON Output

**Status:** IDEA  
**Priority:** P1  
**Target:** Unscheduled

Potential:

```text
casr sessions --json
casr inspect <id> --json
casr doctor --json
```

Useful for scripting and automation.

---

## BL-CLI-003 — Short CASR ID Display

**Status:** IDEA  
**Priority:** P3  
**Target:** Unscheduled

Display shortened IDs while preserving full canonical ID internally.

Need collision-safe resolution if short IDs become command inputs.

---

## BL-CLI-004 — Interactive Session Picker

**Status:** IDEA  
**Priority:** P3  
**Target:** Unscheduled

Potential:

```text
casr resume
```

without explicit ID, opening interactive selection.

Not required while CLI is architecture-first.

---

## BL-CLI-005 — Better Error Taxonomy

**Status:** IDEA  
**Priority:** P2  
**Target:** Unscheduled

Potential error categories:

```text
configuration
storage
adapter
session-not-found
unsupported-adapter
native-runtime
migration
```

---

## BL-CLI-006 — Verbose / Debug Mode

**Status:** IDEA  
**Priority:** P2  
**Target:** Unscheduled

Potential:

```text
--verbose
--debug
```

Must avoid leaking secrets or auth information.

---

# 6. Data / Storage

## BL-DATA-001 — Registry Backup

**Status:** IDEA  
**Priority:** P2  
**Target:** Unscheduled

Backup only CASR-owned data.

Never copy Codex credentials.

---

## BL-DATA-002 — Session Export

**Status:** IDEA  
**Priority:** P2  
**Target:** Future

Potential export:

```text
CASR session metadata
canonical events
snapshots
execution history
bindings
```

Export format should be provider-neutral.

---

## BL-DATA-003 — Session Import

**Status:** IDEA  
**Priority:** P2  
**Target:** Future

Import CASR canonical session package.

Requires stable canonical schema first.

---

## BL-DATA-004 — SQLite Integrity Check

**Status:** IDEA  
**Priority:** P2  
**Target:** Unscheduled

Potential doctor addition:

```text
PRAGMA integrity_check
migration version
registry binding integrity
```

---

## BL-DATA-005 — Orphan Binding Detection

**Status:** IDEA  
**Priority:** P2  
**Target:** Unscheduled

Detect:

```text
CASR binding exists
but native session no longer exists
```

Do not auto-delete.

Possible status:

```text
missing-native
```

---

# 7. Reliability / Safety

## BL-SAFE-001 — Explicit Read-only Codex Guard

**Status:** REVIEW  
**Priority:** P0  
**Target:** Unscheduled

Current adapter opens Codex SQLite read-only.

Potential additional safeguards:

```text
centralized read-only native storage API
tests preventing write-mode DB open
documented forbidden paths
```

---

## BL-SAFE-002 — Credential Path Denylist

**Status:** IDEA  
**Priority:** P0  
**Target:** Unscheduled

Explicitly prohibit reading/copying:

```text
auth.json
sandbox secrets
credential files
tokens
```

Could become adapter-level safety guard.

---

## BL-SAFE-003 — Native Storage Mutation Test

**Status:** IDEA  
**Priority:** P1  
**Target:** Unscheduled

Integration test could snapshot file metadata/hashes before and after CASR discovery/sync to verify no native writes occurred.

Needs careful design to avoid flaky tests.

---

## BL-SAFE-004 — Resume Workspace Existence Check

**Status:** IDEA  
**Priority:** P1  
**Target:** Unscheduled

Before resume:

```text
workspace exists?
directory accessible?
```

Need decide fallback behavior if original workspace has been moved/deleted.

---

# 8. Observability

## BL-OBS-001 — CASR Execution Log

**Status:** IDEA  
**Priority:** P2  
**Target:** Candidate V0.2C

CASR-owned log of operations:

```text
sync
inspect
resume
import
compile
```

Should not store secrets.

---

## BL-OBS-002 — Sync Statistics History

**Status:** IDEA  
**Priority:** P3  
**Target:** Unscheduled

Store sync run summaries:

```text
discovered
imported
updated
unchanged
errors
duration
```

---

## BL-OBS-003 — Native Runtime Exit History

**Status:** IDEA  
**Priority:** P2  
**Target:** Candidate execution-history phase

Record:

```text
CASR session
native session
runtime
started_at
ended_at
exit_code
workspace
```

---

# 9. Developer Experience

## BL-DX-001 — README

**Status:** DONE  
**Priority:** P1  
**Target:** V0.1 closure

Create project README covering:

```text
purpose
scope
commands
architecture
storage boundary
limitations
roadmap
```

---

## BL-DX-002 — Architecture Decision Records

**Status:** IDEA  
**Priority:** P2  
**Target:** Unscheduled

Potential ADRs:

```text
CASR ID ownership
Codex read-only boundary
SQLite selection
canonical raw history immutability
multiple native binding model
```

---

## BL-DX-003 — Release Checklist

**Status:** IDEA  
**Priority:** P2  
**Target:** Before first public release

Checklist:

```text
lint
tests
build
migration validation
doctor validation
real sync validation
resume validation
docs
tag
```

---

## BL-DX-004 — Standalone Executable

**Status:** IDEA  
**Priority:** P2  
**Target:** Future

Current distribution:

```text
npm / Node.js CLI
```

Future option:

```text
standalone executable
```

Do not prioritize before architecture stabilizes.

---

# 10. UI / Application Layer

## BL-UI-001 — Desktop GUI

**Status:** DEFERRED  
**Priority:** P3  
**Target:** Future

Potential GUI:

```text
session browser
session detail
history timeline
bindings
context compilation preview
```

Do not implement before canonical data model stabilizes.

---

## BL-UI-002 — Web UI

**Status:** DEFERRED  
**Priority:** P3  
**Target:** Future

Requires daemon/service architecture decision first.

---

## BL-UI-003 — Local Daemon

**Status:** DEFERRED  
**Priority:** P2  
**Target:** Future

Possible requirement for:

```text
GUI
background sync
continuous event import
local API
```

Not required for current CLI-first design.

---

# 11. Synchronization / Cloud

## BL-SYNC-001 — Multi-device Sync

**Status:** DEFERRED  
**Priority:** P3  
**Target:** Future

Requires:

```text
canonical event identity
conflict strategy
security model
encryption
account model
```

Not appropriate before local canonical store is stable.

---

## BL-SYNC-002 — Cloud Backup

**Status:** DEFERRED  
**Priority:** P3  
**Target:** Future

Must never upload native provider credentials.

---

# 12. Cross-provider Vision

## BL-XPROV-001 — Provider-independent Logical Session

**Status:** IDEA  
**Priority:** P0  
**Target:** Long-term

Target:

```text
CASR Canonical Session
        |
        +---- Codex
        |
        +---- Claude
        |
        +---- OpenCode
        |
        +---- future agent
```

CASR owns logical context.

Provider supplies intelligence/execution.

---

## BL-XPROV-002 — Provider Switch

**Status:** IDEA  
**Priority:** P0  
**Target:** Long-term

Potential flow:

```text
CASR Canonical History
       ↓
Context Compiler
       ↓
Target Provider
       ↓
new native execution
       ↓
new events imported back
```

---

## BL-XPROV-003 — Model-specific Context Profiles

**Status:** IDEA  
**Priority:** P1  
**Target:** Long-term

Compiler may account for:

```text
context window
system prompt behavior
tool schema
reasoning model characteristics
tokenizer
supported modalities
```

---

# 13. Explicit Non-goals Until Needed

Do not implement merely because they are technically attractive:

```text
vector DB
distributed architecture
microservices
plugin marketplace
cloud account system
real-time sync
complex ORM
event streaming infrastructure
message broker
Kubernetes
multi-tenant server
```

CASR should remain local-first and architecture-driven until requirements prove otherwise.

---

# 14. Recommended Immediate Sequence

Before V0.2 coding:

```text
1. Commit and tag MVP V0.1
2. Review V0.1 architecture
3. Perform Codex rollout JSONL discovery spike
4. Document event inventory
5. Design V0.2 scope
6. Create V0.2-dev-planning.md
7. Only then start V0.2 implementation
```

---

# 15. Backlog Summary

Highest-priority future items:

```text
P0
---
Canonical Event Store
Canonical Event Import
Stable Event Identity
Codex Rollout Discovery Spike
Context Compiler
Multiple Native Bindings
Read-only Native Storage Guard
Credential Safety
Provider-independent Logical Session
Provider Switch
```

Immediate next investigation:

```text
Codex Rollout Discovery Spike
```

Immediate next implementation milestone after planning:

```text
V0.2A — Canonical Event Import
```
