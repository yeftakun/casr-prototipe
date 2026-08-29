# CASR v0.2 — Codex Rollout Discovery

**Checkpoint:** CP-v0.2-0  
**Version target:** CASR v0.2 — Canonical Event History  
**Status:** COMPLETE  
**Scope:** Empirical discovery of OpenAI Codex local rollout JSONL  
**Safety boundary:** Read-only inspection only  
**Date:** 2026-08-29

---

# 1. Purpose

This discovery spike was performed before designing the production canonical event schema.

The goal was to answer four questions:

```text
1. How are native Codex rollout records ordered?
2. What identity signals exist?
3. What event families and subtypes exist?
4. Which native fields are safe to use for linkage vs canonical identity?
```

No Codex-owned files were modified.

The inspected sources remained under:

```text
CODEX_HOME = READ ONLY
```

---

# 2. Samples

Five real Codex sessions were inspected.

```text
experiment-small
01a04c15-f919-7c52-9b6a-0fa9ff4d3394

recent-zero-token
01a04c11-a169-7db3-a1ff-887a0532173d

medium
019f75d8-57df-7360-9756-de5c6e2f6943

large-1
019e6984-fd0d-7ee1-8895-582a86e018a7

large-2
019e86b7-ec16-7a32-9970-c516bc89dd62
```

The samples intentionally included:

- a small recent session,
- a zero-token session,
- a medium historical session,
- two very large historical sessions,
- different rollout format generations,
- tool-heavy sessions,
- compaction / rollback / abort signals.

---

# 3. Dataset Summary

Observed record counts:

```text
experiment-small   58
recent-zero-token  15
medium            195
large-1          4490
large-2          4927
```

Across all five samples:

```text
total inspected records = 9685
```

All inspected non-empty records were valid JSON.

Observed:

```text
Malformed middle record : 0
Partial trailing record : 0
```

This does not prove that partial or malformed records can never occur.

Production code must still handle them safely because Codex may be actively appending to a rollout while CASR reads it.

---

# 4. Native Envelope

The stable top-level structure observed in all generations is:

```text
timestamp
type
payload
```

Recent rollout records additionally contain:

```text
ordinal
```

Observed recent signature:

```text
ordinal,payload,timestamp,type
```

Observed older signature:

```text
payload,timestamp,type
```

Therefore:

```text
ordinal is NOT universally available
```

and cannot be required for compatibility with older native sessions.

---

# 5. Top-Level Native Event Families

Observed top-level types include:

```text
session_meta
event_msg
response_item
turn_context
world_state
compacted
```

The dominant families in large historical sessions were:

```text
response_item
event_msg
```

but CASR must not assume those are the only meaningful native record families.

---

# 6. Observed Payload Types

Observed payload subtypes include:

```text
message
reasoning

function_call
function_call_output

custom_tool_call
custom_tool_call_output

user_message
agent_message

task_started
task_complete
turn_aborted

token_count

patch_apply_end

item_completed

thread_settings_applied

context_compacted
thread_rolled_back
```

Some top-level record types have no payload subtype.

Examples:

```text
session_meta
turn_context
world_state
compacted
```

---

# 7. Important Semantic Discovery

Native Codex history is not simply:

```text
user message
assistant message
tool call
tool result
```

It also contains state/lifecycle history such as:

```text
turn start
turn completion
turn abort
context compaction
thread rollback
world state
thread settings
token count
patch application
session metadata
```

Therefore CASR v0.2 must preserve the raw event stream even when not every native record becomes a high-level conversational event.

---

# 8. Ordering Findings

## 8.1 Physical source order

Every inspected rollout is a JSONL sequence.

The safest common ordering signal across all inspected generations is:

```text
physical source order
```

Therefore the v0.2 ordering rule is:

```text
PRIMARY NATIVE ORDER
=
physical JSONL record order
```

CASR must not reconstruct the native sequence solely from timestamps.

---

## 8.2 Ordinal

Recent sessions contain an `ordinal`.

Observed recent sessions:

```text
experiment-small

records            : 58
ordinal present    : 58
ordinal unique     : 58
ordinal duplicates : 0
ordinal decreases  : 0
first ordinal      : 0
last ordinal       : 57
```

and:

```text
recent-zero-token

records            : 15
ordinal present    : 15
ordinal unique     : 15
ordinal duplicates : 0
ordinal decreases  : 0
first ordinal      : 0
last ordinal       : 14
```

This is an excellent ordering validation signal for newer rollout files.

