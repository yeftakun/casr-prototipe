# BABY.md — Panduan CASR untuk Pemula Total

**Project:** Canonical Agent Session Runtime (CASR)  
**Versi yang dijelaskan:** MVP V0.1  
**Target pembaca:** Orang awam yang baru membuka repository ini dan belum tahu apa itu CASR, CLI, session, SQLite, adapter, native session, atau command line.

---

# 1. CASR Itu Apa?

CASR adalah singkatan dari:

```text
Canonical Agent Session Runtime
```

Versi sederhananya:

> CASR adalah alat lokal yang membantu menemukan, mencatat, melihat, dan membuka kembali session AI agent yang sudah ada.

Pada MVP V0.1, CASR saat ini bekerja dengan:

```text
OpenAI Codex CLI
```

CASR belum menggantikan Codex.

CASR juga belum menjadi AI baru.

CASR adalah lapisan tambahan di atas Codex.

Bayangkan:

```text
Codex = mesin
CASR  = katalog + pengelola session
```

Contoh sederhana:

Kamu punya banyak percakapan Codex.

Tanpa CASR:

```text
Codex session A
Codex session B
Codex session C
...
```

CASR membuat daftar sendiri:

```text
CASR session 1 → Codex session A
CASR session 2 → Codex session B
CASR session 3 → Codex session C
```

Jadi CASR bisa berkata:

```text
"Saya tahu session ini berasal dari Codex,
ID native-nya apa,
workspace-nya di mana,
dan bagaimana cara membukanya lagi."
```

---

# 2. CASR Bukan Apa?

Penting supaya tidak salah paham.

CASR MVP V0.1 BUKAN:

```text
AI chatbot baru
pengganti Codex
pengganti ChatGPT
cloud service
database percakapan universal
GUI desktop
web application
sync antar komputer
backup akun
tool untuk mencuri session
tool untuk membaca password
```

CASR saat ini adalah:

```text
local CLI tool
+
session registry
+
native session navigator
+
native resume helper
```

---

# 3. Apa Itu "Local"?

Local berarti CASR berjalan di komputer kamu sendiri.

Contoh:

```text
C:\Users\NamaKamu\casr-prototipe
```

CASR menyimpan registry miliknya sendiri di komputer.

Default:

```text
~/.casr
```

Pada Windows, `~` biasanya berarti:

```text
C:\Users\NamaKamu
```

Jadi:

```text
~/.casr
```

kira-kira berarti:

```text
C:\Users\NamaKamu\.casr
```

---

# 4. Apa Itu CLI?

CLI adalah:

```text
Command Line Interface
```

Artinya program digunakan lewat terminal.

Di Windows kita memakai:

```text
PowerShell
```

Contoh command:

```powershell
npm.cmd run dev -- doctor
```

Tidak ada tombol GUI.

Tidak ada menu klik.

Kita memberi instruksi lewat terminal.

---

# 5. Apa Itu Command?

Command adalah perintah yang diberikan ke program.

CASR MVP V0.1 punya command:

```text
doctor
sync
sessions
inspect
resume
```

Masing-masing punya fungsi berbeda.

---

# 6. Struktur Mental Paling Sederhana

Ingat alur ini:

```text
doctor
  ↓
sync
  ↓
sessions
  ↓
inspect
  ↓
resume
```

Artinya:

```text
cek sistem
  ↓
masukkan session Codex ke registry CASR
  ↓
lihat daftar
  ↓
lihat detail
  ↓
buka kembali session
```

Kalau bingung, kembali ke alur ini.

---

# 7. Apa Itu Codex?

Codex dalam konteks proyek ini adalah:

```text
OpenAI Codex CLI
```

Codex menyimpan session-nya sendiri.

CASR hanya membaca metadata native tersebut.

CASR tidak menggantikan mekanisme session Codex.

---

# 8. Apa Itu Session?

Session adalah satu riwayat kerja atau percakapan agent.

Contoh:

```text
Session 1:
Membuat website company profile

Session 2:
Memperbaiki error Astro

Session 3:
Membuat API Node.js

Session 4:
Eksperimen LOCAL-CODEX-SESSION-TEST
```

Setiap session punya identitas.

---

# 9. Native Session Itu Apa?

"Native" berarti milik sistem asli.

Dalam MVP ini:

```text
native session = session milik Codex
```

Contoh native Codex session ID:

```text
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

ID ini dibuat dan dimiliki Codex.

CASR tidak membuat ID ini.

---

# 10. CASR Session Itu Apa?

CASR membuat logical session ID miliknya sendiri.

Contoh:

```text
casr_01a04d48-c014-7469-9ed4-b36dcf9145ae
```

Jadi kita bisa punya:

```text
CASR ID
casr_01a04d48-c014-7469-9ed4-b36dcf9145ae

        ↓ menunjuk ke

Codex Native ID
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

Ini penting.

CASR ID dan Codex ID bukan hal yang sama.

---

# 11. Kenapa CASR Membuat ID Sendiri?

Tujuan jangka panjang proyek ini adalah agar:

```text
session identity
```

tidak selalu bergantung pada:

```text
provider
account
model
native runtime
```

