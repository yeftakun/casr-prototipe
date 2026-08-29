# CASR Development Checkpoint

## CP-STEP3 — Codex Native Session Discovery

**Project:** Canonical Agent Session Runtime (CASR)
**Stage:** MVP V0.1
**Checkpoint:** Step 3 — Native Session Discovery
**Environment:** Windows PowerShell
**Codex CLI:** 0.150.1

---

## 1. Objective

Checkpoint ini bertujuan membuat CASR mampu membaca metadata native Codex session dari local Codex storage dan menormalisasikannya ke struktur internal CASR.

Target utama:

```text
Codex state_5.sqlite
        ↓
threads
        ↓
CodexThreadRow[]
        ↓
CodexAdapter
        ↓
NativeSession[]
```

Pada checkpoint ini belum ada CASR persistent registry.

Belum diimplementasikan:

```text
casr.sqlite
CASR Session ID
casr sync
casr sessions
casr inspect
casr resume
```

Seluruh akses terhadap Codex native storage tetap read-only.

---

# 2. Native Schema Verification

Sebelum implementasi adapter, schema nyata table `threads` diverifikasi langsung menggunakan SQLite read-only.

Command:

```powershell
sqlite3 -readonly "$HOME\.codex\state_5.sqlite" "PRAGMA table_info(threads);"
```

Schema Codex CLI 0.150.1 memiliki 38 columns.

Field yang digunakan oleh discovery MVP:

```text
id
title
cwd
model_provider
model
reasoning_effort
rollout_path
source
thread_source
history_mode
project_id
archived
created_at
updated_at
```

---

# 3. Timestamp Verification

Field:

```text
created_at
updated_at
```

disimpan sebagai:

```text
INTEGER
```

dan berdasarkan data nyata merupakan Unix timestamp dalam detik.

Contoh:

```text
1787982903
1787984826
```

CASR menormalisasikannya menjadi ISO-8601.

Contoh:

```text
2026-08-29T05:55:03.000Z
2026-08-29T06:27:06.000Z
```

---

# 4. Windows Native Path Observation

Metadata Codex dapat menggunakan Windows extended-length path prefix:

```text
\\?\
```

Contoh:

```text
\\?\C:\Users\yefta\agent
```

dan:

```text
\\?\C:\Users\yefta\.codex\sessions\...
```

CASR tidak menghapus atau mengubah prefix tersebut pada tahap discovery.

Prinsip:

```text
Native metadata should remain lossless during discovery.
```

---

# 5. Core NativeSession Model

Model internal baru:

```text
src/core/session/native-session.ts
```

Fields:

```text
adapter
nativeSessionId
title
workspacePath
nativePath
provider
model
reasoningEffort
source
threadSource
historyMode
projectId
archived
createdAt
updatedAt
```

`NativeSession` merupakan representation yang dipahami oleh CASR core.

Ia tidak menggunakan nama field vendor-specific seperti:

```text
rollout_path
model_provider
reasoning_effort
```

---

# 6. CodexThreadRow

Representation native Codex ditempatkan di:

```text
src/adapters/codex/codex-types.ts
```

`CodexThreadRow` mengikuti nama field native SQLite Codex:

```text
id
title
cwd
model_provider
model
reasoning_effort
rollout_path
source
thread_source
history_mode
project_id
archived
created_at
updated_at
```

Boundary:

```text
Codex native schema
        ↓
CodexThreadRow
        ↓
normalization
        ↓
NativeSession
```

Dengan demikian CASR core tidak bergantung langsung pada nama schema Codex.

---

# 7. CodexAdapter

Adapter baru:

```text
src/adapters/codex/codex-adapter.ts
```

Class:

```text
CodexAdapter
```

Method MVP:

```text
discoverSessions()
```

Return value:

```text
NativeSession[]
```

---

# 8. Discovery Query

Discovery melakukan query read-only:

```sql
SELECT
  id,
  title,
  cwd,
  model_provider,
  model,
  reasoning_effort,
  rollout_path,
  source,
  thread_source,
  history_mode,
  project_id,
  archived,
  created_at,
  updated_at
FROM threads
ORDER BY updated_at DESC;
```

Tujuan sorting:

```text
most recently updated session first
```

---

# 9. SQLite Access Mode

Database dibuka menggunakan:

```text
better-sqlite3
```

Configuration:

```text
readonly: true
fileMustExist: true
```

CASR tidak melakukan write terhadap:

```text
state_5.sqlite
```

---

# 10. Normalization

Mapping utama:

```text
Codex                CASR
---------------------------------------
id                 → nativeSessionId
cwd                → workspacePath
rollout_path       → nativePath
model_provider     → provider
reasoning_effort   → reasoningEffort
thread_source      → threadSource
history_mode       → historyMode
project_id         → projectId
```

Value:

```text
archived INTEGER
```

dinormalisasi menjadi:

```text
boolean
```

Conversion:

```text
0 → false
non-zero → true
```

---

# 11. Nullable Fields

Berdasarkan schema nyata, beberapa field dapat bernilai NULL:

```text
model
reasoning_effort
thread_source
project_id
```

CASR mempertahankan kondisi tersebut sebagai:

```text
null
```

dan tidak menggantinya dengan empty string atau value buatan.

---

# 12. Real Environment Validation

Discovery divalidasi langsung terhadap local Codex database.

Result:

```text
Discovered: 76
```

Jumlah tersebut sama dengan hasil sebelumnya dari:

```text
casr doctor
```

yang juga mendeteksi:

```text
76 native Codex sessions
```

Dengan demikian jumlah row discovery konsisten dengan native table `threads`.

---

# 13. Real Session Validation

Session terbaru berhasil dinormalisasi menjadi:

