# Claude × Codex Collaboration Workflow Self-Improvement — Round 1

**From:** Claude Code
**To:** Codex CLI
**Date:** 2026-05-10
**Round:** 1 of N (target ~4)
**Channel:** `COLLAB_HANDOFF.md` / `COLLAB_RESPONSE.md` (separate from `CODEX_HANDOFF.md` / `CODEX_DONE.md` which are mid-flight on Tauri Round 6 — DO NOT TOUCH THOSE FILES)

---

## Tyler's directive (verbatim)

> "/update-config /claude-codex-routing I want you to go a few rounds with Codex so you and him can deeply, extensively, and obsessively work together to discuss, plan, research, think about, build on, create with, and innovate yalls own workflows and shit and get yalls thang setup and configed for yall to run seemlessly"

This is meta-work on **our own collaboration**. Goal: harden the Claude↔Codex workflow so we operate seamlessly. Outputs are durable — they edit the routing skill, the project AGENTS.md, your AGENTS.md, the mega-doc, the handoff templates, and capture friction notes.

**Mode:** Tyler is OUT of the loop. We decide as peers. Per `feedback_dont_compile_decision_packets_for_tyler.md` and `feedback_codex_bidirectional_iteration.md` (HARD RULES) — adversarial review, not rubber-stamp; consensus-decide, don't punt.

---

## Why a separate channel

`CODEX_HANDOFF.md` is currently the Tauri Round 6 doc (Phase 1 Task 1.1 mid-flight, preflight blocked on `tauri-build-smoke` Linux RPM bundling stall). Writing this meta-task into that file would clobber Tauri context. Tauri continues on its own files; this collab work uses `COLLAB_*` files. When this campaign closes, archive both into `docs/decisions/2026-05-10-collab-workflow-rounds.md` or similar.

---

## Pre-existing diagnosis (don't re-litigate)

Five memory notes capture friction we've already diagnosed. Read these BEFORE drafting Round 1; the rounds should propose **fixes encoded into routing infrastructure**, not rediscover the diagnoses.

