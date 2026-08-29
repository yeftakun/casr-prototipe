# CASR — Roadmap Kasar Menuju Cross-Account Codex

**Status dokumen:** Planning draft  
**Scope:** Cross-account dalam OpenAI Codex CLI  
**Out of scope:** Cross-platform / cross-provider agent runtime  
**Baseline saat ini:** CASR v0.1.1

---

# 1. Tujuan Besar

Target CASR dalam fase ini adalah membuat satu logical session lokal yang tetap dianggap sebagai **session yang sama**, walaupun environment eksekusinya berubah.

Contoh awal:

```text
Codex
Account A
Model X
128K context
```

kemudian berpindah menjadi:

```text
Codex
Account B
Model X
```

atau:

```text
Codex
Account B
Model Y
```

CASR harus tetap memahami bahwa keduanya merupakan kelanjutan dari:

```text
CASR SESSION YANG SAMA
```

Prinsip utamanya:

```text
ACCOUNT_IDENTITY != SESSION_IDENTITY
```

dan:

```text
NATIVE_SESSION_IDENTITY != LOGICAL_SESSION_IDENTITY
```

Artinya:

- akun bukan pemilik session,
- native Codex session bukan identitas utama,
- CASR logical session adalah identitas yang dipertahankan.

---

# 2. Posisi CASR Saat Ini — v0.1.1

CASR v0.1.1 sudah membuktikan fondasi pertama.

Saat ini CASR dapat:

```text
Codex Native Session
        ↓
     casr sync
        ↓
CASR Logical Session
        ↓
casr sessions
        ↓
casr inspect
        ↓
casr resume
        ↓
Codex native session dilanjutkan
```

CASR sudah memiliki:

- logical CASR session ID,
- native Codex binding,
- local SQLite registry,
- Codex native session discovery,
- idempotent synchronization,
- session inspection,
- native resume,
- original workspace restoration,
- Codex schema compatibility diagnostics,
- read-only boundary terhadap storage Codex.

Namun CASR **belum memiliki isi session**.

Saat ini hubungan sederhananya masih:

```text
CASR Session
     ↓
Native Codex Session
```

Belum:

```text
CASR Session
├── Canonical History
├── Session State
└── Native Bindings
```

Karena itu CASR v0.1.x masih dapat dianggap sebagai:

```text
Logical Session Registry
+
Native Session Orchestration
```

belum menjadi:

```text
Canonical Session Runtime
```

---

# 3. Prinsip Arsitektur untuk Fase Cross-Account

Beberapa aturan tidak boleh dilanggar selama pengembangan.

## 3.1 CODEX_HOME tetap read-only

```text
CODEX_HOME = READ ONLY
CASR_HOME  = READ / WRITE
```

CASR tidak boleh mengedit database atau rollout milik Codex.

---

## 3.2 Credential bukan bagian canonical session

CASR tidak boleh menjadikan:

```text
auth.json
token
credential
cookie
secret
```

sebagai bagian dari canonical state.

Account harus dianggap sebagai:

```text
Execution Environment
```

bukan:

```text
Session Owner
```

---

## 3.3 Canonical history harus lossless

Target:

```text
Canonical(t+1)
=
Canonical(t)
+
NewRawEvents(t)
```

Raw canonical events harus:

- append-only,
- lossless,
- persistent,
- reproducible,
- tidak ditimpa summary.

---

## 3.4 Compaction bukan canonical history

Summary, checkpoint, retrieval result, atau compiled context hanyalah derived state.

```text
RAW CANONICAL EVENTS
        ↓
derived representation
        ↓
compiled context
```

Bukan:

```text
RAW HISTORY
   ↓
summary
   ↓
hapus raw
```

---

# 4. Target Akhir Fase Ini

Target akhir fase cross-account Codex adalah:

```text
CASR SESSION 001
        │
        ├── Canonical Events
        ├── Working State
        ├── Context Compiler
        │
        └── Native Bindings
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
Codex Native #A     Codex Native #B

Account A           Account B
Model X             Model X / Y
```

Bagi Codex mungkin terdapat dua native sessions.

Bagi CASR:

```text
SATU LOGICAL SESSION
```

---

# 5. Roadmap Versi

Roadmap kasar:

```text
v0.1.1  Logical identity + native resume
v0.2    Canonical event history
v0.3    Session checkpoint / working state
v0.4    Context compiler + rehydration
v0.5    Multi-native binding + cross-account fallback
v0.6    Model/context-window adaptation
```