MVP V0.1 baru membuktikan fondasinya.

Sekarang:

```text
CASR logical session
        ↓
Codex native session
```

Masa depan bisa menjadi:

```text
CASR logical session
    ├── Codex
    ├── Claude
    └── OpenCode
```

Tetapi fitur itu BELUM ada di V0.1.

---

# 12. Apa Itu Registry?

Registry adalah daftar milik CASR.

Bayangkan buku katalog.

Isi sederhananya:

```text
CASR ID
title
workspace
status
native session ID
provider
model
metadata
```

Registry CASR disimpan di:

```text
casr.sqlite
```

---

# 13. Apa Itu SQLite?

SQLite adalah database kecil berbentuk satu file.

Dalam CASR:

```text
casr.sqlite
```

menyimpan registry CASR.

Tidak perlu install database server seperti:

```text
MySQL Server
PostgreSQL Server
SQL Server
```

SQLite cukup satu file.

---

# 14. Apa Itu Workspace?

Workspace adalah folder tempat session agent bekerja.

Contoh:

```text
C:\Users\yefta\agent
```

atau:

```text
D:\code\my-site
```

Kalau session Codex awalnya bekerja di:

```text
D:\code\my-site
```

CASR mencoba me-resume session tersebut di workspace yang sama.

---

# 15. Apa Itu Adapter?

Adapter adalah penerjemah antara CASR dan agent tertentu.

Sekarang CASR punya:

```text
CodexAdapter
```

Tugasnya:

```text
membaca metadata Codex
↓
mengubahnya menjadi format yang dipahami CASR
```

Bayangkan colokan listrik.

CASR punya socket umum.

Codex punya bentuk colokan tertentu.

Adapter membuat keduanya kompatibel.

---

# 16. Apa Itu Provider?

Provider adalah penyedia runtime/model.

Dalam session Codex yang kita uji:

```text
provider = openai
```

Masa depan CASR mungkin punya provider/runtime lain.

Tetapi V0.1 hanya fokus Codex.

---

# 17. Apa Itu Model?

Model adalah model AI yang digunakan oleh native session.

Contoh:

```text
gpt-5.4-mini
```

CASR menyimpan informasi tersebut sebagai metadata.

CASR V0.1 tidak memilih atau mengganti model secara otomatis.

---

# 18. Apa Itu Metadata?

Metadata adalah informasi tambahan tentang session.

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

Metadata membantu CASR mengetahui karakteristik native session.

---

# 19. Apa Itu Read-only?

Read-only berarti:

```text
boleh membaca
tidak boleh mengubah
```

CASR punya prinsip sangat penting:

```text
CODEX_HOME = READ ONLY
CASR_HOME  = READ / WRITE
```

Artinya:

CASR boleh membaca session Codex.

CASR tidak boleh merusak atau memodifikasi storage native Codex.

---

# 20. Folder Penting

Repository project:

```text
C:\Users\yefta\casr-prototipe
```

Default Codex storage:

```text
C:\Users\yefta\.codex
```

Default CASR storage:

```text
C:\Users\yefta\.casr
```

Untuk eksperimen, lebih aman memakai:

```text
C:\Users\yefta\casr-prototipe\.playground-casr
```

---

# 21. Jangan Sentuh File Ini Secara Manual

Untuk pemula, jangan edit:

```text
~/.codex/state_5.sqlite
~/.codex/session_index.jsonl
~/.codex/sessions/**
~/.codex/auth.json
credential files
token files
sandbox secrets
```

Terutama:

```text
auth.json
```

Jangan copy.

Jangan buka untuk eksperimen.

Jangan masukkan ke Git.

---

# 22. Sebelum Mulai

Masuk ke folder project:

```powershell
cd C:\Users\yefta\casr-prototipe
```

Cek lokasi:

```powershell
Get-Location
```

Harus kira-kira:

```text
C:\Users\yefta\casr-prototipe
```

---

# 23. Kenapa Menggunakan npm.cmd?

Di Windows PowerShell, project ini menggunakan:

```text
npm.cmd
```

bukan hanya:

```text
npm
```

Contoh:

```powershell
npm.cmd run dev -- doctor
```

Ini menghindari masalah PowerShell/npm argument forwarding yang pernah ditemukan selama development.

---

# 24. Command: doctor

Command:

```text
doctor
```

artinya:

```text
periksa apakah lingkungan CASR sehat
```

Jalankan:

```powershell
npm.cmd run dev -- doctor
```

Contoh output:

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

Arti:

```text
[OK]
semuanya sehat

[INFO]
informasi tambahan
```

Jika `doctor` gagal, jangan buru-buru menjalankan command lain.

---

# 25. Apa yang Dicek doctor?

`doctor` memeriksa:

```text
Node.js
Codex CLI
CODEX_HOME
state_5.sqlite
sessions folder
read-only database access
threads table
native session count
```

---

# 26. Command: sync

Command:

```text
sync
```

artinya:

```text
baca daftar native session
dan sinkronkan ke registry CASR
```

Jalankan:

```powershell
npm.cmd run dev -- sync
```

Contoh pertama kali:

```text
CASR Sync

Discovered : 76
Imported   : 76
Updated    : 0
Unchanged  : 0
```

---

# 27. Arti Discovered

```text
Discovered
```

berarti:

```text
berapa native session yang ditemukan CASR
```

Contoh:

```text
Discovered : 76
```

berarti CASR menemukan 76 native Codex sessions.

---

# 28. Arti Imported

```text
Imported
```

berarti:

```text
berapa session baru yang masuk registry CASR
```

Contoh:

```text
Imported : 76
```

berarti 76 session baru diregistrasikan.

---

# 29. Arti Updated

```text
Updated
```

berarti:

```text
session sudah ada,
tetapi metadata native berubah
```

Contoh:

```text
Updated : 1
```

bisa berarti satu session baru saja berubah.

---

# 30. Arti Unchanged

```text
Unchanged
```

berarti:

```text
session sudah ada dan tidak berubah
```

Contoh repeated sync:

```text
Discovered : 76
Imported   : 0
Updated    : 0
Unchanged  : 76
```

Ini normal.

Bahkan bagus.

Artinya sync idempotent.

---

# 31. Apa Itu Idempotent?

Istilah penting.

Idempotent berarti:

> Menjalankan operasi yang sama berulang kali tidak menghasilkan duplicate atau perubahan aneh.

Contoh:

Sync pertama:

```text
Imported : 76
```

Sync kedua:

```text
Imported  : 0
Unchanged : 76
```

Sync ketiga:

```text
Imported  : 0
Unchanged : 76
```

CASR tidak membuat:

```text
76
152
228
304
```

session.

Tetap:

```text
76
```

Itulah idempotent.

---

# 32. Command: sessions

Command:

```text
sessions
```

digunakan untuk melihat daftar CASR session.

Jalankan:

```powershell
npm.cmd run dev -- sessions
```

Contoh:

```text
CASR Sessions

Total: 76

casr_01a0...
  Agent     : codex
  Title     : Example session
  Workspace : D:\code\my-site
  Status    : active
  Updated   : 2026-08-29T06:27:06.000Z
```

---

# 33. Arti Field pada sessions

## CASR ID

```text
casr_01a0...
```

Identitas logical milik CASR.

---

## Agent

```text
codex
```

Agent/native runtime asal session.

---

## Title

Judul atau ringkasan session.

---

## Workspace

Folder kerja asli session.

---

## Status

Contoh:

```text
active
archived
```

---

## Updated

Waktu native session terakhir diketahui berubah.

---

# 34. Command: inspect

Command:

```text
inspect
```

digunakan untuk melihat detail satu session.

Format:

```text
inspect <casr-id>
```

Contoh:

```powershell
npm.cmd run dev -- inspect casr_01a04d48-c014-7469-9ed4-b36dcf9145ae
```

---

# 35. Output inspect

Contoh:

```text
CASR Session

ID        : casr_...
Title     : ...
Workspace : C:\Users\yefta\agent
Status    : active
Created   : ...
Updated   : ...

Native Binding

Agent     : codex
Native ID : 01a04c15-f919-7c52-9b6a-0fa9ff4d3394
Path      : ...
Provider  : openai
Model     : gpt-5.4-mini
```

---

# 36. Apa Itu Native Binding?

Native binding adalah hubungan:

```text
CASR session
     ↓
native agent session
```

Contoh:

```text
CASR:
casr_123

Native:
codex / abc-123
```

Binding mengatakan:

```text
"CASR session ini terhubung ke native Codex session tersebut."
```

---

# 37. Command: resume

Command:

```text
resume
```

digunakan untuk membuka kembali native session.

Format:

```text
resume <casr-id>
```

Contoh:

```powershell
npm.cmd run dev -- resume casr_01a04d48-c014-7469-9ed4-b36dcf9145ae
```

CASR akan:

```text
mencari CASR ID
↓
mencari native binding
↓
mendapatkan Codex session ID
↓
mendapatkan original workspace
↓
menjalankan Codex
```

---

# 38. Apa yang Terjadi Setelah resume?

Terminal akan berubah menjadi Codex TUI.

Contoh:

```text
>_ OpenAI Codex

model:     ...
directory: ~\agent
```

Percakapan lama seharusnya muncul.

---

# 39. Cara Mengecek Session yang Dibuka Benar

Di Codex:

```text
/status
```

Lihat:

```text
Directory
Session
Thread name
```

Contoh:

```text
Directory: ~\agent
Session:   01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

Ini bisa dibandingkan dengan:

```text
casr inspect
```

---

# 40. Kenapa Workspace Penting Saat resume?

Tanpa workspace restoration, session bisa terbuka di folder yang salah.

Contoh salah:

```text
CASR dijalankan dari:
C:\Users\yefta\casr-prototipe

