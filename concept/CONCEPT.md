# Canonical Agent Session Runtime (CASR)

## 1. Ringkasan

**Canonical Agent Session Runtime (CASR)** adalah konsep runtime lokal untuk mempertahankan satu **logical agent session** secara persisten, independen dari akun, provider, model, dan ukuran context window.

CASR memisahkan tiga hal yang sering tercampur dalam sistem agent saat ini:

1. **Session identity**, yaitu identitas percakapan dan pekerjaan yang persisten.
2. **Canonical history**, yaitu seluruh event asli yang disimpan secara lokal dan tidak dihapus akibat compaction.
3. **Active context**, yaitu representasi sementara dari canonical history yang dikompilasi sesuai kebutuhan model dan context window tertentu.

Prinsip utamanya:

> **Context window membatasi satu eksekusi model, bukan umur atau kapasitas logical session.**

Dengan pendekatan ini, sebuah session dapat terus berkembang menjadi jutaan token ekuivalen secara lokal, sementara setiap model hanya menerima subset atau representasi terkompresi yang relevan untuk satu turn.

---

## 2. Nama Proyek

### Nama utama yang direkomendasikan

**Canonical Agent Session Runtime**

Singkatan:

```text
CASR
```

Alasan pemilihan nama:

- **Canonical** menegaskan bahwa sistem memiliki satu sumber kebenaran lokal yang lossless.
- **Agent Session** menegaskan bahwa objek utama bukan sekadar chat history atau memory.
- **Runtime** menunjukkan bahwa sistem tidak hanya menyimpan histori, tetapi juga mengelola reconstruction, compaction, context compilation, resume, dan execution.

### Alternatif nama

Beberapa nama alternatif yang masih sesuai dengan konsep:

```text
Local Agent Session Runtime
Persistent Agent Session Layer
Universal Agent Session Runtime
Agent Session Continuity Layer
Provider-Agnostic Session Runtime
Canonical Context Runtime
Local Agent Continuity Engine
```

Untuk pengembangan jangka panjang, **Canonical Agent Session Runtime (CASR)** paling tepat karena tidak terlalu terikat pada Codex dan tetap relevan jika sistem mendukung Claude Code, OpenCode, Antigravity, atau provider lain.

---

## 3. Masalah yang Ingin Diselesaikan

Coding agent modern memiliki kemampuan reasoning dan tool-use yang kuat, tetapi kontinuitas session sering bergantung pada:

- akun tertentu,
- provider tertentu,
- model tertentu,
- context window tertentu,
- format session internal vendor,
- atau lifecycle aplikasi tertentu.

Masalah ini menciptakan beberapa bentuk fragmentasi.

### 3.1 Account fragmentation

Session sering diasumsikan melekat pada akun.

Namun pada Codex CLI v0.150.1 yang diuji, session lokal dapat di-resume dengan akun ChatGPT berbeda selama session lokal yang sama masih tersedia.

Hal ini menunjukkan bahwa secara teknis:

```text
ACCOUNT_IDENTITY != SESSION_IDENTITY
```

### 3.2 Provider fragmentation

Sebuah session biasanya hidup di dalam runtime provider tertentu.

Contoh:

```text
Codex Session
Claude Code Session
OpenCode Session
Antigravity Conversation
```

Masing-masing memiliki format dan lifecycle sendiri.

CASR bertujuan membuat logical session berada di atas provider tersebut.

### 3.3 Context-window fragmentation

Model dapat memiliki context window berbeda.

Contoh:

```text
Model A = 128K
Model B = 258K
Model C = 1M
```

Jika session bergantung langsung pada context window, maka kontinuitas session ikut dibatasi oleh kapasitas model.

CASR memisahkan keduanya.

### 3.4 Destructive compaction

Compaction tradisional berisiko menghilangkan detail lama.

Jika hasil summary menggantikan raw history, maka informasi yang hilang tidak dapat direkonstruksi dengan sempurna.

CASR menggunakan **non-destructive compaction**.

Raw history tidak dihapus.

---

## 4. Prinsip Dasar

CASR dibangun di atas beberapa prinsip utama.

### 4.1 Session adalah objek lokal yang persisten

Logical session dimiliki oleh runtime lokal, bukan oleh akun provider.

```text
Local Session
    |
    +-- Account A
    +-- Account B
    +-- Provider A
    +-- Provider B
```

Akun berfungsi sebagai execution credential.

Provider berfungsi sebagai execution backend.

Session tetap memiliki identitas sendiri.

---

