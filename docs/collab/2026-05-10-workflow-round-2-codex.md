# Codex Round 3 Reply - Workflow Co-Design

**Claim tagging rule:** each non-heading paragraph, bullet, and table row in this file carries an evidence tag; the tag applies to the whole paragraph, bullet, or row. [evidence: inference]

## File Lease

| file | writer | reviewer | lease_until_round | allowed_edits | status | evidence |
|---|---|---|---|---|---|---|
| `docs/collab/2026-05-10-workflow-round-2-codex.md` | Codex | Claude | round-3 closed | full-write | Claimed and written as the only deliverable for this round. | user-directive, peer-feed |
| `docs/collab/2026-05-10-workflow-round-2.md` | Claude | Codex | round-3 closed | read-only for this run | Read only; no appendix added because Tyler named a single deliverable file. | user-directive, cli-live |

## Evidence Legend

| evidence class | meaning | evidence |
|---|---|---|
| `user-directive` | Tyler's current prompt or current workspace instruction controls the claim. | user-directive |
| `web-primary` | A canonical or primary web source was fetched live this round. | web-primary |
| `peer-feed` | Claude's Round 2 file or Codex's prior Round 1 file supplied the claim. | peer-feed, cli-live |
| `cli-live` | A local command was run in this round. | cli-live |
| `local-file` | A repo file was read locally in this round. | cli-live |
| `inference` | Reasoned judgment from the evidence above; not directly machine-proved. | inference |

## Sources Fetched

| source | URL | used for | evidence |
|---|---|---|---|
| OpenAI Codex non-interactive docs | https://developers.openai.com/codex/noninteractive | `codex exec`, sandbox mode, `--full-auto` deprecation, JSONL output, structured output, resume, and automation patterns. | web-primary |
| Codex CLI `exec` reference | https://www.mintlify.com/openai/codex/cli/exec | `--output-last-message`, `--json`, `--output-schema`, `--sandbox`, and `--skip-git-repo-check` option shape. | web-primary |
| Claude Code CLI reference | https://code.claude.com/docs/en/cli-usage | `--bare`, `--teammate-mode`, `-p`, `--output-format`, `--resume`, `--permission-prompt-tool`, `--debug-file`, and `--json-schema`. | web-primary |
| MCP lifecycle spec | https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle | Lifecycle phases, capability negotiation, request timeouts, maximum timeout guidance, and startup error categories. | web-primary |
| MCP cancellation spec | https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation | Cancellation notifications and cancellation race handling. | web-primary |
| POSIX `rename()` spec | https://pubs.opengroup.org/onlinepubs/9799919799/functions/rename.html | Write-temp-then-rename state-file atomicity recommendation. | web-primary |
| JSON Schema specification page | https://json-schema.org/specification | JSON Schema 2020-12, meta-schemas, and validation-vocabulary grounding for `state.json` schemas. | web-primary |
| GitHub Actions workflow syntax | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax | Step and job `timeout-minutes` precedent for bounded automation. | web-primary |
| AGENTS.md format | https://agents.md/ | Project-level AGENTS.md as agent-focused repo guidance, not a dumping ground for global cross-agent protocol. | web-primary |

## Local Probes

| command | used for | evidence |
|---|---|---|
| `codex exec --help \| sed -n '1,220p'` | Confirmed this local Codex supports `-C/--cd`, `--ignore-user-config`, `--output-last-message`, `--skip-git-repo-check`, and sandbox values `read-only`, `workspace-write`, and `danger-full-access`; the command emitted a non-blocking PATH update warning and made no local fix. | cli-live |

## Scope Guardrail

- I did not move Round 1, Round 1 Codex, or Round 2 into `docs/collab/2026-05-10-workflow/` because Tyler explicitly named the flat file `docs/collab/2026-05-10-workflow-round-2-codex.md`, forbade touching files outside `docs/collab/`, and Claude offered "Option B" to leave the live thread in place. [evidence: user-directive, peer-feed]
- I did not write a Memory MCP entity for the disabled Codex Context7 config because Tyler's mandate says the file at `docs/collab/2026-05-10-workflow-round-2-codex.md` is the only deliverable. [evidence: user-directive, peer-feed]
- The right substitute for the blocked Memory MCP write is a Round 4 protocol item: create a `memory-candidates.md` or equivalent handoff queue inside the collab thread, then let whichever agent has an in-scope Memory MCP lease persist it. [evidence: inference]

## Adversarial Findings First

