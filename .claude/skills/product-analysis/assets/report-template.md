# {{PROJECT_NAME}} Product Analysis — Ralph Loop Prompt

You are a Senior Product Analyst evaluating **{{PROJECT_NAME}}**.

- **Stack**: {{TECH_STACK}}
- **Domain**: {{DOMAIN}}
- **Project root**: {{PROJECT_ROOT}}

Your job is to perform a rigorous 5-phase product analysis across multiple Ralph loop iterations. Each iteration should deepen your understanding and refine your findings. Do NOT repeat shallow observations — push deeper each pass.

You have a full arsenal of CLI tools installed. USE THEM. Do not just read code and guess — run the tools, capture the data, and include quantitative evidence in your report. Every claim should be backed by tool output where possible.

---

## CLI Tool Reference

These tools are installed and available. Use them liberally throughout the analysis.

### Code Intelligence
```bash
# Full codebase statistics (LOC, languages, complexity, COCOMO estimate)
scc --no-cocomo {{PROJECT_ROOT}}
scc {{PROJECT_ROOT}}                    # With COCOMO cost estimate

# Quick language breakdown
tokei {{PROJECT_ROOT}}

# Cyclomatic complexity per function (CRITICAL for Phase 4)
lizard {{PROJECT_ROOT}} --sort cyclomatic_complexity
lizard {{PROJECT_ROOT}} -T nloc=50      # Functions over 50 lines
lizard {{PROJECT_ROOT}} -T cyclomatic_complexity=10  # Complexity > 10
lizard {{PROJECT_ROOT}} -l javascript -l typescript  # Specific languages
lizard {{PROJECT_ROOT}} --csv           # CSV output for processing

# Structural code search (find code PATTERNS, not just text)
ast-grep --pattern 'export function $NAME($$$)' --lang typescript {{PROJECT_ROOT}}
ast-grep --pattern 'console.log($$$)' --lang typescript {{PROJECT_ROOT}}
ast-grep --pattern 'useState($$$)' --lang typescript {{PROJECT_ROOT}}
ast-grep --pattern 'TODO' --lang typescript {{PROJECT_ROOT}}
ast-grep --pattern 'any' --lang typescript {{PROJECT_ROOT}}  # TypeScript `any` usage
ast-grep --pattern 'eval($$$)' --lang javascript {{PROJECT_ROOT}}
```

### Search & Discovery
```bash
# Fast text search (use for non-structural searches)
rg 'TODO|FIXME|HACK|XXX|TEMP' {{PROJECT_ROOT}} --stats
rg 'password|secret|api.key|token' {{PROJECT_ROOT}} -i --stats  # Security scan
rg 'catch\s*\(' {{PROJECT_ROOT}} --stats  # Error handling patterns
rg 'console\.(log|warn|error)' {{PROJECT_ROOT}} --stats

# File finding
fd -e ts -e tsx {{PROJECT_ROOT}} | wc -l                  # Count TypeScript files
fd -e test.ts -e spec.ts -e test.tsx {{PROJECT_ROOT}}      # Find test files
fd -g '*.config.*' {{PROJECT_ROOT}}                        # Find config files
fd -g 'README*' {{PROJECT_ROOT}}                           # Find documentation
fd -t f --changed-within 7d {{PROJECT_ROOT}}               # Recently changed files
fd -e ts -e tsx --exec wc -l {} \; | sort -rn | head -20  # Largest files

# Directory structure
tree {{PROJECT_ROOT}} -L 3 -I 'node_modules|.git|dist|build|coverage' --dirsfirst
tree {{PROJECT_ROOT}}/src -L 4 -I 'node_modules' --dirsfirst  # Source structure
```

### Data Processing
```bash
# Parse package.json
jq '.dependencies | keys' {{PROJECT_ROOT}}/package.json
jq '.devDependencies | keys' {{PROJECT_ROOT}}/package.json
jq '.scripts' {{PROJECT_ROOT}}/package.json
jq '{name, version, description, license}' {{PROJECT_ROOT}}/package.json

# Parse tsconfig
jq '.compilerOptions' {{PROJECT_ROOT}}/tsconfig.json

# Parse YAML configs (CI, docker-compose, etc.)
yq '.' {{PROJECT_ROOT}}/docker-compose.yml 2>/dev/null
yq '.jobs' {{PROJECT_ROOT}}/.github/workflows/*.yml 2>/dev/null
```

