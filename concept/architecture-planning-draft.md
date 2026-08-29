# Architecture Planning Draft

## Project

**Canonical Agent Session Runtime (CASR)**

## Scope Dokumen

Dokumen ini berisi rencana arsitektur awal untuk prototipe CASR dengan fokus utama pada **CLI**.

Tahap awal bersifat:

```text
Codex-first
CLI-first
Local-first
Read-only terhadap storage Codex
Provider-agnostic pada level core
```

Target prototipe bukan langsung membangun context compiler penuh. Fokus awal adalah membuat CASR menjadi lapisan lokal yang mampu menemukan, mengindeks, memetakan, memeriksa, dan me-resume session Codex.

---

# 1. Tujuan Prototipe

Prototipe pertama harus membuktikan bahwa CASR dapat:

```text
1. Menemukan session Codex lokal.
2. Membaca metadata session secara aman.
3. Memberikan CASR Session ID sendiri.
4. Menyimpan registry session di database CASR.
5. Menampilkan daftar session lewat CLI.
6. Menampilkan detail session.
7. Me-resume native Codex session.
8. Memisahkan identity session dari account.
9. Menjadi fondasi untuk canonical event store.
10. Tidak bergantung langsung pada satu schema vendor di core.
```

Definisi sukses MVP:

```text
casr sync
casr sessions
casr inspect <session>
casr resume <session>
```

harus bekerja dengan session Codex lokal yang sudah ada.

---

# 2. Tech Stack Prototipe

Untuk tahap prototipe:

```text
Runtime       : Node.js
Language      : TypeScript
Database      : SQLite
CLI           : Commander atau CLI ringan internal
Validation    : Zod
Serialization : JSON / JSONL
Process       : Node.js child_process
Testing       : Vitest
Package       : npm
```

## Alasan TypeScript

Kebutuhan utama CASR saat ini adalah:

```text
filesystem access
JSONL parsing
SQLite
CLI
process execution
structured data
cross-platform development
```

TypeScript cukup kuat untuk seluruh kebutuhan tersebut dan memiliki barrier pengembangan lebih rendah dibanding Rust untuk prototipe awal.

Rust tetap dapat dipertimbangkan pada fase berikutnya jika CASR berkembang menjadi daemon atau runtime lokal berperforma tinggi.

---

# 3. Prinsip Arsitektur

## 3.1 Codex-first, bukan Codex-dependent

Implementasi pertama menggunakan Codex.

Namun core CASR tidak boleh mengetahui detail storage internal Codex.

Gunakan:

```text
Codex Native Storage
        |
        v
Codex Adapter
        |
        v
CASR Canonical Interface
```

Hindari:

```text
CASR Core
    |
    v
state_5.sqlite
```

Schema internal Codex dapat berubah.

---

## 3.2 Storage Codex read-only

Pada prototipe awal:

```text
Codex storage = READ ONLY
CASR storage  = READ / WRITE
```

CASR boleh:

```text
SELECT state_5.sqlite
read session_index.jsonl
read rollout JSONL
execute codex resume
```

CASR tidak boleh:

```text
UPDATE state_5.sqlite
DELETE state_5.sqlite
modify rollout JSONL
modify session_index.jsonl
modify auth.json
```

CASR harus memperlakukan seluruh storage Codex sebagai sumber eksternal.

---

## 3.3 Account bukan owner session

Session tidak memiliki foreign key wajib ke akun.

Gunakan:

```text
Session
    |
    +-- Execution A -> Account A
    |
    +-- Execution B -> Account B
```

Bukan:

```text
Session -> Account Owner
```

Prinsip:

```text
ACCOUNT_IDENTITY != SESSION_IDENTITY
```

---

## 3.4 CASR ID berbeda dari native ID

CASR harus memiliki identity sendiri.

Contoh:

```text
CASR Session ID:
casr_01KXYZ...

Native Codex Session ID:
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

Jangan menggunakan native Codex ID sebagai primary identity CASR.

---

# 4. Arsitektur Tingkat Tinggi

```text
                     CASR CLI
                        |
                        v
                 +--------------+
                 |  CASR CORE   |
                 +--------------+
                        |
        +---------------+---------------+
        |               |               |
        v               v               v
 Session Registry   Storage Layer   Execution Layer
        |                               |
        |                               v
        |                         Agent Adapter
        |                               |
        +-------------------------------+
                                        |
                                        v
                                  Codex Adapter
                                        |
                    +-------------------+-------------------+
                    |                   |                   |
                    v                   v                   v
             state_5.sqlite     session_index.jsonl   rollout JSONL
