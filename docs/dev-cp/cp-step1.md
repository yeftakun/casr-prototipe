# CASR Development Checkpoint

## CP-STEP1 — Bootstrap CLI

**Project:** Canonical Agent Session Runtime (CASR)
**Stage:** MVP V0.1
**Checkpoint:** Step 1 — Project Bootstrap
**Environment:** Windows PowerShell

---

## 1. Objective

Checkpoint ini bertujuan membangun fondasi minimum project CASR tanpa mengakses atau memodifikasi storage native Codex.

Target utama:

* menyiapkan environment development;
* menginisialisasi project Node.js + TypeScript;
* menyiapkan CLI dasar;
* menyiapkan testing;
* menyiapkan formatter dan linter;
* memastikan project dapat di-build;
* menjaga `CODEX_HOME` tetap tidak tersentuh.

Pada checkpoint ini belum ada implementasi:

* Codex discovery;
* SQLite registry CASR;
* `casr doctor`;
* `casr sync`;
* session parsing;
* session resume.

---

# 2. Environment Validation

Environment awal yang digunakan:

```text
Node.js     : v22.17.1
npm         : 10.9.2
Git         : 2.51.1.windows.1
Codex CLI   : 0.150.1
```

Working directory:

```text
C:\Users\yefta\casr-prototipe
```

Repository Git sudah tersedia sebelum bootstrap.

---

# 3. Existing Project Structure

Sebelum implementasi dimulai:

```text
casr-prototipe/
├── .git/
└── concept/
```

Folder `concept/` menyimpan dokumen perencanaan utama CASR.

Dokumen tersebut dipertahankan sebagai bagian dari repository.

---

# 4. Runtime Dependencies

Runtime dependency yang dipasang:

```text
commander
better-sqlite3
zod
uuid
```

Versi pada saat checkpoint:

```text
better-sqlite3  13.0.3
commander       15.0.0
uuid            14.0.2
zod             4.5.2
```

---

# 5. Development Dependencies

Development dependency:

```text
typescript
tsx
vitest
@types/node
@types/better-sqlite3
@biomejs/biome
```

Versi saat checkpoint:

```text
@biomejs/biome       2.5.11
@types/better-sqlite3 9.6.0
@types/node           26.4.0
tsx                   4.23.12
typescript            7.0.2
vitest                4.1.11
```

---

# 6. Node Project Configuration

Project menggunakan:

```text
Node.js >= 22.12.0
ES Modules
TypeScript
```

Konfigurasi penting pada `package.json`:

```json
{
  "type": "module",
  "private": true,
  "engines": {
    "node": ">=22.12.0"
  }
}
```

CLI binary diarahkan ke:

```text
./dist/cli/index.js
```

Dengan nama executable:

```text
casr
```

---

# 7. NPM Scripts

Script development yang tersedia:

```text
dev
build
test
test:watch
lint
format
```

Fungsi:

```text
dev        -> menjalankan CLI TypeScript menggunakan tsx
build      -> compile TypeScript dengan tsc
test       -> menjalankan Vitest
test:watch -> menjalankan Vitest watch mode
lint       -> menjalankan Biome check
format     -> menjalankan Biome formatter
```

---

# 8. PowerShell npm Issue

Saat menjalankan:

```powershell
npm run dev -- --help
```

PowerShell menampilkan help milik npm dan tidak meneruskan argument ke script.

Workaround yang berhasil:

```powershell
npm.cmd run dev -- --help
```

Alternatif yang juga berhasil:

```powershell
npx tsx src/cli/index.ts --help
```

dan:

```powershell
.\node_modules\.bin\tsx.cmd src\cli\index.ts --help
```

Untuk development CASR menggunakan Windows PowerShell, command `npm.cmd` digunakan ketika menjalankan npm scripts jika forwarding argument diperlukan.

---

# 9. TypeScript Configuration

TypeScript hanya membangun source code di:

```text
src/
```

Configuration:

```text
rootDir : src
outDir  : dist
```

Tests tidak dimasukkan ke build production.

Struktur hasil build:

```text
dist/
└── cli/
    ├── index.js
    ├── index.js.map
    ├── program.js
    └── program.js.map
```

---

# 10. CLI Architecture

CLI awal dipisahkan menjadi dua bagian.

```text
src/
└── cli/
    ├── index.ts
    └── program.ts
```

`program.ts` bertanggung jawab membuat Commander program.

`index.ts` menjadi executable entrypoint.