Native session sebenarnya:
C:\Users\yefta\agent
```

CASR harus membuka:

```text
C:\Users\yefta\agent
```

bukan:

```text
C:\Users\yefta\casr-prototipe
```

Bug ini pernah ditemukan dan sudah diperbaiki di MVP V0.1.

---

# 41. Apa Itu Exit Code?

Program command line memberi angka saat selesai.

Biasanya:

```text
0 = sukses
1 = gagal
```

Di PowerShell:

```powershell
$LASTEXITCODE
```

Contoh:

```powershell
npm.cmd run dev -- inspect casr-does-not-exist
$LASTEXITCODE
```

Expected:

```text
1
```

---

# 42. Contoh Error: Session Tidak Ada

```powershell
npm.cmd run dev -- inspect casr-random
```

Output:

```text
Session not found: casr-random
```

Normal.

Tidak berarti database rusak.

Hanya ID yang tidak ditemukan.

---

# 43. Apa Itu CASR_HOME?

`CASR_HOME` menentukan di mana CASR menyimpan database miliknya.

Default:

```text
~/.casr
```

Untuk eksperimen:

```powershell
$env:CASR_HOME="$PWD\.playground-casr"
```

Sekarang CASR memakai:

```text
project\.playground-casr
```

---

# 44. Kenapa Playground Berguna?

Karena kita bisa:

```text
buat registry baru
hapus registry
ulang sync
bereksperimen
```

tanpa menyentuh registry utama.

---

# 45. Membuat Playground

Di folder project:

```powershell
$env:CASR_HOME="$PWD\.playground-casr"
```

Lalu:

```powershell
npm.cmd run dev -- sync
```

Database akan muncul di:

```text
.playground-casr\casr.sqlite
```

---

# 46. Menghapus Playground

Aman jika memang folder itu hanya untuk eksperimen:

```powershell
Remove-Item .playground-casr -Recurse -Force
```

Kemudian:

```powershell
Remove-Item Env:CASR_HOME
```

Jangan lakukan command delete ini pada:

```text
~/.codex
```

---

# 47. Apa Itu CODEX_HOME?

`CODEX_HOME` adalah lokasi storage native Codex.

Default biasanya:

```text
~/.codex
```

CASR membaca lokasi ini.

---

# 48. Jangan Samakan CODEX_HOME dan CASR_HOME

Ini dua dunia berbeda:

```text
CODEX_HOME
native provider storage

CASR_HOME
CASR-owned storage
```

Prinsip:

```text
CODEX_HOME = source
CASR_HOME  = registry
```

---

# 49. Kasus Nyata 1 — Pertama Kali Mencoba Repo

Urutan:

```powershell
cd C:\Users\yefta\casr-prototipe

npm.cmd install

npm.cmd run dev -- doctor

$env:CASR_HOME="$PWD\.playground-casr"

npm.cmd run dev -- sync

npm.cmd run dev -- sessions
```

Setelah itu pilih CASR ID.

---

# 50. Kasus Nyata 2 — Mau Membuka Session Lama

Langkah:

```powershell
npm.cmd run dev -- sessions
```

Cari session berdasarkan:

```text
title
workspace
updated date
```

Copy CASR ID.

Kemudian:

```powershell
npm.cmd run dev -- inspect <casr-id>
```

Jika benar:

```powershell
npm.cmd run dev -- resume <casr-id>
```

---

# 51. Kasus Nyata 3 — Baru Membuat Session Codex

Misalnya baru membuat session di Codex.

Setelah keluar dari Codex:

```powershell
npm.cmd run dev -- sync
```

Contoh result:

```text
Discovered : 77
Imported   : 1
Updated    : 0
Unchanged  : 76
```

Artinya satu session baru ditemukan.

---

# 52. Kasus Nyata 4 — Session Lama Dilanjutkan

Kamu resume session lama di Codex lalu menambah percakapan.

Setelah keluar:

```powershell
npm.cmd run dev -- sync
```

Mungkin:

```text
Updated : 1
```

CASR ID tetap sama.

Native metadata-nya diperbarui.

---

# 53. Kasus Nyata 5 — Sync Berkali-kali

Jalankan:

```powershell
npm.cmd run dev -- sync
npm.cmd run dev -- sync
npm.cmd run dev -- sync
```

Expected:

```text
Imported : 0
Updated : 0
Unchanged : semua session
```

Ini bukan masalah.

Ini bukti idempotency.

---

# 54. Kasus Nyata 6 — Menjalankan CASR dari Folder Berbeda

Misalnya CASR session berasal dari:

```text
D:\code\project-a
```

Tetapi kamu menjalankan CASR dari:

```text
C:\Users\NamaKamu\Desktop
```

CASR resume seharusnya tetap membuka native agent dengan:

```text
D:\code\project-a
```

karena CASR menyimpan workspace asli.

---

# 55. Kasus Nyata 7 — Workspace Sudah Hilang

Jika workspace asli dihapus atau dipindahkan:

```text
D:\code\project-a
```

tidak ada lagi.

`resume` mungkin gagal.

Ini limitation V0.1.

Backlog sudah mencatat kebutuhan:

```text
Resume Workspace Existence Check
```

---

# 56. Kasus Nyata 8 — Mencari Session dengan SQLite

Untuk pengguna yang mulai belajar database:

```powershell
sqlite3 -readonly ".playground-casr\casr.sqlite"
```

Lalu:

```sql
.headers on
.mode column
```

Lihat sessions:

```sql
SELECT
  id,
  title,
  workspace_path,
  updated_at