```

Pada fase berikutnya:

```text
CASR CORE
   |
   +-- Context Compiler
   +-- Retriever
   +-- Compaction Engine
   +-- Canonical Event Store
```

Tetapi komponen tersebut belum menjadi requirement MVP pertama.

---

# 5. Komponen Inti

## 5.1 CLI Layer

CLI merupakan interface utama prototipe.

Command awal:

```text
casr doctor
casr sync
casr sessions
casr inspect <session-id>
casr resume <session-id>
```

CLI hanya bertugas:

```text
parse input
call service
render output
return exit code
```

Business logic tidak diletakkan di layer CLI.

---

## 5.2 Session Registry

Session Registry menangani logical session identity.

Contoh:

```text
CASR Session
|
+-- id
+-- title
+-- workspace
+-- created_at
+-- updated_at
+-- status
```

Session Registry tidak mengetahui bagaimana Codex membaca database native.

---

## 5.3 Native Session Binding

Native session menyimpan hubungan antara CASR dan agent runtime.

Contoh:

```text
CASR Session
    |
    +-- Native Session
            |
            +-- adapter = codex
            +-- native_session_id
            +-- native_path
            +-- provider
            +-- model
```

Pada masa depan:

```text
CASR Session
|
+-- Codex Native Session
+-- Claude Native Session
+-- OpenCode Native Session
```

---

## 5.4 Agent Adapter Layer

Interface konseptual:

```ts
interface AgentAdapter {
  readonly id: string;

  discoverSessions(): Promise<NativeSession[]>;

  getSession(
    nativeSessionId: string
  ): Promise<NativeSession | null>;

  readEvents(
    nativeSessionId: string
  ): Promise<CanonicalEvent[]>;

  resume(
    nativeSessionId: string
  ): Promise<void>;

  getCapabilities(): AgentCapabilities;
}
```

Implementasi pertama:

```text
CodexAdapter
```

Future:

```text
ClaudeCodeAdapter
OpenCodeAdapter
AntigravityAdapter
```

---

# 6. Codex Adapter

Struktur awal:

```text
src/adapters/codex/
|
+-- codex.adapter.ts
+-- codex.discovery.ts
+-- codex.state-db.ts
+-- codex.session-index.ts
+-- codex.rollout.ts
+-- codex.process.ts
+-- codex.types.ts
```

## 6.1 Discovery

Sumber utama:

```text
~/.codex/state_5.sqlite
```

Query awal:

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
FROM threads;
```

Hasil query dinormalisasi menjadi `NativeSession`.

---

## 6.2 Session Index

File:

```text
~/.codex/session_index.jsonl
```

Digunakan sebagai metadata tambahan.

Observed fields:

```text
id
thread_name
updated_at
```

Index tidak dianggap sebagai source of truth tunggal.

---

## 6.3 Rollout Reader

File:

```text
~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
```

Untuk prototipe awal rollout hanya perlu:

```text
validate file exists
read session metadata
read event types
read token metrics jika diperlukan
```

Full canonical event import masuk fase berikutnya.

---

## 6.4 Resume

CASR tidak melakukan reconstruction pada MVP.

Gunakan native command:

```text
codex resume <native-session-id>
```

Implementasi:

```ts
spawn("codex", ["resume", nativeSessionId], {
  stdio: "inherit"
});
```

Dengan pendekatan ini, seluruh TUI tetap ditangani Codex.

---

# 7. Struktur Project

