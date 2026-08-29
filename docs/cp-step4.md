# CASR Development Checkpoint

## CP-STEP4 — CASR Registry & Sync

**Project:** Canonical Agent Session Runtime (CASR)
**Stage:** MVP V0.1
**Checkpoint:** Step 4 — CASR Registry & Sync
**Environment:** Windows PowerShell

---

## 1. Objective

Checkpoint ini bertujuan memberikan CASR persistence dan session identity miliknya sendiri.

Sebelum checkpoint ini, CASR hanya dapat:

```text
Codex Storage
     ↓
NativeSession[]
```

Setelah CP-STEP4:

```text
Codex Storage
     ↓
NativeSession[]
     ↓
CASR Registry
     ↓
casr.sqlite
```

CASR sekarang dapat:

* membuat database lokal sendiri;
* memberikan CASR Session ID;
* membuat binding antara CASR session dan native Codex session;
* melakukan import native sessions;
* memperbarui session yang berubah;
* mengenali session yang tidak berubah;
* melakukan sync secara idempotent.

---

# 2. Storage Ownership

Storage sekarang dipisahkan secara eksplisit.

```text
CODEX_HOME
READ ONLY

CASR_HOME
READ / WRITE
```

Codex tetap menjadi external native source.

CASR hanya menulis ke database miliknya sendiri.

---

# 3. CASR_HOME

Default:

```text
~/.casr
```

Windows:

```text
C:\Users\<user>\.casr
```

Environment override:

```text
CASR_HOME
```

Override digunakan selama development untuk membuat isolated temporary database.

Contoh:

```powershell
$env:CASR_HOME="$PWD\.tmp-casr-home"
```

---

# 4. CASR Database

Database utama:

```text
~/.casr/casr.sqlite
```

Database menggunakan SQLite melalui:

```text
better-sqlite3
```

Foreign key enforcement diaktifkan:

```text
PRAGMA foreign_keys = ON
```

---

# 5. Migration System

Migration pertama:

```text
migrations/0001_initial.sql
```

Migration metadata disimpan pada:

```text
schema_migrations
```

Initial migration:

```text
version = 1
name    = initial
```

Migration runner bersifat idempotent.

Menjalankan migration dua kali tidak membuat schema atau migration record baru.

Validation:

```text
Run #1
version 1 applied

Run #2
version 1 already exists
no duplicate
```

---

# 6. Initial CASR Schema

Tiga table tersedia:

```text
schema_migrations
sessions
native_sessions
```

---

# 7. Sessions Table

Table:

```text
sessions
```

Fields awal:

```text
id
title
workspace_path
status
created_at
updated_at
```

Table ini merepresentasikan logical CASR session.

---

# 8. Native Sessions Table

Table:

```text
native_sessions
```

Fields:

```text
id
session_id
adapter
native_session_id
native_path
provider
model
metadata_json
created_at
updated_at
```

Relationship:

```text
sessions
    |
    +-- native_sessions
```

Foreign key:

```text
native_sessions.session_id
    ↓
sessions.id
```

---

# 9. Native Identity Constraint

Native session identity menggunakan pasangan:

```text
adapter
+
native_session_id
```

Unique constraint:

```text
UNIQUE(adapter, native_session_id)
```

Hal ini mencegah native session yang sama di-import dua kali.

---

# 10. CASR Session Identity

CASR Session ID menggunakan:

```text
UUIDv7
```

dengan human-readable prefix:

```text
casr_
```

Contoh hasil nyata:

```text
casr_01a04c94-9650-7210-aece-4ca5907962c2
```

Native binding juga memiliki identity sendiri:

```text
binding_<UUIDv7>
```

---

# 11. Identity Separation

CASR ID tidak menggunakan native Codex ID.

Contoh nyata:

