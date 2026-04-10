---
name: breadboard-lab
description: ProtoPulse Breadboard Lab skill for the full bench workflow. Use when working on BreadboardView, breadboard workbench UX, starter/project/exact-part placement, bench stash, board health, breadboard coach overlays, breadboard trust/readiness, breadboard realism, wire editing, or schematic-to-breadboard sync. Triggers on breadboard, breadboard lab, board health, bench, exact part, starter shelf, breadboard coach, breadboard inventory, breadboard audit, breadboard sync, and breadboard workbench.
---

# Breadboard Lab

Use this skill for the ProtoPulse Breadboard tab as a complete bench workflow, not just a placement canvas.

## What This Skill Covers

- Workbench orchestration in `client/src/components/circuit-editor/BreadboardView.tsx`
- Starter, project-linked, stash-backed, and exact-part bench flows
- Board health and issue focus workflows
- Selected-part trust and readiness
- Coach planning, support-part staging, and breadboard-specific AI prompts
- Schematic-to-breadboard sync and provenance
- Breadboard-focused testing and real-browser verification

## What This Skill Does Not Replace

- Generic frontend design guidance: compose with `frontend-design`
- Generic testing process: compose with `testing-mastery`
- Generic completion proof: compose with `verification-mastery`
- Whole-repo onboarding: compose with `project-context`

## Mandatory Breadboard Lens

Every Breadboard change should answer:

1. Can a beginner tell how to start within seconds?
2. Can they distinguish starter, project-linked, and verified exact parts?
3. Is stash reality visible, not implied?
4. Does the change improve debugging confidence, not just visual density?
5. Does the Breadboard tab stay coherent with schematic, inventory, validation, and AI guidance?
6. Is the claimed improvement proven in a real browser?

## Workflow

1. Start with `references/architecture-and-entrypoints.md`.
2. Identify whether the request is primarily orchestration, canvas, trust/readiness, coach/audit, or sync/provenance.
3. Check whether the capability already exists but is under-surfaced from `BreadboardView.tsx`.
4. Prefer the smallest change that improves the whole bench workflow.
5. Update the nearest Breadboard tests.
6. Verify the changed flow in a live browser.
7. If the work surfaced durable product knowledge, capture it in `knowledge/`.

## References

- `references/architecture-and-entrypoints.md`
- `references/workflow-playbook.md`
- `references/testing-and-browser-verification.md`
- `references/ai-audit-and-sync.md`

## Optional Helper Script

If you need a fast repo orientation pass for Breadboard work, run:

`./.agents/skills/breadboard-lab/scripts/inspect-breadboard-surface.sh`
