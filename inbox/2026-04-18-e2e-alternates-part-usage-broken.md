---
name: E2E walkthrough — Alternates / Part Usage — 🔴 BROKEN
description: Frontend E2E findings for 'Alternates / Part Usage — 🔴 BROKEN' chunk from 2026-04-18 walkthrough. 2 E2E IDs; 3 🔴, 0 🟡, 0 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 3
  ux: 0
  idea: 0
  works: 0
  e2e_ids: 2
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Alternates / Part Usage — 🔴 BROKEN

- **E2E-312 🔴 BUG (CRITICAL)** — `/projects/30/part_alternates` shows "Failed to load alternates data". Console: 401 Unauthorized on `/api/parts/browse/alternates`.
- **E2E-313 🔴 BUG (CRITICAL)** — `/projects/30/part_usage` shows "Failed to load usage data". Console: 401 Unauthorized + "[API Query Error] Failed to fetch usage summary".
- **Root cause:** `/api/parts/browse/alternates` and `/api/parts/browse/usage` endpoints are not registered as public in `server/request-routing.ts:PUBLIC_API_PATHS` AND/OR auth tier doesn't permit them. Same class of bug I fixed for `/api/vault/` last session.
- **Fix:** Either add `/api/parts/browse/` to PUBLIC_API_PATHS or scope-down requireProjectOwnership to allow self-owned reads.


---