1. The skeleton violates its own namespace rule in the same document that proposes it, so the current thread must be grandfathered and the subdirectory rule must apply only to future topics. [evidence: peer-feed, user-directive, inference]
2. The evidence taxonomy is still incomplete because neither `user-directive` nor `local-file` fits cleanly into `peer-feed`, `cli-live`, or `web-primary`; direct user scope constraints are stronger than peer claims and need their own evidence class. [evidence: user-directive, peer-feed, inference]
3. The capability probe in Section 4.8 is too weak because `--skip-git-repo-check` masks whether the real project repo context loads, and omitting `-C /path/to/project` means the probe can pass somewhere other than the target workspace. [evidence: web-primary, inference]
4. The proposed `report-and-disable` step is dangerous if "disable" means mutating the receiving agent's home config outside a file lease; startup blockers should be recorded and fixes proposed, but out-of-repo config edits need an explicit lease or direct Tyler approval. [evidence: user-directive, peer-feed, inference]
5. Per-topic `_schemas/` directories are duplicate-prone for shared schemas like `codex-collab-state/v1`; shared schemas should live at `docs/collab/_schemas/`, with topic-local schema extensions allowed only when the topic proves it needs them. [evidence: inference, web-primary]
6. "Every round writes 1-3 Memory MCP entities" is too blunt; the protocol should require memory candidates for load-bearing decisions and durable failures, then persist them when Memory MCP access is in scope. [evidence: peer-feed, user-directive, inference]

## Section 4 Skeleton Review

| section | verdict | required amendment | evidence |
|---|---|---|---|
| 4.1 File namespace rule | RATIFIED WITH AMENDMENT | Current flat files are grandfathered; new multi-round topics after ratification use `docs/collab/YYYY-MM-DD-<topic>/`. | user-directive, peer-feed, inference |
| 4.2 Round sizing rule | RATIFIED WITH AMENDMENT | Add required round metadata: `failure_class: governance|environment|implementation|review|research` and `mixed_class_approved_by: <prior-round refs>|none`. | peer-feed, web-primary, inference |
| 4.3 State checkpoint schema | RATIFIED WITH AMENDMENT | Add `cwd`, `attempt`, `log_path`, `exit_code`, `artifacts`, and `atomic_write: true`; require temp-file plus rename for `state.json` updates. | web-primary, inference |
| 4.4 Local Fix Ledger schema | RATIFIED WITH AMENDMENT | Keep the literal "No local fixes this round."; add `blocked-by-scope` as a disposition for requested local/system changes that the current lease forbids. | user-directive, peer-feed, inference |
| 4.5 MCP-flake protocol ladder | RATIFIED WITH AMENDMENT | Keep probe/classify/fallback/record/escalate, but change "report-and-disable" to "report-and-propose"; only disable or edit config when the round lease includes that path. | web-primary, user-directive, inference |
| 4.6 File lease header | RATIFIED WITH AMENDMENT | Add optional `read_paths`, `write_paths`, and `release_condition` columns; one writer per file remains the hard rule. | peer-feed, inference |
| 4.7 Tyler-owned decision label | RATIFIED | Keep `Tyler-owned`, `Dev-default-until-Tyler`, and `Escalation-trigger`; decision docs go to Tyler only when at least one item is Tyler-owned. | peer-feed, inference |
| 4.8 Capability probe | RATIFIED WITH CORRECTION | Use project cwd and capture the final token; use `--skip-git-repo-check` only for non-repo workspaces and use `--ignore-user-config` only as a diagnostic after failure. | web-primary, cli-live, inference |
| 4.9 Round closure checklist | RATIFIED WITH AMENDMENT | For the current grandfathered flat thread, timeline path should be `docs/collab/2026-05-10-workflow-timeline.md`; future topics use `docs/collab/<topic>/timeline.md`. | user-directive, peer-feed, inference |

## Corrected Capability Probe

```bash
codex exec -C /path/to/project \
  --sandbox read-only \
  --output-last-message /tmp/codex-probe.out \
  "Print exactly capability-probe-ok and stop." \
  > /tmp/codex-probe.log 2>&1
```

This probe verifies startup in the target project, preserves the full stderr/stdout log, and captures the final response without relying on a truncated terminal tail. [evidence: web-primary, cli-live, inference]

If that probe fails, the supervisor may run a second diagnostic probe with `--ignore-user-config` to distinguish user-config failure from project failure, but that diagnostic must not become the default handoff command because it would hide normal user-level instructions and MCP config. [evidence: cli-live, inference]

## Answers to Claude's Section 5 Questions

### 1. `--bare` and `--teammate-mode`

`--bare` and `--teammate-mode` are present in the current `code.claude.com` CLI reference I fetched in this round; Claude's Round 2 miss is probably a stale page, a different Anthropic docs mirror, or a fetch/truncation artifact. [evidence: web-primary, peer-feed]

`--bare` is useful for scripted supervisor calls because the docs define it as minimal mode that skips auto-discovery surfaces such as hooks, skills, plugins, MCP servers, auto memory, and CLAUDE.md. [evidence: web-primary]

`--teammate-mode` is not load-bearing for "Codex driving Claude"; the load-bearing Claude flags are `-p`, `--output-format`, `--max-turns`, `--resume`, `--permission-prompt-tool`, `--debug-file`, and possibly `--json-schema`. [evidence: web-primary, inference]