FROM sessions
ORDER BY updated_at DESC
LIMIT 10;
```

Keluar:

```text
.quit
```

Gunakan:

```text
-readonly
```

untuk eksplorasi.

---

# 57. Tabel Database CASR

MVP V0.1 punya tabel utama:

```text
sessions
native_sessions
schema_migrations
```

---

# 58. sessions

Menyimpan logical session CASR.

Contoh konsep:

```text
id
title
workspace
status
created
updated
```

---

# 59. native_sessions

Menyimpan binding ke native runtime.

Contoh:

```text
session_id
adapter
native_session_id
native_path
provider
model
metadata
```

---

# 60. schema_migrations

Menyimpan migration database yang sudah diterapkan.

Tujuannya supaya CASR tahu:

```text
schema database versi berapa
```

---

# 61. Apa Itu Migration?

Migration adalah perubahan struktur database yang terkontrol.

Misalnya:

```text
V1:
buat sessions

V2:
buat canonical_events

V3:
tambah execution_history
```

Saat ini MVP menggunakan migration awal:

```text
0001_initial.sql
```

---

# 62. Apa Itu Build?

Source code project ditulis TypeScript.

Build mengubahnya menjadi JavaScript yang bisa dijalankan Node.js.

Command:

```powershell
npm.cmd run build
```

Output masuk:

```text
dist/
```

---

# 63. Apa Itu TypeScript?

TypeScript adalah JavaScript dengan type checking.

Contoh:

```ts
function hello(name: string) {
  return `Hello ${name}`;
}
```

CASR menggunakan TypeScript supaya struktur data lebih aman dan mudah dijaga.

---

# 64. Apa Itu Test?

Test adalah kode otomatis untuk memastikan fitur bekerja.

Command:

```powershell
npm.cmd test
```

Pada akhir MVP V0.1:

```text
Test Files : 7 passed
Tests      : 19 passed
```

---

# 65. Apa Itu Lint?

Lint memeriksa kualitas/style kode.

Command:

```powershell
npm.cmd run lint
```

Misalnya menemukan:

```text
import tidak terurut
syntax style bermasalah
```

Project menggunakan:

```text
Biome
```

---

# 66. Apa Itu Format?

Format merapikan source code.

Command:

```powershell
npm.cmd run format
```

Contoh:

```text
indentasi
line wrapping
spacing
```

---

# 67. Quality Gate

Sebelum commit perubahan, biasakan:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Ideal:

```text
lint = PASS
tests = PASS
build = PASS
```

---

# 68. Apa Itu Git?

Git mencatat versi source code.

Command umum:

```powershell
git status
```

Melihat file berubah.

---

# 69. Apa Itu Commit?

Commit adalah checkpoint source code.

Contoh:

```powershell
git add .
git commit -m "feat: add something"
```

Jangan commit file eksperimen:

```text
.playground-casr
casr.sqlite
credentials
auth.json
```

---

# 70. Apa Itu Repository?

Repository adalah folder project yang dikelola Git.

Dalam kasus ini:

```text
casr-prototipe
```

berisi:

```text
source code
tests
docs
migrations
config
Git history
```

---

# 71. Struktur Folder Project

Secara sederhana:

```text
casr-prototipe/
├── concept/
├── docs/
├── migrations/
├── src/
├── tests/
├── BACKLOG.md
├── README.md
├── package.json
└── tsconfig.json
```

---

# 72. Folder src

`src` berisi source code utama.

```text
src/
├── adapters/
├── cli/
├── core/
└── storage/
```

---

# 73. adapters

Berisi integration dengan provider/native runtime.

Sekarang:

```text
adapters/codex
```

---

# 74. cli

Berisi command seperti:

```text
doctor
sync
sessions
inspect
resume
```

---

# 75. core

Berisi logika domain CASR yang sebisa mungkin provider-independent.

Artinya core seharusnya tidak tahu detail database internal Codex.

---

# 76. storage

Berisi database CASR, migration handling, repository.

---

# 77. tests

Berisi automated tests.

Jangan takut membuka folder ini.

Tests sering menjadi dokumentasi teknis terbaik untuk melihat expected behavior.

---

# 78. docs

Berisi checkpoint dokumentasi.

Contoh:

```text
cp-step1.md
cp-step2.md
cp-step3.md
cp-step4.md
cp-step5.md
cp-step6.md
MVP-v0.1-validation.md
```

---

# 79. concept

Berisi dokumen awal konsep dan planning.

Gunakan folder ini untuk memahami "kenapa project ini dibuat".

---

# 80. BACKLOG.md

Backlog berisi ide dan technical debt.

Penting:

```text
BACKLOG != fitur yang sudah ada
```

Jika sesuatu ada di backlog dengan status IDEA:

```text
belum tentu sudah diimplementasikan
```

---

# 81. README.md

README adalah ringkasan utama project.

Jika baru datang ke repo:

```text
baca README dulu
```

Kemudian:

```text
BABY.md
```

jika masih awam.

---

# 82. BABY.md Ini untuk Apa?

Dokumen ini sengaja lebih panjang daripada README.

README menjawab:

```text
"Apa project ini?"
```

BABY.md menjawab:

```text
"Saya benar-benar baru.
Tolong jelaskan semua istilah dan cara mencobanya."
```

---

# 83. Alur Belajar yang Disarankan

Untuk orang awam:

```text
1. baca bagian 1–20
2. jalankan doctor
3. buat playground
4. jalankan sync
5. jalankan sessions
6. inspect satu session
7. resume satu session
8. coba sync dua kali
9. baca SQLite setelah mulai nyaman
10. baru lihat source code
```

---

# 84. Demo 5 Menit

Masuk repo:

```powershell
cd C:\Users\yefta\casr-prototipe
```

Set playground:

```powershell
$env:CASR_HOME="$PWD\.playground-casr"
```

Doctor:

```powershell
npm.cmd run dev -- doctor
```

Sync:

```powershell
npm.cmd run dev -- sync
```

List:

```powershell
npm.cmd run dev -- sessions
```

Copy satu CASR ID.

Inspect:

```powershell
npm.cmd run dev -- inspect <casr-id>
```

Resume:

```powershell
npm.cmd run dev -- resume <casr-id>
```

Itu sudah cukup untuk memahami MVP V0.1.

---

# 85. Demo Idempotency

Jalankan:

```powershell
npm.cmd run dev -- sync
```

lagi.

Jika:

```text
Imported : 0
Unchanged : semua session
```

berarti registry bekerja sesuai desain.

---

# 86. Troubleshooting: npm Tidak Jalan

Cek:

```powershell
node --version
npm.cmd --version
```

Jika tidak ditemukan, Node.js mungkin belum terinstall atau PATH belum benar.

---

# 87. Troubleshooting: Codex Tidak Ditemukan

Cek:

```powershell
codex --version
```

Jika gagal:

```text
doctor
```

juga akan gagal mendeteksi Codex.

---

# 88. Troubleshooting: Tidak Ada Session

Jika:

```text
Discovered : 0
```

kemungkinan:

```text
Codex belum pernah membuat session
CODEX_HOME salah
storage native tidak ada
schema native berbeda
```

Jalankan:

```powershell
npm.cmd run dev -- doctor
```

---

# 89. Troubleshooting: CASR Database Aneh Saat Eksperimen

Jika kamu memakai playground:

```text
.playground-casr
```

hapus saja:

```powershell
Remove-Item .playground-casr -Recurse -Force
```

Lalu sync ulang.

Jangan lakukan ini ke registry utama jika datanya ingin dipertahankan.

---

# 90. Troubleshooting: Session Tidak Ditemukan

Mungkin CASR ID berasal dari registry lain.

Ingat:

```text
Registry A
dan
Registry B
```

bisa menghasilkan CASR ID berbeda untuk native session yang sama.

Lakukan:

```powershell
npm.cmd run dev -- sessions
```

dan ambil ID dari registry aktif.

---

# 91. Troubleshooting: Resume Membuka Session Tetapi Folder Salah

Pada MVP V0.1 final, original workspace seharusnya dipulihkan.

Cek:

```text
/status
```

Jika berbeda dari `inspect`, itu bug yang layak dilaporkan.

---

# 92. Troubleshooting: Workspace Tidak Ada

Jika folder asli sudah dihapus:

```text
resume
```

dapat gagal.

Ini limitation yang diketahui.

---

# 93. Bagaimana Mengetahui CASR_HOME Aktif?

PowerShell:

```powershell
$env:CASR_HOME
```

Jika kosong:

```text
CASR memakai default ~/.casr
```

Jika berisi:

```text
C:\...\playground
```

berarti playground aktif.

---

# 94. Bagaimana Kembali ke CASR_HOME Default?

```powershell
Remove-Item Env:CASR_HOME
```

Kemudian CASR kembali memakai:

```text
~/.casr
```

---

# 95. Apa yang Aman Dihapus?

Jika memang disposable:

```text
.playground-casr
.casr-lab-a
.casr-lab-b
dist
coverage
```

`dist` bisa dibuat ulang lewat build.

---

# 96. Apa yang Tidak Boleh Dihapus Sembarangan?

```text
src
tests
migrations
docs
concept
.git
package.json
package-lock.json
```

dan tentu:

```text
~/.codex
```

jika itu native Codex storage milikmu.

---

# 97. Prinsip Keamanan Paling Penting

Selalu ingat:

```text
CASR membaca native data.
CASR tidak mengambil ownership atas credential native.
```

Jangan pernah membuat fitur eksperimen yang:

```text
copy auth.json
copy tokens
commit secrets
upload credential
modify native rollout
modify native state DB
```

---

# 98. Apa yang Sudah Dibuktikan MVP V0.1?

Secara nyata:

```text
Codex sessions dapat ditemukan
↓
CASR dapat memberi logical ID sendiri
↓
CASR dapat menyimpan registry
↓
sync tidak duplicate
↓
session dapat dilihat
↓
session dapat di-inspect
↓
native session yang benar dapat di-resume
↓
workspace asli dapat dipulihkan
```

---

# 99. Apa yang Belum Dibuktikan?

Belum ada:

```text
canonical event history
lossless event import
token metrics
execution history
context compiler
retrieval
compaction
provider switching
Claude adapter
OpenCode adapter
GUI
cloud sync
```

Jangan menganggap fitur tersebut tersedia.

---

# 100. Kenapa Namanya "Canonical"?

Tujuan jangka panjang:

CASR ingin mempunyai representasi history yang menjadi sumber kebenaran miliknya sendiri.

Contoh masa depan:

```text
Codex history
      ↓