### 4.2 Canonical history adalah sumber kebenaran

Semua event asli disimpan secara lokal.

Contoh:

```text
user message
assistant message
developer/system instruction
tool call
tool result
file reference
artifact
execution result
workspace event
model metadata
```

Canonical history tidak diganti oleh summary.

Secara formal:

```text
Canonical(t+1)
=
Canonical(t)
+
NewRawEvents(t)
```

---

### 4.3 Context adalah view terhadap history

Context bukan history.

Context merupakan representasi terpilih dari canonical history untuk kebutuhan satu invocation.

```text
Context(t)
=
Compile(
    CanonicalSession,
    TargetModel,
    TargetWindow,
    CurrentTask
)
```

Dengan demikian:

```text
SESSION != CONTEXT WINDOW
SESSION != ACTIVE CONTEXT
```

---

### 4.4 Compaction tidak boleh destruktif

Compaction hanya menghasilkan representasi baru.

```text
Raw Events
    |
    +--> Compact Snapshot
```

Bukan:

```text
Raw Events
    |
    X replaced by summary
```

Jika summary buruk, snapshot dapat dibuat ulang karena raw source masih tersedia.

---

### 4.5 Provider dan model adalah adapter

CASR tidak boleh bergantung pada satu provider.

Arsitektur ideal:

```text
                 CASR
                  |
        +---------+---------+
        |         |         |
      Codex     Claude    OpenCode
      Adapter    Adapter    Adapter
        |         |         |
      OpenAI   Anthropic   Provider X
```

Codex dapat menjadi adapter pertama tanpa menjadikan seluruh core Codex-dependent.

---

## 5. Temuan Empiris Awal pada Codex

Pengujian dilakukan menggunakan:

```text
OpenAI Codex CLI v0.150.1
Windows
ChatGPT Free Account A
ChatGPT Free Account B
```

Session uji:

```text
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

Session dibuat dengan Account A, kemudian:

```text
codex logout
codex login
```

Login dilakukan menggunakan Account B.

Session lama berhasil dibuka menggunakan:

```text
codex resume 01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

Conversation context sebelumnya tetap tersedia.

Status setelah resume menunjukkan:

```text
Account  : Account B
Session  : 01a04c15-f919-7c52-9b6a-0fa9ff4d3394
Thread   : tetap thread lama
```

Temuan ini menunjukkan bahwa pada versi dan lingkungan yang diuji:

```text
Session identity
dapat bertahan

sementara

Authentication identity
dapat berubah
```

Temuan tersebut merupakan **observed capability**, bukan jaminan kontrak API permanen dari OpenAI.

---

## 6. Arsitektur Penyimpanan Codex yang Diamati

Pada environment yang diuji, Codex menyimpan state lokal dalam beberapa lapisan:

```text
~/.codex/
|
+-- sessions/
|   +-- YYYY/MM/DD/
|       +-- rollout-<timestamp>-<session-id>.jsonl
|
+-- session_index.jsonl
|
+-- state_5.sqlite
|
+-- auth.json
```

### 6.1 Rollout JSONL

Rollout JSONL menyimpan event stream session.

Record yang ditemukan antara lain:

```text
session_meta
world_state
turn_context
response_item
event_msg
```

Subtype yang ditemukan:

```text
task_started
item_completed
task_complete
token_count
thread_settings_applied
message
reasoning
```

Ini menunjukkan bahwa local session bukan sekadar array pesan.

Ia menyerupai append-only event log.

---

### 6.2 session_index.jsonl

Index lokal menyimpan data ringan seperti:

```text
id
thread_name
updated_at
```

Index bersifat append-oriented dan dapat memiliki lebih dari satu record untuk session yang sama ketika nama thread berubah.

---

### 6.3 state_5.sqlite

Database `state_5.sqlite` memiliki tabel `threads`.

Kolom yang diamati antara lain:

```text
id
rollout_path
created_at
updated_at
source
model_provider
cwd
title
sandbox_policy
approval_mode
tokens_used
archived
git_sha
git_branch
git_origin_url
cli_version
first_user_message
model
reasoning_effort
history_mode
project_id
```

Tidak ditemukan kolom langsung seperti:

```text
email
account_id
user_id
subscription_id
```

pada tabel `threads`.

Ini konsisten dengan hasil eksperimen native cross-account resume.

---

## 7. Arsitektur CASR

Arsitektur tingkat tinggi:

```text
                    LOCAL MACHINE
                         |
                         v
                +------------------+
                |       CASR       |
                +------------------+
                         |
       +-----------------+------------------+
       |                 |                  |
       v                 v                  v
Canonical Store    Context Compiler    Session Registry
       |                 |                  |
       |                 v                  |
       |          Active Context            |
       |                 |                  |
       +-----------------+------------------+
                         |
                         v
                  Agent Adapter
                         |
         +---------------+---------------+
         |               |               |
         v               v               v
       Codex           Claude          OpenCode
```

---

## 8. Canonical Session

Canonical session menyimpan seluruh history asli.

Contoh:

```text
Session X
|
+-- Event 000001
+-- Event 000002
+-- Event 000003
+-- ...
+-- Event 982341
```

Canonical history dapat secara teoritis jauh lebih besar daripada context window model.

Contoh:

```text
Canonical History
= 5,000,000 token equivalent

Model Context Window
= 258,400 tokens
```

Tidak ada konflik.

Karena hanya sebagian history yang masuk ke active context.

---

## 9. Context Compiler

Context Compiler bertugas menentukan apa yang dikirim ke model.

Input:

```text
Canonical Session
Current Task
Target Model
Target Context Window
Tool Definitions
Workspace State
Relevant Artifacts
```

Output:

```text
Context Build
```

Contoh:

```text
Target Context Window: 258,400

System / developer        18K
Tool definitions          12K
Historical summary        35K
Relevant old events       30K
Recent raw conversation  145K
Reserved output           18K
------------------------------
Total                    258K
```

Context Compiler tidak mengubah canonical history.

---

## 10. Compaction

Compaction menghasilkan snapshot.

Contoh:

```json
{
  "snapshot_id": "cmp_0042",
  "session_id": "sess_001",
  "source_event_start": 1,
  "source_event_end": 928,
  "source_token_estimate": 611420,
  "compacted_token_count": 36781,
  "target_model": "gpt-5.4-mini",
  "target_context_window": 258400
}
```

Relasinya:

```text
Raw Events 1-928
      |
      +--> Compact Snapshot #42
```

Raw Events 1-928 tetap tersedia.

---

## 11. Hierarchical Compaction

Untuk session sangat panjang, compaction dapat dilakukan bertingkat.

```text
Raw 1-500
    |
    +--> Summary A

Raw 501-1000
    |
    +--> Summary B

Raw 1001-1500
    |
    +--> Summary C
```

Kemudian:

```text
Summary A
Summary B
Summary C
    |
    +--> Summary ABC
```

Lineage harus tetap dipertahankan:

```text
Summary ABC
|
+-- Summary A
|   +-- Raw 1-500
|
+-- Summary B
|   +-- Raw 501-1000
|
+-- Summary C
    +-- Raw 1001-1500
```

Jika diperlukan, sistem dapat kembali ke raw event.

---

## 12. Merge Model

CASR tidak menggabungkan compacted context ke canonical history sebagai raw truth.

Yang dilakukan:

```text
Canonical History A
        |
        v
Context Build A
        |
        v
Model Execution
        |
        v
New Raw Events B
        |
        v
Canonical History A + B
```

Kemudian:

```text
Canonical History A+B
        |
        +--> Context Build berikutnya
```

Secara formal:

```text
Canonical(t+1)
=
Canonical(t)
+
NewRawEvents(t)
```

Sedangkan:

```text
ContextBuild(t)
=
Compile(Canonical(t))
```

---

## 13. Token Model

CASR tidak menggunakan token ID sebagai canonical storage.

Canonical storage menggunakan raw text atau structured event.

Contoh:

```text
"PostgreSQL digunakan sebagai source of truth."
```

Bukan:

```text
[14822, 9281, 442, ...]
```

Alasannya:

```text
Tokenizer Model A != Tokenizer Model B
```

Satu content yang sama dapat menghasilkan token count berbeda.

CASR dapat menyimpan token metric per model:

```json
{
  "event_id": "evt_100",
  "content": "PostgreSQL digunakan sebagai source of truth.",
  "token_metrics": {
    "model_a": 8,
    "model_b": 10
  }
}
```

---

## 14. Token Metrics

CASR dapat menyimpan beberapa metric sekaligus:

```text
Canonical Event Count
Canonical Character Count
Canonical Token Estimate by Model
Active Context Tokens
Cached Input Tokens
Output Tokens
Context Window Capacity
```

Contoh:

```text
Canonical history:
1,827,441 token equivalent

Current active context:
241,820 / 258,400

Current output:
6,200 tokens
```

Canonical token count tidak sama dengan active context count.

---

## 15. Execution Model