Target utama fase ini secara produk sebenarnya dicapai pada:

```text
v0.5
```

Sedangkan v0.6 membuat perpindahan model lebih matang.

---

# 6. v0.2 — Canonical Event History

## Tujuan

CASR mulai memiliki isi session secara lokal.

Dari:

```text
CASR Session
     ↓
Native Binding
```

menjadi:

```text
CASR Session
├── Native Binding
└── Canonical Events
```

---

## Sumber data pertama

Untuk Codex, sumber data kemungkinan berasal dari native rollout/session history.

Flow:

```text
Codex Rollout / Native History
            ↓
       READ ONLY
            ↓
       Codex Adapter
            ↓
      Event Normalizer
            ↓
   CASR Canonical Events
```

---

## Bentuk konseptual event

Contoh:

```text
event 0001
type: user_message

event 0002
type: assistant_message

event 0003
type: tool_call

event 0004
type: tool_result

event 0005
type: user_message
```

Namun canonical core tidak boleh menggunakan vocabulary internal Codex seperti:

```text
event_msg
response_item
turn_context
```

Vocabulary provider harus berhenti di adapter boundary.

---

## Kebutuhan storage

Kemungkinan diperlukan tabel baru seperti:

```text
canonical_events
```

Contoh konsep:

```text
id
session_id
sequence
event_type
payload_json
native_event_id
native_source
native_session_id
occurred_at
imported_at
```

Belum berarti schema tersebut final.

---

## Import cursor

Import tidak boleh membaca ulang seluruh rollout setiap sync jika session sudah sangat besar.

Perlu konsep:

```text
last imported position
```

atau:

```text
native import cursor
```

Flow:

```text
Previous Import
      ↓
cursor = N
      ↓
Read only events N+1 ...
      ↓
Append new canonical events
```

---

## Idempotency

Import event wajib idempotent.

Menjalankan:

```text
casr sync
```

berulang kali tidak boleh menggandakan event.

---

## Unknown event preservation

Jika Codex menambahkan tipe event yang belum dipahami CASR:

```text
UNKNOWN NATIVE EVENT
```

CASR tidak boleh langsung membuangnya.

Lebih aman:

```text
preserve raw payload
+
mark event as unknown
```

---

## Success criteria v0.2

CASR dapat mengatakan:

```text
Session: casr_ABC

Native Events Read : 412
Canonical Events   : 412
New Events Imported: 17
Duplicates         : 0
```

Dan raw history CASR tetap tersedia walaupun native Codex session suatu hari tidak dapat digunakan.

---

# 7. v0.3 — Session Checkpoint / Working State

## Masalah

Memiliki semua history belum berarti model baru dapat langsung bekerja secara efektif.

Session coding panjang dapat memiliki:

```text
200K+
500K+
1M+
```

token accumulated history.

Model baru mungkin hanya perlu mengetahui state kerja saat ini.

---

## Tujuan

CASR menghasilkan derived working state dari canonical history.

Contoh:

```text
Session Goal
Current Task
Completed Work
Architecture Decisions
Open Issues
Relevant Files
Important Commands
Recent Test Results
Next Actions
```

---

## Mental model

```text
Canonical History
=
buku lengkap
```

sedangkan:

```text
Session Checkpoint
=
bookmark + meja kerja saat ini
```

Checkpoint boleh dibuat ulang.

Canonical history tidak boleh hilang.

---

## Contoh checkpoint

```text
Goal:
Build persistent agent session runtime.

Current Task:
Implement canonical event importer.

Completed:
- Registry
- Sync
- Resume
- Codex schema guard

Open Issues:
- Native event parser
- Import cursor

Relevant Files:
- src/adapters/codex/...
- src/storage/...

Next Action:
Create rollout parser fixtures.
```

---

## Success criteria v0.3

Dari canonical history yang panjang, CASR dapat menghasilkan snapshot state yang cukup untuk menjelaskan:

```text
"What are we doing right now?"
```

tanpa membaca seluruh conversation setiap kali.

---

# 8. v0.4 — Context Compiler + Rehydration

Ini adalah komponen penting sebelum cross-account fallback dapat benar-benar bekerja.

## Masalah

Canonical history bisa lebih besar dari target context window.

Contoh:

```text
Canonical History
250K tokens
```

Target model:

```text
128K context
```

Tidak mungkin memasukkan seluruh canonical history.

---

## Tujuan

Membuat:

```text
Context(t)
=
Compile(
  Canonical(t),
  Checkpoint(t),
  TargetModel,
  TargetWindow,
  CurrentTask
)
```

---

## Context compiler dapat memilih

Misalnya:

```text
Session identity
Important decisions
Current checkpoint
Recent messages
Relevant historical events
Relevant tool results
Relevant code state
Current task
```

---

## Derived context

Compiled context hanyalah:

```text
temporary execution context
```

Canonical history tetap:

```text
untouched
```

---

## Rehydration

Jika session harus berjalan pada native Codex session baru:

```text
CASR Canonical Session
        ↓
Context Compiler
        ↓
Rehydration Context
        ↓
New Codex Native Session
```

Model baru menerima cukup informasi untuk melanjutkan pekerjaan.

---

## Success criteria v0.4

CASR mampu memulai native Codex session baru dan membuat agent memahami:

```text
goal
current state
major decisions
recent conversation
unfinished work
```

tanpa memerlukan native session lama.

---

# 9. v0.5 — Multi-Native Binding + Cross-Account

Ini adalah milestone utama.

## Perubahan data model

Saat ini secara konsep:

```text
CASR Session
     ↓
Native Binding
```

Perlu berubah menjadi:

```text
CASR Session
├── Native Binding A
├── Native Binding B
└── Native Binding C
```

Satu binding dapat diberi status:

```text
active
inactive
failed
superseded
```

---

# 10. Strategi Resume Dua Tingkat

Saat:

```text
casr resume casr_ABC
```

CASR tidak langsung selalu membuat session baru.

Gunakan strategi:

```text
FAST PATH
```

kemudian:

```text
FALLBACK PATH
```

---

## 10.1 Fast Path

Scenario:

```text
Native Session #111
dibuat saat Account A
```

User logout lalu login:

```text
Account B
```

CASR mencoba:

```text
codex resume #111
```

Jika berhasil:

```text
same native session
same CASR session
```

Tidak perlu rehydration.

Flow:

```text
CASR Session
      ↓
Current Native Binding
      ↓
codex resume
      ↓
SUCCESS
```

---

# 11. Cross-Account Fallback

Masalah yang ingin CASR antisipasi:

```text
Account A
Native Session #111
```

kemudian:

```text
logout Account A
login Account B
```

dan native Codex session lama tidak lagi dapat digunakan.

Flow:

```text
casr resume casr_ABC
       ↓
try Native Session #111
       ↓
FAILED
       ↓
CASR canonical history still exists
       ↓
load checkpoint
       ↓
compile context
       ↓
create new Codex native session
       ↓
inject / rehydrate context
       ↓
Native Session #222
       ↓
bind to casr_ABC
```

Hasil:

```text
CASR SESSION
casr_ABC

Bindings:

#111
Codex
old native session

#222
Codex
new native session
ACTIVE
```

Logical identity:

```text
casr_ABC
```

tidak berubah.

---

# 12. Yang Tidak Perlu CASR Ketahui Tentang Account

CASR tidak perlu membaca:

```text
email
account id
auth.json
access token
refresh token
cookie
credential
```

CASR cukup mengetahui hasil eksekusi:

```text
resume succeeded
```

atau:

```text
resume failed
```

Account A / Account B hanya perlu dianggap sebagai:

```text
environment labels
```

jika suatu hari memang dibutuhkan.

---

# 13. Demo Utama v0.5

Demo yang harus berhasil:

## Step 1

Login:

```text
Codex
Account A
```

---

## Step 2

Mulai pekerjaan.

```text
Native Codex Session #111
```

CASR:

```text
casr sync
```

menghasilkan:

```text
CASR Session casr_ABC
```

---

## Step 3

Bekerja cukup lama.

Canonical history CASR bertambah.

---

## Step 4

Logout Account A.

---

## Step 5

Login Account B.

---

## Step 6

Jalankan:

```text
casr resume casr_ABC
```

---

## Step 7 — Fast Path

Jika Codex masih mengizinkan:

```text
resume #111
```

CASR melanjutkannya.

Demo selesai.

---

## Step 8 — Forced Fallback Test

Untuk membuktikan CASR benar-benar independent dari native session lama:

```text
buat native #111 unavailable
```

kemudian:

```text
casr resume casr_ABC
```

CASR harus:

```text
detect resume failure
       ↓
compile canonical context
       ↓
create Native Session #222
       ↓
rehydrate
       ↓
continue
```

---

## Step 9

Tanya agent:

```text
Apa yang sedang kita kerjakan?
Apa yang sudah selesai?
Apa next action?
```

Jawabannya harus konsisten dengan state sebelumnya.

---

# 14. v0.6 — Model dan Context Window Adaptation

Setelah cross-account dapat dilakukan, barulah model switching diperkuat.

Contoh:

```text
Account A
Model X
128K
```

menjadi:

```text
Account B
Model Y
64K
```

---

## Masalah

Compiled context untuk:

```text
128K
```

tidak selalu cocok untuk:

```text
64K
```

CASR harus mengetahui:

```text
target context budget
```

---

## Contoh budgeting

Misalnya model memiliki:

```text
64K
```

CASR dapat membagi secara dinamis:

```text
checkpoint
recent events
retrieved old events
relevant code state
current task
response reserve
```

Tidak perlu hardcoded persis.

---

## Jika target context lebih besar

Contoh:

```text
256K
```

CASR dapat menggunakan lebih banyak raw recent history.

---

## Jika target context lebih kecil

Contoh:

```text
32K
```

CASR menggunakan lebih banyak:

```text
checkpoint
retrieval
compact representation
```

tanpa merusak canonical history.

---

# 15. State Akhir Fase Cross-Account

Architecture yang ingin dicapai:

```text
                     CASR SESSION
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
 Canonical Events   Working State   Session Metadata
          │              │
          └───────┬──────┘
                  ▼
           Context Compiler
                  │
          ┌───────┴────────┐
          │                │
          ▼                ▼
 Codex Native A      Codex Native B
 Account A           Account B
 Model X             Model X / Y
```

CASR session tetap sama.

---

# 16. Definition of Done Cross-Account

Fase ini dapat dianggap selesai jika seluruh kondisi berikut terpenuhi.

```text
[ ] CASR owns canonical event history
[ ] Canonical import is append-only
[ ] Import is idempotent
[ ] Unknown native events are preserved
[ ] CASR can build working checkpoints
[ ] CASR can compile context for a target window
[ ] CASR supports multiple native bindings per logical session
[ ] Native resume remains the fast path
[ ] Resume failure can trigger fallback
[ ] CASR can create a replacement Codex session
[ ] Replacement session can be rehydrated
[ ] Logical CASR session ID does not change
[ ] No credential copying is required
[ ] Account change does not destroy logical session continuity
```

Target akhirnya:

```text
Account A
Native Session A
Model X
        │
        ▼
   CASR SESSION
        │
        ▼
Account B
Native Session B
Model X / Y
```

dan pengguna tetap merasa:

```text
INI SESSION YANG SAMA
```

---

# 17. Yang Belum Dikerjakan pada Fase Ini

Fase ini sengaja belum mencakup:

```text
Claude
Gemini
OpenAI API direct runtime
Cursor
Copilot
multi-provider routing
cross-platform agent abstraction
cloud synchronization
multi-device synchronization
distributed session ownership
```

Semua itu baru relevan setelah CASR berhasil membuktikan:

```text
one logical session
across multiple Codex execution environments
```

---

# 18. Prinsip Urutan Implementasi

Jangan langsung membuat abstraction untuk semua provider.

Urutan yang lebih aman:

```text
1. Own canonical history.
2. Understand session state.
3. Compile context.
4. Survive native session replacement.
5. Survive account switching.
6. Adapt to different model windows.
7. Only then consider another agent/provider.
```

Dengan urutan ini, adapter kedua nanti akan menguji abstraction yang sudah memiliki fungsi nyata, bukan abstraction hipotetis.

---

# 19. Ringkasan Roadmap

```text
CASR v0.1.1
Logical Registry
Native Resume
        │
        ▼
CASR v0.2
Canonical Event Ownership
        │
        ▼
CASR v0.3
Working State / Checkpoint
        │
        ▼
CASR v0.4
Context Compiler / Rehydration
        │
        ▼
CASR v0.5
Multi-Binding / Cross-Account Codex
        │
        ▼
CASR v0.6
Model + Context Window Adaptation
```

Target produk fase ini:

```text
Codex Account A
      ↓
CASR logical session
      ↓
Codex Account B
```

tanpa kehilangan identitas, history, keputusan, dan state pekerjaan.

---

# 20. One-Sentence Goal

> CASR harus dapat mempertahankan satu logical coding-agent session secara lokal ketika pengguna berpindah akun Codex, meskipun native session lama tidak dapat digunakan lagi.

