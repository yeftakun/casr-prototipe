# MVP Development Planning

## Project

**Canonical Agent Session Runtime (CASR)**

## Status

```text
Document Type : Development Scope Guard
Stage         : Prototype / MVP
Primary UI    : CLI
Primary Agent : Codex
Language      : TypeScript
Runtime       : Node.js
Database      : SQLite
```

---

# 1. Tujuan Dokumen

Dokumen ini bukan spesifikasi arsitektur lengkap.

Dokumen ini digunakan untuk menjaga pengembangan MVP tetap:

```text
kecil
terukur
dapat diuji
tidak overengineering
tidak terlalu cepat mengejar provider lain
tidak terlalu cepat membangun context engine penuh
```

Prinsip utama:

> **Build only what is required to prove the core concept.**

Jika suatu fitur tidak diperlukan untuk membuktikan MVP, fitur tersebut ditunda.

---

# 2. Tujuan MVP

MVP harus membuktikan satu hal utama:

> CASR dapat menjadi registry session lokal di atas Codex, memberikan identity sendiri, dan me-resume native Codex session tanpa menjadikan account sebagai owner session.

MVP belum perlu membuktikan:

```text
cross-provider continuation
full canonical context compiler
semantic retrieval
production-grade encryption
GUI
cloud sync
multi-device sync
```

---

# 3. Core User Flow

User flow MVP:

```text
install CASR
    |
    v
casr doctor
    |
    v
casr sync
    |
    v
casr sessions
    |
    v
casr inspect <session>
    |
    v
casr resume <session>
    |
    v
Codex TUI terbuka
```

Jika flow ini berjalan stabil, MVP dianggap berhasil.

---

# 4. MVP Commands

Hanya lima command wajib.

## 4.1 doctor

```text
casr doctor
```

Tujuan:

```text
cek Node.js
cek Codex CLI
cek CODEX_HOME
cek state_5.sqlite
cek sessions directory
cek tabel threads
```

Tidak menulis ke Codex storage.

---

## 4.2 sync

```text
casr sync
```

Tujuan:

```text
discover Codex sessions
normalize metadata
assign CASR session ID
upsert ke casr.sqlite
```

Sync harus idempotent.

---

## 4.3 sessions

```text
casr sessions
```

Tujuan:

```text
menampilkan daftar CASR sessions
```

Output minimum:

```text
CASR ID
Title
Agent
Workspace
Updated
```

---

## 4.4 inspect

```text
casr inspect <casr-id>
```

Tujuan:

```text
menampilkan metadata CASR session
menampilkan native Codex binding
```

---

## 4.5 resume

```text
casr resume <casr-id>
```

Tujuan:

```text
resolve CASR session
find native Codex session
execute codex resume <native-id>
```

CASR tidak mengambil alih TUI Codex.

---

# 5. MVP Data Model

Jangan membuat schema besar.

MVP cukup menggunakan:

```text
sessions
native_sessions
```

Tabel `executions` boleh ditambahkan jika benar-benar dibutuhkan selama implementasi, tetapi tidak wajib pada milestone pertama.

---

## 5.1 sessions

Minimum fields:

```text
id
title
workspace_path
created_at
updated_at
status
```

---

## 5.2 native_sessions

Minimum fields:

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

Unique constraint:

```text
adapter + native_session_id
```

---

# 6. MVP Architecture Boundary

Core flow:

```text
CLI
 |
 v
Session Service
 |
 v
Agent Adapter
 |
 v
Codex Adapter
 |
 v
Codex Local Storage
```

CASR Core tidak boleh membaca `state_5.sqlite` secara langsung.

Semua Codex-specific logic tetap berada di:

```text
src/adapters/codex/
```

---

# 7. Read-Only Rule

Selama MVP:

```text
CODEX_HOME = READ ONLY
```

CASR boleh:

```text
SELECT database
read JSONL
read metadata
run official Codex CLI commands
```

CASR tidak boleh:

```text
UPDATE Codex database
DELETE Codex records
modify rollout JSONL
modify session_index.jsonl
modify auth.json
```