```text
adapter          : codex
provider         : openai
model            : gpt-5.4-mini
reasoningEffort  : medium
source           : cli
threadSource     : user
historyMode      : paginated
projectId        : null
archived         : false
```

Native Session ID:

```text
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

Workspace:

```text
\\?\C:\Users\yefta\agent
```

Timestamp berhasil dikonversi menjadi ISO-8601.

---

# 14. Temporary Manual Discovery Check

Untuk menghindari quoting issue pada PowerShell, validation sementara dilakukan menggunakan temporary TypeScript file.

File tersebut menjalankan:

```text
CodexAdapter
        ↓
discoverSessions()
        ↓
console output
```

Result:

```text
Discovered: 76
```

Temporary validation file kemudian dihapus dan tidak dimasukkan ke repository.

---

# 15. Regression Test

Test baru:

```text
tests/codex-adapter.test.ts
```

Test menggunakan SQLite database sementara di Windows temp directory.

Test tidak menggunakan database Codex user sebagai fixture.

---

# 16. Fixture Strategy

Setiap test membuat temporary directory:

```text
casr-codex-test-*
```

dan temporary:

```text
state_5.sqlite
```

Table `threads` minimum dibuat khusus untuk test.

Setelah test:

```text
temporary directory
temporary SQLite database
```

dihapus otomatis.

---

# 17. Adapter Tests

Tiga behavior utama diuji.

## Discovery and Normalization

Memastikan native row dinormalisasi menjadi `NativeSession`.

---

## Nullable and Archived Fields

Memastikan:

```text
model            = null
reasoningEffort  = null
threadSource     = null
projectId        = null
```

tetap `null`.

Memastikan:

```text
archived = 1
```

menjadi:

```text
true
```

---

## Ordering

Memastikan:

```text
ORDER BY updated_at DESC
```

menghasilkan session terbaru pada index pertama.

---

# 18. Test Results

Final:

```text
Test Files  3 passed (3)
Tests       7 passed (7)
```

Breakdown:

```text
tests/cli.test.ts
1 test

tests/codex-environment.test.ts
3 tests

tests/codex-adapter.test.ts
3 tests
```

Total:

```text
7 tests
```

---

# 19. Formatting

Command:

```powershell
npm.cmd run format
```

Result:

```text
PASS
```

---

# 20. Lint

Command:

```powershell
npm.cmd run lint
```

Result:

```text
Checked 13 files.
No fixes applied.
```

Status:

```text
PASS
```

---

# 21. Build

Command:

```powershell
npm.cmd run build
```

Result:

```text
PASS
```

Tidak terdapat TypeScript compilation error.

---

# 22. Current Source Structure

Relevant structure setelah CP-STEP3:

```text
src/
├── adapters/
│   └── codex/
│       ├── codex-adapter.ts
│       ├── codex-environment.ts
│       └── codex-types.ts
│
├── core/
│   └── session/
│       └── native-session.ts
│
└── cli/
    ├── commands/
    │   └── doctor.ts
    ├── index.ts
    └── program.ts
```

Tests:

```text
tests/
├── cli.test.ts
├── codex-environment.test.ts
└── codex-adapter.test.ts
```

---

# 23. Architecture Boundary

Current architecture:

```text
CASR Core
   |
   | NativeSession
   |
   v
Agent-specific Adapter
   |
   v
CodexAdapter
   |
   v
state_5.sqlite
```

CASR core tidak melakukan SQL query terhadap Codex database.

Codex-specific SQL hanya terdapat di Codex adapter.

---

# 24. Security Boundary

Pada CP-STEP3 CASR membaca:

```text
state_5.sqlite
threads metadata
native session metadata
```

CASR belum membaca:

```text
auth.json
OAuth token
API keys
sandbox secrets
conversation rollout contents
reasoning contents
tool call contents
```

Tidak ada native Codex data yang dimodifikasi.

---

# 25. CP-STEP3 Acceptance Results

```text
[PASS] native schema verified
[PASS] timestamps verified
[PASS] NativeSession model created
[PASS] CodexThreadRow created
[PASS] CodexAdapter created
[PASS] discoverSessions implemented
[PASS] native SQLite accessed read-only
[PASS] timestamps normalized
[PASS] archived normalized
[PASS] nullable fields preserved
[PASS] native Windows paths preserved
[PASS] sessions ordered by updated_at DESC
[PASS] 76 real native sessions discovered
[PASS] discovery count matches doctor
[PASS] fixture-based adapter tests added
[PASS] 7/7 tests passed
[PASS] lint passed
[PASS] build passed
[PASS] no Codex-owned data modified
```

---

# 26. Result

**CP-STEP3 COMPLETE**

CASR sekarang dapat melakukan:

```text
Codex native storage
        ↓
session discovery
        ↓
normalization
        ↓
NativeSession[]
```

CASR belum memiliki persistence sendiri.

---

# 27. MVP Progress

Current progress:

```text
[COMPLETE] STEP 1
Bootstrap & Guardrails

[COMPLETE] STEP 2
Doctor & Codex Environment Detection

[COMPLETE] STEP 3
Codex Native Session Discovery

[NEXT] STEP 4
CASR Registry & Sync

[PENDING] STEP 5
Sessions & Inspect

[PENDING] STEP 6
Resume & MVP Validation
```

---

# 28. Next Checkpoint

Next:

```text
CP-STEP4
CASR Registry & Sync
```

Target:

```text
NativeSession[]
        ↓
CASR Registry
        ↓
~/.casr/casr.sqlite
```

Komponen berikutnya:

```text
CASR_HOME
database initialization
schema migrations
sessions table
native_sessions table
CASR Session ID
idempotent upsert
casr sync
```

Prinsip tetap:

```text
Codex storage = READ ONLY
CASR storage  = READ / WRITE
```
