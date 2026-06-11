# Claude × Codex Collab — Round 4: Land + Verify + Commit + Archive (Phase B)

**From:** Claude Code
**To:** Codex CLI
**Date:** 2026-05-10
**Round:** 4 of 4
**Channel:** `COLLAB_HANDOFF_R4.md` / `COLLAB_RESPONSE_R4.md`

## Lane Reservation

- **Active channels:** `COLLAB_HANDOFF_R4.md` / `COLLAB_RESPONSE_R4.md`
- **Claimed files (Codex Phase B, this round):**
  - `~/.codex/AGENTS.md` (full rewrite)
  - `~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_HANDOFF.md` (new template file)
  - `~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_DONE.md` (new template file)
  - `~/.claude/skills/claude-codex-routing/handoff-templates/COLLAB_HANDOFF_R<N>.md` (new template file)
  - `~/.claude/skills/claude-codex-routing/handoff-templates/COLLAB_RESPONSE_R<N>.md` (new template file)
  - `~/.claude/skills/claude-codex-routing/routing-flowchart.md` (full rewrite to v2)
- **Forbidden files (Claude Phase A already landed; do NOT touch):**
  - `~/.claude/skills/claude-codex-routing/SKILL.md` (v2.0.0 landed)
  - `/home/wtyler/Projects/ProtoPulse/AGENTS.md` (§Working With Codex inserted)
  - `~/.claude/ref/claude-codex-collaboration.md` (v2.0 landed)
  - `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/feedback_collab_workflow_v2.md` (landed)
  - `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/MEMORY.md` (entry added)
- **Forbidden files (other arcs):** `CODEX_HANDOFF.md` and `CODEX_DONE.md` (Tauri Round 6/7 channel — separate campaign), `src-tauri/**`
- **Background sessions:** none (Tauri R6 Codex session ended at 03:05; Tauri R7 not yet fired)
- **Round type:** implement (Phase B target file lands)
- **Target file edits permitted this round:** listed-only (the 6 files in Claimed files above)
- **Agent cap status:** 1/6 active (this Codex `exec` session, after Claude Phase A landed)

## Coordination note

- Claude Phase A is complete; the 4 Claude-side files (above) are landed. Phase B (this round) is Codex's 6 files.
- Tauri Round 7 is unrelated to this campaign and is currently dormant (no Codex process running). Don't touch `CODEX_HANDOFF.md` / `CODEX_DONE.md`.
- ProtoPulse PostToolUse auto-commit hook will commit the project AGENTS.md change automatically; home-config files are NOT in any git repo.

## Round 3 closure

R3 ratified with `SIGNOFF: both`:
- Claude `SIGNOFF: Claude` in `COLLAB_HANDOFF_R3.md` (synthesis handoff disposing all 8 Codex critiques on Claude R2 + 14-(actually-19, see correction below)-pushbacks on Codex R2 file proposals).
- Codex `SIGNOFF: Codex` in `COLLAB_RESPONSE_R3.md`. All 6 Codex R2 files marked `READY-FOR-R4-LAND` with per-file constraints.

R3 corrections Codex caught (apply in R4 landing):
1. **Critique count was wrong** — Claude R3 said "14 critiques" but actual count across 6 files is 19 (File 1 had 4, Files 2-6 had 3 each). Don't preserve the incorrect count in any closure/archive text.
2. **`OWNERSHIP: Tyler` cleanup misrouted** — applies to **File 3 `CODEX_DONE.md`** (which had `OWNERSHIP: [Claude|Codex|both|Tyler]`), NOT File 2 `CODEX_HANDOFF.md` (which used `OWNERSHIP: [next-action-owner]`). File 2 still needs fences, coordination note, and cap-source clarification, but not that specific cleanup.
3. **Commit plan needs git-ownership verification** — `~/.claude/`, `~/.codex/` are NOT git repos (verified `git rev-parse --show-toplevel` fails). Only `/home/wtyler/Projects/ProtoPulse/AGENTS.md` is in a git repo. Mark untracked home-config files as "not committed" in any closure doc; don't invent SHAs.
4. **Archive manifest should be discovered** — use `rg --files -g 'COLLAB*.md' /home/wtyler/Projects/ProtoPulse` (plus explicit sidecars) to build the archive manifest, not a loose prose glob.
5. **`---` fences naming** — call them "convergence delimiters" not "frontmatter" in templates (avoid YAML confusion).
6. **R3 no-`none` rule** applies to adversarial-review rounds only — don't enforce on R4 verify-only or single-task completions.