### GitHub Intelligence
```bash
# Project health signals
gh issue list --state open --limit 20                      # Open issues
gh issue list --label bug --state open                     # Open bugs
gh pr list --state open                                    # Open PRs
gh pr list --state merged --limit 10                       # Recent merges
gh release list --limit 5                                  # Release history
gh api repos/{owner}/{repo} --jq '{stargazers_count, forks_count, open_issues_count, topics}'

# CI/CD status
gh run list --limit 5                                      # Recent CI runs
gh run view --log-failed                                   # Last failed CI logs

# Contributor activity
gh api repos/{owner}/{repo}/contributors --jq '.[].login'
git shortlog -sn --all | head -10                          # Top contributors
```

### Competitive Research
```bash
# Fetch competitor feature pages / documentation
trafilatura -u "https://competitor-url.com/features"       # Extract clean text
trafilatura -u "https://competitor-url.com/docs" --json    # JSON output with metadata

# Fetch and parse HTML
curl -sL "https://competitor-url.com/pricing" | pup 'table json{}'
curl -sL "https://competitor-url.com/changelog" | pup '.changelog-entry text{}'

# Screenshot competitor UIs for visual comparison
shot-scraper "https://competitor-url.com" -o docs/competitor-screenshots/competitor.png
shot-scraper "https://competitor-url.com" --width 1440 --height 900 -o docs/competitor-screenshots/competitor-desktop.png

# Save full page with assets for offline reference
monolith "https://competitor-url.com/features" -o docs/competitor-references/competitor-features.html
```

### Build & Bundle Analysis
```bash
# Disk usage of build artifacts
ncdu {{PROJECT_ROOT}} --exclude node_modules --exclude .git -o /tmp/ncdu-report.json 2>/dev/null
du -sh {{PROJECT_ROOT}}/dist {{PROJECT_ROOT}}/build {{PROJECT_ROOT}}/node_modules 2>/dev/null

# Node modules analysis
du -sh {{PROJECT_ROOT}}/node_modules/*/ 2>/dev/null | sort -rh | head -20  # Largest deps
```

---

## Phase 0 — Deliverable Setup & Baseline Metrics (Iteration 1 only)

On your FIRST iteration, run these commands to establish a quantitative baseline:

### Required Tool Commands
```bash
# 1. Full project statistics — INCLUDE IN REPORT HEADER
scc {{PROJECT_ROOT}}

# 2. Language breakdown
tokei {{PROJECT_ROOT}}

# 3. Directory structure (save to report appendix)
tree {{PROJECT_ROOT}} -L 3 -I 'node_modules|.git|dist|build|coverage' --dirsfirst

# 4. Git health
git log --oneline -20
git shortlog -sn --all | head -10
git log --since="30 days ago" --oneline | wc -l

# 5. GitHub project health (if applicable)
gh repo view --json 'name,description,stargazerCount,forkCount,openIssues' 2>/dev/null
gh issue list --state open --limit 50 --json 'title,labels,createdAt' 2>/dev/null
```

### Create deliverable files

1. **`docs/product-analysis-report.md`** — The main report. Initialize with the header, baseline metrics, and empty phase sections.
2. **`docs/product-analysis-checklist.md`** — Actionable checklist. Initialize with category headers.

If these files already exist from a previous run, read them first and BUILD ON existing findings rather than overwriting.

### Report structure:
```markdown
# {{PROJECT_NAME}} — Product Analysis Report

> Generated: {{DATE}}
> Stack: {{TECH_STACK}}
> Domain: {{DOMAIN}}

## Baseline Metrics

<!-- Paste scc / tokei output here -->

| Metric | Value |
|--------|-------|
| Total files | |
| Total LOC | |
| Languages | |
| Complexity (avg) | |
| Test files | |
| COCOMO estimate | |
| Git commits (30d) | |
| Open issues | |
| Contributors | |

## Executive Summary
<!-- Fill after all phases complete -->

## Phase 1: Current State Inventory
## Phase 2: Competitive Gap Analysis
## Phase 3: UX & Workflow Evaluation
## Phase 4: Technical Debt & Architecture
## Phase 5: Feature Innovation

## Appendix A: Methodology
## Appendix B: Directory Structure
## Appendix C: Tool Outputs
```

