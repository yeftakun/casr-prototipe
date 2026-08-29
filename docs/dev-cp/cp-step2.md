# CASR Development Checkpoint

## CP-STEP2 — CASR Doctor & Codex Environment Detection

**Project:** Canonical Agent Session Runtime (CASR)
**Stage:** MVP V0.1
**Checkpoint:** Step 2 — Doctor & Codex Environment Detection
**Environment:** Windows PowerShell

---

## 1. Objective

Checkpoint ini bertujuan mengimplementasikan command pertama yang berinteraksi dengan environment Codex:

```text
casr doctor
```

Command ini digunakan untuk memeriksa apakah environment lokal siap digunakan oleh CASR.

Pada checkpoint ini CASR mulai membaca metadata dan storage Codex, tetapi seluruh akses terhadap `CODEX_HOME` tetap bersifat:

```text
READ ONLY
```

Tidak ada perubahan terhadap database, session JSONL, authentication file, atau file internal Codex lainnya.

---

# 2. Development Scope

CP-STEP2 dibagi menjadi tiga bagian.

```text
CP-STEP2A
Doctor command + Node/Codex detection

CP-STEP2B
CODEX_HOME + native storage inspection

CP-STEP2C
Regression tests
```

Fitur di luar scope seperti session import, CASR database, sync, dan resume belum diimplementasikan.

---

# 3. Doctor Command

Command baru:

```text
casr doctor
```

Development invocation:

```powershell
npm.cmd run dev -- doctor
```

Output pada environment saat checkpoint:

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

# 4. Node Runtime Detection

Doctor membaca runtime Node.js aktif melalui:

```text
process.version
```

Environment yang terdeteksi:

```text
Node.js v22.17.1
```

---

# 5. Codex CLI Detection

CASR memeriksa executable Codex menggunakan command:

```text
codex --version
```

Execution dilakukan melalui Node.js process spawning.

Hasil:

```text
codex-cli 0.150.1
```

Status:

```text
[PASS] Codex CLI available
```

---

# 6. Codex Adapter Boundary

Logic yang spesifik terhadap Codex ditempatkan di:

```text
src/adapters/codex/
```

File awal:

```text
src/adapters/codex/codex-environment.ts
```

CLI tidak membaca database Codex secara langsung.

Architecture boundary:

```text
CLI
 |
 v
Doctor Command
 |
 v
Codex Environment Adapter
 |
 v
Codex Native Storage
```

Prinsip ini menjaga CASR core agar tidak bergantung langsung pada implementasi internal Codex.

---

# 7. CODEX_HOME Resolution

CASR memiliki resolver untuk menentukan lokasi Codex.

Priority saat ini:

```text
1. --codex-home CLI option
2. CODEX_HOME environment variable
3. ~/.codex default
```

Default environment menghasilkan:

```text
C:\Users\yefta\.codex
```

dengan source:

```text
default
```

---

# 8. CLI Override Test

CASR mendukung override:

```powershell
npm.cmd run dev -- doctor --codex-home "$HOME\.codex"
```

Result:

```text
[OK] CODEX_HOME C:\Users\yefta\.codex (cli)
```

Hal ini membuktikan path Codex tidak di-hardcode.

---

# 9. Codex Storage Inspection

Doctor memeriksa:

```text
state_5.sqlite
sessions/
```

Pada environment pengembangan:

```text
state_5.sqlite : FOUND
sessions/      : FOUND
```

---

# 10. SQLite Read-Only Access

Database Codex dibuka menggunakan:

```text
better-sqlite3
```

dengan mode:

```text
readonly: true
fileMustExist: true
```

CASR tidak menjalankan:

```text
INSERT
UPDATE
DELETE
ALTER
DROP
```

terhadap database Codex.

---

# 11. Threads Table Detection

Doctor memeriksa keberadaan table:

```text
threads
```

melalui SQLite metadata.

Result:

```text
[OK] threads table
```

---

# 12. Native Session Count

Doctor menjalankan query read-only:

```sql
SELECT COUNT(*) AS count
FROM threads;
```

Jumlah native Codex session pada saat checkpoint:

```text
76
```

Output:

```text
[INFO] 76 native Codex sessions detected
```

Jumlah ini merupakan kondisi native Codex storage pada saat checkpoint dan dapat berubah seiring penggunaan Codex.

---

# 13. Current Codex Environment

Environment nyata yang berhasil dideteksi:

```text
Node.js        : v22.17.1
Codex CLI      : 0.150.1
CODEX_HOME     : C:\Users\yefta\.codex
State DB       : state_5.sqlite
Sessions Dir   : sessions/
Threads Table  : available
Native Threads : 76
```

