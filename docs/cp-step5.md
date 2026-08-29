# CASR Development Checkpoint

## CP-STEP5 — Session Navigation CLI

**Project:** Canonical Agent Session Runtime (CASR)
**Stage:** MVP V0.1
**Checkpoint:** Step 5 — Sessions & Inspect
**Environment:** Windows PowerShell

---

## 1. Objective

Checkpoint ini bertujuan membuat CASR registry dapat dinavigasi langsung melalui CLI.

Sebelum STEP 5:

```text
Codex
  ↓
NativeSession[]
  ↓
CASR Registry
  ↓
casr.sqlite
```

Setelah STEP 5:

```text
CASR Registry
    ↓
casr sessions
    ↓
CASR Session ID
    ↓
casr inspect <id>
```

User sekarang dapat menemukan dan memeriksa logical CASR session tanpa membaca SQLite secara manual.

---

# 2. Scope

Command baru:

```text
casr sessions
casr inspect <casr-id>
```

STEP 5 belum melakukan native resume.

Command:

```text
casr resume
```

tetap menjadi scope STEP 6.

---

# 3. Session View Models

File:

```text
src/core/session/session-view.ts
```

Dua representation diperkenalkan:

```text
SessionListItem
SessionDetail
```

`SessionListItem` digunakan untuk daftar session.

Fields:

```text
id
title
workspacePath
status
adapter
updatedAt
```

`SessionDetail` digunakan untuk inspection.

Fields utama:

```text
id
title
workspacePath
status
createdAt
updatedAt
nativeBinding
```

Native binding berisi:

```text
adapter
nativeSessionId
nativePath
provider
model
metadata
createdAt
updatedAt
```

---

# 4. Session Query Repository

Repository baru:

```text
src/storage/repositories/session-query-repository.ts
```

Class:

```text
SessionQueryRepository
```

Repository ini bersifat query-oriented dan tidak melakukan session mutation.

Responsibilities:

```text
listSessions()
getSessionById()
```

---

# 5. listSessions()

Method:

```text
listSessions()
```

menggabungkan:

```text
sessions
+
native_sessions
```

melalui:

```text
native_sessions.session_id
    ↓
sessions.id
```

Sorting:

```text
ORDER BY sessions.updated_at DESC
```

Dengan demikian session yang paling baru diperbarui muncul paling atas.

---

# 6. casr sessions

CLI command:

```text
casr sessions
```

Development invocation:

```powershell
npm.cmd run dev -- sessions
```

Command menampilkan:

```text
CASR ID
Agent
Title
Workspace
Status
Updated
```

---

# 7. Real Registry Validation

Registry temporary diisi melalui:

```powershell
npm.cmd run dev -- sync
```

Result:

```text
Discovered : 76
Imported   : 76
Updated    : 0
Unchanged  : 0
```

Kemudian:

```powershell
npm.cmd run dev -- sessions
```

menghasilkan:

```text
CASR Sessions

Total: 76
```

Semua 76 native Codex sessions dapat dinavigasi melalui CASR registry.

---

# 8. Session List Example

Contoh session pertama:

```text
casr_01a04cab-5aad-77de-bf7b-e802fa1e8f96
  Agent     : codex
  Title     : Ingat untuk session ini bahwa nama project uji kita adalah...
  Workspace : \\?\C:\Users\yefta\agent
  Status    : active
  Updated   : 2026-08-29T06:27:06.000Z
```

Title multiline dinormalisasi menjadi single-line pada list output.

Title panjang juga dipotong untuk menjaga output terminal tetap terbaca.

Data asli di registry tidak diubah.

---

# 9. casr inspect

Command:

```text
casr inspect <casr-id>
```

Development invocation:

```powershell
npm.cmd run dev -- inspect <casr-id>
```

Flow:

```text
CASR ID
   ↓
SessionQueryRepository
   ↓
sessions
   +
native_sessions
   ↓
SessionDetail
   ↓
terminal output
```

---

# 10. Real Inspection Validation

CASR Session ID nyata:

```text
casr_01a04cab-5aad-77de-bf7b-e802fa1e8f96
```

berhasil di-resolve ke native Codex session:

```text
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

---

# 11. Real Inspect Result

Output utama:

```text
CASR Session

