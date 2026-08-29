# CASR - Canonical Agent Session Runtime

CASR is a local runtime layer for persistent coding-agent sessions.

It gives a session a CASR-owned logical identity while treating the native
agent runtime as an execution environment and native history source.

Current release:

```text
CASR v0.2.0
Canonical Event History
```

The first supported adapter is OpenAI Codex CLI.

## Core Identity Model

CASR deliberately separates logical and native identity:

```text
CASR_SESSION_ID != NATIVE_SESSION_ID
ACCOUNT_IDENTITY != SESSION_IDENTITY
```

A CASR session can therefore be reasoned about independently from the
account, provider-native session identifier, model, and future execution
environment.

## What v0.2 Adds

v0.1 established logical session identity, native session discovery, and
native resume.

v0.2 adds CASR-owned canonical event history.

```text
CODEX_HOME
   |
   | READ ONLY
   v
Codex rollout JSONL
   |
   v
Codex Rollout Reader
   |
   v
Native Event Parser
   |
   v
Canonical Normalizer
   |
   v
Canonical Import Service
   |
   +--> canonical_events
   +--> import_cursors
   |
   v
CASR-owned SQLite
```

Canonical history is append-only and preserves native evidence.

## Current CLI

```text
casr doctor
casr sync
casr sessions
casr inspect <session-id>
casr inspect <session-id> --json
casr history <session-id>
casr history <session-id> --limit 20
casr history <session-id> --kind message
casr history <session-id> --json
casr history <session-id> --json --raw
casr resume <session-id>
```

### `doctor`

Checks the local CASR and Codex environment, including Node.js, Codex CLI,
`CODEX_HOME`, `state_5.sqlite`, the native `sessions/` tree, required schema
columns, and read-only access to Codex-owned metadata.

```powershell
npm.cmd run dev -- doctor
```

### `sync`

Discovers native sessions, synchronizes the CASR registry, and incrementally
imports canonical history.

```powershell
npm.cmd run dev -- sync
```

The import process is idempotent. An unchanged source already at EOF reads and
inserts no new canonical records on a repeated sync.

### `sessions`

```powershell
npm.cmd run dev -- sessions
```

### `inspect`

Shows logical session metadata, native binding information, canonical history
summary, and import diagnostics.

```powershell
npm.cmd run dev -- inspect <casr-id>
npm.cmd run dev -- inspect <casr-id> --json
```

Import diagnostics may report:

```text
NOT_IMPORTED
MISSING_CURSOR
EOF
BEHIND
SOURCE_GREW
SOURCE_MISSING
SOURCE_TRUNCATED
MALFORMED_RECORD
DEFERRED_TAIL
```

### `history`

Reads canonical history from CASR-owned SQLite.

```powershell
npm.cmd run dev -- history <casr-id>
npm.cmd run dev -- history <casr-id> --limit 20
npm.cmd run dev -- history <casr-id> --kind message
npm.cmd run dev -- history <casr-id> --json
npm.cmd run dev -- history <casr-id> --json --raw
```

Default output hides raw native evidence. `--raw` is intentionally available
only with JSON output.

### `resume`

```powershell
npm.cmd run dev -- resume <casr-id>
```

## Canonical Event Model

Provider-neutral event kinds:

```text
message
tool_call
tool_result
reasoning
lifecycle
state
metadata
unknown
```

Important rule:

```text
1 native record -> 1 canonical draft
```

Native provider vocabulary is retained as provenance metadata and raw
evidence.

## Incremental Import

CASR maintains one cursor per physical native source. A cursor records the
native source, next safe byte offset, next physical record index, observed file
size, and last consumed record fingerprint.

```text
EVENT INSERT + CURSOR ADVANCE = ONE TRANSACTION
```

## Corruption and Partial Files

Malformed terminated middle record:

```text
safe prefix -> imported
malformed record -> blocks progress
later bytes -> not silently skipped
```

Incomplete final record:

```text
safe prefix -> imported
incomplete tail -> deferred
completed tail -> imported on a later sync
```

CASR does not automatically skip malformed native records, rewrite rollout
files, rewind cursors, or delete canonical history.

## Storage Boundary

```text
CODEX_HOME = READ ONLY
CASR_HOME  = READ / WRITE
```

Typical locations:

```text
Codex: ~/.codex
CASR:  ~/.casr
```

CASR must not modify or copy sensitive Codex-owned files such as `auth.json`,
credentials, access tokens, refresh tokens, or sandbox secrets.

## Codex Compatibility

Codex internal storage is not treated as a stable public contract. CASR
validates required `threads` schema columns before reading native metadata.

## Golden Fixtures

Deterministic synthetic fixtures live under:

```text
tests/fixtures/codex/
```

They cover legacy and modern envelopes, messages, tools, lifecycle, state,
metadata, unknown future semantics, malformed middle records, and deferred
tails. The fixture corpus contains no real conversation history or credentials.

## v0.2 Real-Native Validation

Validated against five real local Codex rollout sources:

```text
experiment-small      58
recent-zero-token     15
medium               195
large-1             4490
large-2             4927
-------------------------
TOTAL                9685
```

Acceptance:

```text
Physical records    : 9685
Canonical events    : 9685
First import        : 9685 inserted
Second import       : 0 inserted
Diagnostics         : 5 x EOF
Source positions    : contiguous
Sequences           : contiguous
Fingerprints        : valid SHA-256
Payload/raw JSON    : serializable
Tool linkage        : valid
CODEX_HOME           : unchanged
Production CASR DB  : unchanged
```

Canonical kinds:

```text
lifecycle      755
message       1675
metadata      1540
reasoning     1045
state          113
tool_call     2279
tool_result   2278
------------------
TOTAL          9685
```

The accepted tool invariant is:

```text
every tool_result must reference an observed tool_call
```

A result is not required for every call.

## Quick Start

Requirements:

- Node.js >= 22.12.0
- npm
- Git
- OpenAI Codex CLI

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run dev -- doctor
npm.cmd run dev -- sync
npm.cmd run dev -- sessions
```

## Development

```powershell
npm.cmd run format
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Validated v0.2 quality gate:

```text
Test Files : 23 passed
Tests      : 132 passed
Lint       : PASS
Build      : PASS
```

CI performs:

```text
npm ci
npm run lint
npm test
npm run build
```

## Documentation

```text
README.md
CHANGELOG.md
docs/CASR-v0.2-CANONICAL-EVENT-HISTORY.md
docs/CASR-CROSS-ACCOUNT-ROADMAP.md
docs/v0.2-validation.md
docs/MVP-v0.1-validation.md
```

## Release Status

```text
v0.1.0 - Native session registry and resume
v0.1.1 - MVP hardening
v0.2.0 - Canonical event history
```

## Roadmap

```text
v0.1  Logical identity + native resume              COMPLETE
v0.2  Canonical append-only event history           COMPLETE
v0.3  Session checkpoint / working state
v0.4  Context compiler + rehydration
v0.5  Multi-native binding + fallback
v0.6  Model / context-window adaptation
```

Canonical raw history remains the durable source of evidence. Future
summaries, checkpoints, compaction products, and compiled context are derived
state and must not replace raw canonical history.

## License

ISC License. See `LICENSE`.
