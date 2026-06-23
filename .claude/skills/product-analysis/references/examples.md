# Examples Reference

Real examples showing what the product analysis deliverables look like for different project types. Read this when you need to understand the expected format, depth, or style of the report and checklist.

---

## Example 1: React SaaS Dashboard (WebApp)

### detect-project.sh Output

```json
{
  "project_name": "taskflow",
  "tech_stack": "React 19.0.0 + Next.js + Prisma + PostgreSQL + Tailwind + Vitest",
  "domain": "WebApp",
  "project_root": "/home/user/Projects/TaskFlow",
  "key_files": [
    "src/app/layout.tsx",
    "src/app/dashboard/page.tsx",
    "prisma/schema.prisma",
    "src/lib/api.ts",
    "src/components/task-board.tsx"
  ],
  "competitors": ["Linear", "Asana", "Jira", "Notion", "Vercel Dashboard"],
  "personas": ["End user (non-technical)", "Power user", "Administrator"],
  "date": "2026-02-28",
  "baseline": { "loc": 42300, "files": 187, "languages": "TypeScript, CSS, JSON" }
}
```

### Sample Report Sections

#### Phase 1 — Current State Inventory (excerpt)

```markdown
## Phase 1 — Current State Inventory

### Feature Map

| Category | Feature | Status | Entry Point |
|----------|---------|--------|-------------|
| Task Management | Create/edit tasks | Complete | `src/components/task-form.tsx` |
| Task Management | Drag-and-drop board | Complete | `src/components/task-board.tsx` |
| Task Management | Subtasks | Partial | Only 1 level deep, no progress tracking |
| Collaboration | Real-time updates | Missing | No WebSocket/SSE implementation |
| Collaboration | Comments | Complete | `src/components/comments.tsx` |
| Collaboration | @mentions | Missing | — |
| Views | Kanban board | Complete | `src/app/dashboard/page.tsx` |
| Views | List view | Complete | `src/app/list/page.tsx` |
| Views | Calendar view | Missing | — |
| Views | Timeline/Gantt | Missing | — |

### Developer Intent Signals

```
$ rg 'TODO|FIXME|HACK|XXX' src/ --stats
45 matches in 23 files

Top findings:
- TODO: Add real-time sync (task-board.tsx:142)
- FIXME: Race condition in optimistic update (api.ts:67)
- TODO: Implement role-based permissions (middleware.ts:23)
- HACK: Hardcoded team ID for demo (dashboard/page.tsx:15)
```

### Integration Points

| Integration | Type | Status |
|-------------|------|--------|
| GitHub | OAuth + issue sync | Complete |
| Slack | Webhook notifications | Partial (outbound only) |
| Google Calendar | 2-way sync | Missing |
| Zapier/webhooks | Generic automation | Missing |
```

#### Phase 2 — Competitive Gap Analysis (excerpt)

```markdown
## Phase 2 — Competitive Gap Analysis

### Feature Comparison Matrix

| Feature | TaskFlow | Linear | Asana | Jira |
|---------|----------|--------|-------|------|
| Keyboard shortcuts | 5 shortcuts | 40+ (vim-style) | 15+ | 20+ |
| Bulk operations | None | Select + action | Multi-select | Bulk change |
| Custom fields | None | Yes | Yes | Yes (extensive) |
| Workflow automation | None | Auto-archive, auto-assign | Rules engine | Automation rules |
| Mobile app | None | iOS + Android | iOS + Android | iOS + Android |
| API access | REST only | GraphQL + REST | REST | REST + GraphQL |
| Search | Basic filter | Fuzzy + boolean | Basic + saved | JQL (powerful) |

### Gap Classification

| Gap ID | Feature | Classification | Competitor Reference | Impact |
|--------|---------|---------------|---------------------|--------|
| FG-01 | Keyboard navigation | Weak | Linear has full vim-mode | High — power users leave |
| FG-02 | Custom fields | Missing | All 3 competitors have it | Critical — blocks enterprise |
| FG-03 | Workflow automation | Missing | Linear auto-archive is beloved | High — manual repetitive work |
| FG-04 | Mobile app | Missing | All 3 have native apps | Medium — usage context dependent |
| FG-05 | Calendar view | Missing | Asana calendar is a top feature | Medium — visual planning |
```

