---
description: What ProtoPulse is missing, what's broken, and where the biggest opportunities are — the radar for development priorities
type: moc
---

# gaps and opportunities

This topic map organizes what ProtoPulse DOESN'T have yet, what's broken, and where the biggest opportunities live. Unlike other topic maps that organize what exists, this one tracks what's missing.

## Unmet User Needs

- [[makers-need-one-tool-because-context-switching-kills-momentum]] -- core value prop, partially delivered
- [[exports-are-only-accessible-via-ai-chat]] -- no direct UI for the most common export workflow
- [[zero-form-elements-means-no-native-input-paradigm]] -- fundamental UX gap across the entire app
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] -- proactive AI safety, partially delivered via coach

## Competitive Gaps

- [[flux-ai-is-the-primary-competitive-threat]] -- the existential competitive framing
- [[pcb-layout-was-the-weakest-domain-across-all-five-phases]] -- biggest domain gap
- [[tinkercad-perception-gap-is-about-seeing-not-computing]] -- visual feedback beats computation for makers
- [[competitive-audits-generated-more-work-than-internal-analysis]] -- external pressure drives more actionable insights

## Technical Debt Blocking Features

- [[god-files-create-feature-paralysis-through-complexity]] -- complexity bottleneck, not talent
- [[project-provider-monolith-is-the-biggest-remaining-frontend-debt]] -- couples unrelated domains, quadratic renders
- [[dual-export-system-is-a-maintenance-trap]] -- parallel implementations with divergent signatures
- [[all-procurement-data-is-ai-fabricated]] -- zero real supplier APIs
- [[ai-prompt-scaling-is-linear-and-will-hit-token-limits]] -- linear token cost scaling
- [[monolithic-context-causes-quadratic-render-complexity]] -- unmemoized + monolithic = slow
- [[cors-origin-reflection-was-a-critical-csrf-vector]] -- fixed in Wave E
- [[hardcoded-project-id-blocked-multi-project-until-wave-39]] -- fixed, but debt history matters

## Architecture Gaps

- [[cross-tool-coherence-is-harder-than-building-features]] -- data ownership between views is ambiguous
- [[c5-items-are-programs-not-features]] -- 24 items need ADRs, not sprint slots

## Strategic Opportunities

- [[ai-is-the-moat-lean-into-it]] -- 6x more AI actions than Flux.ai
- [[architecture-first-bridges-intent-to-implementation]] -- uncontested market position
- [[self-hosted-and-free-is-a-pricing-moat]] -- $0 vs Flux.ai's $20-158/month
- [[greatness-manifest-pushed-beyond-parity-into-innovation]] -- 11 C5 items no competitor has
- [[breadboard-plus-ai-plus-free-is-the-maker-bundle]] -- Fritzing breadboard + AI + $0

## Developer Infrastructure Gaps

- [[session-orient-and-validate-note-have-syntax-bugs]] -- two hook scripts have bash syntax errors from concatenated lines
- [[nine-posttooluse-groups-fire-on-every-write]] -- dense blocking pipeline adds latency to every edit
- [[auto-commit-vault-is-the-only-async-hook]] -- 25 blocking hooks vs 1 async creates bottleneck
- [[two-hook-groups-have-no-explicit-matcher]] -- fragile implicit defaults in settings.json
- [[thirty-seven-agents-have-no-trigger-patterns]] -- agents cannot self-activate, must be manually invoked
- [[six-agents-cover-technologies-not-in-protopulse-stack]] -- dead-weight agent definitions
- [[postgres-mcp-has-inline-credentials-in-mcp-json]] -- hardcoded DB password in version control
- [[combined-claude-md-exceeds-800-lines-creating-context-pressure]] -- ~8600 tokens consumed per session by instructions alone
- [[claude-md-references-a-settings-skill-that-does-not-exist]] -- stale reference after skill removal
- [[subagentsop-event-is-declared-but-has-no-hooks]] -- subagent quality gates missing
- [[vault-skills-outnumber-project-skills-seven-to-one]] -- development workflow skills underserved

## Query Scripts

Run these for live analysis:
- `bash ops/queries/gap-analysis.sh` -- claims vs debt contradictions
- `bash ops/queries/competitive-gaps.sh` -- what competitors do better
- `bash ops/queries/competitive-gaps.sh flux` -- Flux.ai specific gaps
- `bash ops/queries/unmet-needs.sh` -- user needs cross-referenced with debt
- `bash ops/queries/idea-generator.sh` -- feature opportunities from graph patterns
- `bash ops/queries/backlog-vs-knowledge.sh` -- backlog items with vault evidence
- `bash ops/queries/infra-audit.sh` -- comprehensive Claude Code infrastructure health audit

---

Topics:
- [[index]]
