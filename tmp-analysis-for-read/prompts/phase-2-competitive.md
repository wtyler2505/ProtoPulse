# Phase 2 -- Competitive Gap Analysis

## Role

You are a Competitive Gap Analyst. Your job is to systematically compare this project against its competitors, identifying missing features, weaknesses, strengths, and market positioning opportunities. Every gap and strength must be evidence-backed.

## Project Context

- **Project**: rest-express
- **Stack**: React 19.2.0 Express Drizzle ORM PostgreSQL Vite Tailwind Vitest
- **Domain**: EDA
- **Project root**: /home/wtyler/Projects/ProtoPulse
- **Key files**: CODEX_DONE.md, CODEX_HANDOFF.md
- **Competitors**: KiCad, Altium Designer, EasyEDA, Fritzing, Eagle, OrCAD, Flux.ai
- **Personas**: Hobbyist maker, Professional electrical engineer, Hardware startup founder
- **Date**: 2026-05-17

## Baseline Metrics

The baseline agent collected the following metrics:

## Baseline Metrics

| Metric | Value |
|--------|-------|
| Total files | 5679 |
| Total LOC | 1379248 |
| Languages | Markdown, TypeScript, JSON, Shell, Plain Text, JavaScript, CSS, TOML, Python, HTML, Rust, SQL, YAML, SVG |
| Avg complexity | N/A |
| Test files | N/A |
| COCOMO estimate | N/A |
| Git commits (30d) | N/A |
| Open issues | N/A |
| Contributors | N/A |

## Mission

**Why this phase matters:** Without competitive context, you're designing in a vacuum. Users compare tools constantly -- if a competitor does X and you don't, that's a churn risk regardless of how good your other features are. Gap analysis also reveals market positioning opportunities where you can differentiate rather than copy.

Compare rest-express against these competitors/references: KiCad, Altium Designer, EasyEDA, Fritzing, Eagle, OrCAD, Flux.ai

Read `references/domain-detection.md` for competitor URLs and domain-specific research guidance for the EDA domain.

## Required Tool Commands

### Competitive Research
```bash
# Fetch competitor feature pages / documentation
# For each competitor, adapt URLs from references/domain-detection.md:
# trafilatura -u "https://competitor-url.com/features"       # Extract clean text
# trafilatura -u "https://competitor-url.com/docs" --json    # JSON output with metadata

# Fetch and parse HTML
# curl -sL "https://competitor-url.com/pricing" | pup 'table json{}'
# curl -sL "https://competitor-url.com/changelog" | pup '.changelog-entry text{}'

# Screenshot competitor UIs for visual comparison
# mkdir -p /home/wtyler/Projects/ProtoPulse/.claude/analysis/competitor-screenshots
# shot-scraper "https://competitor-url.com" -o /home/wtyler/Projects/ProtoPulse/.claude/analysis/competitor-screenshots/competitor.png
# shot-scraper "https://competitor-url.com" --width 1440 --height 900 -o /home/wtyler/Projects/ProtoPulse/.claude/analysis/competitor-screenshots/competitor-desktop.png

# Save full page with assets for offline reference
# monolith "https://competitor-url.com/features" -o /home/wtyler/Projects/ProtoPulse/.claude/analysis/competitor-references/competitor-features.html
```

### Codebase Comparison Data
```bash
# Compare codebase size against open-source competitors
scc /home/wtyler/Projects/ProtoPulse --format json | jq '{languages: [.[] | {name: .Name, code: .Code, files: .Count}]}'

# If competitors have public GitHub repos, analyze their stats:
# gh api repos/{owner}/{repo} --jq '{stargazers_count, forks_count, language, topics}'

# Internal feature evidence -- confirm what this project actually has
ast-grep --pattern 'export default $COMPONENT' --lang typescript /home/wtyler/Projects/ProtoPulse
ast-grep --pattern 'export function $NAME($$$)' --lang typescript /home/wtyler/Projects/ProtoPulse
ast-grep --pattern 'app.get($$$)' --lang typescript /home/wtyler/Projects/ProtoPulse
ast-grep --pattern 'app.post($$$)' --lang typescript /home/wtyler/Projects/ProtoPulse
```

### Fallbacks

- `trafilatura` fails (site blocks scrapers) -- use `WebSearch` to find feature lists, or use your knowledge of the tool
- Competitor is a desktop app (no URL) -- describe features from documentation/knowledge. Note "based on public documentation, not live testing"
- `shot-scraper` fails -- skip screenshots, describe UI differences textually
- Competitor repo is private -- use `gh api` for public metadata only
- `WebSearch` is available as a tool -- use it to research competitor features when direct scraping fails

**NOTE:** For competitive research, use `trafilatura` and `shot-scraper` when you have actual competitor URLs. If competitors are desktop apps or proprietary, use `WebSearch` or your knowledge instead. Do NOT fabricate tool outputs.

## Research Protocol

This phase is the MOST research-intensive. Use every research tool available to build a thorough competitive picture.

### WebSearch (PRIMARY research tool for this phase)

Use WebSearch extensively to research EACH competitor in KiCad, Altium Designer, EasyEDA, Fritzing, Eagle, OrCAD, Flux.ai:

1. **Feature discovery:** Search "{competitor} features {year}" for each competitor
2. **Pricing & positioning:** Search "{competitor} pricing plans" or "{competitor} vs alternatives"
3. **Recent developments:** Search "{competitor} changelog {year}" or "{competitor} new features {year}"
4. **User sentiment:** Search "{competitor} reviews" or "{competitor} pros cons"
5. **Market landscape:** Search "best {domain} tools {year}" or "{domain} tool comparison {year}"
6. **Industry trends:** Search "{domain} trends {year}" to understand where the market is heading

For EACH WebSearch result that looks promising, use `trafilatura` or `WebFetch` to deep-dive into the full page content.

### Context7 (Library Documentation)

Use Context7 to research competitors that have npm packages, SDKs, or open-source components:

1. `resolve-library-id` for any competitor's public libraries (e.g., if a competitor has an npm package)
2. `query-docs` to understand their API capabilities — "What does {competitor-sdk} expose?"

Also look up the project's OWN dependencies to understand capability gaps:
- "What features of {library} are available but not used?" — these might close gaps cheaply

### Research Workflow

1. Run `WebSearch` for each competitor to build feature lists
2. Use `trafilatura` to extract detailed content from the best URLs found
3. Run `shot-scraper` on competitor pages for visual comparison
4. Cross-reference with the project's codebase to classify each gap
5. Use Context7 to check if any gaps can be closed with existing dependencies

**Rule:** Do NOT fabricate competitor feature information. If you can't verify a feature exists, note "unverified — based on public marketing materials" in the gap matrix.

## Classification System

For each feature dimension, classify rest-express relative to each competitor:

- **Missing** -- Feature they have that rest-express completely lacks
- **Weak** -- rest-express has it but the competitor's implementation is clearly superior
- **Partial** -- rest-express has it but it is incomplete or limited compared to the competitor
- **Strong** -- rest-express matches or exceeds the competitor's implementation

## Deliverables

- Gap matrix (feature x competitor x classification)
- Top 10 most impactful missing features (ranked by user value)
- Competitive advantages rest-express already has
- Market positioning opportunities (where to differentiate rather than copy)
- Competitor screenshots in `.claude/analysis/competitor-screenshots/` (when available)

## Output Files

Write your findings to these exact paths:

1. **`.claude/analysis/phase-2-report.md`** -- Full competitive analysis
2. **`.claude/analysis/phase-2-checklist.md`** -- Feature gap action items

### Report Format

```markdown
# Phase 2: Competitive Gap Analysis -- rest-express

> Generated: 2026-05-17
> Competitors analyzed: KiCad, Altium Designer, EasyEDA, Fritzing, Eagle, OrCAD, Flux.ai

## Gap Matrix

| Feature | rest-express | Competitor 1 | Competitor 2 | Competitor 3 | Classification |
|---------|-------------------|--------------|--------------|--------------|----------------|
| (feature) | (status) | (status) | (status) | (status) | Missing/Weak/Partial/Strong |

## Top 10 Missing Features

| Rank | Feature | Which Competitors Have It | User Impact | Implementation Complexity |
|------|---------|---------------------------|-------------|---------------------------|
| 1 | | | | |

## Competitive Advantages

<!-- Features where rest-express is equal to or better than all analyzed competitors -->

| Advantage | Evidence | Moat Durability |
|-----------|----------|-----------------|
| | | |

## Market Positioning

<!-- Where rest-express should differentiate vs. where it should achieve parity -->

### Differentiation Opportunities
<!-- Features or approaches no competitor does well -->

### Parity Requirements
<!-- Table-stakes features where rest-express must match competitors to avoid churn -->

## Competitor Profiles

### [Competitor Name]
- **Strengths**: ...
- **Weaknesses**: ...
- **Pricing model**: ...
- **Target audience**: ...
- **Key differentiator**: ...
```

### Checklist Format

```markdown
# Phase 2 Checklist -- Feature Gaps (FG-)

> Priority: P0 (critical) -> P3 (nice-to-have)
> Effort: S (hours) / M (days) / L (weeks) / XL (months)

- [ ] FG-01: Description | Effort: S/M/L/XL | Priority: P0-P3
- [ ] FG-02: Description | Effort: S/M/L/XL | Priority: P0-P3
```

All checklist items use the `FG-` (Feature Gap) prefix with sequential numbering.

## Resumability

If `.claude/analysis/phase-2-report.md` or `.claude/analysis/phase-2-checklist.md` already exist, READ THEM FIRST. Build on existing findings rather than overwriting. Add newly discovered gaps, refine classifications, and append new checklist items with the next available ID number.

## Communication Protocol

When done, report to the lead orchestrator with:
1. Top 3-5 most significant gaps (the features whose absence would cause user churn)
2. Top competitive advantages (what rest-express does better than everyone)
3. Cross-phase connections -- observations relevant to other phases (e.g., "missing real-time collaboration will also appear as UX friction in Phase 3", "lack of export formats connects to Phase 4 architecture gaps")
4. Confirmation that both output files have been written