```text
casr/
|
+-- src/
|   |
|   +-- cli/
|   |   +-- index.ts
|   |   +-- commands/
|   |       +-- doctor.ts
|   |       +-- sync.ts
|   |       +-- sessions.ts
|   |       +-- inspect.ts
|   |       +-- resume.ts
|   |
|   +-- core/
|   |   +-- session/
|   |   |   +-- session.types.ts
|   |   |   +-- session.service.ts
|   |   |
|   |   +-- execution/
|   |   |   +-- execution.types.ts
|   |   |
|   |   +-- events/
|   |       +-- event.types.ts
|   |
|   +-- adapters/
|   |   +-- codex/
|   |       +-- codex.adapter.ts
|   |       +-- codex.discovery.ts
|   |       +-- codex.state-db.ts
|   |       +-- codex.session-index.ts
|   |       +-- codex.rollout.ts
|   |       +-- codex.process.ts
|   |       +-- codex.types.ts
|   |
|   +-- storage/
|   |   +-- database.ts
|   |   +-- migrations.ts
|   |   +-- repositories/
|   |       +-- session.repository.ts
|   |       +-- native-session.repository.ts
|   |       +-- execution.repository.ts
|   |
|   +-- config/
|   |
|   +-- utils/
|
+-- data/
|   +-- casr.sqlite
|
+-- migrations/
|
+-- tests/
|
+-- docs/
|   +-- CONCEPT.md
|   +-- architecture-planning-draft.md
|
+-- package.json
+-- tsconfig.json
+-- README.md
```

---

# 8. Data Model V0.1

Untuk MVP cukup tiga tabel utama.

---

## 8.1 sessions

```text
sessions
--------
id
title
workspace_path
created_at
updated_at
status
```

Contoh:

```text
id:
casr_01K...

title:
Catat LOCAL-CODEX-SESSION-TEST

workspace:
C:\Users\yefta\agent
```

---

## 8.2 native_sessions

```text
native_sessions
---------------
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

Relasi:

```text
sessions.id
    |
    +-- native_sessions.session_id
```

---

## 8.3 executions

```text
executions
----------
id
session_id
native_session_id
provider
account_label
model
reasoning_effort
context_window
started_at
completed_at
```

Account berada pada execution.

Bukan pada session.

---

# 9. Session ID Strategy

Gunakan ID sortable.

Pilihan:

```text
UUIDv7
```

atau:

```text
ULID
```

Format display dapat diberi prefix:

```text
casr_01K...
```

Native session ID tetap disimpan terpisah.

---

# 10. CLI Commands

## 10.1 casr doctor

Tujuan:

memeriksa environment.

Contoh output:

```text
CASR Doctor

[OK] Node.js
[OK] Codex CLI
     Version: 0.150.1

[OK] Codex home
     C:\Users\yefta\.codex

[OK] state_5.sqlite
[OK] session_index.jsonl
[OK] sessions directory

[INFO]
Detected 20 Codex sessions
```

Doctor tidak melakukan perubahan.

---

## 10.2 casr sync

Flow:

```text
casr sync
    |
    v
CodexAdapter.discoverSessions()
    |
    v
read state_5.sqlite
    |
    v
normalize NativeSession[]
    |
    v
CASR Matcher
    |
    +-- existing -> update
    |
    +-- new -> insert
    |
    v
casr.sqlite
```

Contoh output:

```text
Discovered : 20
Imported   : 18
Updated    : 2
Unchanged  : 0
```

---

## 10.3 casr sessions

Menampilkan registry.

Contoh:

```text
CASR ID        AGENT   TITLE                         WORKSPACE
casr_01K...    codex   LOCAL-CODEX-SESSION-TEST      C:\Users\yefta\agent
casr_01J...    codex   Analisis kode PrintOrder      D:\PrintOrder
```

Filter dapat ditambahkan kemudian:

```text
--agent
--workspace
--archived
--search
```

---

## 10.4 casr inspect

Contoh:

```text
CASR Session
============

ID:
casr_01K...

Title:
Catat LOCAL-CODEX-SESSION-TEST

Workspace:
C:\Users\yefta\agent

Native Session
--------------
Agent:
codex

Native ID:
01a04c15-f919-7c52-9b6a-0fa9ff4d3394

Provider:
openai

Model:
gpt-5.4-mini

Native Path:
C:\Users\yefta\.codex\sessions\...
```

---

## 10.5 casr resume

Command:

```text
casr resume casr_01K...
```

Flow:

```text
CASR ID
   |
   v
Session Registry
   |
   v
Native Session
   |
   v
CodexAdapter.resume()
   |
   v