```text
CASR ID:
casr_01a04c94-9650-7210-aece-4ca5907962c2

Codex Native ID:
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

Prinsip:

```text
CASR SESSION ID != NATIVE SESSION ID
```

CASR sekarang memiliki logical identity sendiri.

---

# 12. Session Registry Repository

Repository:

```text
SessionRegistryRepository
```

Location:

```text
src/storage/repositories/session-registry-repository.ts
```

Responsibilities:

```text
create CASR session
create native binding
lookup native identity
detect existing binding
update changed metadata
detect unchanged session
```

Repository hanya berinteraksi dengan CASR-owned database.

Ia tidak membaca Codex database secara langsung.

---

# 13. Native Session Registration

Flow:

```text
NativeSession
     ↓
SessionRegistryRepository
     ↓
CASR Session
     +
Native Binding
```

Registration menghasilkan:

```text
1 sessions row
1 native_sessions row
```

Validation manual:

```text
sessions        = 1
native_sessions = 1
```

---

# 14. Native Session Metadata

Metadata yang tidak memiliki dedicated database column disimpan sementara sebagai:

```text
metadata_json
```

Current metadata:

```text
reasoningEffort
source
threadSource
historyMode
projectId
archived
```

Contoh:

```json
{
  "reasoningEffort": "medium",
  "source": "cli",
  "threadSource": "user",
  "historyMode": "paginated",
  "projectId": null,
  "archived": false
}
```

---

# 15. Registry Lookup

Repository dapat mencari CASR logical session berdasarkan:

```text
adapter
+
native_session_id
```

Flow:

```text
Codex Native ID
      ↓
native_sessions
      ↓
CASR Session ID
```

Manual validation:

```text
CASR ID == lookup result
```

berhasil.

---

# 16. Sync Service

Core sync logic:

```text
syncNativeSessions()
```

Input:

```text
NativeSession[]
```

Output:

```text
SyncSummary
```

Fields:

```text
discovered
imported
updated
unchanged
```

---

# 17. Sync Dispositions

Setiap native session mendapat salah satu disposition:

```text
imported
updated
unchanged
```

---

## Imported

Terjadi jika native identity belum ada.

```text
Native Session
      ↓
new CASR Session
```

---

## Updated

Terjadi jika native identity sudah ada tetapi metadata berubah.

CASR ID tetap dipertahankan.

---

## Unchanged

Terjadi jika native identity dan metadata sama dengan registry.

Tidak ada database mutation yang diperlukan.

---

# 18. Stable CASR Identity

Regression test memastikan CASR Session ID tidak berubah ketika native metadata diperbarui.

Flow:

```text
Native Session
CASR ID = X
      ↓
native metadata changes
      ↓
sync
      ↓
CASR ID = X
```

CASR logical identity tetap stabil.

---

# 19. Sync Command

CLI baru:

```text
casr sync
```

Development invocation:

```powershell
npm.cmd run dev -- sync
```

Option:

```text
--codex-home <path>
```

tersedia untuk override Codex home.

---

# 20. Sync Architecture

Flow akhir STEP 4:

```text
casr sync
     ↓
resolve CODEX_HOME
     ↓
CodexAdapter.discoverSessions()
     ↓
NativeSession[]
     ↓
open CASR database
     ↓
run migrations
     ↓
SessionRegistryRepository
     ↓
syncNativeSessions()
     ↓
casr.sqlite
```

---

# 21. First Real Sync

CASR_HOME temporary digunakan agar validation tidak langsung membuat production registry.

First sync:

```text
CASR Sync

Discovered : 76
Imported   : 76
Updated    : 0
Unchanged  : 0
```

Semua native Codex sessions berhasil di-import.

---

# 22. Second Real Sync

Command yang sama dijalankan kembali tanpa perubahan native source.

Result:

```text
CASR Sync

