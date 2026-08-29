# CASR — Canonical Agent Session Runtime

CASR is a local session runtime layer that gives coding-agent sessions an independent logical identity.

Today, CASR works with **OpenAI Codex CLI** and lets you:

- discover native Codex sessions,
- register them into a CASR-owned SQLite registry,
- browse and inspect sessions,
- resume the correct native session,
- restore the original workspace.

> Current status: **MVP V0.1 complete**

---

## Why CASR?

Native agent runtimes already have their own session IDs.

CASR adds a separate logical identity on top:

```text
CASR Session ID
      ↓
Native Binding
      ↓
Codex Session ID
```

Example:

```text
CASR:
casr_01a04d48-c014-7469-9ed4-b36dcf9145ae

Codex:
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

So:

```text
CASR_SESSION_ID != NATIVE_SESSION_ID
```

The long-term goal is to separate:

```text
ownership of context
```

from:

```text
provider of intelligence
```

V0.1 does **not** yet own canonical conversation history. It currently provides a logical registry and native session orchestration layer.

---

## Current Capabilities

MVP V0.1 includes:

```text
casr doctor
casr sync
casr sessions
casr inspect <casr-id>
casr resume <casr-id>
```

Validated behavior:

- Codex environment detection
- native session discovery
- CASR logical session IDs
- SQLite registry
- idempotent sync
- session listing
- session inspection
- native binding lookup
- native Codex resume
- original workspace restoration
- Codex schema compatibility checks

---

## Quick Start

### Requirements

- Node.js >= 22.12.0
- npm
- Git
- OpenAI Codex CLI

Install dependencies:

```powershell
npm.cmd install
```

Check the environment:

```powershell
npm.cmd run dev -- doctor
```

Sync native sessions into CASR:

```powershell
npm.cmd run dev -- sync
```

List sessions:

```powershell
npm.cmd run dev -- sessions
```

Inspect one session:

```powershell
npm.cmd run dev -- inspect <casr-id>
```

Resume it:

```powershell
npm.cmd run dev -- resume <casr-id>
```

---

## Commands

### `doctor`

Checks:

- Node.js runtime
- Codex CLI
- `CODEX_HOME`
- `state_5.sqlite`
- Codex `sessions/`
- read-only database access
- `threads` table
- required Codex schema columns

Example:

```powershell
npm.cmd run dev -- doctor
```

---

### `sync`

Discovers native Codex sessions and synchronizes them into the CASR registry.

```powershell
npm.cmd run dev -- sync
```

Example first sync:

```text
Discovered : 76
Imported   : 76
Updated    : 0
Unchanged  : 0
```

Repeated sync:

```text
Discovered : 76
Imported   : 0
Updated    : 0
Unchanged  : 76
```

Sync is designed to be idempotent.

---

### `sessions`

Lists known CASR sessions.

```powershell
npm.cmd run dev -- sessions
```

Shows:

- CASR ID
- adapter
- title
- workspace
- status
- updated timestamp

---

### `inspect`

Shows detailed information for one CASR session.

```powershell
npm.cmd run dev -- inspect <casr-id>
```

Includes:

- logical CASR session metadata
- native Codex session ID
- native rollout path
- provider
- model
- native metadata

---

### `resume`

Resumes the native session linked to a CASR session.

```powershell
npm.cmd run dev -- resume <casr-id>
```

Flow:

```text
CASR ID
  ↓
CASR Registry
  ↓
Native Binding
  ↓
Native Codex Session ID
  +
Original Workspace
  ↓
codex resume <native-id>
```

---

## Architecture

```text
Codex Local Storage
        │
        │ READ ONLY
        ▼
   Codex Adapter
        │
        ▼
   NativeSession[]
        │
        ▼
      CASR Sync
        │
        ▼
   CASR Registry
    casr.sqlite
        │
   ┌────┼─────┐
   │    │     │
   ▼    ▼     ▼
sessions inspect resume
```

High-level source layout:

```text
src/
├── adapters/   # native runtime integration
├── cli/        # CLI commands
├── core/       # provider-neutral domain logic
└── storage/    # CASR-owned persistence
```

---

## Storage Boundary

CASR follows a strict ownership rule:

```text
CODEX_HOME = READ ONLY
CASR_HOME  = READ / WRITE
```

Default locations:

```text
Codex: ~/.codex
CASR:  ~/.casr
```

CASR must not modify Codex-owned storage.

It should not mutate or copy sensitive native files such as:

- `auth.json`
- credentials
- tokens
- sandbox secrets

Native resume is performed through the Codex CLI.

---

## Codex Schema Compatibility

CASR currently depends on internal Codex session metadata stored in:

```text
state_5.sqlite
```

Because this is not a stable public storage contract, CASR performs compatibility checks before using it.

`casr doctor` reports whether the expected Codex schema is supported.

If required fields are missing, CASR reports a clear compatibility error instead of failing with an unhandled SQL error.

---

## Development

Run tests:

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

Build:

```powershell
npm.cmd run build
```

Current validated quality gate:

```text
Test Files : 9 passed
Tests      : 25 passed
Lint       : PASS
Build      : PASS
```

---

## Project Status

```text
[COMPLETE] STEP 1 — Bootstrap & Guardrails
[COMPLETE] STEP 2 — Doctor & Environment Detection
[COMPLETE] STEP 3 — Native Session Discovery
[COMPLETE] STEP 4 — CASR Registry & Sync
[COMPLETE] STEP 5 — Sessions & Inspect
[COMPLETE] STEP 6 — Native Resume & MVP Validation
```

```text
MVP V0.1 COMPLETE
```

---

## Current Limitations

V0.1 does not yet include:

- canonical event history
- token metrics
- execution history
- context compiler
- compaction
- retrieval
- provider switching
- second agent adapter
- GUI
- daemon
- cloud sync
- multi-device sync

V0.1 should be understood as:

```text
logical session registry
+
native session orchestration
```

not yet:

```text
canonical context runtime
```

---

## Documentation

For a beginner-friendly guide:

```text
BABY.md
```

For backlog and technical debt:

```text
BACKLOG.md
```

For MVP validation:

```text
docs/MVP-v0.1-validation.md
```

For development checkpoints:

```text
docs/cp-step1.md
docs/cp-step2.md
docs/cp-step3.md
docs/cp-step4.md
docs/cp-step5.md
docs/cp-step6.md
```

For the original architecture and product concept:

```text
concept/
```

---

## Roadmap

High-level direction:

```text
V0.1 — Native Session Registry & Resume
COMPLETE

V0.2 — Canonical Event Import
         Token Metrics
         Execution History

V0.3 — Non-destructive Snapshots / Compaction

V0.4 — Context Compiler

V0.5 — Retrieval

V0.6 — Second Agent Adapter

V0.7+ — Cross-provider Logical Sessions
```

Detailed future work belongs in `BACKLOG.md`.

---

## License

ISC License.

See:

```text
LICENSE
```