Satu logical session dapat memiliki banyak execution.

```text
Session X
|
+-- Execution 001
|   Account: OpenAI Account A
|   Agent: Codex
|   Model: GPT
|
+-- Execution 002
|   Account: OpenAI Account B
|   Agent: Codex
|   Model: GPT
|
+-- Execution 003
    Provider: Anthropic
    Agent: Claude Code
    Model: Claude
```

Session tetap sama.

Execution credential dapat berubah.

---

## 16. Data Model Konseptual

### Session

```text
id
title
workspace_id
created_at
updated_at
status
```

### Event

```text
id
session_id
ordinal
event_type
role
content
metadata
created_at
```

### Native Session

```text
id
session_id
agent_type
native_session_id
native_path
provider
created_at
```

### Execution

```text
id
session_id
native_session_id
account_ref
provider
agent
model
reasoning_effort
context_window
started_at
completed_at
```

### Compact Snapshot

```text
id
session_id
source_event_start
source_event_end
source_token_estimate
compacted_content
compacted_token_count
target_model
target_window
parent_snapshot_id
created_at
```

### Context Build

```text
id
session_id
execution_id
target_model
target_window
selected_events
selected_snapshots
selected_artifacts
input_token_count
created_at
```

### Token Metric

```text
id
session_id
execution_id
model
input_tokens
cached_input_tokens
output_tokens
total_tokens
context_window
```

---

## 17. Adapter Architecture

Agent-specific logic harus dipisahkan dari core.

Interface konseptual:

```text
AgentAdapter
|
+-- discoverSessions()
+-- loadSession()
+-- resumeSession()
+-- createSession()
+-- getTranscript()
+-- getWorkspace()
+-- getTokenMetrics()
+-- getCapabilities()
```

Implementasi awal:

```text
CodexAdapter
```

Implementasi masa depan:

```text
ClaudeCodeAdapter
OpenCodeAdapter
AntigravityAdapter
CursorAdapter
```

---

## 18. Codex-First, Bukan Codex-Dependent

Tahap pertama dapat fokus pada Codex.

```text
CASR
 |
 +-- CodexAdapter
```

Tetapi core tidak boleh menggunakan schema Codex sebagai canonical schema.

Gunakan pola:

```text
Codex Native Session
        |
        v
Codex Adapter
        |
        v
Canonical Session Format
```

Bukan:

```text
CASR Core
   |
   v
state_5.sqlite schema
```

Hal ini penting karena schema internal Codex dapat berubah.

---

## 19. Session Portability

CASR membedakan tiga tingkat portability.

### Level 1: Readable

Session dapat dibaca oleh CASR.

```text
Readable = true
```

### Level 2: Reconstructable

CASR dapat membuat context equivalent pada agent lain.

```text
Reconstructable = true
```

### Level 3: Native Resumable

Runtime agent asli menerima native session ID yang sama.

```text
NativeResume = true
```

Codex v0.150.1 pada eksperimen awal menunjukkan Level 3 untuk pergantian akun pada instalasi lokal yang sama.

---

## 20. Context Portability

Context tidak perlu identik secara token.

Yang harus dipertahankan adalah semantic continuity.

Contoh:

```text
Session X
|
+-- Model A
|   Context Window: 258K
|
+-- Model B
|   Context Window: 128K
|
+-- Model C
    Context Window: 1M
```

Untuk masing-masing model:

```text
ContextBuild
=
Compile(
  same Canonical Session,
  different model requirements
)
```

---

## 21. Security Boundary

Cross-account session continuity menimbulkan konsekuensi keamanan.

Jika semua akun lokal dapat membuka semua session:

```text
Account A
    |
Local Session
    |
Account B
```

maka account isolation tidak lagi menjadi boundary utama.

CASR harus memiliki local authorization layer.

Contoh:

```text
Session Access Policy

[ ] unrestricted-local
[ ] require-local-password
[ ] account-whitelist
[ ] workspace-restricted
[ ] encrypted-session
```

Sensitive information juga harus dipisahkan.

Credential tidak boleh disimpan di canonical session.

Contoh yang harus dikecualikan:

```text
OAuth token
API key
cookie
password
private credential
auth.json
```

---

## 22. Integrity

Canonical history sebaiknya append-only.

Setiap event dapat memiliki hash:

```text
event_hash
previous_event_hash
```

Sehingga terbentuk chain:

```text
Event 1
  |
Event 2
  |
Event 3
  |
Event N
```

Perubahan historis dapat terdeteksi.

---

## 23. Storage Strategy

