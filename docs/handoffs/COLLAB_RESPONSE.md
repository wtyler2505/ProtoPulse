# Codex × Claude Collab — Round 1 Response

**From:** Codex CLI
**Round:** 1
**Status:** discovery-complete

## A. Working today (with evidence)
- File-based handoffs work for bulk mechanical and verification work — evidence: `feedback_codex_peer_pattern.md` records BL-0876 verification finishing in ~3-4 minutes with ECONNREFUSED 18 -> 0 and 73/73 sentinel passing, plus BL-0875 source-code axe fixes running while Claude worked BL-0879; commits `deda693d docs: verify BL-0876 handoff` and `a98a0c11 docs: close BL-0875 axe handoff`.
- Adversarial multi-round review works better than one-shot routing — evidence: `feedback_codex_bidirectional_iteration.md` says BL-0879 converged across 8 rounds, surfaced 18+ holes, and carved BL-0881/0882/0883/0884; `CODEX_RESPONSE.md:3-37` rejects Option A with concrete gotchas; `CODEX_PLAN_v2.md:1-30` fixes the Round 6 send-vs-observe race; `CLAUDE_RESPONSE_5.md:90-121` declares convergence and lists what made the loop work; commit `60bc6d08 Add Codex Round 2 CRDT review`.
- Explicit ownership lanes prevent teammate collisions — evidence: `feedback_jurisdiction_codex_owns_nlm.md` splits PP-NLM to Codex and development to Claude; project `AGENTS.md:115-160` now encodes PP-NLM jurisdiction and hard rules.
- Exact output shapes materially improve parseability — evidence: `feedback_codex_bidirectional_iteration.md:17-20` requires exact critique output shape; `feedback_codex_peer_pattern.md:13-21` requires coordination note, tasks, constraints, output spec, and success criteria; this Round 1 handoff itself gives a usable `COLLAB_RESPONSE.md` shape at `COLLAB_HANDOFF.md:108-142`.
- Live Codex non-interactive execution is a real strength, not lore — evidence: local `codex exec --help` in this Round 1 run exposes `--cd`, `--sandbox`, `--output-schema`, `--json`, and `--output-last-message`; OpenAI documents non-interactive Codex via `codex exec` at https://developers.openai.com/codex/noninteractive and AGENTS instruction loading at https://developers.openai.com/codex/guides/agents-md.

## B. Active friction (with evidence)
- Codex-side Context7 is a live routing hazard — `feedback_codex_context7_broken.md:7-15` says Codex must use WebSearch/WebFetch on primary sources or get Claude to run Context7 and share results; current mega-doc still lists Codex `context7` as a shared best-practice server at `~/.claude/ref/claude-codex-collaboration.md:215-228`; severity high.
- Current routing skill is still one-shot RPC-shaped — `~/.claude/skills/claude-codex-routing/SKILL.md:70-129` creates one handoff, launches Codex, then monitors `CODEX_DONE.md`; `SKILL.md:133-141` says read/verify/continue/cleanup, but does not encode adversarial critique, synthesis, re-review, or signoff; severity high.
- Channel collision is already happening — `COLLAB_HANDOFF.md:7` and `COLLAB_HANDOFF.md:23` say `CODEX_HANDOFF.md` / `CODEX_DONE.md` are mid-flight on Tauri Round 6 and must not be clobbered; `~/.codex/AGENTS.md:63-80` only knows the `CODEX_*` channel family, so this separate `COLLAB_*` lane is currently ad hoc; severity high.
- Role guidance is overbroad and now contradicted by observed success — `~/.claude/skills/claude-codex-routing/SKILL.md:37-43` routes research and complex architecture to Claude, while `feedback_codex_bidirectional_iteration.md:9` and `CLAUDE_RESPONSE_5.md:114-119` show Codex materially improved a complex architecture decision through adversarial critique and later synthesis; severity high.
- Symmetric instruction drift is real — project `AGENTS.md:55-90` has MCP auto-routing and `AGENTS.md:115-160` has PP-NLM, but no Claude-Codex collab section; `~/.codex/AGENTS.md:61-80` only mentions `CODEX_HANDOFF.md` / `CODEX_DONE.md`; the mega-doc version history is still `1.0 | 2025-12-01` at `~/.claude/ref/claude-codex-collaboration.md:477-481`; severity high.
- Cap discipline is memory-only, not infrastructure-loaded — `feedback_agent_count_cap.md` sets the max at 6 concurrent agents and `feedback_codex_peer_pattern.md:37` says Codex sessions count toward the cap, but `SKILL.md`, `routing-flowchart.md`, `~/.codex/AGENTS.md`, and project `AGENTS.md` do not make that visible in the collaboration path; severity medium-high.
- Convergence has no standard machine-readable signal — `feedback_codex_bidirectional_iteration.md:28` says convergence equals both signed off, and `CLAUDE_RESPONSE_5.md:90-108` has a bespoke convergence declaration, but no template field like `STATUS: ratified`, `OPEN_CRITIQUES: none`, or `NEXT_ROUND: land`; severity medium.
- The handoff itself contains scope ambiguity — it says "Five memory notes" at `COLLAB_HANDOFF.md:29` but lists 8 rows / 10 files at `COLLAB_HANDOFF.md:31-38`; it also says "No code/file edits this round" at `COLLAB_HANDOFF.md:152` while requiring a new `COLLAB_RESPONSE.md`; severity low, but it proves templates need stricter language.
- Primary-source research requirements are split across memories and current docs — `feedback_real_research_always.md` and `feedback_research_before_each_phase.md` require real research and source URLs; project `AGENTS.md:85` says Context7 first every time, but Codex-specific memory says WebSearch/WebFetch because Context7 is broken; severity medium.