#### Phase 4 — Technical Debt (excerpt)

```markdown
## Phase 4 — Technical Debt & Architecture

### Complexity Hotspots

```
$ lizard src/ -T nloc=60 -T cyclomatic_complexity=10

================================================
  NLOC  CCN  Token  PARAM  Length  Location
------------------------------------------------
   142   23   891     4     168    handleTaskDrop@src/components/task-board.tsx:45
    98   18   567     6     112    syncWithGitHub@src/lib/integrations/github.ts:23
    87   15   445     3      95    processAutomation@src/lib/automation.ts:78
    76   14   398     5      88    renderFilters@src/components/filter-panel.tsx:12
    63   12   312     2      71    migrateSchema@prisma/migrations/runner.ts:34
================================================
5 functions with complexity >= 10

Average complexity: 4.2 (project-wide)
Median complexity: 2.0
Max complexity: 23 (handleTaskDrop)
```

### Codebase Statistics

```
$ scc src/
───────────────────────────────────────────────
Language         Files    Lines     Code  Comments
───────────────────────────────────────────────
TypeScript         134    38200    31400      2100
CSS                 23     3200     2800       120
JSON                15      780      780         0
Markdown             8      420      340        80
Shell                7      110       85        25
───────────────────────────────────────────────
Total              187    42710    35405      2325
───────────────────────────────────────────────
Estimated Cost to Develop: $1,042,318 (COCOMO)
```

### Test Coverage

```
$ fd -g '*test*' -g '*spec*' --type f | wc -l
12

Test files / Source files ratio: 12/134 = 8.9% (target: >30%)
```

### Checklist Items from Phase 4

- TD-01: Refactor `handleTaskDrop` (CCN=23) — split into drag validation, position calculation, and state update | Effort: M | Priority: P1
- TD-02: Extract GitHub sync into queue-based worker — current implementation blocks request thread | Effort: L | Priority: P1
- TD-03: Add integration test suite — only 12 test files for 134 source files | Effort: L | Priority: P0
- TD-04: Replace hardcoded team ID with proper multi-tenancy | Effort: XL | Priority: P0
- TD-05: Add error boundaries around each dashboard panel | Effort: S | Priority: P2
```

### Sample Checklist Items

```markdown
## Feature Gaps (from Phase 2)

- [ ] FG-01: Add comprehensive keyboard shortcuts (vim-inspired navigation, `j/k` for up/down, `e` to edit, `/` to search) | Effort: M | Priority: P1
- [ ] FG-02: Implement custom fields system (text, number, date, select, multi-select per workspace) | Effort: XL | Priority: P0
- [ ] FG-03: Add workflow automation engine (trigger → condition → action, starting with auto-archive and auto-assign) | Effort: XL | Priority: P1
- [ ] FG-04: Build progressive web app with offline support | Effort: L | Priority: P2
- [ ] FG-05: Add calendar view using FullCalendar or custom date grid | Effort: M | Priority: P2

## UX Issues (from Phase 3)

- [ ] UI-01: Task creation requires 4 clicks minimum — add `Ctrl+N` global shortcut with inline creation | Effort: S | Priority: P1
- [ ] UI-02: No loading skeletons — blank screen during data fetch feels broken | Effort: S | Priority: P1
- [ ] UI-03: Filter panel resets on navigation — persist filter state in URL params | Effort: S | Priority: P2
- [ ] UI-04: No onboarding flow — new users see empty board with no guidance | Effort: M | Priority: P1

## Technical Debt (from Phase 4)

- [ ] TD-01: Refactor handleTaskDrop (CCN=23) into composable functions | Effort: M | Priority: P1
- [ ] TD-02: Extract GitHub sync to background worker queue | Effort: L | Priority: P1
- [ ] TD-03: Achieve 30%+ test coverage (currently 8.9%) | Effort: L | Priority: P0

## Innovation (from Phase 5)

- [ ] IN-01: AI-powered task decomposition ("break this into subtasks") | Effort: L | Priority: P2
- [ ] IN-02: Natural language task creation ("remind me to review PR #42 tomorrow") | Effort: M | Priority: P2
- [ ] IN-03: Smart task prioritization using urgency + impact + dependency graph | Effort: XL | Priority: P3
```