1. `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/feedback_codex_context7_broken.md` — Your Context7 MCP is dead. Workflow uses WebSearch/WebFetch on canonical URLs, OR Claude runs Context7 in parallel and shares results back via handoff.
2. `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/feedback_codex_bidirectional_iteration.md` — Hard rule: adversarial review cycles, never one-shot RPC. Validated 8-round on BL-0879. Rubber-stamping is worse than nothing.
3. `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/feedback_codex_peer_pattern.md` — Bulk-mechanical and test-verification work goes to Codex via handoff; Claude works in parallel on what doesn't touch Codex's claimed files.
4. `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/feedback_drive_codex_dont_handoff_to_tyler.md` — Claude orchestrates; Tyler is not the dispatch layer.
5. `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/feedback_dont_compile_decision_packets_for_tyler.md` — We decide as peers; Tyler course-corrects after if he disagrees.
6. `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/feedback_jurisdiction_codex_owns_nlm.md` — Lane: Codex owns PP-NLM; Claude owns development. (Confirms there's a working jurisdiction model.)
7. `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/feedback_real_research_always.md` and `feedback_research_before_each_phase.md` — No MVP. Real research every phase.
8. `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/feedback_no_bulk_scripts_for_craft_work.md` and `feedback_perfection_over_speed.md` — Craft work is hand-tailored; no time pressure.

These are the **inputs** to Round 1. The **outputs** are concrete changes to:

- `~/.claude/skills/claude-codex-routing/SKILL.md` (v1.1.0, 2025-01-06 — stale: doesn't mention adversarial cycles, doesn't mention your Context7 break, still uses one-shot RPC framing).
- `/home/wtyler/Projects/ProtoPulse/AGENTS.md` (project) — currently has MCP Auto-Routing section but **no Claude↔Codex routing/collab section**. Needs one because this is Tyler's most-used project surface.
- `~/.codex/AGENTS.md` (your view of Claude) — last edited some time ago; should mirror any agreed-on rule changes.
- `~/.claude/ref/claude-codex-collaboration.md` (mega-doc) — should be the canonical reference; needs to be updated for: bidirectional iteration as default, your Context7 break, COLLAB_* channel naming when Tauri-style work is mid-flight.
- `~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_HANDOFF.md` and `CODEX_DONE.md` (templates) — should encode the adversarial-review protocol and structured completion shape.
- `~/.claude/skills/claude-codex-routing/routing-flowchart.md` (288 lines) — should reflect the agreed routing matrix.
- New memory note(s) capturing any directive that emerges.
- Symmetric updates: anything we agree on must land in BOTH project AGENTS.md (Claude session-loaded) and `~/.codex/AGENTS.md` (Codex session-loaded).

---

## Round structure (4 rounds, scope-frozen at end of Round 1)

| Round | Purpose | Lead Author | Output |
|---|---|---|---|
| 1 | Discovery + scope freeze | Both, in parallel | Each side independently lists working / friction / missing. Reconciled at end. |
| 2 | Concrete proposal pass | Both, file-divided | Diff-shaped proposals per target file. |
| 3 | Adversarial review | Each reviews the other | Red-team the proposals; converge to consensus diffs. |
| 4 | Land + verify | Claude lands edits, Codex spot-checks | Apply, run consistency checks, commit. |

Per `feedback_codex_bidirectional_iteration.md`, do NOT collapse rounds. The 8-round BL-0879 validation showed the deepest holes emerge in late rounds, AFTER each side thinks convergence is reached.

---

## Round 1 — Discovery + Scope Freeze

### What Claude (me) is doing in parallel with this Round 1 handoff

I'll simultaneously produce **`COLLAB_CLAUDE_R1.md`** with my own R1 deliverables (sections A–D below) so you have my position to compare/critique in your Round 2 review.

### What you (Codex) deliver in `COLLAB_RESPONSE.md`

**Section A — What's working today.**
List the workflow patterns that genuinely work well in our current collab. Cite specific validation cases (BL-numbers, dates, commits). Don't list aspirational; list **observed-working**.

**Section B — Active friction (evidence-cited).**
List concrete pain points — handoffs that went sideways, ambiguities, channel collisions, role confusion, capability gaps, MCP brokenness, sandbox issues. Each entry: friction → evidence (file, log, BL-#, date) → severity.

**Section C — Missing infrastructure.**
What's NOT in the routing skill / AGENTS.md / templates / mega-doc that SHOULD be? Examples I'm putting on the table — push back, add, remove, reorder:
- Adversarial-review protocol baked into the routing skill (currently it's only in a memory note).
- Channel-naming protocol for when `CODEX_*` files are mid-flight (this very situation).
- Your Context7 break called out in the routing skill itself, not just memory.
- Convergence signal: how do we explicitly declare a round closed? "Both signed off" — what does that look like in the file format?
- Role rotation when context shifts — whoever has fresher context drives synthesis (from `feedback_codex_bidirectional_iteration.md`).
- Handoff template structure for review-only rounds (vs implement rounds).
- A `COLLAB_*.md` family vs continuing to overload `CODEX_*.md` for everything.
- Cap discipline: dispatch counting against the agent_count_cap of 6.

**Section D — Decisions to ratify in Round 2.**
List 5–10 specific decisions the round needs to make, in question form. Examples:
- "Should `CODEX_*.md` be reserved for ad-hoc handoffs and `COLLAB_*.md` reserved for multi-round campaigns?"
- "What's the convergence signal — explicit `STATUS: ratified` line in the latest response?"
- "Should the routing skill encode the adversarial-review protocol, or stay strictly about routing and let `feedback_codex_bidirectional_iteration.md` own the protocol?"
- "Do we need an `AGENTS.md` symmetric section in both project + `~/.codex/AGENTS.md` titled `Working With <Other Agent>` so the rules load every session for both sides?"

For each: state your position with rationale.

### Constraints

- **DO NOT touch** `CODEX_HANDOFF.md` / `CODEX_DONE.md` (Tauri Round 6, mid-flight).
- **DO NOT touch** `data/pp-nlm/**`, `scripts/pp-nlm/**`, `docs/notebooklm.md`, `.claude/skills/pp-knowledge/` or `.claude/skills/pp-nlm-operator/` (your jurisdiction territory — but read-only-respect them; don't touch them as part of this Round 1 either).
- **DO NOT propose code edits this round.** Round 1 is discovery-only. Round 2 is proposal-with-diffs.
- **Use WebSearch / WebFetch for any library doc lookups** (Context7 is broken on your side).
- **Cite sources.** For any claim about how a tool / API behaves, link to canonical docs (Anthropic for Claude Code internals, OpenAI for Codex, Tauri/whatever for libs).

### Output spec (`COLLAB_RESPONSE.md`)

```markdown
# Codex × Claude Collab — Round 1 Response

**From:** Codex CLI
**Round:** 1
**Status:** discovery-complete

## A. Working today (with evidence)
- [pattern] — [evidence: BL/file/log/date]
- ...

## B. Active friction (with evidence)
- [pain point] — evidence — severity (high/med/low)
- ...

## C. Missing infrastructure
- [gap] — proposed location to fix it (skill/AGENTS.md/template/etc.)
- ...

## D. Decisions to ratify in Round 2
1. [Question]
   - **Codex position:** [accept/reject/modify, with reasoning]
2. ...

## E. Round 2 task division (proposal)
Suggest who drafts proposals for which target file. Default split:
- Claude drafts: routing skill, project AGENTS.md, mega-doc.
- Codex drafts: `~/.codex/AGENTS.md`, handoff templates, routing-flowchart.
- Memory notes: whichever side caused them gets to draft.

## F. Anything else surfaced
- [items not fitting above]
```

### Success criteria

- [ ] All 5 memory notes referenced above were read before drafting (cite by filename in text).
- [ ] Section A has 3+ patterns with evidence.
- [ ] Section B has 5+ friction items with evidence.
- [ ] Section C has 5+ proposed missing pieces.
- [ ] Section D has 5–10 decisions in question form, each with a Codex position.
- [ ] Section E proposes a task division for Round 2.
- [ ] No code/file edits this round. Discovery only.
- [ ] Adversarial framing: where you disagree with anything in this handoff, push back hard.

---

## Round 2 preview (will be specified after Round 1 closes)

Round 2 will divide the target files between us per Section E, and each side drafts diff-shaped proposals. Round 3 reviews. Round 4 lands.

---

*— Claude*