However, older sessions contained no ordinal at all.

Therefore:

```text
ordinal
=
optional native metadata
+
ordering validation signal

NOT
=
universal event identity
```

---

# 9. Timestamp Findings

Every inspected native record had a top-level timestamp.

Across all five sessions:

```text
timestamp missing      : 0
timestamp parse errors : 0
timestamp decreases    : 0
```

Timestamps were monotonic in all inspected samples.

However:

```text
timestamp != canonical ordering key
```

because timestamps can theoretically collide and native source order is stronger.

Recommended usage:

```text
physical source order = primary
ordinal               = optional validation
timestamp             = temporal metadata
```

---

# 10. Payload ID Findings

A critical discovery is that `payload.id` is not stable enough to serve as universal native record identity.

Observed:

```text
experiment-small
unique payload IDs   : 18
repeated payload IDs : 0

recent-zero-token
unique payload IDs   : 8
repeated payload IDs : 0

medium
unique payload IDs   : 78
repeated payload IDs : 3

large-1
unique payload IDs   : 1
repeated payload IDs : 42

large-2
unique payload IDs   : 1
repeated payload IDs : 39
```

This changes substantially between rollout generations.

Therefore:

```text
DO NOT USE payload.id
AS THE UNIVERSAL CANONICAL IMPORT KEY
```

Payload IDs remain useful as native linkage metadata when present.

---

# 11. Native Record Identity Decision

There is no single universal top-level native event ID in the inspected rollout format.

All samples showed:

```text
top-level ID-like key = 0
```

Therefore raw native record identity in CASR should be based on source provenance.

Recommended conceptual identity:

```text
adapter
+
native_session_id
+
native_source
+
source_position
+
content_fingerprint
```

Where:

```text
adapter
=
codex

native_session_id
=
native Codex session UUID

native_source
=
rollout source identity

source_position
=
physical record position

content_fingerprint
=
stable hash of raw source record
```

The fingerprint provides additional mutation/deduplication protection.

---

# 12. Source Position Decision

CASR should preserve a CASR-owned source position for every imported native record.

Minimum:

```text
record_index
```

starting from the physical JSONL order.

Recommended production reader metadata:

```text
record_index
byte_offset_start
byte_offset_end
```

if byte offsets can be tracked without making the implementation unnecessarily complex.

Reason:

```text
record_index
=
easy deterministic ordering

byte offset
=
efficient incremental cursor candidate
```

The exact cursor storage format can be finalized during rollout reader implementation.

---

# 13. Canonical Sequence Decision

Native source position and CASR canonical sequence are separate concepts.

Example:

```text
native record_index : 412
canonical sequence  : 307
```

This can happen if later versions distinguish between:

```text
raw native records
```

and:

```text
logical canonical projections
```

For v0.2, CASR should preserve native source position independently from the CASR-owned canonical sequence.

---

# 14. Turn ID Findings

`turn_id` appears consistently enough to be useful as grouping metadata.

Observed unique turn IDs:

```text
experiment-small   5
recent-zero-token  1
medium             4
large-1           45
large-2           45
```

Recommended use:

```text
turn_id
=
native relationship / grouping metadata
```

Not:

```text
event identity
```

---

# 15. Function Call Linkage

`call_id` is a strong linkage signal.

Observed medium session:

```text
function calls       : 37
function outputs     : 37
matched call/output  : 37
calls without output : 0
outputs without call : 0
```

Observed large-1:

```text
function calls       : 845
function outputs     : 845
matched call/output  : 845
```

Observed large-2:

```text
function calls       : 858
function outputs     : 858
matched call/output  : 858
```

Therefore:

```text
call_id
=
strong tool-call relationship key
```

but:

```text
call_id
!=
raw event identity
```

---

# 16. Custom Tool Linkage

The same pattern exists for custom tools.

Observed medium:

```text
custom calls        : 4
custom outputs      : 4
matched             : 4
```

Observed large-1:

```text
custom calls        : 294
custom outputs      : 294
matched             : 294
```

Observed large-2:

```text
custom calls        : 240
custom outputs      : 240
matched             : 240
```

Therefore custom tool call/output can also be linked using:

```text
call_id
```

when present.

---

# 17. Unmatched Tool Call Case

The recent zero-token session contained:

```text
function calls       : 1
function outputs     : 0
calls without output : 1
```

The same session also contained:

```text
turn_aborted
```

This proves that production CASR must allow:

```text
tool_call
without
tool_result
```

A canonical data model must not enforce:

```text
every call must have output
```