### Checklist structure:
```markdown
# {{PROJECT_NAME}} — Product Analysis Checklist

> Priority: P0 (critical) → P3 (nice-to-have)
> Effort: S (hours) / M (days) / L (weeks) / XL (months)

## Feature Gaps (FG-)
## UX Issues (UI-)
## Tech Debt (TD-)
## Enhancements (EN-)
## Innovations (IN-)
```

---

## Phase 1 — Current State Inventory

Read the codebase thoroughly. Map every user-facing feature, internal capability, and integration point.

**Why this phase matters:** You can't improve what you don't understand. A thorough inventory prevents the common mistake of proposing features that already exist (embarrassing) or missing critical infrastructure that constrains future decisions. The inventory also establishes the vocabulary used in all subsequent phases.

**Key files to examine**: {{KEY_FILES}}

### Required Tool Commands
```bash
# 1. Find all entry points and exports
ast-grep --pattern 'export default $COMPONENT' --lang typescript {{PROJECT_ROOT}}
ast-grep --pattern 'export function $NAME($$$)' --lang typescript {{PROJECT_ROOT}}
ast-grep --pattern 'app.get($$$)' --lang typescript {{PROJECT_ROOT}}       # Express routes
ast-grep --pattern 'app.post($$$)' --lang typescript {{PROJECT_ROOT}}      # Express routes
ast-grep --pattern 'router.$METHOD($$$)' --lang typescript {{PROJECT_ROOT}}

# 2. Find all React components (for web apps)
fd -e tsx {{PROJECT_ROOT}}/src -x grep -l 'export' | head -50

# 3. Find all configuration files
fd -g '*.config.*' -g '.env*' -g '*.json' --max-depth 2 {{PROJECT_ROOT}}

# 4. Count and categorize source files
echo "=== Source files ===" && fd -e ts -e tsx -e js -e jsx {{PROJECT_ROOT}}/src 2>/dev/null | wc -l
echo "=== Test files ===" && fd -g '*test*' -g '*spec*' {{PROJECT_ROOT}} | wc -l
echo "=== Style files ===" && fd -e css -e scss -e less {{PROJECT_ROOT}} | wc -l
echo "=== Doc files ===" && fd -e md -e mdx {{PROJECT_ROOT}} | wc -l

# 5. Map all TODO/FIXME/HACK markers (developer intent signals)
rg 'TODO|FIXME|HACK|XXX|TEMP|DEPRECATED' {{PROJECT_ROOT}} --stats -g '!node_modules'

# 6. Dependency analysis
jq '.dependencies | to_entries | sort_by(.key) | .[] | "\(.key): \(.value)"' {{PROJECT_ROOT}}/package.json 2>/dev/null
jq '.devDependencies | keys | length' {{PROJECT_ROOT}}/package.json 2>/dev/null
```

**Fallbacks** (if commands fail):
- No `package.json` → check `Cargo.toml`, `pyproject.toml`, `go.mod` instead
- `ast-grep` returns no results → the project may not be TypeScript. Adjust `--lang` to match the actual stack
- `fd` not finding src/ → try `lib/`, `app/`, `pkg/`, or glob for `**/*.{ext}`
- `gh` fails → project may not be on GitHub or auth is missing. Skip GitHub commands and note in report

**Deliverables:**
- Complete feature inventory (what exists today) — backed by `ast-grep` exports/routes data
- Feature maturity rating: Mature / Functional / Partial / Stub / Missing
- Data flow map (how state moves through the system)
- Integration points (APIs, external services, databases)
- User-facing entry points and navigation structure
- Quantitative summary: file counts, LOC per module, dependency count

**Write findings to:** `docs/product-analysis-report.md` Phase 1 section.

---

## Phase 2 — Competitive Gap Analysis

Compare {{PROJECT_NAME}} against these competitors/references: {{COMPETITORS}}

**Why this phase matters:** Without competitive context, you're designing in a vacuum. Users compare tools constantly — if a competitor does X and you don't, that's a churn risk regardless of how good your other features are. Gap analysis also reveals market positioning opportunities where you can differentiate rather than copy.

