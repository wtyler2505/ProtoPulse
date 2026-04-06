---
description: What ProtoPulse is missing, what's broken, and where the biggest opportunities are — the radar for development priorities
type: moc
---

# gaps and opportunities

This topic map organizes what ProtoPulse DOESN'T have yet, what's broken, and where the biggest opportunities live. Unlike other topic maps that organize what exists, this one tracks what's missing.

## Unmet User Needs

- [[makers-need-one-tool-because-context-switching-kills-momentum]] -- core value prop, partially delivered
- [[manufacturing-exports-only-accessible-via-ai-chat]] -- no direct UI for the most common export workflow
- [[zero-form-elements-means-no-native-input-paradigm]] -- fundamental UX gap across the entire app
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] -- proactive AI safety, partially delivered via coach

## Competitive Gaps

- [[flux-ai-is-a-complete-eda-tool-with-ai-protopulse-is-ai-missing-eda]] -- the existential competitive framing
- [[pcb-layout-was-weakest-across-all-five-analysis-phases]] -- biggest domain gap
- [[tinkercad-perception-gap-is-about-seeing-not-computing]] -- visual feedback beats computation for makers
- [[competitive-audits-generated-more-work-than-internal-analysis]] -- external pressure drives more actionable insights

## Technical Debt Blocking Features

- [[god-files-create-feature-paralysis]] -- complexity bottleneck, not talent
- [[project-provider-monolith-is-biggest-frontend-debt]] -- couples unrelated domains, quadratic renders
- [[dual-export-system-forces-every-fix-twice]] -- parallel implementations with divergent signatures
- [[all-procurement-data-is-ai-simulated]] -- zero real supplier APIs
- [[ai-prompt-rebuilds-full-state-on-every-request]] -- linear token cost scaling
- [[monolithic-context-creates-quadratic-render-complexity]] -- unmemoized + monolithic = slow
- [[cors-reflecting-origin-was-critical-csrf-vector]] -- fixed in Wave E
- [[hardcoded-project-id-blocked-multi-project-until-wave-39]] -- fixed, but debt history matters

## Architecture Gaps

- [[cross-tool-coherence-is-harder-than-building-features]] -- data ownership between views is ambiguous
- [[c5-items-are-programs-not-features]] -- 24 items need ADRs, not sprint slots

## Strategic Opportunities

- [[ai-is-the-competitive-moat-to-invest-in]] -- 6x more AI actions than Flux.ai
- [[architecture-first-bridges-intent-and-implementation]] -- uncontested market position
- [[self-hosted-and-free-is-a-pricing-moat]] -- $0 vs Flux.ai's $20-158/month
- [[greatness-manifest-pushed-beyond-parity-into-innovation]] -- 11 C5 items no competitor has
- [[breadboard-plus-ai-plus-free-is-a-unique-maker-bundle]] -- Fritzing breadboard + AI + $0

## Query Scripts

Run these for live analysis:
- `bash ops/queries/gap-analysis.sh` -- claims vs debt contradictions
- `bash ops/queries/competitive-gaps.sh` -- what competitors do better
- `bash ops/queries/competitive-gaps.sh flux` -- Flux.ai specific gaps
- `bash ops/queries/unmet-needs.sh` -- user needs cross-referenced with debt
- `bash ops/queries/idea-generator.sh` -- feature opportunities from graph patterns
- `bash ops/queries/backlog-vs-knowledge.sh` -- backlog items with vault evidence

---

Topics:
- [[index]]