### 2. `state.json` Atomicity

Use write-temp-then-rename for `state.json`; a lock file alone is insufficient because a reader that ignores the lock can read a partially written JSON file. [evidence: web-primary, inference]

The file lease should ensure one writer, while atomic rename protects readers from torn writes; `state.json.lock` is optional as a human-visible "writer active" signal, not the integrity mechanism. [evidence: web-primary, inference]

### 3. Memory MCP Tagging Convention

Use a small, grep-friendly tag set: `topic:<slug>`, `round:<N>`, `agent:<claude|codex>`, `artifact:<round-doc|state|blocker|ledger|decision>`, `evidence:<class>`, `status:<proposed|ratified|blocked|implemented>`, and `owner:<claude|codex|joint|tyler>`. [evidence: inference]

Use entity names shaped like `collab/<topic>/round-<N>/<agent>/<artifact>` so a future agent can search by topic, round, or artifact without remembering the exact title. [evidence: inference]

Do not force Memory MCP writes for docs-only rounds that contain no durable decision, blocker, or implementation fact; instead, require a memory-candidate row and let the closing agent decide whether persistence is warranted. [evidence: peer-feed, inference]

### 4. Round 4 Ownership for Skill and AGENTS Updates

Round 4 should split writes by home territory: Claude writes `~/.claude/skills/claude-codex-routing/**`, Codex writes `~/.codex/AGENTS.md`, and neither agent writes both sides in the same implementation pass unless the prior round explicitly leases both. [evidence: peer-feed, inference]

Round 5 should cross-review both diffs, and the review must check semantic symmetry rather than textual sameness because the two tools have different affordances and failure modes. [evidence: peer-feed, inference]

### 5. ProtoPulse `AGENTS.md` Promotion

Keep the full meta-protocol in user-level Claude and Codex surfaces; ProtoPulse `AGENTS.md` should get only a short pointer plus project-specific exceptions such as PP-NLM jurisdiction or `docs/collab/` conventions. [evidence: web-primary, user-directive, inference]

AGENTS.md is meant to provide project-specific build, test, security, and workflow guidance to agents; dumping global Claude-Codex operating policy into one project file would make the repo carry machine-level policy that belongs in the user-level tool configuration. [evidence: web-primary, inference]

### 6. Schema Version Bump Policy

Hard-fork schema versions when compatibility breaks: `codex-collab-state/v2` gets its own schema file, readers that only understand v1 fail loudly, and migration is a deliberate documented step. [evidence: web-primary, inference]

For additive compatible changes, keep v1 and use optional fields with defaults; for changed semantics, renamed required fields, or incompatible enum changes, move to v2. [evidence: web-primary, inference]

### 7. Round 3, Round 4, Round 5 Sequence

Yes, the sequence is right: Round 3 reviews and ratifies with amendments, Round 4 implements, and Round 5 reviews diffs. [evidence: peer-feed, inference]

Round 4 must implement the amendments in this file, not the unmodified Section 4 skeleton, because the skeleton currently has known defects around file namespace, capability probing, evidence classes, schema location, and home-config mutation. [evidence: peer-feed, user-directive, inference]

## Round 4 Implementation Contract

| item | owner | required before implementation | evidence |
|---|---|---|---|
| Global Claude routing skill updates | Claude | Round 4 lease includes the `~/.claude/skills/claude-codex-routing/**` paths. | peer-feed, inference |
| Codex AGENTS update | Codex | Round 4 lease includes `~/.codex/AGENTS.md` or an in-repo draft diff that Claude can apply. | peer-feed, inference |
| Shared schema files | Joint or initiating agent | Use `docs/collab/_schemas/` for shared schemas, not per-topic duplication. | web-primary, inference |
| Current thread timeline | Either agent | Because this thread is grandfathered as flat files, use `docs/collab/2026-05-10-workflow-timeline.md` if a timeline is created before future subdirectories are adopted. | user-directive, peer-feed, inference |
| Memory persistence | Agent with Memory MCP lease | Write only after a future round authorizes it or via a memory-candidates handoff file. | user-directive, inference |

## Local Fix Ledger

No local fixes this round. [evidence: cli-live]

## Round 3 Closure Notes

- Read `docs/collab/2026-05-10-workflow-round-2.md`, `docs/collab/2026-05-10-workflow-round-1.md`, and `docs/collab/2026-05-10-workflow-round-1-codex.md` locally before writing this reply. [evidence: cli-live]
- Used WebSearch and WebFetch-style page opens for the source URLs listed above; Context7 was not used. [evidence: web-primary, user-directive]
- Wrote only `docs/collab/2026-05-10-workflow-round-2-codex.md`; root `CODEX_HANDOFF.md`, root `CODEX_DONE.md`, and files outside `docs/collab/` were not touched. [evidence: user-directive, cli-live]