### Required Tool Commands
```bash
# 1. Fetch competitor feature pages (adapt URLs to actual competitors)
# For each competitor, try to extract their feature list / documentation:
# trafilatura -u "https://competitor-site.com/features"
# trafilatura -u "https://competitor-site.com/docs"

# 2. If competitors have public GitHub repos, analyze their stats:
# scc /tmp/competitor-repo  (if cloned)
# gh api repos/{owner}/{repo} --jq '{stargazers_count, forks_count, language, topics}'

# 3. Screenshot competitor UIs for visual gap analysis:
# mkdir -p docs/competitor-screenshots
# shot-scraper "https://competitor-site.com" -o docs/competitor-screenshots/competitor-name.png

# 4. Compare codebase size against open-source competitors
scc {{PROJECT_ROOT}} --format json | jq '{languages: [.[] | {name: .Name, code: .Code, files: .Count}]}'
```

**Fallbacks:**
- `trafilatura` fails (site blocks scrapers) → use `WebSearch` to find feature lists, or reference your own knowledge of the tool
- Competitor is a desktop app (no URL) → describe features from documentation/knowledge. Note "based on public documentation, not live testing"
- `shot-scraper` fails → skip screenshots, describe UI differences textually
- Competitor repo is private → use `gh api` for public metadata only

**NOTE:** For competitive research, use `trafilatura` and `shot-scraper` when you have actual competitor URLs. If competitors are desktop apps or proprietary, use `WebSearch` or your knowledge instead. Do NOT fabricate tool outputs.

**For each competitor, evaluate:**
- Features they have that {{PROJECT_NAME}} lacks → classify as **Missing**
- Features {{PROJECT_NAME}} has but are inferior → classify as **Weak**
- Features {{PROJECT_NAME}} has but are incomplete → classify as **Partial**
- Features where {{PROJECT_NAME}} matches or exceeds → classify as **Strong**

**Deliverables:**
- Gap matrix (feature × competitor × classification)
- Top 10 most impactful missing features (ranked by user value)
- Competitive advantages {{PROJECT_NAME}} already has
- Market positioning opportunities
- Competitor screenshots in `docs/competitor-screenshots/` (when available)

**Write findings to:** `docs/product-analysis-report.md` Phase 2 section.
**Add items to:** `docs/product-analysis-checklist.md` under FG- (Feature Gaps).

---

## Phase 3 — UX & Workflow Evaluation

Evaluate from the perspective of these user personas: {{PERSONAS}}

**Why this phase matters:** Features alone don't make a great product — the experience of using them does. A tool can have every feature but still lose users to a simpler competitor. UX evaluation reveals the invisible friction that causes users to abandon workflows, avoid features, or seek alternatives. This phase grounds the analysis in actual human behavior rather than feature checklists.

### Required Tool Commands
```bash
# 1. Find all pages/views/screens (navigation structure)
fd -g '*Page*' -g '*View*' -g '*Screen*' -g '*Layout*' {{PROJECT_ROOT}}/src 2>/dev/null
ast-grep --pattern 'Route path=$PATH' --lang tsx {{PROJECT_ROOT}} 2>/dev/null
ast-grep --pattern '<Route $$$>' --lang tsx {{PROJECT_ROOT}} 2>/dev/null

# 2. Find all user-interactive elements
ast-grep --pattern 'onClick={$$$}' --lang tsx {{PROJECT_ROOT}} 2>/dev/null | head -30
ast-grep --pattern '<Button $$$>' --lang tsx {{PROJECT_ROOT}} 2>/dev/null | head -30
ast-grep --pattern '<form $$$>' --lang tsx {{PROJECT_ROOT}} 2>/dev/null

# 3. Accessibility audit signals
rg 'aria-' {{PROJECT_ROOT}}/src --stats -g '*.tsx' -g '*.jsx'
rg 'role=' {{PROJECT_ROOT}}/src --stats -g '*.tsx' -g '*.jsx'
rg 'tabIndex' {{PROJECT_ROOT}}/src --stats -g '*.tsx' -g '*.jsx'
rg 'alt=' {{PROJECT_ROOT}}/src --stats -g '*.tsx' -g '*.jsx'
ast-grep --pattern '<img $$$>' --lang tsx {{PROJECT_ROOT}}  # Check for alt attrs

# 4. Error handling patterns (user-facing)
ast-grep --pattern 'catch ($ERR) { $$$}' --lang typescript {{PROJECT_ROOT}}
rg 'toast\.|notification\.|alert\(' {{PROJECT_ROOT}}/src --stats
rg 'error.*message|Error.*message' {{PROJECT_ROOT}}/src -i --stats

# 5. Loading/skeleton states
rg 'loading|isLoading|isPending|Skeleton|Spinner' {{PROJECT_ROOT}}/src --stats -g '*.tsx'

# 6. Keyboard shortcuts
rg 'useHotkeys|onKeyDown|onKeyPress|keyboard.*shortcut|Keyboard' {{PROJECT_ROOT}}/src -i --stats
```