---

## Example 2: Rust CLI Tool

### detect-project.sh Output

```json
{
  "project_name": "logslice",
  "tech_stack": "Rust + Tokio + clap",
  "domain": "CLI",
  "project_root": "/home/user/Projects/logslice",
  "key_files": [
    "src/main.rs",
    "src/lib.rs",
    "src/parser.rs",
    "src/filter.rs",
    "Cargo.toml"
  ],
  "competitors": ["ripgrep", "lnav", "goaccess", "jq"],
  "personas": ["Casual user", "Daily power user", "CI/CD pipeline (automated)"],
  "date": "2026-02-28",
  "baseline": { "loc": 8200, "files": 24, "languages": "Rust, TOML, Markdown" }
}
```

### Sample Report Sections

#### Phase 1 — Current State (excerpt)

```markdown
### CLI Interface Analysis

```
$ logslice --help
logslice 0.3.1 — Fast structured log filtering and slicing

Usage: logslice [OPTIONS] <FILE>

Arguments:
  <FILE>  Log file to process (or - for stdin)

Options:
  -f, --format <FMT>    Log format (json, logfmt, clf) [default: auto]
  -q, --query <EXPR>    Filter expression (e.g., level=error AND service=api)
  -t, --time <RANGE>    Time range filter (e.g., "1h", "2024-01-01..now")
  -o, --output <FMT>    Output format (text, json, csv, table) [default: text]
      --stats           Show summary statistics
  -h, --help            Print help
  -V, --version         Print version
```

### Feature completeness vs competitors

| Feature | logslice | ripgrep | lnav | jq |
|---------|----------|---------|------|----|
| JSON log parsing | Yes | No (text only) | Yes | Yes |
| Time range filter | Yes | No | Yes | Manual |
| Live tail (follow) | No | No | Yes | No |
| Colorized output | Partial | Yes | Yes | No |
| Regex support | Basic | Full (PCRE2) | Full | No |
| Compressed files | No | Yes (.gz) | Yes | No |
| Multi-file | No | Yes | Yes | No |
```

#### Phase 4 — Technical Debt (excerpt)

```markdown
### Complexity Analysis

```
$ lizard src/ -T cyclomatic_complexity=8

================================================
  NLOC  CCN  Token  PARAM  Length  Location
------------------------------------------------
    67   14   334     3      78    parse_logfmt@src/parser.rs:45
    54   12   267     2      62    evaluate_filter@src/filter.rs:89
    43   11   198     4      51    detect_format@src/parser.rs:123
================================================
3 functions with complexity >= 8
```

### Codebase Statistics

```
$ scc src/
───────────────────────────────────────────────
Language     Files    Lines     Code  Comments
───────────────────────────────────────────────
Rust            18     7400     6200       580
TOML             3      120      100        20
Markdown         3      680      540       140
───────────────────────────────────────────────
Total           24     8200     6840       740
───────────────────────────────────────────────
```

### Checklist Items

- TD-01: Refactor `parse_logfmt` (CCN=14) — extract field tokenizer and value coercion into separate functions | Effort: M | Priority: P1
- TD-02: No benchmark suite — add `criterion` benchmarks for parser hot paths | Effort: M | Priority: P2
- TD-03: Error messages use `unwrap()` in 12 places — replace with proper `anyhow` context | Effort: S | Priority: P1
- FG-01: Add compressed file support (.gz, .zstd) — ripgrep users expect this | Effort: M | Priority: P1
- FG-02: Add multi-file support with filename prefixing | Effort: M | Priority: P1
- FG-03: Add `--follow` mode for live log tailing | Effort: L | Priority: P2
- UI-01: No shell completions — add `clap_complete` generation for bash/zsh/fish | Effort: S | Priority: P1
- UI-02: Error output goes to stdout, not stderr — breaks piping | Effort: S | Priority: P0
- IN-01: AI-powered log pattern detection ("find anomalies in this log") | Effort: XL | Priority: P3
- IN-02: TUI mode with interactive filtering (using `ratatui`) | Effort: L | Priority: P2
```

