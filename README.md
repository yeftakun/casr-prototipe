# CASR — Canonical Agent Session Runtime

CASR adalah local session runtime layer yang memberi identitas logis independen di atas native agent sessions.

Tujuan jangka panjang CASR adalah memisahkan:

```text
ownership of context
```

dari:

```text
provider of intelligence
```

Pada MVP V0.1, CASR belum menjadi canonical history owner penuh. CASR saat ini berfungsi sebagai:

```text
logical session registry
+
native session discovery
+
native session navigation
+
native session resume
```

dengan Codex sebagai adapter pertama.

---

## Status

```text
Version : MVP V0.1
Status  : COMPLETE
```

Validated on:

```text
Platform  : Windows
Node.js   : v22.17.1
npm       : 10.9.2
Codex CLI : 0.150.1
```

Final quality gate:

```text
Lint       : PASS
Test Files : 7 passed
Tests      : 19 passed
Build      : PASS
```

---

# 1. What CASR Solves

Native agent runtimes biasanya memiliki session identity sendiri.

Contoh:

```text
Codex Session ID
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

CASR menambahkan logical identity miliknya sendiri:

```text
CASR Session ID
casr_01a04d48-c014-7469-9ed4-b36dcf9145ae
```

Mapping:

```text
CASR Session
     ↓
Native Binding
     ↓
Codex Session
```

Dengan demikian:

```text
CASR_SESSION_ID != NATIVE_SESSION_ID
```

tetapi CASR tetap dapat menemukan, memeriksa, dan me-resume native session yang benar.

---

# 2. MVP V0.1 Capabilities

MVP V0.1 menyediakan command:

```text
casr doctor
casr sync
casr sessions
casr inspect <casr-id>
casr resume <casr-id>
```

Capabilities:

```text
Codex environment detection
native session discovery
native metadata normalization
CASR logical session registration
idempotent synchronization
session listing
session inspection
native session binding
native Codex resume
original workspace restoration
```

---

# 3. Current Architecture

```text
                        CODEX
                          |
                          | READ ONLY
                          v
                    CodexAdapter
                          |
                          v
                   NativeSession[]
                          |
                          v
                       CASR Sync
                          |
                          v
                    CASR Registry
                     casr.sqlite
                          |
               +----------+----------+
               |                     |
               v                     v
        casr sessions          casr inspect
               |
               v
         CASR Session ID
               |
               v
          Native Binding
               |
               v
           casr resume
               |
               v
       Correct Codex Session
               +
       Correct Original Workspace
```

---

# 4. Storage Ownership

CASR mengikuti boundary berikut:

```text
CODEX_HOME = READ ONLY
CASR_HOME  = READ / WRITE
```

Default Codex home:

```text
~/.codex
```

Default CASR home:

```text
~/.casr
```

Environment overrides:

```text
CODEX_HOME
CASR_HOME
```

CASR tidak boleh melakukan mutation terhadap storage milik Codex.

Termasuk:

```text
state_5.sqlite
session_index.jsonl
sessions/**/rollout-*.jsonl
auth.json
sandbox secrets
credentials
tokens
```

Native resume dilakukan melalui Codex CLI:

```text
codex resume <native-session-id>
```

---

# 5. Requirements

Minimum runtime:

```text
Node.js >= 22.12.0
npm
Git
Codex CLI
```

Current validated environment:

```text
Node.js   v22.17.1
npm       10.9.2
Codex CLI 0.150.1
```

---

# 6. Installation

Install dependencies:

```powershell
npm.cmd install
```

Development CLI:

```powershell
npm.cmd run dev -- --help
```

Build:

```powershell
npm.cmd run build
```

Tests:

```powershell
npm.cmd test
```

Lint:

```powershell
npm.cmd run lint
```

Format:

```powershell
npm.cmd run format
```

---

# 7. Commands

## 7.1 casr doctor

Checks CASR and Codex environment.

Development invocation:

```powershell
npm.cmd run dev -- doctor
```

Example:

```text
CASR Doctor

Runtime
[OK] Node.js v22.17.1

Codex
[OK] codex-cli 0.150.1
[OK] CODEX_HOME C:\Users\yefta\.codex (default)

Storage
[OK] state_5.sqlite
[OK] sessions/
[OK] state_5.sqlite readable (read-only)
[OK] threads table
[INFO] 76 native Codex sessions detected
```

Override Codex home:

```powershell
npm.cmd run dev -- doctor --codex-home "C:\custom\.codex"
```

---

## 7.2 casr sync

Discovers native Codex sessions and synchronizes them into the CASR registry.

```powershell
npm.cmd run dev -- sync
```

Initial sync example:

```text
CASR Sync

Discovered : 76
Imported   : 76
Updated    : 0
Unchanged  : 0
```

Repeated sync:

```text
CASR Sync

Discovered : 76
Imported   : 0
Updated    : 0
Unchanged  : 76
```

Repeated synchronization is designed to be idempotent.

---

## 7.3 casr sessions

Lists registered CASR sessions.

```powershell
npm.cmd run dev -- sessions
```

Example:

```text
CASR Sessions

Total: 76

casr_...
  Agent     : codex
  Title     : Example session
  Workspace : C:\workspace
  Status    : active
  Updated   : 2026-08-29T...
```

Current MVP list output includes:

```text
CASR ID
Agent
Title
Workspace
Status
Updated
```

---

## 7.4 casr inspect

Inspects one logical CASR session.

```powershell
npm.cmd run dev -- inspect <casr-id>
```

Example:

```text
CASR Session

ID        : casr_...
Title     : ...
Workspace : ...
Status    : active
Created   : ...
Updated   : ...

