# Changelog

All notable CASR prototype release milestones are documented here.

## [0.2.0] - 2026-08-30

### Added

- provider-neutral canonical event domain model
- CASR-owned `canonical_events` storage
- incremental Codex rollout JSONL reader
- tolerant native Codex event parser
- provider-neutral Codex event normalizer
- append-only canonical event repository
- transactional import cursor persistence
- transactional canonical import service
- canonical history import during `casr sync`
- `casr history <session-id>`
- canonical kind filtering
- JSON history output
- optional raw native evidence output
- import diagnostics in `casr inspect`
- structured `casr inspect --json`
- corruption and partial-file diagnostics
- `MALFORMED_RECORD` and `DEFERRED_TAIL`
- synthetic deterministic Codex golden fixtures
- real-native v0.2 acceptance validation

### Safety and Integrity

- Codex-owned storage remains read-only
- canonical history is append-only
- native source position plus fingerprint protects event identity
- source mutation is rejected
- cursor regressions are rejected
- event insertion and cursor advancement are transactional
- malformed records are never silently skipped
- incomplete final records are deferred
- raw native evidence remains recoverable

### Validation

Validated against five real Codex rollout files containing 9,685 physical
records.

```text
Physical records    : 9685
Canonical events    : 9685
First import        : 9685 inserted
Second import       : 0 inserted
Diagnostics         : 5 x EOF
Tool calls          : 2279
Tool results        : 2278
CODEX_HOME           : unchanged
Production CASR DB  : unchanged
```

Quality gate:

```text
Test Files : 23 passed
Tests      : 132 passed
Lint       : PASS
Build      : PASS
```

## [0.1.1]

MVP hardening release.

- compatibility guardrails
- packaging and release cleanup
- CI and repository hardening

## [0.1.0]

Initial CASR MVP.

- logical CASR session identity
- Codex environment detection
- native session discovery
- CASR SQLite registry
- idempotent metadata sync
- session navigation
- native resume
- original workspace restoration