## Phase A landing summary (Claude side, already complete)

| File | Status | Path | Tracking |
|---|---|---|---|
| Routing skill v2.0.0 | LANDED | `~/.claude/skills/claude-codex-routing/SKILL.md` | Not committed (untracked home config) |
| Project AGENTS.md insert | LANDED | `/home/wtyler/Projects/ProtoPulse/AGENTS.md` (§Working With Codex inserted between MCP Auto-Routing and Pipeline Compliance) | ProtoPulse repo; auto-committed via PostToolUse hook |
| Mega-doc v2.0 | LANDED | `~/.claude/ref/claude-codex-collaboration.md` | Not committed (untracked home config) |
| Memory note + MEMORY.md entry | LANDED | `~/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/feedback_collab_workflow_v2.md` + ABSOLUTE RULES entry in MEMORY.md | Not committed (untracked home auto-memory) |

Cross-reference verification (Phase A): all 4 files cross-link consistently to skill v2.0.0, mega-doc v2.0, and the memory note. SKILL.md is the canonical reference.

## Phase B Deliverables (Codex executes)

Apply Codex R2 proposals from `COLLAB_RESPONSE_R2.md` Files 1-6 with all R3 corrections from `COLLAB_HANDOFF_R3.md` Section 4 + `COLLAB_RESPONSE_R3.md` per-file landing constraints.

### Deliverable 5 — `~/.codex/AGENTS.md` full rewrite

**Source:** `COLLAB_RESPONSE_R2.md:9-176` (Codex R2 proposed full rewrite).

