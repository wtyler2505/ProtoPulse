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
- [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] -- keyboard-only users are locked out of the tool

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

### Comprehensive Audit Sub-Maps (April 2026)
- [[ai-system-debt]] -- validation vacuum, tool blindspots, architecture anti-patterns (9 notes)
- [[performance-debt]] -- main-thread blocking, DB indexing, memory leaks, bundle bloat (6 notes)
- [[security-debt]] -- Tauri RCE chain, XSS/eval exploits, DoS vectors, auth gaps (5 notes)
- [[tauri-node-sidecar-is-not-self-contained-and-crashes-without-global-node]] -- desktop pivot: app requires Node.js installed
- [[comprehensive-audit-reveals-zero-validation-at-any-layer]] -- synthesis: the audit's meta-finding

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

See [[dev-infrastructure]] for the full infrastructure topic map — hook latency, agent trigger gaps, MCP credential leaks, and CLAUDE.md context pressure all live there under their respective sections. The Known Issues subsection is the specific analog to this one.

## Skill Ecosystem Gaps

See [[claude-code-skills]] for the full topic map — the Gaps subsection catalogs routing confusion, zombie skills, deployment pipeline gaps, and performance-profiling orphans.

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

Agent Notes:
- 2026-04-06: 25 comprehensive audit notes added across 5 new subsections. The audit revealed that ProtoPulse's biggest gaps are no longer feature gaps (backlog complete) but quality/reliability gaps: AI output is unvalidated, security boundaries are porous, and synchronous bottlenecks block the main thread. The next strategic phase should be hardening over features.

Topics:
- [[index]]