Discovered : 76
Imported   : 0
Updated    : 0
Unchanged  : 76
```

Ini membuktikan sync bersifat idempotent.

---

# 23. Idempotency

Property yang berhasil dibuktikan:

```text
sync(source)
sync(source)
sync(source)
```

tidak menghasilkan duplicate CASR sessions.

Setelah dua sync:

```text
sessions        = 76
native_sessions = 76
```

bukan:

```text
152
```

---

# 24. Real Database Validation

Query:

```sql
SELECT COUNT(*) FROM sessions;
```

Result:

```text
76
```

Query:

```sql
SELECT COUNT(*) FROM native_sessions;
```

Result:

```text
76
```

---

# 25. Identity Mapping Validation

Sample real mappings:

```text
casr_01a04c94-9650-7210-aece-4ca5907962c2
→
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

```text
casr_01a04c94-965e-72b4-bade-ff16ed051c00
→
01a04c11-a169-7db3-a1ff-887a0532173d
```

```text
casr_01a04c94-966b-7437-a23c-80bb45529dd6
→
019f75d8-57df-7360-9756-de5c6e2f6943
```

CASR identity dan native Codex identity terbukti independen.

---

# 26. Testing

Test suites setelah STEP 4:

```text
cli.test.ts
codex-environment.test.ts
codex-adapter.test.ts
session-registry.test.ts
sync-service.test.ts
```

Current result:

```text
Test Files  5 passed
Tests       13 passed
```

---

# 27. Registry Tests

Registry tests mencakup:

```text
UUIDv7 CASR ID
session creation
native binding creation
metadata JSON
native identity lookup
```

---

# 28. Sync Tests

Sync tests mencakup:

```text
initial import
repeated sync
idempotency
metadata update
stable CASR identity
```

---

# 29. Quality Validation

Final quality gate:

```text
Format : PASS
Lint   : PASS
Tests  : 13/13 PASS
Build  : PASS
```

---

# 30. Security Boundary

Codex storage tetap:

```text
READ ONLY
```

CASR membaca:

```text
state_5.sqlite
threads metadata
```

CASR tidak melakukan mutation terhadap Codex database.

CASR write hanya dilakukan ke:

```text
CASR_HOME
```

---

# 31. CP-STEP4 Acceptance Results

```text
[PASS] CASR_HOME resolver
[PASS] CASR_HOME environment override
[PASS] CASR SQLite initialization
[PASS] foreign keys enabled
[PASS] migration system
[PASS] migration idempotency
[PASS] sessions table
[PASS] native_sessions table
[PASS] UUIDv7 CASR identity
[PASS] native binding identity
[PASS] native identity lookup
[PASS] NativeSession registration
[PASS] metadata persistence
[PASS] stable CASR identity on update
[PASS] idempotent sync
[PASS] casr sync CLI
[PASS] 76 native sessions discovered
[PASS] 76 sessions imported
[PASS] second sync produced 76 unchanged
[PASS] no duplicate CASR sessions
[PASS] 13/13 tests passed
[PASS] lint passed
[PASS] build passed
[PASS] Codex storage remains read-only
```

---

# 32. Result

**CP-STEP4 COMPLETE**

CASR sekarang memiliki persistent local session registry.

Architecture:

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
                      |
                      | READ / WRITE
                      v
                casr.sqlite
```

CASR telah mulai memiliki session ownership sendiri pada tingkat logical identity.

---

# 33. MVP Progress

```text
[COMPLETE] STEP 1
Bootstrap & Guardrails

[COMPLETE] STEP 2
Doctor & Environment Detection

[COMPLETE] STEP 3
Native Session Discovery

[COMPLETE] STEP 4
CASR Registry & Sync

[NEXT] STEP 5
Sessions & Inspect

[PENDING] STEP 6
Resume & MVP Validation
```

---

# 34. Next Checkpoint

Next:

```text
CP-STEP5
Session Navigation CLI
```

Commands:

```text
casr sessions
casr inspect <casr-id>
```

Target:

```text
CASR Registry
     ↓
human-readable session navigation
```

STEP 5 belum melakukan native resume.

Resume tetap menjadi STEP 6.
