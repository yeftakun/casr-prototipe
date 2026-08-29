# CASR Development Checkpoint

## CP-STEP6 — Native Resume & MVP Validation

**Project:** Canonical Agent Session Runtime (CASR)  
**Stage:** MVP V0.1  
**Checkpoint:** Step 6 — Native Resume & MVP Validation  
**Environment:** Windows PowerShell  
**Codex CLI:** 0.150.1  
**Node.js:** v22.17.1

---

# 1. Objective

Checkpoint ini bertujuan menyelesaikan capability terakhir MVP V0.1:

```text
casr resume <casr-id>
```

Target utama:

```text
CASR Session ID
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
      ↓
Correct Codex Session
      +
Correct Original Workspace
```

STEP 6 juga menjadi final end-to-end validation untuk seluruh MVP V0.1.

---

# 2. Scope

STEP 6 mencakup:

```text
ResumeTarget
Codex native process launcher
casr resume command
CASR ID → native binding resolution
invalid session handling
working directory preservation
real native resume validation
final MVP quality gate
```

Tidak ada implementasi:

```text
canonical event store
context compiler
compaction
retrieval
second provider adapter
GUI
daemon
cloud sync
```

---

# 3. Resume Target Model

File:

```text
src/core/session/resume-target.ts
```

Resume target membawa tiga field:

```text
adapter
nativeSessionId
workspacePath
```

Tujuan:

```text
CASR SessionDetail
      ↓
ResumeTarget
```

CASR tidak langsung menjalankan Codex dari object database mentah.

---

# 4. Resume Target Resolution

Function:

```text
getResumeTarget()
```

mengambil:

```text
SessionDetail
```

dan menghasilkan:

```text
{
  adapter,
  nativeSessionId,
  workspacePath
}
```

Dengan demikian resume layer hanya menerima data minimum yang diperlukan.

---

# 5. Codex Process Launcher

File:

```text
src/adapters/codex/codex-process.ts
```

Function:

```text
resumeCodexSession()
```

menjalankan:

```text
codex resume <native-session-id>
```

menggunakan Node.js:

```text
spawnSync()
```

dengan:

```text
stdio: inherit
```

agar Codex TUI mengambil alih terminal secara langsung.

---

# 6. Database Lifecycle

CASR database tidak dibiarkan terbuka selama Codex TUI aktif.

Lifecycle:

```text
open CASR database
      ↓
resolve CASR session
      ↓
resolve native binding
      ↓
close CASR database
      ↓
launch Codex TUI
```

Hal ini mencegah SQLite connection menggantung selama native agent runtime berjalan.

---

# 7. Adapter Validation

Resume saat ini hanya mendukung:

```text
adapter = codex
```

Jika adapter berbeda:

```text
Resume is not supported for adapter: <adapter>
```

dan command menghasilkan non-zero exit code.

Provider lain tetap out of scope untuk MVP V0.1.

---

# 8. Invalid CASR Session Handling

Validation:

```powershell
npm.cmd run dev -- resume casr-does-not-exist
```

Result:

```text
Session not found: casr-does-not-exist
```

Exit code:

```text
1
```

Dengan demikian invalid CASR ID tidak dianggap sebagai successful resume.

---

# 9. Real CASR to Codex Mapping

CASR Session ID yang digunakan untuk validation:

```text
casr_01a04d48-c014-7469-9ed4-b36dcf9145ae
```

Native Codex Session ID:

```text
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

Mapping:

```text
casr_01a04d48-c014-7469-9ed4-b36dcf9145ae
        ↓
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

CASR logical session identity tetap independen dari native Codex identity.

---

# 10. Initial Resume Validation

Command:

```powershell
npm.cmd run dev -- resume $sessionId
```

CASR berhasil menjalankan:

```text
Resuming Codex session:
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

Native Codex TUI berhasil terbuka.

Conversation history yang benar berhasil dipulihkan.

---

# 11. Restored Session History

Session yang di-resume memuat history lama termasuk:

```text
LOCAL-CODEX-SESSION-TEST
```

dan marker lanjutan:

```text
ACCOUNT-B-CONTINUATION
```

Hal ini membuktikan native Codex session yang dibuka adalah session yang benar, bukan session baru.

---

# 12. Working Directory Bug Discovered

Pada resume validation pertama ditemukan issue penting.

CASR registry menyimpan workspace:

```text
\\?\C:\Users\yefta\agent
```

tetapi Codex TUI pertama kali terbuka di:

```text
~\casr-prototipe
```

Artinya:

```text
native session identity = correct
working directory       = incorrect
```

Root cause:

```text
Codex process inherited CASR CLI current working directory.
```

---

# 13. Working Directory Fix

Resume target kemudian diperluas dengan:

```text
workspacePath
```

dan `spawnSync()` diberi:

```text
cwd: original workspace
```

Final flow:

```text
CASR ID
   ↓
native ID
   +
workspacePath
   ↓
spawn Codex with cwd
```

---

# 14. Windows Extended-Length Path Handling

Codex metadata dapat menyimpan path Windows:

```text
\\?\C:\Users\yefta\agent
```

Sebelum diberikan ke child process, CASR melakukan process-only normalization:

```text
\\?\C:\Users\yefta\agent
        ↓
C:\Users\yefta\agent
```

Native metadata dalam registry tidak diubah.

Prinsip:

```text
persist native path losslessly
normalize only at process boundary when required
```

---

# 15. Resume Validation After Fix

Setelah fix:

```powershell
npm.cmd run dev -- resume $sessionId
```

Codex TUI menampilkan:

```text
directory: ~\agent
```

Bukan lagi:

```text
~\casr-prototipe
```

Dengan demikian original workspace berhasil dipulihkan.

---

# 16. Codex /status Validation

Di dalam resumed Codex session:

```text
/status
```

menampilkan:

```text
Directory:
~\agent