---

## Example 3: Python FastAPI Service

### detect-project.sh Output

```json
{
  "project_name": "invoicely-api",
  "tech_stack": "Python + FastAPI + SQLAlchemy + PostgreSQL",
  "domain": "API",
  "project_root": "/home/user/Projects/invoicely-api",
  "key_files": [
    "app/main.py",
    "app/routers/invoices.py",
    "app/models/invoice.py",
    "app/schemas/invoice.py",
    "alembic/versions/"
  ],
  "competitors": ["Stripe Invoicing API", "FreshBooks API", "QuickBooks API"],
  "personas": [
    "Frontend developer (consumer)",
    "DevOps engineer",
    "API product manager"
  ],
  "date": "2026-02-28",
  "baseline": { "loc": 15600, "files": 62, "languages": "Python, YAML, SQL, Markdown" }
}
```

### Sample Report Sections

#### Phase 2 — Competitive Gap Analysis (excerpt)

```markdown
### API Design Comparison

| Aspect | invoicely-api | Stripe | FreshBooks |
|--------|--------------|--------|------------|
| Authentication | API key (header) | API key + OAuth | OAuth 2.0 |
| Versioning | None | URL path (v1/) | Header-based |
| Pagination | offset/limit | cursor-based | page/per_page |
| Idempotency | None | Idempotency-Key header | None |
| Webhooks | None | 200+ event types | 15 event types |
| Rate limiting | None | 100/sec with headers | 300/min |
| SDKs | None | 7 languages | 3 languages |
| Sandbox | None | Test mode with test keys | Sandbox env |

### Gap Classification

- FG-01: No API versioning strategy — breaking changes will alienate consumers | Effort: M | Priority: P0
- FG-02: No idempotency support — duplicate charges are a billing liability | Effort: M | Priority: P0
- FG-03: No webhook system — consumers can't react to invoice events | Effort: L | Priority: P1
- FG-04: No rate limiting — vulnerable to abuse and accidental DoS | Effort: S | Priority: P0
- FG-05: No SDK generation — consumers write raw HTTP calls | Effort: L | Priority: P2
```

#### Phase 4 — Technical Debt (excerpt)

```markdown
### Complexity Analysis

```
$ lizard app/ -T cyclomatic_complexity=8

================================================
  NLOC  CCN  Token  PARAM  Length  Location
------------------------------------------------
    89   16   423     5     102    create_invoice@app/routers/invoices.py:34
    67   13   312     4      78    calculate_tax@app/services/tax.py:12
    54   11   267     3      62    generate_pdf@app/services/pdf.py:45
    45    9   198     2      52    process_payment@app/services/payment.py:23
================================================
4 functions with complexity >= 8
```

### Security Audit

```
$ rg 'eval|exec|__import__|pickle\.loads|subprocess\.call' app/ --stats
0 matches — no obvious code injection vectors

$ rg 'secret|password|token|key' app/ -i --stats
14 matches in 6 files