Pemisahan ini memungkinkan konfigurasi CLI diuji tanpa menjalankan process CLI secara langsung.

---

# 11. Current CLI

CLI saat ini memiliki identity:

```text
Name        : casr
Description : Canonical Agent Session Runtime
Version     : 0.1.0
```

Output:

```text
Usage: casr [options]

Canonical Agent Session Runtime

Options:
  -V, --version  output the version number
  -h, --help     display help for command
```

Belum ada subcommand.

---

# 12. Testing

Testing menggunakan:

```text
Vitest
```

Test awal memverifikasi:

```text
CLI name
CLI description
CLI version
```

Test file:

```text
tests/cli.test.ts
```

Hasil terakhir:

```text
Test Files  1 passed (1)
Tests       1 passed (1)
```

---

# 13. Duplicate Test Issue

Pada konfigurasi TypeScript awal, folder `tests/` ikut dikompilasi ke `dist/`.

Akibatnya Vitest menjalankan:

```text
tests/cli.test.ts
dist/tests/cli.test.js
```

sehingga test terlihat berjalan dua kali.

Solusi:

```text
rootDir = src
include = src/**/*.ts
exclude = tests
```

Setelah perubahan:

```text
Test Files 1 passed
Tests      1 passed
```

---

# 14. Biome

Formatter dan linter menggunakan:

```text
Biome 2.5.11
```

Pada konfigurasi awal ditemukan dua masalah:

1. schema menggunakan versi `2.5.0`;
2. konfigurasi `recommended` sudah deprecated.

Konfigurasi diperbaiki melalui:

```powershell
npx biome migrate --write
```

Kemudian source diformat dengan:

```powershell
npm.cmd run format
```

Hasil lint terakhir:

```text
Checked 6 files.
No fixes applied.
```

---

# 15. Build Validation

Build dijalankan menggunakan:

```powershell
npm.cmd run build
```

Result:

```text
SUCCESS
```

Tidak terdapat TypeScript compilation error.

---

# 16. Final Validation

Validation terakhir pada checkpoint ini:

## Tests

```text
PASS

Test Files : 1 passed
Tests      : 1 passed
```

## Build

```text
PASS
```

## Lint

```text
PASS

No fixes applied.
```

## CLI

```text
PASS
```

Command:

```powershell
npm.cmd run dev -- --help
```

menghasilkan help CASR dengan benar.

---

# 17. Security Boundary

Checkpoint ini belum membaca:

```text
~/.codex
state_5.sqlite
session_index.jsonl
rollout JSONL
auth.json
```

Tidak ada file milik Codex yang dimodifikasi.

Rule yang tetap berlaku:

```text
CODEX_HOME = READ ONLY
```

sampai ada keputusan eksplisit lain pada tahap pengembangan berikutnya.

---

# 18. Current Project Structure

Setelah checkpoint:

```text
casr-prototipe/
├── .git/
├── concept/
├── docs/
│   └── cp-step1.md
├── src/
│   └── cli/
│       ├── index.ts
│       └── program.ts
├── tests/
│   └── cli.test.ts
├── migrations/
├── biome.json
├── package.json
├── package-lock.json
├── tsconfig.json
└── .gitignore
```

Generated directories seperti berikut tidak disimpan ke Git:

```text
node_modules/
dist/
```

---

# 19. Checkpoint Acceptance

Status:

```text
[PASS] Node environment validated
[PASS] npm project initialized
[PASS] TypeScript configured
[PASS] ESM configured
[PASS] Commander CLI initialized
[PASS] CLI --help works
[PASS] Vitest configured
[PASS] Initial test passes
[PASS] TypeScript build succeeds
[PASS] Biome formatter configured
[PASS] Biome lint passes
[PASS] Build output structure corrected
[PASS] Codex storage untouched
```

---

# 20. Result

**CP-STEP1 COMPLETE**

CASR sekarang memiliki bootstrap CLI minimum yang:

```text
buildable
testable
linted
ESM-based
TypeScript-based
CLI-ready
```

Belum ada business logic terkait session.

---

# 21. Next Checkpoint

Checkpoint berikutnya:

```text
CP-STEP2
CASR Doctor
```

Target awal:

```text
casr doctor
```

akan melakukan environment diagnostics terhadap:

```text
Node runtime
Codex executable
Codex version
CODEX_HOME
state_5.sqlite
sessions directory
threads table
```

Semua akses terhadap native Codex storage tetap read-only.