CASR hanya menulis ke:

```text
CASR_HOME
```

---

# 8. Development Phases

## Phase 0 - Bootstrap

Target:

```text
project structure
TypeScript
Commander
SQLite
Vitest
Biome
basic CLI entrypoint
```

Acceptance:

```text
npm run build
npm test
npm run dev -- --help
```

berhasil.

Do not build:

```text
database schema besar
Codex parsing penuh
context engine
```

---

## Phase 1 - Doctor

Implement:

```text
casr doctor
```

Acceptance:

```text
Codex detected
Codex version displayed
CODEX_HOME resolved
state_5.sqlite detected
sessions directory detected
threads table detected
```

Jika ini belum stabil, jangan lanjut ke sync.

---

## Phase 2 - Codex Discovery

Implement:

```text
CodexAdapter.discoverSessions()
```

Data source utama:

```text
state_5.sqlite
```

Acceptance:

```text
jumlah native session ditemukan
session ID valid
title valid
cwd valid
rollout_path valid
```

Tidak perlu parsing seluruh rollout.

---

## Phase 3 - CASR Registry

Implement:

```text
casr.sqlite
sessions
native_sessions
migrations
repositories
```

Acceptance:

```text
native session dapat di-import
CASR ID dibuat
sync ulang tidak duplicate
```

---

## Phase 4 - Sync Command

Implement:

```text
casr sync
```

Acceptance:

```text
Imported
Updated
Unchanged
```

terlapor dengan benar.

---

## Phase 5 - Sessions Command

Implement:

```text
casr sessions
```

Acceptance:

```text
session tampil
CASR ID tampil
title tampil
workspace tampil
```

Filtering belum wajib.

---

## Phase 6 - Inspect Command

Implement:

```text
casr inspect <id>
```

Acceptance:

```text
CASR metadata tampil
native Codex session ID tampil
model tampil
rollout path tampil
```

---

## Phase 7 - Resume Command

Implement:

```text
casr resume <id>
```

Internal:

```text
codex resume <native-id>
```

Acceptance:

```text
Codex TUI terbuka
native session yang tepat di-resume
```

Jika Phase 7 berhasil:

```text
MVP V0.1 COMPLETE
```

---

# 9. Explicit Non-Goals for MVP

Fitur berikut **tidak boleh dikerjakan** sebelum MVP selesai.

```text
GUI
Electron
Tauri
web dashboard
cloud synchronization
multi-device sync
Claude adapter
OpenCode adapter
Antigravity adapter
vector database
embedding
semantic search
RAG
context compiler
automatic compaction
hierarchical compaction
cross-provider continuation
session encryption system
plugin marketplace
daemon
background service
remote API
account manager
credential manager
automatic Codex file mutation
```

Jika salah satu fitur tersebut muncul selama vibe coding:

```text
STOP
```

Masukkan ke backlog.

Jangan implementasikan.

---

# 10. Deferred Features

Setelah MVP:

## V0.2

```text
Canonical event import
Token metrics
Execution history
```

## V0.3

```text
Non-destructive snapshots
Basic compaction
```

## V0.4

```text
Context Compiler
```

## V0.5

```text
Retrieval
Relevant historical event selection
```

## V0.6

```text
Second agent adapter
```

## V0.7+

```text
Cross-provider logical session
```

---

# 11. Anti-Overengineering Rules

## Rule 1

Jika solusi dapat dilakukan dengan satu function, jangan langsung membuat framework.

---

## Rule 2

Jangan membuat abstraction untuk provider kedua sebelum provider kedua benar-benar dikerjakan.

Adapter interface boleh ada.

Generic provider framework belum perlu.

---

## Rule 3

Jangan membuat event sourcing system penuh sebelum rollout import dibutuhkan.

---

## Rule 4

Jangan menambahkan cache sebelum ada masalah performa terukur.

---

## Rule 5

Jangan menambahkan queue.

CLI MVP bersifat synchronous.

---

## Rule 6

Jangan menambahkan background daemon.

User menjalankan command secara eksplisit.

---

## Rule 7

Jangan menambahkan ORM.