Canonical CASR history
      ↓
compile
      ↓
Codex / Claude / model lain
```

MVP V0.1 belum sampai di sini.

---

# 101. Konsep Jangka Panjang

Prinsip:

```text
Canonical(t+1)
=
Canonical(t)
+
NewRawEvents(t)
```

Artinya history asli ditambahkan.

Bukan dihancurkan.

---

# 102. Compaction Masa Depan

Jika nanti history terlalu panjang:

```text
raw history
```

tidak boleh dihapus hanya karena dibuat summary.

Ideal:

```text
Raw History
    ├── Snapshot
    ├── Summary
    └── Compacted View
```

Raw tetap ada.

---

# 103. Context Compiler Masa Depan

Masa depan CASR diharapkan bisa:

```text
Canonical History
        ↓
Context Compiler
        ↓
context sesuai target model
```

Misalnya model A punya context window berbeda dari model B.

Tetapi ini roadmap, bukan fitur V0.1.

---

# 104. Cara Membaca BACKLOG

Contoh:

```text
Status: IDEA
```

berarti:

```text
ide
belum disetujui untuk dibuat
```

`PLANNED` berarti lebih dekat ke implementation.

`DONE` berarti selesai.

---

# 105. Jangan Coding Semua Backlog

Kesalahan umum:

```text
lihat backlog
↓
implement semuanya
```

Jangan.

Backlog adalah tempat menyimpan ide.

Milestone menentukan apa yang benar-benar dikerjakan.

---

# 106. Cara Eksperimen yang Aman

Gunakan:

```powershell
$env:CASR_HOME="$PWD\.playground-casr"
```

Lalu bebas bereksperimen dengan:

```text
CASR registry
SQLite query
sync
list
inspect
resume
```

Tetapi native `.codex` tetap read-only.

---

# 107. Cara Melihat Status Git Sebelum Eksperimen

```powershell
git status
```

Ideal:

```text
working tree clean
```

Dengan begitu kamu tahu file mana yang berubah karena eksperimen.

---

# 108. Cara Melihat Perubahan Source

```powershell
git diff
```

Jika tidak sengaja mengubah source, Git membantu melihatnya.

---

# 109. Jangan Commit Database Playground

File seperti:

```text
.playground-casr/casr.sqlite
```

seharusnya tidak masuk Git.

Pastikan `.gitignore` melindungi local runtime files.

---

# 110. Istilah "Source of Truth"

Source of truth berarti:

```text
sumber data utama yang dianggap paling benar
```

V0.1:

```text
history source of truth
masih native Codex
```

CASR baru menjadi source of truth untuk:

```text
logical registry miliknya sendiri
```

Masa depan:

```text
canonical history source of truth
bisa menjadi CASR
```

---

# 111. Istilah "Provider-agnostic"

Provider-agnostic berarti desain tidak terikat satu provider.

Contoh buruk:

```text
core selalu menganggap semua session adalah Codex
```

Target:

```text
core mengenal konsep umum
adapter mengenal detail provider
```

---

# 112. Istilah "Provider-specific"

Provider-specific berarti detail hanya berlaku untuk provider tertentu.

Contoh:

```text
Codex rollout JSONL
state_5.sqlite
threads table
```

Ini adalah detail Codex.

Harus tetap berada di adapter boundary.

---

# 113. Istilah "Canonical Vocabulary"

Masa depan core sebaiknya mengenal:

```text
user_message
assistant_message
tool_call
tool_result
reasoning
usage
```

bukan langsung:

```text
event_msg
response_item
turn_context
```

karena nama tersebut bisa spesifik Codex.

---

# 114. Istilah "Binding"

Binding = hubungan.

```text
CASR session
    ↕