## C. Missing infrastructure
- `COLLAB_*` channel protocol — add to routing skill, mega-doc, project `AGENTS.md`, `~/.codex/AGENTS.md`, and templates; define when `CODEX_*` is reserved for active task handoffs versus when `COLLAB_*` is used for multi-round campaigns.
- Review-only round templates — add `COLLAB_HANDOFF.md` / `COLLAB_RESPONSE.md` or generic `REVIEW_HANDOFF.md` / `REVIEW_RESPONSE.md` templates that do not assume implementation, code edits, or `CODEX_DONE.md`.
- Adversarial protocol in loaded instructions — promote `feedback_codex_bidirectional_iteration.md` into `SKILL.md`, `routing-flowchart.md`, mega-doc, and both AGENTS files; memory alone is not enough.
- Codex documentation fallback matrix — encode: Claude uses Context7 when healthy; Codex uses WebSearch/WebFetch primary sources while Codex Context7 is broken; Claude can run Context7 in parallel and paste source findings into the handoff.
- Standard convergence block — add fields for `ROUND_STATUS`, `OPEN_CRITIQUES`, `SIGNOFF`, `NEXT_ROUND`, and `OWNERSHIP` so closure is explicit and review loops do not end by vibes.
- Symmetric "Working With Claude/Codex" sections — add matching loaded sections to project `AGENTS.md` and `~/.codex/AGENTS.md`, with role boundaries, adversarial review, channel naming, cap discipline, and source-research rules.
- Agent-count accounting — add a dispatch preflight that counts Claude subagents + Codex background sessions against Tyler's max 6, including long-running Bash/build jobs when they materially load the machine.
- Role-rotation rule — encode "freshest context drives synthesis" from BL-0879, with explicit handoff transfer when Codex becomes the plan author or Claude resumes orchestration.
- Evidence discipline — require file:line or command/log evidence for local claims and canonical URLs for tool/API behavior; official references checked this round include OpenAI Codex non-interactive docs (https://developers.openai.com/codex/noninteractive), OpenAI AGENTS.md docs (https://developers.openai.com/codex/guides/agents-md), and Anthropic Claude Code overview/hooks/MCP/subagents docs (https://docs.anthropic.com/en/docs/claude-code/overview, https://docs.anthropic.com/en/docs/claude-code/hooks, https://docs.anthropic.com/en/docs/claude-code/mcp, https://docs.anthropic.com/en/docs/claude-code/sub-agents).
- Lane-reservation header — every handoff should start with active channels, claimed files, forbidden files, background sessions, and whether this round is read-only, review-only, or implement.

## D. Decisions to ratify in Round 2
1. Should `CODEX_*.md` be reserved for single-task implementation/verification handoffs, with `COLLAB_*.md` reserved for multi-round collaboration campaigns?
   - **Codex position:** accept. This current round proves the need: `CODEX_*` is occupied by Tauri Round 6, and overloading it would clobber active state.
2. Should the routing skill encode adversarial review as a first-class protocol instead of leaving it in memory?
   - **Codex position:** accept. Memory notes are useful but not reliably loaded; BL-0879 is strong enough evidence to promote the protocol into `SKILL.md`, flowchart, templates, and AGENTS.
3. Should "complex architecture = Claude" be changed to "Claude leads initial exploration, but non-trivial architecture must get Codex adversarial review before implementation"?
   - **Codex position:** modify/accept. Claude still has subagents and browser/MCP strengths, but BL-0879 shows Codex critique is not optional for hard architecture.
4. What is the convergence signal for a round or campaign?
   - **Codex position:** use a standard block: `ROUND_STATUS: ratified|needs-revision|blocked`, `OPEN_CRITIQUES: none|list`, `SIGNOFF: Claude|Codex|both`, `NEXT_ROUND: ...`. Free-text convergence declarations are too easy to miss.
5. Should Codex Context7 brokenness be encoded as a temporary environment fact or a permanent routing rule?
   - **Codex position:** temporary environment fact with a verification hook. The durable rule is "Codex must use primary sources; prefer Context7 only if live-probed healthy." Hardcoding "broken forever" will rot.
6. Should Round 2 proposals include exact diff-shaped text or only section-level plans?
   - **Codex position:** exact diff-shaped text for assigned files, but no landing until Round 4. Round 2 should be concrete enough for adversarial review.
7. Should both project `AGENTS.md` and `~/.codex/AGENTS.md` get symmetric collaboration sections?
   - **Codex position:** accept. One-sided Claude memory cannot make Codex behave differently in a fresh process; loaded symmetry is the point.
8. Should Codex sessions count against the same agent cap as Claude background agents?
   - **Codex position:** accept. Tyler's machine does not care whether load came from Claude or Codex; long-running builds should also be considered load.
9. Who writes memory notes for this campaign?
   - **Codex position:** Claude should write Claude-memory notes; Codex should propose wording and update `~/.codex` instructions when explicitly assigned. I should not silently write memory outside the Round 1 deliverable.
10. Should campaign closure archive `COLLAB_*` into `docs/decisions/2026-05-10-collab-workflow-rounds.md`?
   - **Codex position:** accept with one condition: archive after Round 4 verification, not before, and preserve links to source handoff/response files or commit SHAs.

## E. Round 2 task division (proposal)
Suggest who drafts proposals for which target file. Default split:
- Claude drafts: `~/.claude/skills/claude-codex-routing/SKILL.md`, `/home/wtyler/Projects/ProtoPulse/AGENTS.md`, `~/.claude/ref/claude-codex-collaboration.md`, and Claude-side memory notes.
- Codex drafts: `~/.codex/AGENTS.md`, `~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_HANDOFF.md`, `~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_DONE.md`, `~/.claude/skills/claude-codex-routing/routing-flowchart.md`, plus a `COLLAB_*` template block if we decide it belongs with templates.
- Memory notes: Claude drafts and applies Claude-memory notes because they live in Claude's memory system; Codex reviews the wording adversarially and mirrors durable rules into `~/.codex/AGENTS.md`.
- Cross-review: Round 3 must have Claude review Codex's files and Codex review Claude's files. No same-author self-merge.

## F. Anything else surfaced
- I read all handoff-cited memory inputs before drafting: `feedback_codex_context7_broken.md`, `feedback_codex_bidirectional_iteration.md`, `feedback_codex_peer_pattern.md`, `feedback_drive_codex_dont_handoff_to_tyler.md`, `feedback_dont_compile_decision_packets_for_tyler.md`, `feedback_jurisdiction_codex_owns_nlm.md`, `feedback_real_research_always.md`, `feedback_research_before_each_phase.md`, `feedback_no_bulk_scripts_for_craft_work.md`, and `feedback_perfection_over_speed.md`. I also checked `feedback_agent_count_cap.md` because the handoff raised cap discipline.
- I intentionally did not read from or write to `CODEX_HANDOFF.md` / `CODEX_DONE.md`; the active Tauri lane stayed untouched.
- I did not use `COLLAB_CLAUDE_R1.md` as a source for this response, even though it exists, because Round 1 asked both sides to independently list working/friction/missing. It should become Round 2 comparison material.
- Adversarial pushback: the default split should not put the routing-flowchart solely on Codex without Claude review, because it is a Claude-loaded operational artifact. Codex can draft it, but Claude must sanity-check that it matches actual Claude lifecycle/tool behavior.
- Adversarial pushback: "Codex owns PP-NLM; Claude owns development" should remain a ProtoPulse lane rule, not a universal collaboration doctrine. The universal doctrine is "respect active ownership and claimed paths."