because interrupted or aborted native sessions can legitimately violate that assumption.

---

# 18. Message Role Findings

Observed native message roles include:

```text
user
assistant
developer
```

Examples from recent rollout:

```text
message -> role=user
message -> role=assistant
message -> role=developer
```

Therefore a future provider-neutral canonical message representation should at minimum support these roles.

Do not collapse developer messages into user messages.

---

# 19. `item_completed` Discovery

Recent rollout generations include:

```text
event_msg -> item_completed
```

Nested item types observed:

```text
UserMessage
Reasoning
AgentMessage
Plan
```

A key discovery is that nested `item_completed.item.id` only partially overlaps with IDs found on `response_item`.

Example experiment-small:

```text
response_item IDs       : 17
item_completed item IDs : 15
ID overlap              : 10
```

Recent zero-token:

```text
response_item IDs       : 7
item_completed item IDs : 3
ID overlap              : 2
```

Medium:

```text
response_item IDs       : 77
item_completed item IDs : 1
ID overlap              : 0
```

Therefore:

```text
item_completed
```

must NOT automatically be treated as:

```text
duplicate response_item
```

nor should it automatically be treated as a completely independent user-visible conversation event.

The safest v0.2 behavior is:

```text
preserve raw item_completed record
+
preserve nested item metadata
+
defer aggressive semantic collapsing
```

---

# 20. Session Metadata Evolution

`session_meta` shape evolved across Codex versions.

Recent session metadata includes fields such as:

```text
base_instructions
cli_version
context_window
cwd
history_mode
id
model_provider
originator
session_id
source
thread_source
timestamp
```

Older metadata commonly contains:

```text
base_instructions
cli_version
cwd
git
id
memory_mode
model_provider
originator
source
thread_source
timestamp
```

Some old session metadata records do not contain:

```text
session_id
```

Therefore:

```text
session_meta.session_id
```

cannot be required as the sole session-linking mechanism.

CASR already knows native session identity from its binding and rollout source.

---

# 21. Repeated Session Metadata

Large historical sessions contained many `session_meta` records.

Observed:

```text
large-1 : 43 session_meta records
large-2 : 40 session_meta records
```

This means `session_meta` is not necessarily only:

```text
one header at beginning of file
```

CASR should preserve these records because they may describe changing native execution context.

Do not assume:

```text
first session_meta == only relevant metadata
```

---

# 22. Compaction Findings

Both large historical sessions contained:

```text
top-level: compacted
```

and:

```text
event_msg -> context_compacted
```

Observed:

```text
large-1
compacted         : 4
context_compacted : 4

large-2
compacted         : 4
context_compacted : 4
```

This is architecturally important.

Native Codex history already contains compaction lifecycle information.

CASR must preserve these records because later context reconstruction may need to understand:

```text
what native history was compacted
when it was compacted
what replacement state existed
```

CASR must still preserve its own raw canonical import losslessly.

---

# 23. Rollback Findings

Observed:

```text
event_msg -> thread_rolled_back
```

Counts:

```text
large-1 : 1
large-2 : 3
```

This proves native history is not simply a forward-only semantic conversation timeline.

The raw source remains append-only as a file, but its semantics can include:

```text
rollback
```

CASR must preserve rollback records.

Future projections may decide which logical state is considered active.

Raw canonical history must not erase pre-rollback records.

---

# 24. Abort Findings

Observed:

```text
event_msg -> turn_aborted
```

Examples occurred in:

```text
recent-zero-token
large-2
```

Therefore canonical history must represent interrupted turns without requiring artificial completion.

---

# 25. World State Findings

Recent sessions include:

```text
world_state
```

Older inspected sessions did not necessarily contain it.

This is another format-evolution signal.

For v0.2:

```text
world_state
```

must be preserved raw even before CASR assigns a richer provider-neutral semantic meaning.

---

# 26. Format Evolution

The inspected sessions clearly show at least two format generations.

## Newer shape

Characteristics include:

```text
top-level ordinal
internal_chat_message_metadata_passthrough
item_completed
world_state
thread_settings_applied
session_meta.session_id
```

## Older shape

Characteristics include:

```text
no ordinal
different response_item fields
event_msg user_message
event_msg agent_message
compacted
context_compacted
thread_rolled_back
older session_meta shapes
```

Therefore the Codex parser must be:

```text
version-tolerant
```

rather than expecting one exact native schema.

---

# 27. Required Parser Philosophy

Production parser behavior should be:

```text
known structure
→ normalize

unknown valid structure
→ preserve as unknown

malformed source record
→ report safely

partial trailing record
→ defer

never silently drop valid native data
```

---

# 28. Native vs Canonical Layer

The discovery reinforces the need for three different concepts.

```text
RawNativeRecord
        ↓
CodexNativeEvent
        ↓
CanonicalEvent
```

## RawNativeRecord

Represents physical JSONL source fidelity.

Contains:

```text
raw line
parsed JSON
source position
timestamp
native top-level type
```

## CodexNativeEvent

Provider-specific semantic parsing.

May understand:

```text
response_item
event_msg
function_call
context_compacted
...
```

## CanonicalEvent

Provider-neutral CASR meaning.

Must not expose Codex internal vocabulary as its public core contract.

---

# 29. Recommended Raw Record Model

Draft:

```ts
interface NativeRolloutRecord {
  recordIndex: number;

  byteOffsetStart?: number;
  byteOffsetEnd?: number;

  timestamp: string | null;

  nativeTopLevelType: string | null;

  ordinal: number | null;

  rawLine: string;
  parsed: unknown;

  fingerprint: string;
}
```

This is a reader-layer structure, not the final canonical event structure.

---

# 30. Recommended Linkage Metadata

Canonical provenance may preserve optional linkage fields:

```text
native_payload_id
native_turn_id
native_call_id
native_ordinal
native_top_level_type
native_payload_type
```

These are metadata.

They are not all required.

They must not determine CASR session identity.

---

# 31. Recommended Import Identity

A robust first implementation should use something conceptually equivalent to:

```text
source_record_key =
SHA-256(
  adapter
  +
  native_session_id
  +
  normalized_source_identity
  +
  source_position
  +
  raw_record_fingerprint
)
```

A simpler DB representation can store the components separately and enforce a suitable UNIQUE constraint.

Do not rely on:

```text
timestamp
payload.id
turn_id
call_id
ordinal
```

alone.

---

# 32. Source Path Normalization

Observed rollout paths can use both:

```text
C:\Users\...
```

and:

```text
\\?\C:\Users\...
```

CASR already encountered this path form during v0.1.

For v0.2:

```text
preserve native path losslessly
```

while optionally deriving a normalized comparison path for internal source identity.

Do not mutate the stored native path merely for convenience.

---

# 33. Incremental Cursor Recommendation

Discovery supports an incremental reader.

Recommended first candidate:

```text
byte offset
```

with:

```text
record index
```

also tracked for diagnostics and deterministic ordering.

Why byte offset:

```text
avoids rereading entire large rollout
```

Why record index:

```text
human-readable ordering
simple testing
stable CASR source sequence
```

Before committing the final cursor schema, the rollout reader implementation should prove byte-offset resume behavior with:

```text
LF
CRLF
UTF-8
partial final record
```

---

# 34. Mutation Detection

If CASR later observes:

```text
same source position
different raw fingerprint
```

that should be treated as:

```text
native source mutation
```

not silently overwritten.

Possible future diagnostic:

```text
SOURCE_MUTATION_DETECTED
```

The v0.2 canonical store should remain append-safe.

---

# 35. Raw Import vs Semantic Projection

Discovery revealed duplicated or overlapping semantic signals.

Examples:

```text
response_item -> message
event_msg -> agent_message

response_item -> function_call
event_msg -> item_completed

compacted
event_msg -> context_compacted
```

Therefore v0.2 should distinguish:

```text
lossless native import
```

from:

```text
semantic canonical projection
```

This is crucial.

Recommended architecture:

```text
Native rollout
     ↓
lossless imported native records
     ↓
canonical semantic events / projections
```

If v0.2 uses one physical table initially, it must still preserve enough raw provenance to reconstruct this distinction later.

---

# 36. Important Design Warning

Do not equate:

```text
one JSONL line
=
one user-visible conversation event
```

The discovery disproves that simplification.

One turn can generate many records:

```text
turn_context
response_item
event_msg
token_count
function_call
function_call_output
task_complete
...
```

---

# 37. Canonical Event Categories — Revised Draft

The original planning draft proposed categories such as:

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

After discovery, a safer initial canonical vocabulary is:

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

with message role:

```text
user
assistant
developer
system
unknown
```

This avoids premature proliferation while preserving meaning.

This is still a draft for STEP 1.

---

# 38. Lifecycle Category Candidates

Native records that may map to lifecycle events include:

```text
task_started
task_complete
turn_aborted
item_completed
thread_rolled_back
context_compacted
compacted
```

