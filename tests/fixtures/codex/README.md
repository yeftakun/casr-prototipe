# Codex Golden Fixtures

These fixtures are synthetic test data for the CASR Codex adapter.

They are intentionally committed to the repository so changes to:

- physical JSONL reading,
- native parsing,
- canonical normalization,
- provenance extraction,
- corruption handling, and
- deferred-tail handling

produce deterministic regression failures.

## Safety

The fixture corpus:

- does not contain real user conversations;
- does not contain Codex authentication data;
- does not contain tokens, cookies, or account credentials;
- is not copied from CODEX_HOME;
- may be read and modified only as normal repository test data.

## Fixture groups

- `legacy-basic.jsonl` — legacy record format without `ordinal`
- `modern-basic.jsonl` — modern message records with ordinals
- `tools.jsonl` — function call and function result linkage
- `lifecycle.jsonl` — lifecycle semantics plus a forward-compatible unknown event
- `state-metadata.jsonl` — state and metadata normalization
- `malformed-middle.jsonl` — terminated malformed JSON in the middle of a source
- `deferred-tail.jsonl` — incomplete final record

The `expected/` directory contains static golden output.

Canonical golden output intentionally uses a logical fixture source name instead of an
absolute filesystem path so the same expected data works on Windows, Linux, CI, and
developer machines.