ID        : casr_01a04cab-5aad-77de-bf7b-e802fa1e8f96
Workspace : \\?\C:\Users\yefta\agent
Status    : active
Created   : 2026-08-29T05:55:03.000Z
Updated   : 2026-08-29T06:27:06.000Z
```

Native binding:

```text
Agent     : codex
Native ID : 01a04c15-f919-7c52-9b6a-0fa9ff4d3394
Provider  : openai
Model     : gpt-5.4-mini
```

Native rollout path juga berhasil ditampilkan.

---

# 12. Metadata Inspection

Metadata native yang sebelumnya disimpan pada:

```text
metadata_json
```

sekarang ditampilkan sebagai structured JSON.

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

# 13. Invalid Session Handling

Command diuji dengan:

```powershell
npm.cmd run dev -- inspect casr-does-not-exist
```

Result:

```text
Session not found: casr-does-not-exist
```

CASR menetapkan:

```text
process.exitCode = 1
```

PowerShell validation:

```powershell
$LASTEXITCODE
```

Result:

```text
1
```

Dengan demikian invalid session tidak dianggap sebagai successful command.

---

# 14. Session Query Tests

Test file:

```text
tests/session-query.test.ts
```

Behavior yang diuji:

```text
list ordering
human-facing metadata
detail lookup
unknown ID handling
```

---

# 15. List Ordering Test

Dua session fixture dibuat:

```text
casr-old
casr-new
```

Expected order:

```text
casr-new
casr-old
```

berdasarkan:

```text
updated_at DESC
```

Test berhasil.

---

# 16. Detail Lookup Test

Repository berhasil menemukan:

```text
CASR ID
    ↓
Native Binding
```

dan memverifikasi:

```text
adapter
nativeSessionId
provider
model
```

---

# 17. Unknown ID Test

Query:

```text
getSessionById("casr-does-not-exist")
```

menghasilkan:

```text
null
```

CLI kemudian menerjemahkannya menjadi error yang jelas.

---

# 18. Test Results

Final STEP 5 result:

```text
Test Files  6 passed (6)
Tests       17 passed (17)
```

Breakdown:

```text
cli.test.ts                  1
codex-environment.test.ts    3
codex-adapter.test.ts        3
session-registry.test.ts     4
sync-service.test.ts         2
session-query.test.ts        4
                             --
                             17
```

---

# 19. Lint

Command:

```powershell
npm.cmd run lint
```

Result:

```text
Checked 28 files.
No fixes applied.
```

Status:

```text
PASS
```

---

# 20. Build

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

# 21. Architecture After STEP 5

Current architecture:

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
                    casr.sqlite
                          |
               +----------+----------+
               |                     |
               v                     v
        casr sessions          casr inspect
```

---

# 22. Data Ownership

Tidak ada perubahan pada boundary storage.

```text
CODEX_HOME = READ ONLY
CASR_HOME  = READ / WRITE
```

STEP 5 hanya membaca registry CASR setelah sync.

---

# 23. CP-STEP5 Acceptance Results

```text
[PASS] SessionListItem model
[PASS] SessionDetail model
[PASS] SessionQueryRepository
[PASS] listSessions()
[PASS] getSessionById()
[PASS] casr sessions command
[PASS] 76 real CASR sessions displayed
[PASS] latest session appears first
[PASS] CASR ID displayed
[PASS] agent displayed
[PASS] title displayed
[PASS] workspace displayed
[PASS] status displayed
[PASS] updated timestamp displayed
[PASS] casr inspect command
[PASS] real CASR session inspected
[PASS] native Codex ID displayed
[PASS] native path displayed
[PASS] provider displayed
[PASS] model displayed
[PASS] metadata displayed
[PASS] unknown CASR ID handled
[PASS] invalid inspect exit code = 1
[PASS] 17/17 tests passed
[PASS] lint passed
[PASS] build passed
```

---

# 24. Result

**CP-STEP5 COMPLETE**

CASR sekarang dapat digunakan untuk menemukan dan memeriksa logical session melalui CLI.

Current user flow:

```text
casr doctor
    ↓
casr sync
    ↓
casr sessions
    ↓
casr inspect <casr-id>
```

Satu capability utama MVP yang belum ada adalah native resume.

---

# 25. MVP Progress

```text
[COMPLETE] STEP 1
Bootstrap & Guardrails

[COMPLETE] STEP 2
Doctor & Environment Detection

[COMPLETE] STEP 3
Codex Native Session Discovery

[COMPLETE] STEP 4
CASR Registry & Sync

[COMPLETE] STEP 5
Sessions & Inspect

[NEXT] STEP 6
Resume & MVP Validation
```

---

# 26. Next Checkpoint

Next:

```text
CP-STEP6
Native Resume & MVP Validation
```

Target command:

```text
casr resume <casr-id>
```

Flow:

```text
CASR ID
   ↓
CASR Registry
   ↓
Native Binding
   ↓
Codex Native Session ID
   ↓
codex resume <native-id>
   ↓
Codex TUI
```

Setelah STEP 6 dan end-to-end validation berhasil:

```text
MVP V0.1 COMPLETE
```