Findings:
- app/config.py:12 — SECRET_KEY loaded from env (correct)
- app/config.py:15 — DB password loaded from env (correct)
- app/routers/auth.py:34 — API key compared with `==` (VULNERABLE to timing attack, use `hmac.compare_digest`)
- app/tests/conftest.py:8 — Hardcoded test API key (acceptable for tests)
```

### Checklist Items

- TD-01: Fix timing attack in API key comparison (`==` → `hmac.compare_digest`) | Effort: S | Priority: P0
- TD-02: Refactor `create_invoice` (CCN=16) — extract validation, tax calculation, and PDF generation | Effort: M | Priority: P1
- TD-03: Add Alembic migration tests — no verification that migrations are reversible | Effort: M | Priority: P2
- TD-04: Add request validation middleware for consistent error responses | Effort: S | Priority: P1
- FG-01: Implement API versioning (URL path recommended for this use case) | Effort: M | Priority: P0
- FG-02: Add Idempotency-Key header support for payment endpoints | Effort: M | Priority: P0
- FG-04: Add rate limiting middleware (token bucket, return X-RateLimit headers) | Effort: S | Priority: P0
- UI-01: API error messages are inconsistent — standardize on RFC 7807 Problem Details | Effort: M | Priority: P1
- IN-01: Auto-generate OpenAPI SDK clients via `openapi-generator` | Effort: M | Priority: P2
- IN-02: AI-powered invoice categorization and anomaly detection | Effort: L | Priority: P3
```

---

## Executive Summary Example

For reference, here's what a completed Executive Summary section looks like:

```markdown
## Executive Summary

**TaskFlow** is a React/Next.js task management SaaS with solid foundations (clean
component architecture, type-safe API layer, GitHub integration) but significant gaps
that limit its competitive position against Linear, Asana, and Jira.

### Key Findings

1. **Critical gaps**: No custom fields (blocks enterprise adoption), no workflow automation
   (users do repetitive work manually), no mobile experience (limits usage contexts)
2. **Strongest asset**: Clean TypeScript architecture with 4.2 average complexity — the
   codebase is healthy enough to support rapid feature development
3. **Biggest risk**: 8.9% test coverage. Any major refactor or feature addition is
   high-risk without tests. This is the single highest-priority item.
4. **Quick wins**: Keyboard shortcuts (M), loading skeletons (S), and filter persistence (S)
   would immediately improve perceived quality at low cost
5. **Innovation opportunity**: AI-powered task decomposition would differentiate from all
   competitors — none offer it today

### Priority Matrix

| Priority | Count | Examples |
|----------|-------|---------|
| P0 (Critical) | 4 | Test coverage, multi-tenancy, custom fields |
| P1 (High) | 9 | Keyboard shortcuts, automation, complexity refactors |
| P2 (Medium) | 6 | Calendar view, mobile PWA, loading states |
| P3 (Future) | 3 | AI features, smart prioritization |

### Recommended First Sprint

1. TD-03: Test infrastructure (P0, L) — foundation for everything else
2. TD-04: Fix hardcoded team ID (P0, XL) — blocks multi-tenancy
3. UI-01: Keyboard shortcut `Ctrl+N` for task creation (P1, S) — immediate UX win
4. UI-02: Loading skeletons (P1, S) — perceived performance improvement
```

---

## Format Reference

### Checklist Item Format

Every checklist item follows this pattern:
```
- [ ] ID-NN: Description of what to do | Effort: S/M/L/XL | Priority: P0/P1/P2/P3
```

**ID prefixes:**
- `FG-` — Feature Gap (from Phase 2 competitive analysis)
- `UI-` — UX Issue (from Phase 3 workflow evaluation)
- `TD-` — Technical Debt (from Phase 4 architecture audit)
- `EN-` — Enhancement (from Phase 1 current state, improvements to existing features)
- `IN-` — Innovation (from Phase 5 novel feature proposals)

**Effort scale:**
- `S` — Small: < 1 day, single file, low risk
- `M` — Medium: 1-3 days, few files, moderate risk
- `L` — Large: 1-2 weeks, multiple files/systems, requires planning
- `XL` — Extra Large: 2+ weeks, architectural change, high risk

**Priority scale:**
- `P0` — Critical: Security vulnerability, data loss risk, blocks core functionality
- `P1` — High: Significant user impact, competitive disadvantage, should be next sprint
- `P2` — Medium: Noticeable improvement, plan for this quarter
- `P3` — Future: Nice to have, innovation/exploration, backlog

### Report Section Pattern

Each phase section should include:
1. **Narrative summary** (2-3 paragraphs explaining findings)
2. **Evidence table** (data from CLI tools)
3. **Raw tool output** (in fenced code blocks with the command that produced it)
4. **Checklist items** (actionable items generated from findings)