Gunakan SQL sederhana.

---

## Rule 8

Jangan menambahkan dependency jika Node.js standard library sudah cukup.

---

## Rule 9

Jangan membuat config kompleks.

MVP:

```text
~/.casr/config.json
```

cukup.

---

## Rule 10

Jangan melakukan refactor besar selama milestone belum selesai kecuali ada bug struktural nyata.

---

# 12. Definition of Done per Feature

Setiap fitur dianggap selesai jika:

```text
works
has basic error handling
has minimal test
does not modify Codex storage
does not introduce unrelated feature
```

Tidak perlu:

```text
perfect abstraction
perfect UI
maximum performance
future-proof everything
```

---

# 13. Bug Priority

Urutan prioritas:

```text
P0 - Data corruption risk
P1 - Wrong session resumed
P2 - Sync duplicate
P3 - CLI command failure
P4 - Incorrect metadata display
P5 - Cosmetic output
```

P0 dan P1 harus diselesaikan sebelum fitur baru.

---

# 14. Backlog Rule

Jika selama coding muncul ide:

```text
"sekalian bikin..."
```

maka:

```text
jangan implementasikan
```

Masukkan ke:

```text
BACKLOG.md
```

Format:

```text
Feature:
Reason:
Why deferred:
Target phase:
```

---

# 15. Prototype Success Criteria

MVP berhasil jika pada komputer nyata:

```text
casr doctor
```

mendeteksi Codex.

Kemudian:

```text
casr sync
```

mengimpor session.

Kemudian:

```text
casr sessions
```

menampilkan session.

Kemudian:

```text
casr inspect <id>
```

menampilkan binding native.

Kemudian:

```text
casr resume <id>
```

membuka session Codex yang benar.

Tidak ada file Codex yang dimodifikasi oleh CASR.

---

# 16. What MVP Does Not Prove

MVP belum membuktikan:

```text
session portability ke provider lain
canonical history lebih baik dari vendor history
automatic context reconstruction
cross-model semantic continuity
production-grade security
scalability untuk jutaan session
```

MVP hanya membuktikan:

```text
CASR dapat menjadi local session registry
dan native resume orchestration layer
di atas Codex.
```

---

# 17. Coding Order

Urutan coding harus tetap:

```text
P0 Bootstrap
    |
P1 Doctor
    |
P2 Discovery
    |
P3 Registry
    |
P4 Sync
    |
P5 Sessions
    |
P6 Inspect
    |
P7 Resume
```

Jangan melompati fase karena fitur selanjutnya terlihat lebih menarik.

---

# 18. Checkpoint Rule

Setelah setiap phase:

```text
build
test
manual run
commit
```

Baru lanjut.

Contoh:

```text
feat: bootstrap CLI
feat: add doctor command
feat: add Codex discovery
feat: add session registry
feat: add sync command
feat: add sessions command
feat: add inspect command
feat: add native resume
```

---

# 19. MVP Estimated Complexity

Target kasar:

```text
CLI commands        : 5
Core tables         : 2
Primary adapter     : 1
Primary database    : 1
Provider support    : Codex only
UI                  : terminal only
Background process  : none
Cloud               : none
```

Jika implementasi MVP mulai membutuhkan:

```text
20+ tables
multiple processes
daemon
message queue
vector database
HTTP server
```

maka scope kemungkinan sudah melebar.

---

# 20. Final MVP Principle

Selama pengembangan V0.1, gunakan pertanyaan berikut sebelum menambahkan sesuatu:

> **Apakah fitur ini diperlukan agar `casr doctor -> sync -> sessions -> inspect -> resume` bekerja?**

Jika jawabannya:

```text
tidak
```

maka fitur tersebut bukan bagian dari MVP.

---

# 21. Next Step

Setelah dokumen ini disetujui:

```text
1. Bootstrap repository.
2. Implement Phase 0.
3. Jangan implementasikan fitur di luar Phase 0.
4. Setelah Phase 0 lolos acceptance criteria, lanjut Phase 1.
```

Dokumen ini menjadi scope guard selama vibe coding MVP.