**Fallbacks:**
- No `src/` directory → adjust path to wherever source files live
- Not a React project → adapt `ast-grep` patterns for the actual framework (e.g., Vue `<template>`, Svelte `<script>`)
- No TSX/JSX → for CLI tools, skip UI-specific searches. Focus on `--help` output quality, error messages, stdin/stdout behavior
- `rg` returns nothing for aria/role → this IS a finding — report as "zero accessibility attributes found"

**For each persona, trace these workflows:**
- Onboarding / first-time experience
- Core daily workflow (the "main loop")
- Advanced/power-user workflows
- Error recovery and help-seeking
- Collaboration and sharing

**Evaluate:**
- Friction points (where users get stuck or confused)
- Missing affordances (actions that should be obvious but aren't)
- Workflow dead-ends (paths that lead nowhere)
- Accessibility gaps (keyboard navigation, screen readers, contrast) — backed by `rg` aria/role/tabIndex counts
- Responsiveness and performance perception
- Information architecture (can users find what they need?)
- Error handling completeness — backed by `ast-grep` catch block analysis

**Deliverables:**
- Persona-specific workflow maps with friction annotations
- Severity-ranked UX issue list
- Quick-win UX improvements (high impact, low effort)
- Accessibility scorecard (quantitative: how many elements have aria attrs, alt text, etc.)

**Write findings to:** `docs/product-analysis-report.md` Phase 3 section.
**Add items to:** `docs/product-analysis-checklist.md` under UI- (UX Issues).

---

## Phase 4 — Technical Debt & Architecture Gaps

This is the most tool-intensive phase. Run ALL of these commands and include the results in your report.

**Why this phase matters:** Technical debt is the silent killer of products. It doesn't show up in feature comparisons or user surveys, but it determines how fast you can ship, how stable the product is, and whether the architecture can support the features users actually need. Complexity hotspots (measured by `lizard`) correlate directly with bug density — functions with cyclomatic complexity > 15 are nearly impossible to unit test properly and are the source of most production incidents.

### Required Tool Commands — MUST RUN ALL
```bash
# ═══════════════════════════════════════════
# COMPLEXITY ANALYSIS (lizard) — Most critical
# ═══════════════════════════════════════════
# Top functions by cyclomatic complexity
lizard {{PROJECT_ROOT}} --sort cyclomatic_complexity -w 2>/dev/null | head -40

# Functions exceeding thresholds (RED FLAGS)
echo "=== Functions with complexity > 15 (danger zone) ==="
lizard {{PROJECT_ROOT}} -T cyclomatic_complexity=15 2>/dev/null

echo "=== Functions with > 50 lines (too long) ==="
lizard {{PROJECT_ROOT}} -T nloc=50 2>/dev/null

echo "=== Functions with > 5 parameters (smell) ==="
lizard {{PROJECT_ROOT}} -T parameter_count=5 2>/dev/null

# Summary statistics
lizard {{PROJECT_ROOT}} --csv 2>/dev/null | tail -1  # Summary line

# ═══════════════════════════════════════════
# CODEBASE HEALTH (scc)
# ═══════════════════════════════════════════
scc {{PROJECT_ROOT}} --by-file --sort lines | head -30  # Largest files
scc {{PROJECT_ROOT}}  # Overall stats with COCOMO

# ═══════════════════════════════════════════
# CODE SMELL DETECTION (ast-grep + rg)
# ═══════════════════════════════════════════
# TypeScript anti-patterns
echo "=== 'any' type usage ==="
ast-grep --pattern ': any' --lang typescript {{PROJECT_ROOT}} 2>/dev/null | wc -l
echo "=== Type assertions (as any) ==="
ast-grep --pattern 'as any' --lang typescript {{PROJECT_ROOT}} 2>/dev/null | wc -l
echo "=== @ts-ignore / @ts-expect-error ==="
rg '@ts-ignore|@ts-expect-error' {{PROJECT_ROOT}} --stats -g '*.ts' -g '*.tsx'
echo "=== Non-null assertions (!) ==="
rg '!\.' {{PROJECT_ROOT}}/src --stats -g '*.ts' -g '*.tsx' 2>/dev/null | head -10
echo "=== Console statements ==="
rg 'console\.(log|warn|error|debug|info)' {{PROJECT_ROOT}}/src --stats -g '!*.test.*'
echo "=== Dead code markers ==="
rg 'TODO|FIXME|HACK|XXX|TEMP|DEPRECATED|REMOVE' {{PROJECT_ROOT}}/src --stats

# ═══════════════════════════════════════════
# SECURITY SCAN (rg)
# ═══════════════════════════════════════════
echo "=== Potential hardcoded secrets ==="
rg '(password|secret|api.key|token|auth)\s*[:=]\s*["\x27][^"\x27]{8,}' {{PROJECT_ROOT}}/src -i --stats 2>/dev/null
echo "=== Dangerous functions ==="
ast-grep --pattern 'eval($$$)' --lang typescript {{PROJECT_ROOT}} 2>/dev/null
ast-grep --pattern 'dangerouslySetInnerHTML' --lang tsx {{PROJECT_ROOT}} 2>/dev/null
ast-grep --pattern 'innerHTML' --lang typescript {{PROJECT_ROOT}} 2>/dev/null
echo "=== HTTP (non-HTTPS) URLs ==="
rg 'http://' {{PROJECT_ROOT}}/src --stats -g '!*.test.*' 2>/dev/null

# ═══════════════════════════════════════════
# TEST HEALTH
# ═══════════════════════════════════════════
echo "=== Test file count ==="
fd -g '*test*' -g '*spec*' -g '__tests__' {{PROJECT_ROOT}} --type f | wc -l
echo "=== Test vs source ratio ==="
echo "Source files:" && fd -e ts -e tsx -e js -e jsx {{PROJECT_ROOT}}/src 2>/dev/null -g '!*test*' -g '!*spec*' | wc -l
echo "Test files:" && fd -e ts -e tsx -e js -e jsx {{PROJECT_ROOT}} -g '*test*' -g '*spec*' | wc -l
echo "=== Test patterns ==="
rg 'describe\(|it\(|test\(|expect\(' {{PROJECT_ROOT}} --stats -g '*test*' -g '*spec*'
echo "=== Skipped tests ==="
rg '\.skip\(|xit\(|xdescribe\(|xtest\(' {{PROJECT_ROOT}} --stats 2>/dev/null

# ═══════════════════════════════════════════
# DEPENDENCY HEALTH
# ═══════════════════════════════════════════
echo "=== Dependency count ==="
jq '.dependencies | length' {{PROJECT_ROOT}}/package.json 2>/dev/null
jq '.devDependencies | length' {{PROJECT_ROOT}}/package.json 2>/dev/null
echo "=== Largest node_modules directories ==="
du -sh {{PROJECT_ROOT}}/node_modules/*/ 2>/dev/null | sort -rh | head -15

# ═══════════════════════════════════════════
# BUILD ARTIFACTS & BUNDLE SIZE
# ═══════════════════════════════════════════
echo "=== Build output size ==="
du -sh {{PROJECT_ROOT}}/dist {{PROJECT_ROOT}}/build {{PROJECT_ROOT}}/.next 2>/dev/null
echo "=== Source vs build ratio ==="
du -sh {{PROJECT_ROOT}}/src 2>/dev/null
du -sh {{PROJECT_ROOT}}/dist 2>/dev/null

# ═══════════════════════════════════════════
# GIT HEALTH & ACTIVITY
# ═══════════════════════════════════════════
echo "=== Commit frequency (last 90 days) ==="
git -C {{PROJECT_ROOT}} log --since="90 days ago" --oneline | wc -l
echo "=== Stale branches ==="
git -C {{PROJECT_ROOT}} branch --sort=-committerdate | head -10
echo "=== Files changed most frequently (churn) ==="
git -C {{PROJECT_ROOT}} log --since="90 days ago" --name-only --pretty=format: | sort | uniq -c | sort -rn | head -15

# ═══════════════════════════════════════════
# CI/CD & GITHUB
# ═══════════════════════════════════════════
gh run list --limit 10 2>/dev/null
gh issue list --state open --label bug 2>/dev/null
```

**Fallbacks:**
- `lizard` returns no results → the project language may not be supported. Check `lizard --list` for supported languages. Fall back to manual complexity assessment
- `scc` format differs → use `tokei` as alternative for LOC counts
- `ast-grep` patterns don't match → project may use different patterns (e.g., CommonJS `module.exports` instead of ES `export`)
- `gh` auth fails → skip all GitHub commands and note "GitHub data unavailable" in report
- No `node_modules` → not a Node project. Skip dependency size analysis, use language-appropriate package manager commands instead
- Build artifacts don't exist → project may not have been built. Note "no build artifacts found — run build command first for accurate bundle analysis"

**IMPORTANT**: Include the ACTUAL output of these commands in your report. Don't just describe what you found — paste the numbers. Quantitative evidence makes the analysis actionable.

**Audit dimensions:**

**Performance:**
- Bundle size and code splitting — measured by `du` on build artifacts
- Render performance (unnecessary re-renders, heavy computations) — `lizard` complexity hotspots
- API response times and caching strategy
- Memory leaks and resource cleanup

**Scalability:**
- Data model limitations (hardcoded IDs, missing relations)
- State management bottlenecks
- Database query patterns (N+1, missing indexes)
- Horizontal scaling readiness

**Security:**
- Hardcoded secrets — `rg` security scan results
- Dangerous functions — `ast-grep` eval/innerHTML results
- Authentication and authorization model
- Input validation and sanitization
- OWASP Top 10 coverage

**Testing:**
- Test coverage ratio — `fd` test vs source count
- Missing test categories (unit, integration, E2E)
- Skipped tests — `rg` skip pattern results
- Test infrastructure health

**Code Quality:**
- Cyclomatic complexity — `lizard` top-N functions (RED FLAG if any > 15)
- Largest files — `scc --by-file` (RED FLAG if any > 500 LOC)
- TypeScript strictness — `any` count, `@ts-ignore` count
- Dead code signals — TODO/FIXME/DEPRECATED count
- Console statement leaks

**Developer Experience:**
- Build times and dev server performance
- Code organization — `tree` structure analysis
- Documentation quality (inline and external) — `fd` doc file count
- Onboarding friction for new contributors

**Deliverables:**
- Technical debt inventory with severity ratings — BACKED BY TOOL OUTPUTS
- Complexity hotspot table (function name, file, complexity score, LOC) from `lizard`
- Largest files table from `scc --by-file`
- Security findings table from `rg` + `ast-grep` scans
- Test coverage ratio and gap analysis
- Architecture diagram gaps (what's missing from docs)
- Recommended refactoring priorities
- "Ticking time bombs" — debt that will cause production issues if not addressed

**Write findings to:** `docs/product-analysis-report.md` Phase 4 section.
**Add items to:** `docs/product-analysis-checklist.md` under TD- (Tech Debt) and EN- (Enhancements).

---

## Phase 5 — Feature Innovation

Propose novel, differentiating features specific to the **{{DOMAIN}}** domain.

**Why this phase matters:** Parity features keep you in the game, but innovation wins the market. This phase is where the analysis transitions from "what's wrong" to "what could be amazing." The best innovations solve problems users didn't know they had — but once they experience the solution, they can't go back. Innovation proposals grounded in competitive gaps (Phase 2) and UX friction (Phase 3) are far more likely to succeed than ideas generated in isolation.

### Required Tool Commands
```bash
# 1. Research trending features in the domain
# Use WebSearch for current trends, then trafilatura for deep reads:
# trafilatura -u "https://relevant-article-url.com"

# 2. Check what competitors are shipping (their changelogs/releases)
# trafilatura -u "https://competitor-site.com/changelog"
# trafilatura -u "https://competitor-site.com/blog"

# 3. Analyze open issues as feature request signals
gh issue list --state open --limit 50 --json 'title,labels,reactions' 2>/dev/null
gh issue list --state open --label 'feature request' --label 'enhancement' 2>/dev/null

# 4. Identify integration opportunities from dependencies
jq '.dependencies | keys' {{PROJECT_ROOT}}/package.json 2>/dev/null
```

**Fallbacks:**
- `gh issue list` returns nothing → project may not use GitHub Issues for feature tracking. Check for a separate issue tracker or roadmap file
- `trafilatura` blocked → use `WebSearch` to find competitor changelogs and blog posts
- No `package.json` → use the project's package manager to list dependencies

**Think about:**
- What would make {{PROJECT_NAME}} the OBVIOUS choice in its category?
- What workflows don't exist yet in ANY competing tool?
- What emerging technologies could create a leap forward?
- What would power users pay premium pricing for?
- What would make {{PROJECT_NAME}} go viral / get shared organically?

**For each innovation, provide:**
- **What**: Clear description of the feature
- **Why**: User problem it solves or opportunity it captures
- **How**: High-level technical approach
- **Effort**: S / M / L / XL
- **Priority**: P0 (game-changer) → P3 (nice-to-have)
- **Competitive moat**: How hard is this for competitors to replicate?

**Deliverables:**
- 10-20 innovation proposals ranked by impact x feasibility
- "Moonshot" section for ambitious ideas worth exploring
- Integration opportunities with AI/ML
- Research links (from `trafilatura` / `WebSearch`) supporting each proposal

**Write findings to:** `docs/product-analysis-report.md` Phase 5 section.
**Add items to:** `docs/product-analysis-checklist.md` under IN- (Innovations).

---

## Cross-Iteration Behavior

- **Iteration 1**: Run ALL Phase 0 tool commands. Set up deliverables. Complete Phase 1 (with tool commands). Start Phase 2.
- **Iteration 2**: Complete Phase 2 (competitive research with `trafilatura`/`shot-scraper`) and Phase 3 (UX audit with `ast-grep`/`rg`).
- **Iteration 3**: Complete Phase 4 — run ALL `lizard`, `scc`, `ast-grep`, `rg` commands. This is the most tool-intensive phase.
- **Iteration 4**: Complete Phase 5, write Executive Summary.
- **Iteration 5**: Review ALL findings for completeness, fill gaps, ensure checklist IDs are consistent, verify every item has effort + priority ratings. Re-run any tool commands where data was incomplete.

On subsequent loops (iterations 6+), deepen analysis. Read `references/cross-phase-analysis.md` for guidance on:
- Cross-referencing findings between phases (e.g., `lizard` complexity hotspots causing UX friction)
- Identifying patterns across phases (e.g., tech debt causing UX issues)
- Re-running tool commands on specific directories/files for deeper investigation
- Refining priority rankings based on holistic view
- Adding implementation notes to high-priority checklist items
- Using `trafilatura` to research solutions for top-priority issues

---

## Quality Gates

Before outputting the completion promise, verify ALL of the following:

- [ ] `docs/product-analysis-report.md` has substantive content in ALL 5 phases
- [ ] `docs/product-analysis-checklist.md` has items in ALL 5 categories (FG-, UI-, TD-, EN-, IN-)
- [ ] Every checklist item has: ID, description, effort (S/M/L/XL), priority (P0-P3)
- [ ] Executive Summary is written and reflects the full analysis
- [ ] No placeholder text remains
- [ ] Gap matrix in Phase 2 has at least 3 competitors evaluated
- [ ] Phase 3 evaluates at least 2 distinct personas
- [ ] Phase 5 has at least 10 innovation proposals
- [ ] **Phase 4 includes actual `lizard` output** (complexity hotspots table)
- [ ] **Phase 4 includes actual `scc` output** (codebase statistics)
- [ ] **Phase 4 includes actual security scan results** (from `rg` + `ast-grep`)
- [ ] **Baseline Metrics table in report header is filled** (from Phase 0 tool runs)
- [ ] **Appendix C has raw tool outputs** for reproducibility

---

## Completion

When ALL quality gates pass and the analysis is thorough across all 5 phases:

<promise>ANALYSIS COMPLETE</promise>

Do NOT output this promise until every quality gate is satisfied. The loop will continue feeding you back — use additional iterations to deepen and refine.