Thread name:
Catat LOCAL-CODEX-SESSION-TEST

Session:
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

Validation ini membuktikan:

```text
correct thread
correct native session
correct original workspace
```

---

# 17. Native Process Exit Status

Setelah keluar dari Codex TUI:

```powershell
$LASTEXITCODE
```

menghasilkan:

```text
0
```

Native resume process selesai normal.

---

# 18. CLI Command Registration

Command MVP final:

```text
doctor
sync
sessions
inspect
resume
```

Regression test memverifikasi seluruh command terdaftar.

---

# 19. Resume Regression Test

Test baru:

```text
tests/resume-target.test.ts
```

Behavior yang diuji:

```text
SessionDetail
    ↓
ResumeTarget
```

Expected target:

```text
adapter
nativeSessionId
workspacePath
```

---

# 20. Test Results

Final result:

```text
Test Files  7 passed (7)
Tests       19 passed (19)
```

Breakdown:

```text
cli.test.ts                  2
codex-environment.test.ts    3
codex-adapter.test.ts        3
session-registry.test.ts     4
sync-service.test.ts         2
session-query.test.ts        4
resume-target.test.ts        1
                             --
                             19
```

---

# 21. Final Doctor Validation

Command:

```powershell
npm.cmd run dev -- doctor
```

Result:

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

---

# 22. Final Sync Validation

Command:

```powershell
npm.cmd run dev -- sync
```

Result:

```text
CASR Sync

Discovered : 76
Imported   : 0
Updated    : 0
Unchanged  : 76
```

This validates sync idempotency after the full MVP implementation.

---

# 23. Final Sessions Validation

Command:

```powershell
npm.cmd run dev -- sessions
```

Result:

```text
CASR Sessions

Total: 76
```

Registry tetap konsisten setelah repeated sync.

---

# 24. Final Inspect Validation

Command:

```powershell
npm.cmd run dev -- inspect $sessionId
```

Result menunjukkan:

```text
CASR ID:
casr_01a04d48-c014-7469-9ed4-b36dcf9145ae

Native ID:
01a04c15-f919-7c52-9b6a-0fa9ff4d3394

Workspace:
\\?\C:\Users\yefta\agent

Provider:
openai

Model:
gpt-5.4-mini
```

Mapping tetap benar.

---

# 25. Final Quality Gate

Lint:

```text
PASS
```

Result:

```text
Checked 32 files.
No fixes applied.
```

Tests:

```text
PASS
19/19
```

Build:

```text
PASS
```

Tidak terdapat TypeScript compilation error.

---

# 26. End-to-End MVP Flow

Flow yang berhasil divalidasi:

```text
casr doctor
    ↓
casr sync
    ↓
casr sessions
    ↓
casr inspect <casr-id>
    ↓
casr resume <casr-id>
```

Result:

```text
correct environment
correct discovery
correct registry
correct CASR identity
correct native binding
correct session detail
correct native resume
correct original workspace
```

---

# 27. Storage Boundary

Codex:

```text
CODEX_HOME
READ ONLY
```

CASR:

```text
CASR_HOME
READ / WRITE
```

CASR tidak melakukan mutation terhadap:

```text
state_5.sqlite
session_index.jsonl
rollout JSONL
auth.json
sandbox secrets
```

Native resume dilakukan hanya melalui official Codex CLI command.

---

# 28. CP-STEP6 Acceptance Results

```text
[PASS] ResumeTarget model
[PASS] CASR ID → native binding resolution
[PASS] Codex native process launcher
[PASS] invalid CASR ID handling
[PASS] invalid CASR ID exit code = 1
[PASS] native Codex session opened
[PASS] correct conversation history restored
[PASS] correct thread restored
[PASS] working-directory issue discovered
[PASS] original workspace restoration fixed
[PASS] Windows extended path handled
[PASS] /status native Session ID correct
[PASS] /status workspace correct
[PASS] native process exit code = 0
[PASS] all MVP CLI commands registered
[PASS] final doctor validation
[PASS] final sync validation
[PASS] final sessions validation
[PASS] final inspect validation
[PASS] 19/19 tests passed
[PASS] lint passed
[PASS] build passed
[PASS] Codex storage remains read-only
```

---

# 29. Result

**CP-STEP6 COMPLETE**

---

# 30. MVP V0.1 Status

```text
[COMPLETE] STEP 1
Bootstrap & Guardrails

[COMPLETE] STEP 2
Doctor & Environment Detection

[COMPLETE] STEP 3
Native Session Discovery

[COMPLETE] STEP 4
CASR Registry & Sync

[COMPLETE] STEP 5
Sessions & Inspect

[COMPLETE] STEP 6
Native Resume & MVP Validation
```

Final status:

```text
MVP V0.1 COMPLETE
```

---

# 31. What MVP V0.1 Proves

CASR V0.1 successfully proves that a local logical session layer can:

```text
discover native Codex sessions
normalize native metadata
assign independent CASR session identities
persist local session registry
sync idempotently
list sessions
inspect sessions
resolve native bindings
resume the correct Codex session
restore the correct original workspace
```

without modifying Codex-owned storage.

---

# 32. Next Phase

Next planned version:

```text
V0.2
Canonical Event Import
Token Metrics
Execution History
```

V0.2 should not begin before MVP V0.1 is committed and reviewed.
