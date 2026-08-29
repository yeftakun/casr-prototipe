# CASR MVP V0.1 Validation

**Project:** Canonical Agent Session Runtime (CASR)  
**Version:** MVP V0.1  
**Status:** PASS  
**Validation Date:** 2026-08-29  
**Platform:** Windows  
**Primary Agent:** OpenAI Codex CLI

---

## 1. Validated Flow

The complete MVP flow was successfully validated:

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

---

## 2. Environment

```text
Node.js   : v22.17.1
npm       : 10.9.2
Codex CLI : 0.150.1
Platform  : Windows
```

Default Codex home:

```text
C:\Users\yefta\.codex
```

---

## 3. Native Dataset

Native Codex sessions detected:

```text
76
```

CASR sessions synchronized:

```text
76
```

---

## 4. Doctor Validation

`casr doctor` successfully verified:

```text
Node runtime
Codex CLI
Codex version
CODEX_HOME
state_5.sqlite
sessions directory
read-only SQLite access
threads table
native session count
```

Result:

```text
PASS
```

---

## 5. Sync Validation

Initial registry import:

```text
Discovered : 76
Imported   : 76
Updated    : 0
Unchanged  : 0
```

Repeated sync:

```text
Discovered : 76
Imported   : 0
Updated    : 0
Unchanged  : 76
```

Result:

```text
No duplicates.
Sync is idempotent.
```

---

## 6. CASR Identity Validation

Validated CASR logical session:

```text
casr_01a04d48-c014-7469-9ed4-b36dcf9145ae
```

Mapped native Codex session:

```text
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

Result:

```text
CASR_SESSION_ID != NATIVE_SESSION_ID
```

CASR owns an independent logical identity while preserving a native binding.

---

## 7. Session Navigation Validation

`casr sessions` successfully listed:

```text
Total: 76
```

The session list included:

```text
CASR ID
Agent
Title
Workspace
Status
Updated
```

Result:

```text
PASS
```

---

## 8. Inspect Validation

`casr inspect <casr-id>` successfully resolved the selected CASR session to:

```text
Native Agent : codex
Native ID    : 01a04c15-f919-7c52-9b6a-0fa9ff4d3394
Provider     : openai
Model        : gpt-5.4-mini
Workspace    : \\?\C:\Users\yefta\agent
```

Native metadata was also available.

Result:

```text
PASS
```

---

## 9. Invalid Session Validation

Invalid inspect/resume session IDs return:

```text
Session not found
```

with:

```text
exit code 1
```

Result:

```text
PASS
```

---

## 10. Native Resume Validation

Command:

```text
casr resume <casr-id>
```

successfully launched:

```text
codex resume 01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

The correct historical Codex conversation was restored.

Verified session markers included:

```text
LOCAL-CODEX-SESSION-TEST
ACCOUNT-B-CONTINUATION
```

Result:

```text
PASS
```

---

## 11. Workspace Resume Validation

An initial validation discovered that Codex inherited the CASR CLI working directory.

This was fixed by launching Codex with the original session workspace.

Final Codex TUI:

```text
directory: ~\agent
```

Final `/status`:

```text
Directory:
~\agent

Session:
01a04c15-f919-7c52-9b6a-0fa9ff4d3394
```

Result:

```text
Correct native session.
Correct original workspace.
```

---

## 12. Native Process Result

After leaving the resumed Codex session:

```text
exit code = 0
```

Result:

```text
PASS
```

---

## 13. Quality Gate

Final lint:

```text
PASS
```

Final tests:

```text
Test Files : 7 passed
Tests      : 19 passed
```

Final build:

```text
PASS
```

---

## 14. Storage Boundary

Codex-owned storage:

```text
CODEX_HOME
READ ONLY
```

CASR-owned storage:

```text
CASR_HOME
READ / WRITE
```

CASR does not modify:

```text
state_5.sqlite
session_index.jsonl
rollout JSONL
auth.json
sandbox secrets
```

---

## 15. MVP Architecture Proven

```text
Codex Local Storage
        │
        │ READ ONLY
        ▼
   CodexAdapter
        │
        ▼
 NativeSession[]
        │
        ▼
     CASR Sync
        │
        ▼
   CASR Registry
    casr.sqlite
        │
        ├──────────────┐
        │              │
        ▼              ▼
 casr sessions    casr inspect
        │
        ▼
   CASR Session ID
        │
        ▼
   Native Binding
        │
        ▼
    casr resume
        │
        ▼
 Correct Codex Session
        +
 Correct Original Workspace
```

---

## 16. MVP V0.1 Conclusion

CASR MVP V0.1 successfully proves that CASR can:

```text
discover
normalize
register
identify
synchronize
list
inspect
and resume
```

native Codex sessions through an independent CASR logical session identity.

The native Codex session remains the execution target.

The CASR registry remains the local logical ownership layer.

Codex storage remains read-only.

---

# FINAL STATUS

```text
MVP V0.1 COMPLETE
VALIDATION: PASS
```

---

## Next Planned Version

```text
V0.2
Canonical Event Import
Token Metrics
Execution History
```

Development of V0.2 should begin only after the V0.1 checkpoint and validation documents are committed.