native session
```

---

# 115. Istilah "Runtime"

Runtime = lingkungan tempat agent benar-benar dijalankan.

Untuk MVP:

```text
Codex CLI
```

adalah native runtime.

---

# 116. Istilah "Orchestration"

Orchestration berarti CASR mengatur alur.

Contoh:

```text
CASR ID
↓
find binding
↓
find workspace
↓
launch Codex
```

CASR tidak mengerjakan reasoning AI.

CASR mengatur execution flow.

---

# 117. Istilah "Schema"

Schema adalah struktur data.

Contoh tabel:

```text
sessions
  id
  title
  workspace
```

Itu schema database.

---

# 118. Istilah "Normalized"

Normalized berarti data native diubah menjadi bentuk internal CASR yang lebih konsisten.

Contoh:

```text
Codex thread row
↓
NativeSession
```

---

# 119. Istilah "Append-only"

Append-only berarti:

```text
boleh menambah
tidak mengubah history lama secara destruktif
```

Ini akan penting pada canonical event store masa depan.

---

# 120. Istilah "Lossless"

Lossless berarti data asli tidak hilang.

Contoh target masa depan:

```text
native event
↓
canonical import
```

tidak boleh diam-diam kehilangan informasi penting.

---

# 121. Istilah "Derived"

Derived berarti hasil turunan.

Contoh masa depan:

```text
raw canonical history
↓
summary
```

Summary adalah derived artifact.

Raw history tetap sumber dasarnya.

---

# 122. Istilah "Adapter Boundary"

Boundary adalah batas tanggung jawab.

```text
Codex-specific stuff
        ↓