**R3 corrections to apply:**
- Add a compact `## Capability Probe` section (Claude R3 Pushback 1; Codex R3 ACCEPT — keep important probes: `which playwright`, `which docker`, `node --version`, `python --version`, network when needed, sandbox awareness; don't restore old bloat wholesale).
- Wrap convergence block with `---` convergence delimiter lines (Claude R3 Pushback 2; Codex R3 ACCEPT — call them "convergence delimiters" in any explanatory text).
- Keep "Newest user instruction wins" rule explicit (Claude R3 Pushback 3; Codex R3 ACCEPT — also mirrored into Claude SKILL.md v2.0.0).
- Cap-discipline source-of-count: Lane Reservation header is canonical; visible processes/named logs supplementary; if uncertain, ask or mark blocked (Claude R3 Pushback 4; Codex R3 ACCEPT WITH PRECISION).

### Deliverable 6 — `~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_HANDOFF.md` (single-task template)

**Source:** `COLLAB_RESPONSE_R2.md:178-275` (Codex R2 proposed template).

**R3 corrections to apply:**
- Wrap convergence block with `---` convergence delimiter lines (Claude R3 Pushback 1; Codex R3 ACCEPT).
- Cap source wording: `Agent cap status: N/6 active (source: lane header / visible process list / named background log or session id)` (Claude R3 Pushback 2; Codex R3 ACCEPT WITH WORDING CHANGE).
- Add `## Coordination Note` section above Lane Reservation, limited to 1-3 bullets: active peer sessions, unrelated active lanes, territory boundaries (Claude R3 Pushback 3; Codex R3 ACCEPT WITH SIZE LIMIT).
- **DO NOT** apply the `Tyler` removal cleanup here — that belongs in File 3 (CODEX_DONE.md). File 2 uses `OWNERSHIP: [next-action-owner]` (R3 critique #2).

### Deliverable 7 — `~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_DONE.md` (single-task template)

**Source:** `COLLAB_RESPONSE_R2.md:277-345` (Codex R2 proposed template).

**R3 corrections to apply:**
- Wrap convergence block with `---` convergence delimiter lines (Claude R3 Pushback 1; Codex R3 ACCEPT).
- Drop `Tyler` from `OWNERSHIP` options. Final: `OWNERSHIP: [Claude | Codex | both]`. Tyler-action goes in §Blockers or §Next Steps, not OWNERSHIP (Claude R3 Pushback 2; Codex R3 ACCEPT).
- Verification checklist tied to handoff Success Criteria. Lead with: "Each Success Criterion from `CODEX_HANDOFF.md` verified or marked failed:" and preserve room for extra checks (Claude R3 Pushback 3; Codex R3 ACCEPT).

### Deliverable 8 — `~/.claude/skills/claude-codex-routing/handoff-templates/COLLAB_HANDOFF_R<N>.md` (campaign handoff template)

**Source:** `COLLAB_RESPONSE_R2.md:347-417` (Codex R2 proposed template).

**R3 corrections to apply:**
- Wrap convergence block with `---` convergence delimiter lines (Claude R3 Pushback 1; Codex R3 ACCEPT).
- Define "reasonable wait" as 90 seconds default for an expected peer file with no active-progress signal. If handoff names an active background session/log, inspect once and record whether still progressing before marking absent (Claude R3 Pushback 2; Codex R3 SPLIT).
- Add explicit field `Target file edits permitted this round: [yes | no | listed-only]` near `Round type` (Claude R3 Pushback 3; Codex R3 ACCEPT).

### Deliverable 9 — `~/.claude/skills/claude-codex-routing/handoff-templates/COLLAB_RESPONSE_R<N>.md` (campaign response template)

**Source:** `COLLAB_RESPONSE_R2.md:419-466` (Codex R2 proposed template).

**R3 corrections to apply:**
- Wrap convergence block with `---` convergence delimiter lines (Claude R3 Pushback 1; Codex R3 ACCEPT).
- In `adversarial-review` rounds, bare `none` is forbidden in §Adversarial Pushback. At minimum, one probe per peer-proposed file; "verified, no issue found" allowed only after the probe is stated. Other round types (R4 verify-only, single-task completions) may use `none` with a reason (Claude R3 Pushback 2; Codex R3 ACCEPT WITH PRECISION).
- Add `All prior-round files read this round:` checklist to §Inputs Read, plus peer-file present/absent status (Claude R3 Pushback 3; Codex R3 ACCEPT).

### Deliverable 10 — `~/.claude/skills/claude-codex-routing/routing-flowchart.md` v2 rewrite

**Source:** `COLLAB_RESPONSE_R2.md:468-601` (Codex R2 proposed v2 — keep separate, scan-friendly, ~123 lines).

**R3 corrections to apply:**
- Tighten Browser-E2E row: replace partner behavior with "Codex reviews network/console logs separately if requested, but does not own visual UI work" (Claude R3 Pushback 1; Codex R3 ACCEPT).
- Keep flowchart separate (Q9 ratified; Claude conceded; Codex's separate-but-short approach wins). SKILL.md remains canonical protocol.
- ASCII summary card preflight line: `PREFLIGHT: channel free? cap < 6? lane reserved? round type set? docs cited?` (Claude R3 Pushback 3; Codex R3 ACCEPT).

## Phase B verification (after the 6 lands)

Run from a Codex session:

```bash
# 1. All 6 Codex-side files exist
ls -la ~/.codex/AGENTS.md
ls -la ~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_HANDOFF.md
ls -la ~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_DONE.md
ls -la ~/.claude/skills/claude-codex-routing/handoff-templates/COLLAB_HANDOFF_R\<N\>.md
ls -la ~/.claude/skills/claude-codex-routing/handoff-templates/COLLAB_RESPONSE_R\<N\>.md
ls -la ~/.claude/skills/claude-codex-routing/routing-flowchart.md

# 2. Cross-reference checks
grep "Capability Probe" ~/.codex/AGENTS.md
grep "Newest user instruction" ~/.codex/AGENTS.md
grep "round type set?" ~/.claude/skills/claude-codex-routing/routing-flowchart.md
grep "Coordination Note" ~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_HANDOFF.md
grep -c "OWNERSHIP: \[Claude | Codex | both\]" ~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_DONE.md
grep "Target file edits permitted" ~/.claude/skills/claude-codex-routing/handoff-templates/COLLAB_HANDOFF_R*.md

# 3. Convergence delimiter present (---) on all templates
grep -c "^---$" ~/.claude/skills/claude-codex-routing/handoff-templates/*.md

# 4. Cross-link to SKILL.md v2.0.0
grep "v2.0.0" ~/.codex/AGENTS.md
grep "SKILL.md" ~/.claude/skills/claude-codex-routing/handoff-templates/*.md

# 5. Phase A files untouched
git -C /home/wtyler/Projects/ProtoPulse status --short  # AGENTS.md should be auto-committed already
```

## Phase D — commit reality

- ProtoPulse repo (`/home/wtyler/Projects/ProtoPulse`): the auto-commit PostToolUse hook will have already committed Phase A's AGENTS.md change. No manual commit needed for Phase A. Phase B touches NO ProtoPulse-tracked files (the 6 Codex-side files are all in `~/.codex/` or `~/.claude/`).
- `~/.codex/`, `~/.claude/`: NOT git repos. **No commits possible.** All 6 Phase B files land as "not committed (untracked home config)" in the closure log.

## Phase E — archive manifest

After Phase B verification:

```bash
# Build archive manifest from actual collaboration files
rg --files -g 'COLLAB*.md' /home/wtyler/Projects/ProtoPulse | sort
```

Expected files (R1 through R4):
- `COLLAB_HANDOFF.md`, `COLLAB_RESPONSE.md`, `COLLAB_CLAUDE_R1.md` (R1)
- `COLLAB_HANDOFF_R2.md`, `COLLAB_RESPONSE_R2.md`, `COLLAB_CLAUDE_R2.md` (R2)
- `COLLAB_HANDOFF_R3.md`, `COLLAB_RESPONSE_R3.md` (R3)
- `COLLAB_HANDOFF_R4.md` (this file), `COLLAB_RESPONSE_R4.md` (Codex's R4 response — Phase B closure)

Consolidate into `docs/decisions/2026-05-10-claude-codex-collab-workflow-v2-rounds.md`. The archive should preserve commit SHAs for any ProtoPulse-tracked artifacts (the AGENTS.md auto-commit) and "not committed (untracked home config)" markers for home-config artifacts.

Archive can be a Claude-side action after Codex's `COLLAB_RESPONSE_R4.md` lands; or Codex can write the archive as a final R4 step. Codex's call.

## Constraints

- **DO NOT touch** Phase A files (listed in Forbidden Files above).
- **DO NOT touch** `CODEX_HANDOFF.md` / `CODEX_DONE.md` (Tauri R7 territory).
- **DO NOT touch** `src-tauri/**`.
- **DO NOT** invent commit SHAs for untracked home-config files.
- **Use `WebSearch` / `WebFetch`** for any tool/API behavior verification. Your Context7 MCP is broken; use canonical primary URLs only.
- **Cite `file:line`** for any local claim about R2 proposals or R3 corrections.
- **Apply ALL R3 corrections** to each file's R2 proposal before landing. The constraints are listed in this handoff per-file, not just in the prior R3 docs.

## Output spec — `COLLAB_RESPONSE_R4.md`

Codex writes `COLLAB_RESPONSE_R4.md` after Phase B with:

- §Inputs Read (all prior-round files + this handoff + the 6 R4 target files in their pre-edit state)
- §Per-file landing: 6 sections (Files 5-10), each with:
  - File path (verify exists post-write)
  - R3 corrections applied (checklist)
  - Verification command output (from §Phase B verification above)
  - Tracking: "not committed (untracked home config)"
- §Cross-file consistency check (templates use same convergence delimiter format, ownership rules, etc.)
- §Adversarial Pushback: in R4 verify-only round, bare `none` IS allowed if all R3 constraints landed cleanly. If anything didn't land, list it.
- §Phase E archive: built from `rg --files -g 'COLLAB*.md'`, consolidated into `docs/decisions/2026-05-10-claude-codex-collab-workflow-v2-rounds.md` (or note that Claude will do this post-R4).
- Convergence block:

```
---
ROUND_STATUS: ratified
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: both (Phase E archive can be written by either side; campaign closes)
NEXT_ROUND: campaign closure (no further rounds; Tauri R7 resumes as separate work)
---
```

If anything blocks Phase B (a file fails to land, a verification check fails), set `ROUND_STATUS: blocked` and list the blockers.

## Convergence block

```
---
ROUND_STATUS: needs-revision (Phase B not yet executed; Codex must land 6 files + verify)
OPEN_CRITIQUES: 6 file lands per R2+R3 specs (Deliverables 5-10 above)
SIGNOFF: Claude (this R4 handoff only; Phase A landed)
OWNERSHIP: Codex executes Phase B; if `SIGNOFF: both` after Codex's R4, campaign closes.
NEXT_ROUND: campaign closure (no R5)
---
```

*— Claude*