---

# 14. New Source Structure

Struktur source setelah CP-STEP2:

```text
src/
├── adapters/
│   └── codex/
│       └── codex-environment.ts
└── cli/
    ├── commands/
    │   └── doctor.ts
    ├── index.ts
    └── program.ts
```

Responsibilities:

```text
codex-environment.ts
-> Codex path resolution
-> Codex storage inspection
-> SQLite read-only inspection

doctor.ts
-> orchestration doctor checks
-> terminal output

program.ts
-> register doctor command

index.ts
-> executable CLI entrypoint
```

---

# 15. Doctor Option

Doctor command sekarang memiliki option:

```text
--codex-home <path>
```

Tujuannya:

```text
override Codex home directory
```

Contoh:

```powershell
casr doctor --codex-home C:\custom\.codex
```

---

# 16. CODEX_HOME Resolver Tests

Test baru:

```text
tests/codex-environment.test.ts
```

Resolver diuji untuk tiga kondisi.

## CLI Has Highest Priority

Jika:

```text
CLI path exists
CODEX_HOME environment exists
```

maka resolver memilih:

```text
CLI
```

---

## Environment Variable

Jika CLI path tidak tersedia tetapi:

```text
CODEX_HOME
```

tersedia, resolver menggunakan environment variable.

---

## Default

Jika tidak ada override:

```text
~/.codex
```

digunakan.

---

# 17. Test Results

Final result:

```text
Test Files  2 passed (2)
Tests       4 passed (4)
```

Breakdown:

```text
tests/cli.test.ts
1 test

tests/codex-environment.test.ts
3 tests
```

Total:

```text
4 tests
```

---

# 18. Lint Validation

Biome result:

```text
Checked 9 files.
No fixes applied.
```

Status:

```text
PASS
```

Biome sempat menemukan dua import-order issues.

Perbaikan dilakukan menggunakan:

```powershell
npx biome check --write .
```

Setelah itu lint berhasil tanpa error.

---

# 19. Build Validation

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

# 20. Security Boundary

CASR telah membaca:

```text
CODEX_HOME path
state_5.sqlite
sessions directory metadata
threads table metadata
thread count
```

CASR belum membaca:

```text
auth.json contents
sandbox secrets
OAuth tokens
API keys
individual rollout content
conversation content
```

CASR juga tidak melakukan write ke:

```text
CODEX_HOME
```

---

# 21. Read-Only Guarantee for This Checkpoint

Seluruh akses SQLite menggunakan:

```text
readonly: true
```

Tidak ada SQL mutation.

Allowed:

```text
SELECT
```

Not allowed:

```text
INSERT
UPDATE
DELETE
ALTER
DROP
```

---

# 22. CP-STEP2 Acceptance Results

```text
[PASS] doctor command registered
[PASS] Node runtime detected
[PASS] Codex executable detected
[PASS] Codex version detected
[PASS] CODEX_HOME default resolved
[PASS] CLI CODEX_HOME override works
[PASS] state_5.sqlite detected
[PASS] sessions directory detected
[PASS] SQLite opened read-only
[PASS] threads table detected
[PASS] native thread count detected
[PASS] Codex-specific logic isolated in adapter
[PASS] resolver tests added
[PASS] 4/4 tests passed
[PASS] lint passed
[PASS] TypeScript build passed
[PASS] no Codex-owned data modified
```

---

# 23. Result

**CP-STEP2 COMPLETE**

CASR sekarang dapat memeriksa apakah local Codex environment tersedia dan kompatibel dengan kebutuhan dasar prototype.

Flow saat ini:

```text
casr
 |
 +-- --help
 |
 +-- doctor
       |
       +-- Node runtime
       +-- Codex CLI
       +-- CODEX_HOME
       +-- state_5.sqlite
       +-- sessions/
       +-- threads table
       +-- native thread count
```

---

# 24. What Has Not Been Implemented

Belum ada:

```text
session discovery model
NativeSession normalization
CASR session registry
casr.sqlite
casr sync
casr sessions
casr inspect
casr resume
rollout parsing
canonical events
```

Fitur tersebut tetap berada pada checkpoint berikutnya.

---

# 25. Next Checkpoint

Checkpoint berikutnya:

```text
CP-STEP3
Codex Native Session Discovery
```

Target utama:

```text
CodexAdapter.discoverSessions()
```

CASR akan membaca metadata thread dari:

```text
state_5.sqlite
```

dan menormalisasinya menjadi internal:

```text
NativeSession[]
```

Belum ada persistence ke `casr.sqlite`.

Prinsip tetap:

```text
CODEX_HOME = READ ONLY
```