Native Binding

Agent     : codex
Native ID : ...
Path      : ...
Provider  : openai
Model     : ...
```

Native metadata is also displayed.

Invalid ID:

```text
Session not found: casr-does-not-exist
```

Exit code:

```text
1
```

---

## 7.5 casr resume

Resumes the native agent session represented by a CASR logical session.

```powershell
npm.cmd run dev -- resume <casr-id>
```

Flow:

```text
CASR ID
   ↓
CASR registry
   ↓
native binding
   ↓
native Codex session ID
   +
original workspace
   ↓
codex resume <native-id>
```

The CASR database connection is closed before Codex TUI is launched.

On Windows, extended-length workspace paths such as:

```text
\\?\C:\workspace
```

are normalized only at the process boundary when needed.

Stored native metadata remains unchanged.

---

# 8. Project Structure

Current high-level structure:

```text
casr-prototipe/
├── concept/
├── docs/
├── migrations/
├── src/
│   ├── adapters/
│   │   └── codex/
│   ├── cli/
│   │   └── commands/
│   ├── core/
│   │   └── session/
│   └── storage/
│       └── repositories/
├── tests/
├── biome.json
├── package.json
└── tsconfig.json
```

Responsibilities:

```text
adapters/
provider/native-runtime integration

core/
provider-independent domain logic

storage/
CASR-owned persistence

cli/
command-line interface
```

The core layer should not directly depend on Codex database schema.

---

# 9. Database

CASR owns:

```text
CASR_HOME/casr.sqlite
```

Current primary tables:

```text
sessions
native_sessions
schema_migrations
```

`native_sessions` maps CASR logical sessions to native runtime sessions.

Conceptually:

```text
sessions
   1
   |
   N
native_sessions
```

MVP currently uses one Codex native binding per imported session, while the schema allows future extension.

---

# 10. Migrations

CASR uses plain SQL migrations.

Current migration:

```text
migrations/0001_initial.sql
```

Applied versions are recorded in:

```text
schema_migrations
```

Migration execution is idempotent.

---

# 11. Tests

Current test suites:

```text
tests/cli.test.ts
tests/codex-environment.test.ts
tests/codex-adapter.test.ts
tests/session-registry.test.ts
tests/sync-service.test.ts
tests/session-query.test.ts
tests/resume-target.test.ts
```

Current validated total:

```text
7 test files
19 tests
```

---

# 12. MVP Validation

The complete V0.1 flow has been validated:

```text
casr doctor
    ↓
casr sync
    ↓
casr sessions
    ↓
casr inspect
    ↓
casr resume
```

Validated dataset:

```text
76 native Codex sessions
76 CASR sessions
```

Validated resume mapping:

```text
CASR:
casr_01a04d48-c014-7469-9ed4-b36dcf9145ae

Codex:
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

The correct historical thread and original workspace were restored.

See:

```text
docs/MVP-v0.1-validation.md
docs/cp-step1.md
docs/cp-step2.md
docs/cp-step3.md
docs/cp-step4.md
docs/cp-step5.md
docs/cp-step6.md
```

---

# 13. Important Current Limitation

MVP V0.1 does **not** yet make CASR the canonical owner of conversation history.

Current model:

```text
CASR
  ↓
logical registry
  ↓
native Codex session
```

Future target:

```text
Native Agent History
        ↓
Canonical Import
        ↓
CASR Canonical Store
        ↓
Context Compiler
        ↓
Target Runtime / Model
```

Therefore V0.1 should be understood as:

```text
logical session registry
+
native runtime orchestration
```

not yet:

```text
canonical context runtime
```

---

# 14. Out of Scope for V0.1

Not implemented:

```text
canonical event store
lossless event import
token metrics
execution history
context compiler
context window targeting
compaction
retrieval
RAG
vector database
cross-provider migration
second adapter
GUI
daemon
cloud sync
multi-device sync
session export/import
automatic backups
```

These items must not be assumed to exist.

---

# 15. Roadmap

Current high-level roadmap:

```text
V0.1
Native Session Registry & Resume
COMPLETE

V0.2
Canonical Event Import
Token Metrics
Execution History

V0.3
Non-destructive Snapshots
Basic Compaction

V0.4
Context Compiler

V0.5
Retrieval

V0.6
Second Agent Adapter

V0.7+
Cross-provider Logical Sessions
```

Before implementing V0.2, the project should perform:

```text
V0.1 architecture review
+
Codex rollout JSONL discovery spike
+
V0.2 planning
```

---

# 16. Core Principle

The long-term architectural principle remains:

```text
Canonical(t+1) = Canonical(t) + NewRawEvents(t)
```

and eventually:

```text
Context(t) =
Compile(
  Canonical(t),
  TargetModel,
  TargetWindow,
  CurrentTask
)
```

Original raw canonical history must remain lossless.

Any future compaction should be derived and non-destructive.

---

# 17. Development Rule

Before adding a feature:

```text
1. define scope
2. define acceptance criteria
3. implement the minimum
4. test
5. lint
6. build
7. validate against real data
8. document checkpoint
9. commit
```

Avoid adding convenience features into a milestone unless they are required by its acceptance criteria.

---

# 18. Current Status

```text
[COMPLETE] STEP 1 — Bootstrap & Guardrails
[COMPLETE] STEP 2 — Doctor & Environment Detection
[COMPLETE] STEP 3 — Native Session Discovery
[COMPLETE] STEP 4 — CASR Registry & Sync
[COMPLETE] STEP 5 — Sessions & Inspect
[COMPLETE] STEP 6 — Native Resume & MVP Validation

MVP V0.1 COMPLETE
```