Some may later become more specific canonical event types.

Do not finalize until STEP 1.

---

# 39. State Category Candidates

Possible state-oriented records include:

```text
turn_context
world_state
thread_settings_applied
```

These may become:

```text
state
```

or:

```text
metadata
```

in the first canonical model.

Raw source must remain preserved regardless.

---

# 40. Metrics Candidates

Examples:

```text
token_count
duration_ms
time_to_first_token_ms
rate_limits
```

These are valuable for future execution history / metrics.

For v0.2:

```text
preserve them
```

Do not build analytics yet.

---

# 41. Discovery Decisions

The following decisions are now considered established for v0.2.

## AR-v0.2-001

```text
Physical JSONL order is the primary native ordering source.
```

## AR-v0.2-002

```text
ordinal is optional metadata, not a required ordering field.
```

## AR-v0.2-003

```text
timestamp is temporal metadata, not sole identity/order.
```

## AR-v0.2-004

```text
payload.id is not a universal native event identity.
```

## AR-v0.2-005

```text
call_id is a relationship key for tool call/output.
```

## AR-v0.2-006

```text
turn_id is grouping metadata.
```

## AR-v0.2-007

```text
unknown valid native records must be preserved.
```

## AR-v0.2-008

```text
raw native source data must remain recoverable.
```

## AR-v0.2-009

```text
compaction, rollback, abort, and lifecycle records are part of canonical history evidence.
```

## AR-v0.2-010

```text
Codex-native vocabulary stops at the adapter boundary.
```

---

# 42. Open Questions Remaining for Implementation

Discovery is complete, but these details should be proven during implementation.

```text
1. Is byte offset the best cursor on Windows Node.js streams?
2. How should a partial final UTF-8 JSON record be detected?
3. Should raw native records and canonical projections use separate tables in v0.2?
4. Which `item_completed` records should project to canonical lifecycle events?
5. How should `compacted` and `context_compacted` relate semantically?
6. Should token_count be a canonical event or only preserved native metadata?
7. How should native source mutation be exposed in CLI diagnostics?
```

These questions do not block STEP 0 completion.

They belong to later implementation steps.

---

# 43. Production Constraints Derived from Discovery

The rollout reader/parser must support:

```text
old rollout without ordinal
new rollout with ordinal
session_meta shape changes
missing payload IDs
repeated payload IDs
function call without output
tool call/output linkage
custom tool call/output linkage
compaction
rollback
abort
world state
unknown future records
```

---

# 44. STEP 0 Exit Criteria

Original questions:

## How are events ordered?

Answered:

```text
physical JSONL source order
```

with optional ordinal validation.

## Is there a universal native event ID?

Answered:

```text
No reliable universal root event ID was observed.
```

## Are timestamps present?

Answered:

```text
Yes across all inspected samples.
```

But they are metadata, not sole identity.

## How are tool calls linked?

Answered:

```text
call_id
```

with strong empirical matching.

## Are unknown/versioned structures possible?

Answered:

```text
Yes.
```

Multiple rollout generations were observed.

## Are malformed/partial lines present?

Observed:

```text
No, not in the inspected static samples.
```

Production reader must still handle them.

## Does native history contain lifecycle/state semantics?

Answered:

```text
Yes.
```

Compaction, rollback, abort, world state, turn context, and other events exist.

---

# 45. STEP 0 Result

```text
STEP 0 — Codex Rollout Discovery Spike
STATUS: COMPLETE
```

We now have enough empirical evidence to start:

```text
STEP 1 — Canonical Event Domain Model
```

without inventing the model blindly.

---

# 46. Recommended Next Step

Do not create the database migration yet.

Next:

```text
STEP 1
Canonical Event Domain Model
```

Use the discovery findings to define:

```text
RawNativeRecord
CanonicalEvent
CanonicalEventType
CanonicalSource
CanonicalLinkage
```

and their invariants.

Only after the domain contract is tested should:

```text
migrations/0002_canonical_events.sql
```

be finalized.

---

# 47. Final Summary

The key discovery is:

```text
Codex rollout
is an append-oriented native execution/event log,
not merely a chat transcript.
```

Therefore CASR must preserve:

```text
conversation
+
tool execution
+
reasoning metadata
+
lifecycle
+
state
+
compaction
+
rollback
+
unknown future records
```

while keeping a strict distinction between:

```text
native source truth
```

and:

```text
CASR canonical semantic representation
```

That distinction is the foundation for the rest of CASR v0.2.