codex resume <native-id>
```

TUI Codex mengambil alih terminal setelah itu.

---

# 11. Doctor Capability Detection

CASR tidak boleh mengasumsikan semua instalasi Codex identik.

Doctor harus mendeteksi:

```text
Codex installed?
Codex version?
Codex home?
state database?
session index?
sessions directory?
schema supported?
```

Jika schema berubah:

```text
[WARN]
Codex schema version not recognized.

Session discovery may be limited.
```

Jangan langsung gagal total jika satu sumber metadata hilang.

---

# 12. Capability Model

Adapter perlu mendeklarasikan kemampuan.

Contoh:

```ts
interface AgentCapabilities {
  discoverSessions: boolean;
  nativeResume: boolean;
  readTranscript: boolean;
  tokenMetrics: boolean;
  workspaceMetadata: boolean;
  accountIndependentResume?: boolean;
}
```

Codex:

```text
discoverSessions          = true
nativeResume              = true
readTranscript            = true
tokenMetrics              = true
workspaceMetadata         = true
accountIndependentResume  = experimental
```

Nilai `experimental` penting karena cross-account resume saat ini merupakan observed behavior, bukan kontrak publik permanen.

---

# 13. Sync Strategy

Sync harus idempotent.

Menjalankan:

```text
casr sync
```

berulang kali tidak boleh menghasilkan duplicate CASR session.

Native identity dapat menggunakan pasangan:

```text
adapter + native_session_id
```

sebagai unique key.

Contoh:

```text
codex:
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

---

# 14. Matching Strategy

Pada MVP:

```text
1 native Codex session
=
1 CASR session
```

Ini paling sederhana.

Pada fase cross-provider:

```text
1 CASR session
=
N native sessions
```

Contoh:

```text
CASR Session X
|
+-- Codex native session
|
+-- Claude native session
```

Jangan membangun matching cross-provider dulu.

---

# 15. Error Handling

CLI harus memiliki error message yang eksplisit.

Contoh:

```text
CASR_ERR_CODEX_NOT_FOUND
CASR_ERR_CODEX_HOME_NOT_FOUND
CASR_ERR_STATE_DB_NOT_FOUND
CASR_ERR_UNSUPPORTED_SCHEMA
CASR_ERR_NATIVE_SESSION_NOT_FOUND
CASR_ERR_RESUME_FAILED
CASR_ERR_DATABASE
```

Human-readable output:

```text
Error:
Native Codex session was found in CASR registry,
but Codex could not resume it.

Native Session:
01a04c15-...

Run:

casr doctor
```

---

# 16. Logging

Prototipe cukup menggunakan local log.

Contoh:

```text
data/logs/casr.log
```

Level:

```text
ERROR
WARN
INFO
DEBUG
```

Credential atau token tidak boleh ditulis ke log.

---

# 17. Security

CASR tidak membaca atau menyalin credential jika tidak diperlukan.

Exclude:

```text
auth.json
OAuth token
API key
cookie
password
.sandbox-secrets
```

Pada MVP, account dapat diberi label manual atau dideteksi hanya melalui command resmi Codex jika tersedia.

CASR tidak boleh menyimpan credential provider.

---

# 18. Backup

Backup native Codex tidak menjadi fitur MVP utama.

Namun CASR dapat menyediakan di fase berikutnya:

```text
casr backup <session>
```

Backup harus:

```text
exclude credentials
include rollout
include CASR metadata
include checksums
```

---

# 19. Testing Strategy

## Unit Test

```text
Codex row -> NativeSession normalization
JSONL parsing
repository upsert
ID generation
command validation
```

## Integration Test

Gunakan fixture:

```text
tests/fixtures/codex/
|
+-- state_5.sqlite
+-- session_index.jsonl
+-- rollout.jsonl
```

Jangan mengandalkan real `~/.codex` pada setiap automated test.

## Manual Test

```text
casr doctor
casr sync
casr sessions
casr inspect
casr resume
```

---

# 20. MVP Development Order

## P0 - Bootstrap

```text
Node.js
TypeScript
package.json
tsconfig
Vitest
SQLite
CLI entrypoint
```

---

## P1 - Doctor

Implement:

```text
casr doctor
```

Target:

```text
detect Codex
detect ~/.codex
detect state DB
detect sessions
```

---

## P2 - Codex Discovery

Implement:

```text
CodexAdapter.discoverSessions()
```