MVP dapat menggunakan:

```text
SQLite
+
filesystem
```

Contoh:

```text
.casr/
|
+-- casr.sqlite
|
+-- sessions/
|   +-- <session-id>/
|       +-- events/
|       +-- snapshots/
|       +-- artifacts/
|
+-- adapters/
|
+-- backups/
```

SQLite menyimpan metadata dan index.

Filesystem menyimpan payload besar jika diperlukan.

---

## 24. MVP Scope

Versi awal sebaiknya fokus pada:

```text
Codex only
```

Fitur minimum:

1. Discover Codex session lokal.
2. Import metadata session.
3. Map native session ID ke CASR session ID.
4. Tampilkan session history.
5. Native resume menggunakan Codex.
6. Catat akun aktif per execution.
7. Catat model dan context window.
8. Catat token metric.
9. Backup canonical transcript.
10. Verifikasi cross-account resume.
11. Bangun non-destructive snapshot.
12. Bangun context compiler sederhana.

---

## 25. Tahapan Pengembangan

### Phase 1: Codex Session Registry

```text
scan ~/.codex
read state_5.sqlite
read session_index.jsonl
map rollout JSONL
```

### Phase 2: Canonical Store

```text
Codex event
    |
    v
Canonical Event
```

### Phase 3: Execution Tracking

Catat:

```text
account
model
reasoning level
context window
token usage
```

### Phase 4: Snapshot Engine

Bangun compaction non-destruktif.

### Phase 5: Context Compiler

Compile canonical history ke target context window.

### Phase 6: Provider Adapter

Tambahkan provider lain.

### Phase 7: Cross-Provider Continuity

Session yang sama dapat berpindah runtime.

---

## 26. Non-Goals

CASR bukan:

```text
cloud chat synchronization service
password manager
credential sharing tool
model provider replacement
LLM inference engine
simple chat-history viewer
```

CASR juga tidak menjanjikan bahwa native session format vendor akan selalu stabil.

---

## 27. Batasan Teknis

Beberapa keterbatasan harus diakui.

### Native schema dapat berubah

Codex, Claude Code, atau provider lain dapat mengubah format local session.

### Native resume tidak selalu tersedia

Readable session belum tentu native-resumable.

### Hidden model state tidak dapat disimpan sempurna

CASR hanya dapat menyimpan state yang tersedia dari runtime atau dapat direkonstruksi.

### Compaction bersifat lossy

Karena itu raw history tidak boleh dihapus.

### Retrieval menjadi masalah utama pada session besar

Jika canonical session mencapai puluhan juta token ekuivalen, tantangan utama bukan storage, melainkan pemilihan context yang relevan.

---

## 28. Definisi Keberhasilan

CASR dianggap berhasil jika kondisi berikut terpenuhi:

```text
1 logical session
        |
        +-- survives app restart
        +-- survives account switch
        +-- survives model switch
        +-- survives context-window differences
        +-- preserves raw historical information
        +-- supports non-destructive compaction
        +-- can rebuild model-specific context
```

Tujuan akhirnya:

> **Session continuity tidak lagi bergantung pada satu akun, satu provider, satu model, atau satu context window.**

---

## 29. Prinsip Arsitektur Final

Prinsip utama CASR dapat diringkas menjadi:

```text
CANONICAL SESSION
      |
      | lossless local history
      |
      v
CONTEXT COMPILER
      |
      | model-specific representation
      |
      v
ACTIVE CONTEXT
      |
      v
AGENT / MODEL
      |
      v
NEW RAW EVENTS
      |
      +--------------------+
                           |
                           v
                    CANONICAL SESSION
```

Aturan utama:

> **Compaction boleh mengubah representasi context, tetapi tidak boleh mengubah canonical session history.**

Dan:

> **Model context window adalah batas eksekusi, bukan batas memory session.**

---

## 30. Visi Jangka Panjang

CASR dapat berkembang menjadi lapisan session universal untuk AI agent.

```text
                 LOCAL CANONICAL SESSION
                          |
             +------------+------------+
             |            |            |
             v            v            v
           Codex        Claude       OpenCode
             |            |            |
             v            v            v
           GPT          Claude       Model X
```

Dalam model ini:

```text
Agent
Model
Provider
Account
```

menjadi execution resources.

Sedangkan:

```text
Session
History
Artifacts
Decisions
Context lineage
```

tetap menjadi aset lokal pengguna atau organisasi.

CASR pada akhirnya memisahkan **ownership of context** dari **provider of intelligence**.