adapters/codex
-------- boundary --------
provider-neutral core
```

Ini salah satu prinsip arsitektur penting CASR.

---

# 123. Apa yang Harus Saya Pelajari Kalau Mau Ikut Ngoding?

Urutan:

```text
PowerShell dasar
Git dasar
Node.js dasar
TypeScript dasar
SQLite dasar
Commander dasar
Vitest dasar
```

Tidak perlu menguasai semuanya sebelum mulai.

---

# 124. File Pertama yang Enak Dibaca

Urutan rekomendasi:

```text
README.md
BABY.md
src/cli/program.ts
src/cli/commands/doctor.ts
src/cli/commands/sync.ts
src/cli/commands/sessions.ts
src/cli/commands/inspect.ts
src/cli/commands/resume.ts
```

Baru kemudian:

```text
adapters
storage
core
tests
```

---

# 125. Cara Mengetahui Command yang Tersedia

```powershell
npm.cmd run dev -- --help
```

Expected command:

```text
doctor
sync
sessions
inspect
resume
```

---

# 126. Cara Mengetahui Versi CASR CLI

```powershell
npm.cmd run dev -- --version
```

MVP saat ini:

```text
0.1.0
```

---

# 127. Contoh Sesi Belajar 15 Menit

Menit 1–3:

```text
doctor
```

Menit 4–6:

```text
sync
```

Menit 7–9:

```text
sessions
```

Menit 10–12:

```text
inspect
```

Menit 13–15:

```text
resume
/status
```

Selesai.

---

# 128. Contoh Sesi Belajar 30 Menit

Tambahkan:

```text
repeated sync
SQLite read-only exploration
git status
lihat source CLI
```

---

# 129. Kapan Harus Takut?

Berhenti jika kamu akan menjalankan sesuatu seperti:

```text
DELETE FROM native Codex database
UPDATE native Codex database
Remove-Item ~/.codex
copy auth.json
commit credentials
```

Itu bukan eksperimen CASR yang aman.

---

# 130. Kapan Tidak Perlu Takut?

Aman bereksperimen dengan:

```text
.playground-casr
CASR sync
sessions
inspect
resume
read-only SQLite queries
tests
lint
build
```

---

# 131. Checklist Pemula

Sebelum mulai:

```text
[ ] Node.js tersedia
[ ] npm tersedia
[ ] Codex CLI tersedia
[ ] repo sudah di-clone/download
[ ] npm install sudah dijalankan
```

Sebelum main:

```text
[ ] git status dicek
[ ] gunakan playground CASR_HOME
[ ] doctor PASS
```

Setelah main:

```text
[ ] hapus playground jika tidak diperlukan
[ ] Remove-Item Env:CASR_HOME
[ ] git status
```

---

# 132. Quick Reference

```powershell
# Masuk project
cd C:\Users\yefta\casr-prototipe

# Help
npm.cmd run dev -- --help

# Doctor
npm.cmd run dev -- doctor

# Playground
$env:CASR_HOME="$PWD\.playground-casr"

# Sync
npm.cmd run dev -- sync

# List sessions
npm.cmd run dev -- sessions

# Inspect
npm.cmd run dev -- inspect <casr-id>

# Resume
npm.cmd run dev -- resume <casr-id>

# Test
npm.cmd test

# Lint
npm.cmd run lint

# Build
npm.cmd run build

# Check active CASR_HOME
$env:CASR_HOME

# Return to default CASR_HOME
Remove-Item Env:CASR_HOME

# Git status
git status
```

---

# 133. Satu Kalimat untuk Mengingat CASR V0.1

Jika hanya mengingat satu kalimat:

> CASR V0.1 adalah registry lokal yang memberi identitas sendiri pada native Codex sessions, lalu membantu kita menemukan, memeriksa, dan membuka kembali session tersebut tanpa mengambil alih atau mengubah storage native Codex.

---

# 134. Final Mental Model

```text
               Native World
                   Codex
                     |
                     | read-only
                     v
              Codex Adapter
                     |
                     v
               CASR Registry
                     |
           +---------+---------+
           |         |         |
           v         v         v
        sessions   inspect   resume
                              |
                              v
                        Native Codex
                        session lama
```

---

# 135. Status Project Saat Dokumen Ini Dibuat

```text
MVP V0.1
COMPLETE
```

Validated capabilities:

```text
doctor
sync
sessions
inspect
resume
```

Next architecture phase belum perlu dipikirkan untuk memahami V0.1.

Untuk belajar, cukup kuasai:

```text
doctor
→ sync
→ sessions
→ inspect
→ resume
```

Itulah CASR MVP V0.1.