Source utama:

```text
state_5.sqlite
```

---

## P3 - CASR Database

Implement:

```text
sessions
native_sessions
executions
```

dan migrations.

---

## P4 - Sync

Implement:

```text
casr sync
```

Native Codex session masuk CASR registry.

---

## P5 - Sessions

Implement:

```text
casr sessions
```

---

## P6 - Inspect

Implement:

```text
casr inspect <id>
```

---

## P7 - Resume

Implement:

```text
casr resume <id>
```

Internal:

```text
codex resume <native-id>
```

---

# 21. MVP Completion Criteria

MVP dianggap selesai ketika:

```text
1. casr doctor berhasil mendeteksi Codex.
2. casr sync menemukan session lokal.
3. Setiap native session mendapat CASR ID.
4. Sync ulang tidak menciptakan duplicate.
5. casr sessions menampilkan registry.
6. casr inspect menampilkan metadata session.
7. casr resume membuka native Codex session.
8. CASR tidak mengubah file internal Codex.
```

---

# 22. Phase Setelah MVP

## Phase 2 - Canonical Event Import

Tambahkan:

```text
events
```

Rollout Codex dinormalisasi.

Canonical event type awal:

```text
user_message
assistant_message
developer_message
reasoning
tool_call
tool_result
task_started
task_completed
token_usage
unknown
```

Unknown event tetap disimpan.

---

## Phase 3 - Token Metrics

Tambahkan:

```text
token_metrics
```

Track:

```text
input_tokens
cached_input_tokens
output_tokens
total_tokens
context_window
model
execution
```

---

## Phase 4 - Execution Tracking

Track:

```text
account
provider
model
reasoning
context window
start
end
```

Session tetap independent dari account.

---

## Phase 5 - Snapshot Engine

Implement non-destructive compaction.

Raw event tidak dihapus.

---

## Phase 6 - Context Compiler

Input:

```text
Canonical Session
Current Task
Target Model
Target Context Window
Workspace State
```

Output:

```text
Context Build
```

---

## Phase 7 - Retrieval

Tambahkan:

```text
semantic relevance
recency
workspace relevance
dependency relevance
artifact relevance
```

---

## Phase 8 - Second Adapter

Kandidat:

```text
Claude Code
OpenCode
```

Baru setelah canonical event model stabil.

---

# 23. Arsitektur Target Jangka Menengah

```text
                          CASR CLI
                             |
                             v
                       +-----------+
                       | CASR CORE |
                       +-----------+
                             |
       +---------------------+----------------------+
       |                     |                      |
       v                     v                      v
Session Registry      Canonical Store        Context Engine
       |                     |                      |
       |                     |            +---------+---------+
       |                     |            |                   |
       |                     |            v                   v
       |                     |         Retriever          Compactor
       |                     |            |                   |
       +---------------------+------------+-------------------+
                             |
                             v
                      Execution Engine
                             |
                             v
                       Adapter Layer
                             |
               +-------------+-------------+
               |             |             |
               v             v             v
             Codex         Claude        OpenCode
```

---

# 24. Prinsip Implementasi

Selama prototipe:

```text
Keep core small.
Keep adapters isolated.
Keep Codex storage read-only.
Keep CLI simple.
Keep schema migratable.
Keep unknown data instead of discarding it.
Do not implement cross-provider too early.
Do not implement compaction before canonical storage exists.
```

Urutan pengembangan penting.

Registry dan native resume harus stabil sebelum CASR mengambil alih context management.

---

# 25. Keputusan Sementara

Keputusan arsitektur prototipe saat ini:

```text
Interface     : CLI
Language      : TypeScript
Runtime       : Node.js
Database      : SQLite
Primary Agent : Codex
Codex Access  : Read-only
Native Resume : codex resume <session-id>
CASR ID       : UUIDv7 / ULID
Core Design   : Provider-agnostic
GUI           : Out of scope
Rust          : Out of scope untuk prototipe
```

Dokumen ini masih bersifat draft.

Perubahan diperbolehkan setelah:

```text
P1 Doctor
P2 Codex Discovery
P3 Registry
```

selesai dan memberikan data implementasi nyata.

---

# 26. Next Technical Decision

Keputusan teknis berikutnya yang perlu ditetapkan sebelum coding:

```text
1. Library SQLite yang digunakan.
2. Library CLI yang digunakan.
3. UUIDv7 atau ULID.
4. Migration strategy.
5. Exact schema V0.1.
6. Config location CASR.
7. Cara mendeteksi CODEX_HOME.
8. Packaging CLI di Windows.
```

Setelah keputusan tersebut ditetapkan, project bootstrap dapat dimulai.


---

# 27. Final Technical Decisions for Prototype V0.1

Bagian ini menetapkan keputusan teknis yang digunakan untuk bootstrap prototipe CLI.

## 27.1 Node.js

Minimum runtime:

```text
Node.js >= 22.12
```

Alasan:

- kompatibel dengan Commander v15;
- ESM modern;
- cukup stabil untuk prototipe CLI;
- tidak memaksa penggunaan Node versi Current.

Untuk development, gunakan Node LTS yang memenuhi batas minimum tersebut.

---

## 27.2 Module System

Gunakan:

```text
ESM
```

`package.json`:

```json
{
  "type": "module"
}
```

Jangan memulai project baru dengan CommonJS.

---

## 27.3 CLI Library

Gunakan:

```text
commander
```

Keputusan:

```text
Commander v15+
```

Alasan:

- matang;
- TypeScript-friendly;
- command/subcommand jelas;
- help dan argument validation sudah tersedia;
- sesuai untuk CLI kecil yang akan bertambah secara bertahap.

CLI dibuat sebagai satu process dengan command handlers internal.

Jangan memakai executable subcommand terpisah pada MVP.

---

## 27.4 SQLite Library

Gunakan:

```text
better-sqlite3
```

Alasan:

- API sinkron cocok untuk lifecycle CLI;
- transaction support sederhana;
- stabil dan matang;
- query CASR bersifat lokal dan relatif kecil;
- lebih sedikit kompleksitas dibanding async database layer.

Keputusan ini berlaku untuk prototipe.

`node:sqlite` dapat dievaluasi kembali ketika packaging standalone menjadi prioritas.

CASR database:

```text
~/.casr/casr.sqlite
```

Database Codex tetap dibuka read-only.

---

## 27.5 Validation

Gunakan:

```text
zod
```

Untuk:

```text
config validation
adapter output validation
JSONL event validation
external/native metadata validation
```

Data vendor tidak boleh langsung dipercaya oleh core.

---

## 27.6 Identifier

Gunakan:

```text
UUIDv7
```

Library:

```text
uuid
```

Contoh internal:

```text
019c....
```

Untuk human-facing output:

```text
casr_<uuid-v7>
```

Database menyimpan UUID asli tanpa wajib menyimpan prefix.

Prinsip:

```text
CASR ID != Native Agent Session ID
```

---

## 27.7 Migration Strategy

Tidak memakai ORM pada MVP.

Gunakan plain SQL migration:

```text
migrations/
|
+-- 0001_initial.sql
+-- 0002_*.sql
```

CASR database memiliki:

```text
schema_migrations
```

Contoh:

```sql
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
);
```

Migration dijalankan otomatis sebelum command yang membutuhkan database.

Keuntungan:

- schema transparan;
- mudah diperiksa;
- tidak mengunci project ke ORM tertentu;
- debugging SQLite lebih sederhana.

---

## 27.8 CASR Home

Environment override:

```text
CASR_HOME
```

Default prototipe:

```text
~/.casr
```

Windows:

```text
C:\Users\<USER>\.casr
```

Struktur:

```text
~/.casr/
|
+-- casr.sqlite
+-- config.json
+-- logs/
+-- backups/
+-- cache/
```

Alasan memilih `~/.casr` pada prototipe:

- sederhana;
- mudah ditemukan;
- konsisten dengan pola local-first;
- tidak membutuhkan dependency path resolver tambahan.

Platform-native/XDG paths dapat dievaluasi setelah MVP.

---

## 27.9 CODEX_HOME Detection

Urutan resolusi:

```text
1. CLI option --codex-home
2. CASR config codexHome
3. environment CODEX_HOME
4. default ~/.codex
```

Pseudo-code:

```ts
function resolveCodexHome(options, config) {
  return (
    options.codexHome ??
    config.codexHome ??
    process.env.CODEX_HOME ??
    path.join(os.homedir(), ".codex")
  );
}
```

CASR harus memverifikasi hasil tersebut dengan mencari minimal:

```text
state_5.sqlite
sessions/
```

`session_index.jsonl` dianggap optional metadata source.

---

## 27.10 CASR Config

File:

```text
~/.casr/config.json
```

Initial shape:

```json
{
  "codexHome": null,
  "logLevel": "info"
}
```

Gunakan JSON terlebih dahulu.

TOML/YAML tidak diperlukan pada prototipe.

Validation dilakukan dengan Zod.

---

## 27.11 Development Runner

Gunakan:

```text
tsx
```

Development:

```bash
npm run dev -- doctor
```

Build production:

```text
TypeScript
   |
   v
dist/
   |
   v
Node.js
```

`tsx` hanya development dependency.

---

## 27.12 Build Strategy

Gunakan:

```text
tsc
```

sebagai baseline build.

Output:

```text
dist/
```

Prototype tidak perlu bundler.

Bundling hanya dipertimbangkan jika:

```text
standalone executable
distribution size
startup performance
```

menjadi requirement.

---

## 27.13 Packaging V0.1

MVP didistribusikan sebagai npm CLI.

`package.json`:

```json
{
  "bin": {
    "casr": "./dist/cli/index.js"
  }
}
```

Local development:

```bash
npm link
```

Setelah itu:

```bash
casr doctor
casr sync
```

Standalone `.exe` bukan requirement V0.1.

Node Single Executable Application dapat dievaluasi pada fase distribusi.

---

## 27.14 Testing

Gunakan:

```text
Vitest
```

Test categories:

```text
unit
integration
fixture-based adapter tests
manual native resume tests
```

Real user Codex storage tidak digunakan sebagai fixture committed ke repository.

---

## 27.15 Formatter and Linter

Untuk prototipe gunakan:

```text
Biome
```

Tujuan:

```text
format
lint
```

Satu tool mengurangi konfigurasi dibanding ESLint + Prettier.

---

# 28. Prototype Dependency Set

Runtime dependencies:

```text
commander
better-sqlite3
zod
uuid
```

Development dependencies:

```text
typescript
tsx
vitest
@types/node
@types/better-sqlite3
@biomejs/biome
```

Prinsip:

```text
Keep dependencies small.
```

Jangan menambahkan framework dependency sebelum kebutuhan nyata muncul.

---

# 29. Initial package.json Direction

Target awal:

```json
{
  "name": "casr",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "casr": "./dist/cli/index.js"
  },
  "engines": {
    "node": ">=22.12.0"
  }
}
```

Script awal:

```json
{
  "scripts": {
    "dev": "tsx src/cli/index.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check .",
    "format": "biome format --write ."
  }
}
```

---

# 30. First Implementation Milestone

Milestone pertama setelah bootstrap:

```text
casr doctor
```

Tidak ada database write dari Codex adapter pada milestone ini.

Doctor harus:

```text
1. mendeteksi Node runtime;
2. mendeteksi executable codex;
3. membaca versi Codex;
4. resolve CODEX_HOME;
5. memverifikasi state_5.sqlite;
6. memverifikasi sessions directory;
7. membuka state_5.sqlite dalam mode read-only;
8. memeriksa keberadaan tabel threads;
9. menghitung jumlah thread;
10. menampilkan diagnostic result.
```

Expected output:

```text
CASR Doctor

Runtime
[OK] Node.js 24.x

Codex
[OK] Codex CLI 0.150.1
[OK] CODEX_HOME C:\Users\yefta\.codex

Storage
[OK] state_5.sqlite
[OK] sessions/
[OK] threads table

Sessions
[OK] 20 native Codex sessions detected

CASR
[OK] Environment ready
```

Tidak ada session yang di-import pada tahap ini.

---

# 31. Implementation Constraint

Selama P0-P7:

```text
NO writes to Codex-owned files.
```

CASR hanya boleh menulis ke:

```text
CASR_HOME
project development directory
```

Semua operasi terhadap:

```text
CODEX_HOME
```

harus bersifat:

```text
read-only
```

kecuali pemanggilan command resmi Codex seperti:

```text
codex resume <id>
```

yang dikelola oleh Codex sendiri.
