# Gemini CLI Global Tune-Up, Repair, Modernization & Enhancement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **NOTE:** This plan operates on Tyler's Gemini CLI installation at `~/.gemini/`, NPM global package `@google/gemini-cli@0.37.1`, and project-level `.gemini/` folders under `~/Projects/`. It does **NOT** modify any ProtoPulse application code — ProtoPulse is CWD but this plan's jurisdiction is Gemini CLI only.

**Goal:** Audit, repair, modernize, and enhance Tyler's global, user, local, and project-level Gemini CLI configuration to eliminate stale/invalid settings, reclaim ~4–6 GB of disk, align with the v0.37.1 schema, adopt new v0.23–v0.37 features (worktrees, Chapters, task tracker, sandbox, checkpointing, Agent Skills spec), harden security, deduplicate resources shared with Claude Code, and produce a runbook for ongoing maintenance.

**Architecture:** Non-destructive audit first → full backup → phased repair (hygiene → settings → extensions → skills → MCP health → feature adoption → project-level) → verification smoke test → runbook handoff. Every destructive action is gated by a backup step. Every settings change is validated against the official schema. Every extension is probed in isolation before being kept or removed.

**Tech Stack:**
- **CLI:** `@google/gemini-cli@0.37.1` (installed at `~/.nvm/versions/node/v22.22.0/lib/node_modules/@google/gemini-cli`)
- **Node:** v22.22.0 via nvm
- **Model:** `gemini-3.1-pro-preview` (1M context, 64k output, preview — replaces deprecated gemini-3-pro-preview as of March 9, 2026)
- **Auth:** `oauth-personal` (OAuth creds in `~/.gemini/oauth_creds.json`)
- **MCP servers:** 25+ via extensions (context7, chrome-devtools, genkit, clear-thought, vision, screenshare, scribe, code-review, conductor, etc.)
- **Skills:** 51 entries in `~/.gemini/skills/` (mix of Agent Skills, legacy SKILL.md, and one broken symlink)
- **Config files:** `~/.gemini/settings.json`, `~/.gemini/GEMINI.md`, 8 project-level `GEMINI.md` files, `~/.gemini/policies/auto-saved.toml` (3390 lines), `~/.gemini/extensions/extension-enablement.json` (70+ entries)

**References (read before starting any phase):**
- Official changelog: https://geminicli.com/docs/changelogs/latest/
- Settings schema: https://geminicli.com/docs/reference/configuration/
- Extension best practices: https://geminicli.com/docs/extensions/best-practices/
- Agent Skills spec: https://geminicli.com/docs/cli/skills/
- MCP server docs: https://geminicli.com/docs/tools/mcp-server/
- Hosted schema JSON: https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json
- GitHub releases: https://github.com/google-gemini/gemini-cli/releases
- Known OAuth token refresh bug: https://github.com/google-gemini/gemini-cli/issues/23776

---

## Existing State Inventory (2026-04-10 audit snapshot)

| Area | Path | Current State | Issues Identified |
|------|------|---------------|-------------------|
| CLI binary | `~/.nvm/versions/node/v22.22.0/bin/gemini` | v0.37.1 | On current stable (v0.37.0 released 2026-04-08, .1 is patch). OK. |
| User config | `~/.gemini/settings.json` | 60 lines | Contains invalid/undocumented keys: `tools.autoAccept`, `experimental.skills`, `experimental.introspectionAgentSettings`, `general.plan.directory: ""`. Missing: `experimental.worktrees`, `experimental.topicUpdateNarration` (Chapters), `experimental.taskTracker`, `general.checkpointing.enabled`, `tools.sandbox`, `security.autoAddToPolicyByDefault`. |
| Global memory | `~/.gemini/GEMINI.md` | 10 entries | Cross-contaminated: OmniTrek Nexus, Tauri/Pake, Android ADB project-specific directives in global scope. Duplicate entries (lines 2–3 are near-identical). |
| Auth | `~/.gemini/oauth_creds.json` | updated Apr 10 14:23 | OAuth-personal active. No API key fallback configured. |
| Projects registry | `~/.gemini/projects.json` | 16 entries | Some stale: `/home/wtyler/.openclaw/workspace`, `/home/wtyler/be-honest`, `/home/wtyler/3nj0ym3nt/A_Void_Reality`. |
| Trusted folders | `~/.gemini/trustedFolders.json` | 2 entries | `/home/wtyler/multi-controller-app` TRUST_PARENT — directory may be stale. |
| Extensions | `~/.gemini/extensions/` | 25 dirs, 2.7 GB | Many duplicate Claude Code MCP servers (chrome-devtools, context7, clear-thought). `genkit` hardcodes `/home/linuxbrew/.linuxbrew/bin/genkit` path. |
| Extension enablement | `~/.gemini/extensions/extension-enablement.json` | 70+ entries | >45 orphaned entries for extensions NOT installed on disk. |
| Extension integrity | `~/.gemini/extension_integrity.json` | 1 entry | Only context7 has hash. 24 other extensions lack integrity signatures. |
| Commands | `~/.gemini/commands/` | 9 TOML files | Some may duplicate Claude Code slash commands (`audit-code`, `deep-audit`, `focus`, `ultrathink`, etc.). |
| Skills | `~/.gemini/skills/` | 51 entries, 268 MB | Mix of legacy and v0.23+ Agent Skills spec. One broken symlink: `file-organizer → ~/.claude/skills/file-organizer`. |
| Policies | `~/.gemini/policies/auto-saved.toml` | 3390 lines | Auto-accumulated from session use. Likely contains rules for tools/servers no longer installed. |
| Tools (npm) | `~/.gemini/tools/` | 325 node_modules, 40 MB | Purpose unclear — package.json is 79 bytes. Likely stale. |
| History | `~/.gemini/history/` | 92 MB | Chat history; session retention says 30d but may not be pruning. |
| Temp | `~/.gemini/tmp/` | **1.3 GB** | Runtime temp — should be cleanable. |
| Antigravity | `~/.gemini/antigravity/` | **1.2 GB** | Separate Antigravity IDE product. Audit whether still used. |
| Antigravity browser | `~/.gemini/antigravity-browser-profile/` | **1.3 GB** | Chromium profile for Antigravity. Audit whether still used. |
| Backups | `~/.gemini/backups/` | empty | Unused. |
| MCP OAuth tokens | `~/.gemini/mcp-oauth-tokens-v2.json` | 490 bytes | Known bug: tokens die after ~1hr (GH #23776). |
| Memory | `~/.gemini/memory/protopulse/GEMINI.md` | 1 file | Project-scoped memory from `save_memory` tool. |
| Project: ProtoPulse | `~/Projects/ProtoPulse/.gemini/commands/` | 3 subdirs, 14 TOMLs | Contains `claude/assistant.toml` and `gemini-cli-maestro/assistant.toml` — naming collision risk. |
| Project: SM-T580 | `~/Projects/SM-T580_Project/.gemini/` | exists | Not audited yet. |
| GEMINI.md files (root) | 8 files | — | Scattered across `~/cheat`, `~/.gemini`, `~/Parts-List`, `~/OpenLinkHub`, `~/circuitmind-ai`, `~/VOID`, `~/th3-syst3m`, `~/Projects/GEMINI.md`. Some likely stale. |

**Total disk usage in `~/.gemini/`:** ~6.5 GB (268 MB skills + 2.7 GB extensions + 40 MB tools + 1.3 GB tmp + 1.2 GB antigravity + 1.3 GB antigravity-browser + 92 MB history + misc).

---

## Scope Check

This plan covers a single logical subsystem (Gemini CLI installation + configuration). It touches multiple files but they are all part of one cohesive product. It produces working, testable software at every phase boundary — after each phase the CLI must still start, authenticate, and respond. No sub-project split is warranted.

---

## Phase 0 — Deep Research & Documentation Ingest (READ-ONLY)

**Goal:** Build an authoritative knowledge base of every Gemini CLI feature, setting, and known issue before touching anything.

**Files (scratchpad only, no system state changes):**
- Create: `~/gemini-cli-audit/research/01-changelog-v023-to-v037.md`
- Create: `~/gemini-cli-audit/research/02-settings-schema.md`
- Create: `~/gemini-cli-audit/research/03-extension-spec.md`
- Create: `~/gemini-cli-audit/research/04-agent-skills-spec.md`
- Create: `~/gemini-cli-audit/research/05-mcp-best-practices.md`
- Create: `~/gemini-cli-audit/research/06-known-issues.md`
- Create: `~/gemini-cli-audit/research/07-sandbox-guide.md`
- Create: `~/gemini-cli-audit/research/08-ide-integration.md`

### Task 0.1 — Scaffold research workspace

- [ ] **Step 1:** Create research directory tree.

  ```bash
  mkdir -p ~/gemini-cli-audit/{research,audit,backups,scripts,runbooks}
  ```

- [ ] **Step 2:** Initialize git repo for research scratchpad (so every change is reversible).

  ```bash
  cd ~/gemini-cli-audit && git init -q && git commit --allow-empty -m "chore: init gemini cli audit workspace"
  ```

### Task 0.2 — Pull every release note v0.23 → v0.37

- [ ] **Step 1:** Fetch the full changelog index from the official docs site and from the GitHub releases page. Save to `research/01-changelog-v023-to-v037.md`. For each release, extract: new features, bug fixes, settings schema changes, breaking changes, new experimental flags, deprecations.

  ```bash
  # Use WebFetch tool (inside agent session) against:
  #   https://geminicli.com/docs/changelogs/
  #   https://github.com/google-gemini/gemini-cli/releases
  # For each version v0.23.0, v0.24.0, ... v0.37.1 — extract headline changes.
  ```

- [ ] **Step 2:** Produce a flat "feature adoption checklist" — every feature introduced between the release Tyler installed and v0.37.1, with a yes/no on whether it is currently enabled in `~/.gemini/settings.json`.

- [ ] **Step 3:** Commit.

  ```bash
  cd ~/gemini-cli-audit && git add research/01-changelog-v023-to-v037.md && git commit -m "research: changelog v0.23→v0.37"
  ```

### Task 0.3 — Ingest the complete settings schema

- [ ] **Step 1:** Download the canonical schema JSON and save locally.

  ```bash
  curl -sSL https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json \
    -o ~/gemini-cli-audit/research/settings.schema.json
  ```

- [ ] **Step 2:** Write `research/02-settings-schema.md` — a plain-language reference of every valid key, type, default, and interaction (especially: `security.folderTrust` × `security.enablePermanentToolApproval` × `general.defaultApprovalMode` × `security.autoAddToPolicyByDefault` — the four-way approval interaction).

- [ ] **Step 3:** Flag every key currently in Tyler's `~/.gemini/settings.json` that is **not** present in the schema. These are invalid or undocumented.

- [ ] **Step 4:** Commit.

### Task 0.4 — Document the extension spec (gemini-extension.json)

- [ ] **Step 1:** Fetch https://geminicli.com/docs/extensions/reference/ and https://geminicli.com/docs/extensions/best-practices/ — save to `research/03-extension-spec.md`.

- [ ] **Step 2:** Build a checklist of required vs optional fields: `name`, `version`, `description`, `mcpServers`, `contextFileName`, `excludeTools`, `includeTools`, `settings[].name/description/envVar/sensitive`, `commands`, `tools`.

- [ ] **Step 3:** Document the `gemini extensions link` local-dev workflow and the signed-archive distribution workflow.

- [ ] **Step 4:** Commit.

### Task 0.5 — Document the Agent Skills spec

- [ ] **Step 1:** Fetch https://geminicli.com/docs/cli/skills/ and save to `research/04-agent-skills-spec.md`.

- [ ] **Step 2:** Record: required `SKILL.md` file, frontmatter keys (name, description, version, tags, when_to_use), three-tier discovery (workspace > user > extension), activation flow via `activate_skill` tool, how bundled assets get read permissions, overlap/precedence rules.

- [ ] **Step 3:** Build a validator checklist an auditor can use to score each of Tyler's 51 skills: Does it have `SKILL.md`? Frontmatter? Description under 200 chars? Name matches directory?

- [ ] **Step 4:** Commit.

### Task 0.6 — MCP best practices & known OAuth bug

- [ ] **Step 1:** Fetch https://geminicli.com/docs/tools/mcp-server/ and save to `research/05-mcp-best-practices.md`.

- [ ] **Step 2:** Fetch the two tracking issues for MCP OAuth token refresh (gh #23776, gh #23296) and document the current workaround (restart CLI every ~55 min for OAuth MCP servers, or use API-key servers where possible).

- [ ] **Step 3:** Document per-server config fields: `command`, `args`, `url`, `httpUrl`, `env`, `trust`, `timeout`, `cwd`, `includeTools`, `excludeTools`. Note: alias names must not contain underscores.

- [ ] **Step 4:** Commit.

### Task 0.7 — Known issues / troubleshooting intel

- [ ] **Step 1:** Search the GitHub issues tracker (via `gh api repos/google-gemini/gemini-cli/issues?state=all&per_page=100`) for open high-severity bugs, and cross-reference against Tyler's v0.37.1. Save to `research/06-known-issues.md`.

- [ ] **Step 2:** Specifically investigate: MCP timeout errors, OAuth refresh failures, `/mcp auth` hang, sandbox escape/noop cases on Linux, skill activation failures, context window overrun with many GEMINI.md files.

- [ ] **Step 3:** Commit.

### Task 0.8 — Sandbox on Linux

- [ ] **Step 1:** Research Linux sandbox options for v0.37.1: docker, podman, and the new v0.37 dynamic sandbox expansion. Save to `research/07-sandbox-guide.md`.

- [ ] **Step 2:** Document: how `forbiddenPaths` works, how `sandboxAllowedPaths` interacts, whether `tools.sandbox: "docker"` is practical on Tyler's system, prerequisites (docker daemon running, image pull), trade-offs (perf, volume mounts, color passthrough).

- [ ] **Step 3:** Commit.

### Task 0.9 — IDE / Editor integration landscape

- [ ] **Step 1:** Research: Gemini CLI's relationship to Antigravity IDE, VS Code extensions, `gemini` inside tmux, ACP mode for multi-agent orchestration. Save to `research/08-ide-integration.md`.

- [ ] **Step 2:** Determine whether Tyler's `~/.gemini/antigravity/` and `antigravity-browser-profile/` (combined 2.5 GB) are still active — when were they last used? Is Antigravity still installed? Can they be safely removed?

- [ ] **Step 3:** Commit.

### Task 0.10 — Consolidated research summary

- [ ] **Step 1:** Write `research/00-EXECUTIVE-SUMMARY.md` — a one-page summary of every finding, every opportunity, every risk. This is the document Tyler reviews before approving Phase 2+.

- [ ] **Step 2:** Commit.

---

## Phase 1 — Non-Destructive Deep Audit (READ-ONLY)

**Goal:** Inventory and score every file in `~/.gemini/` and every project-level `.gemini/` folder. No writes, no deletions.

**Files:**
- Create: `~/gemini-cli-audit/audit/snapshot-manifest.txt`
- Create: `~/gemini-cli-audit/audit/settings-validation-report.md`
- Create: `~/gemini-cli-audit/audit/extension-inventory.md`
- Create: `~/gemini-cli-audit/audit/skills-inventory.md`
- Create: `~/gemini-cli-audit/audit/mcp-servers-health.md`
- Create: `~/gemini-cli-audit/audit/memory-contamination-report.md`
- Create: `~/gemini-cli-audit/audit/stale-references.md`
- Create: `~/gemini-cli-audit/audit/disk-usage.md`
- Create: `~/gemini-cli-audit/audit/CONSOLIDATED-FINDINGS.md`

### Task 1.1 — Full filesystem snapshot

- [ ] **Step 1:** Produce a complete file tree with sizes, mtimes, and permissions.

  ```bash
  find ~/.gemini -printf '%s %TY-%Tm-%Td %TH:%TM %m %p\n' 2>/dev/null \
    > ~/gemini-cli-audit/audit/snapshot-manifest.txt
  ```

- [ ] **Step 2:** Hash every config file for later diffing.

  ```bash
  find ~/.gemini -maxdepth 2 -type f \( -name "*.json" -o -name "*.toml" -o -name "*.md" \) \
    -exec sha256sum {} + > ~/gemini-cli-audit/audit/config-hashes.txt
  ```

- [ ] **Step 3:** Commit.

### Task 1.2 — Validate settings.json against the schema

- [ ] **Step 1:** Use `ajv` or `jsonschema` (via npx) to validate the current settings.json.

  ```bash
  npx --yes ajv-cli validate \
    -s ~/gemini-cli-audit/research/settings.schema.json \
    -d ~/.gemini/settings.json 2>&1 | tee ~/gemini-cli-audit/audit/settings-schema-output.txt
  ```

- [ ] **Step 2:** For each key in Tyler's settings.json, write a row in `audit/settings-validation-report.md`:
  - Key path (e.g., `tools.autoAccept`)
  - Present in schema? (yes/no)
  - Current value
  - Schema-defined default
  - Recommended value (and why)

- [ ] **Step 3:** Flag these known issues to verify:
  - `tools.autoAccept: true` — NOT in schema; determine whether deprecated or never existed
  - `experimental.skills: true` — NOT in documented experimental flags
  - `experimental.introspectionAgentSettings.enabled: true` — NOT in docs
  - `general.plan.directory: ""` — empty string; probably should be `undefined`
  - `model.name: "gemini-3.1-pro-preview"` — valid, but confirm it isn't silently being aliased
  - `general.plan.modelRouting` — missing (defaults true)
  - `general.checkpointing` — missing entirely
  - `experimental.worktrees` — missing (would default false; Tyler should enable)
  - `experimental.topicUpdateNarration` — missing (Chapters feature)
  - `experimental.taskTracker` — missing
  - `experimental.enableAgents` — missing (defaults true, OK)
  - `security.autoAddToPolicyByDefault` — missing (may explain 3390-line policy file)
  - `security.disableYoloMode` — missing (consider enabling given folderTrust on)
  - `tools.sandbox` — missing entirely (no sandboxing)
  - `tools.shell.inactivityTimeout` — defaults 300s; may want higher
  - `context.fileName` — missing (defaults to GEMINI.md; with 8 files + `loadMemoryFromIncludeDirectories: true` this can blow context)
  - `privacy.usageStatisticsEnabled` — defaults true; confirm intent

- [ ] **Step 4:** Commit.

### Task 1.3 — Extension inventory & validation

- [ ] **Step 1:** For every directory under `~/.gemini/extensions/`, collect: name, version, presence of `gemini-extension.json`, declared MCP servers, declared context file, declared excludeTools, size, last modified.

  ```bash
  for d in ~/.gemini/extensions/*/; do
    name=$(basename "$d")
    manifest="$d/gemini-extension.json"
    if [ -f "$manifest" ]; then
      echo "=== $name ==="
      jq -r '{name,version,description,mcpServers:(.mcpServers|keys),contextFileName,excludeTools}' "$manifest"
      du -sh "$d" 2>/dev/null
    else
      echo "=== $name [NO MANIFEST] ==="
    fi
  done > ~/gemini-cli-audit/audit/extension-inventory.md
  ```

- [ ] **Step 2:** Cross-reference `~/.gemini/extensions/extension-enablement.json` against installed extensions. List:
  - **Orphaned enablement entries:** listed in enablement but not installed
  - **Unlisted installed extensions:** installed but not in enablement
  - **Override conflicts:** multiple overrides for overlapping paths

- [ ] **Step 3:** For each manifest, validate it against the extension manifest schema from `research/03-extension-spec.md`. Flag:
  - Missing `version` field
  - `version: "latest"` (bad practice, e.g., chrome-devtools-mcp)
  - Hardcoded absolute paths (e.g., genkit's `/home/linuxbrew/.linuxbrew/bin/genkit`)
  - Missing `excludeTools` on extensions with shell access
  - Missing `timeout` on MCP servers (slow servers may break)
  - Missing `trust` field (defaults false; confirm intent)
  - Settings with secrets but no `"sensitive": true`

- [ ] **Step 4:** Identify duplicates between `~/.gemini/extensions/` and `~/.claude/` MCP servers (`.claude.json`, claude-code plugins). Candidates: chrome-devtools-mcp, context7, clear-thought, code-review, vision, conductor, scribe.

- [ ] **Step 5:** Commit.

### Task 1.4 — Skills inventory & Agent Skills spec compliance

- [ ] **Step 1:** For every directory under `~/.gemini/skills/`, collect: name, presence of SKILL.md, frontmatter validity, description length, size, last modified.

  ```bash
  for d in ~/.gemini/skills/*/; do
    name=$(basename "$d")
    skill_md="$d/SKILL.md"
    if [ -L "$d" ]; then
      echo "=== $name [SYMLINK → $(readlink "$d")] ==="
    elif [ -f "$skill_md" ]; then
      echo "=== $name ==="
      head -20 "$skill_md"
    else
      echo "=== $name [NO SKILL.md] ==="
      ls -la "$d" 2>/dev/null | head -5
    fi
  done > ~/gemini-cli-audit/audit/skills-inventory.md
  ```

- [ ] **Step 2:** For each skill, score against `research/04-agent-skills-spec.md` validator checklist. Produce a scoreboard: skill name | has SKILL.md | valid frontmatter | description length OK | name matches dir | has `when_to_use` | symlink-or-real | size.

- [ ] **Step 3:** Specifically investigate:
  - `file-organizer` symlink to `~/.claude/skills/file-organizer` — confirm target exists and Gemini can follow symlinks
  - `playground-enhancements.md` as a bare file in the skills dir (not in a subdirectory) — is this a skill or a stray file?
  - Duplicates between `~/.gemini/skills/` and `~/.claude/skills/` and `~/.claude/plugins/cache/.../skills/`

- [ ] **Step 4:** Commit.

### Task 1.5 — MCP server health (connectivity test)

- [ ] **Step 1:** For each enabled extension with an MCP server, attempt to start it in isolation to see if it actually works. Use a short timeout.

  ```bash
  # Example for context7
  timeout 10 npx -y @upstash/context7-mcp --help 2>&1 | head -20
  # Example for chrome-devtools-mcp
  timeout 10 npx chrome-devtools-mcp@latest --help 2>&1 | head -20
  # Example for genkit (has hardcoded path)
  timeout 10 /home/linuxbrew/.linuxbrew/bin/genkit mcp -- --help 2>&1 | head -20
  # etc. for every MCP server declared in any gemini-extension.json
  ```

- [ ] **Step 2:** For each server, record: start success, stderr output, whether tools register, env vars required, suggested timeout.

- [ ] **Step 3:** Write `audit/mcp-servers-health.md` — a table: server name | status | error (if any) | recommended action (keep / fix / remove).

- [ ] **Step 4:** Commit.

### Task 1.6 — Memory contamination audit

- [ ] **Step 1:** Read every GEMINI.md in the following locations and tag each line as: `global` (applies anywhere), `project-specific` (mentions a specific project by name), `stale` (references deleted projects or obsolete directives), `duplicate`.

  Files to audit:
  - `~/.gemini/GEMINI.md`
  - `~/cheat/GEMINI.md`
  - `~/Parts-List/GEMINI.md`
  - `~/OpenLinkHub/GEMINI.md`
  - `~/circuitmind-ai/GEMINI.md`
  - `~/VOID/GEMINI.md`
  - `~/th3-syst3m/GEMINI.md`
  - `~/Projects/GEMINI.md`
  - `~/Projects/ProtoPulse/GEMINI.md` (symlink to AGENTS.md per ProtoPulse convention — verify)
  - `~/.gemini/memory/protopulse/GEMINI.md`
  - Every `GEMINI.md` inside `~/.gemini/extensions/*/`

- [ ] **Step 2:** Write `audit/memory-contamination-report.md`:
  - For each file: total lines, global %, project-specific %, stale %, duplicate %
  - Flag: OmniTrek directives in global, Tauri/Pake directives in global, Android ADB directives in global, duplicate lines 2–3 in `~/.gemini/GEMINI.md`

- [ ] **Step 3:** Propose a rewritten global GEMINI.md (Phase 4 will execute the rewrite).

- [ ] **Step 4:** Commit.

### Task 1.7 — Stale references audit (projects, trusted folders, policies)

- [ ] **Step 1:** For each path in `~/.gemini/projects.json`, check whether the directory still exists and is non-empty. List stale entries.

  ```bash
  jq -r '.projects | keys[]' ~/.gemini/projects.json | while read p; do
    [ -d "$p" ] && echo "OK: $p" || echo "STALE: $p"
  done > ~/gemini-cli-audit/audit/stale-projects.txt
  ```

- [ ] **Step 2:** Same for `~/.gemini/trustedFolders.json`.

- [ ] **Step 3:** Parse `~/.gemini/policies/auto-saved.toml` (3390 lines). For each `[[rule]]` extract `mcpName`, `toolName`, `commandPrefix`. Cross-check against:
  - Currently installed extensions (orphaned mcpName → stale rule)
  - Currently available tools
  - Reasonable commandPrefix lists

- [ ] **Step 4:** Write `audit/stale-references.md` listing every stale entry across projects, trusted folders, and policies.

- [ ] **Step 5:** Commit.

### Task 1.8 — Disk usage deep dive

- [ ] **Step 1:** Profile `~/.gemini/` with `ncdu` in export mode.

  ```bash
  ncdu -o ~/gemini-cli-audit/audit/ncdu-export.json ~/.gemini
  ```

- [ ] **Step 2:** Specifically profile:
  - `~/.gemini/tmp/` (1.3 GB) — what's in there, when was it last written, is it reclaimable?
  - `~/.gemini/history/` (92 MB) — how many sessions, age distribution, does 30d retention work?
  - `~/.gemini/antigravity/` (1.2 GB) — Antigravity IDE still installed? Last use?
  - `~/.gemini/antigravity-browser-profile/` (1.3 GB) — browser cache, cookies, service workers?
  - `~/.gemini/extensions/` (2.7 GB) — which extensions are the largest? Are there multiple versions of the same package?
  - `~/.gemini/tools/` (40 MB) — what is this for? Contents of package.json?

- [ ] **Step 3:** Write `audit/disk-usage.md` with a prioritized reclamation table: directory | size | can delete? (yes/conditional/no) | reason | command.

- [ ] **Step 4:** Commit.

### Task 1.9 — Project-level `.gemini/` folders

- [ ] **Step 1:** Find every `.gemini` directory under `~/Projects/` and `~/` (outside `.gemini/` itself).

  ```bash
  find ~ -maxdepth 4 -type d -name ".gemini" -not -path "*/.gemini/*" 2>/dev/null
  ```

- [ ] **Step 2:** For each, catalog: settings.json (if present), commands, extensions, memory.

- [ ] **Step 3:** Identify naming collisions: e.g., ProtoPulse has `claude/assistant.toml` AND `gemini-cli-maestro/assistant.toml` — will `/claude:assistant` and `/gemini-cli-maestro:assistant` both work?

- [ ] **Step 4:** Commit.

### Task 1.10 — Consolidated findings document

- [ ] **Step 1:** Write `audit/CONSOLIDATED-FINDINGS.md` — an executive summary combining every audit report. Structure:
  - **P0 (broken/blocking):** invalid settings keys, broken symlinks, orphaned enablement, stale genkit path, OAuth MCP refresh bug, duplicate memory entries, cross-contaminated global memory
  - **P1 (correctness):** stale projects/trusted folders, unvalidated extensions, missing integrity signatures, skills not meeting Agent Skills spec, missing v0.37 features (worktrees, Chapters, taskTracker, checkpointing, sandbox)
  - **P2 (hygiene/modernization):** 4–6 GB disk reclamation, 3390-line policy file pruning, duplicate MCP servers with Claude Code, history prune, tmp clean
  - **P3 (enhancements):** adopt `gemini extensions link` workflow, bundle heavy extensions with esbuild, add `$schema` to settings.json for editor autocomplete, migrate skills to v0.23+ Agent Skills spec

- [ ] **Step 2:** Surface this to Tyler for review before Phase 2.

- [ ] **Step 3:** Commit.

**Phase 1 gate:** Tyler reviews `CONSOLIDATED-FINDINGS.md` and approves Phase 2+ before any write operation.

---

## Phase 2 — Safety Net (Backups & Rollback)

**Goal:** Before any destructive operation, create a full, verified, restorable backup.

**Files:**
- Create: `~/gemini-cli-audit/backups/gemini-<timestamp>.tar.zst`
- Create: `~/gemini-cli-audit/backups/MANIFEST.md`
- Create: `~/gemini-cli-audit/runbooks/ROLLBACK.md`

### Task 2.1 — Full tarball backup of ~/.gemini/ (excluding huge caches)

- [ ] **Step 1:** Determine exclusions. We back up everything except the two regenerable caches if disk is tight; otherwise back up everything.

  ```bash
  TS=$(date +%Y%m%d-%H%M%S)
  tar --zstd -cvf ~/gemini-cli-audit/backups/gemini-${TS}.tar.zst \
    --exclude='.gemini/tmp/*' \
    --exclude='.gemini/antigravity-browser-profile/Default/Cache/*' \
    --exclude='.gemini/antigravity-browser-profile/Default/Code Cache/*' \
    -C /home/wtyler .gemini 2>&1 | tail -20
  ```

- [ ] **Step 2:** Verify backup integrity.

  ```bash
  tar --zstd -tvf ~/gemini-cli-audit/backups/gemini-${TS}.tar.zst > /tmp/backup-verify.txt
  wc -l /tmp/backup-verify.txt
  ```

- [ ] **Step 3:** Record the backup path, size, file count, and sha256 in `backups/MANIFEST.md`.

- [ ] **Step 4:** Commit.

### Task 2.2 — Backup every project-level `.gemini/`

- [ ] **Step 1:** For each project `.gemini/` found in Task 1.9, create a tarball.

  ```bash
  for d in /home/wtyler/Projects/ProtoPulse/.gemini /home/wtyler/Projects/SM-T580_Project/.gemini; do
    name=$(basename "$(dirname "$d")")
    tar --zstd -cvf ~/gemini-cli-audit/backups/${name}-gemini-${TS}.tar.zst -C "$(dirname "$d")" .gemini
  done
  ```

- [ ] **Step 2:** Commit.

### Task 2.3 — Backup every root-level GEMINI.md

- [ ] **Step 1:** Copy each GEMINI.md (the 8 found in Task 1.6) into `backups/gemini-md/` preserving source-path as filename.

  ```bash
  mkdir -p ~/gemini-cli-audit/backups/gemini-md
  for f in ~/cheat/GEMINI.md ~/Parts-List/GEMINI.md ~/OpenLinkHub/GEMINI.md \
           ~/circuitmind-ai/GEMINI.md ~/VOID/GEMINI.md ~/th3-syst3m/GEMINI.md \
           ~/Projects/GEMINI.md ~/.gemini/GEMINI.md; do
    [ -f "$f" ] && cp -v "$f" ~/gemini-cli-audit/backups/gemini-md/"$(echo "$f" | tr / _)"
  done
  ```

- [ ] **Step 2:** Commit.

### Task 2.4 — Author rollback runbook

- [ ] **Step 1:** Write `runbooks/ROLLBACK.md` with explicit commands for every rollback scenario:
  - Restore full `~/.gemini/` from tarball
  - Restore a single file (settings.json, GEMINI.md, policies/auto-saved.toml, extension-enablement.json)
  - Restore a deleted extension directory
  - Restore oauth_creds.json without losing session
  - Restore project-level `.gemini/`
  - Re-download the correct @google/gemini-cli version if downgrade needed

- [ ] **Step 2:** Commit.

### Task 2.5 — Verify rollback on a sacrificial copy

- [ ] **Step 1:** Extract the tarball to a scratch directory and diff against live `~/.gemini/` to prove the backup restores byte-identically (modulo excluded caches).

  ```bash
  mkdir -p /tmp/gemini-verify
  tar --zstd -xf ~/gemini-cli-audit/backups/gemini-${TS}.tar.zst -C /tmp/gemini-verify
  diff -rq /tmp/gemini-verify/.gemini ~/.gemini 2>&1 | grep -v -E "(tmp/|antigravity-browser-profile/Default/Cache|antigravity-browser-profile/Default/Code Cache)" | head -30
  rm -rf /tmp/gemini-verify
  ```

- [ ] **Step 2:** Commit the verify log.

**Phase 2 gate:** Tyler must explicitly confirm the rollback runbook is readable and the backup tarball exists before Phase 3 starts.

---

## Phase 3 — Hygiene & Cleanup (Destructive but Safe)

**Goal:** Reclaim disk, remove orphaned enablement entries, prune stale references. All actions reversible via Phase 2 backup.

**Files:**
- Modify: `~/.gemini/extensions/extension-enablement.json`
- Modify: `~/.gemini/projects.json`
- Modify: `~/.gemini/trustedFolders.json`
- Delete (conditionally): `~/.gemini/tmp/*`, `~/.gemini/history/` old entries, `~/.gemini/antigravity*/` (if confirmed unused), `~/.gemini/tools/`, `~/.gemini/backups/` (empty)

### Task 3.1 — Clear tmp/

- [ ] **Step 1:** Confirm tmp/ contents are safe to delete (nothing in use).

  ```bash
  lsof +D ~/.gemini/tmp 2>/dev/null | head
  ls -la ~/.gemini/tmp/ | head
  ```

- [ ] **Step 2:** If safe, clear it.

  ```bash
  find ~/.gemini/tmp -mindepth 1 -mtime +1 -delete 2>/dev/null
  du -sh ~/.gemini/tmp
  ```

- [ ] **Step 3:** Verify the CLI still starts after.

  ```bash
  gemini --version
  ```

- [ ] **Step 4:** Commit an audit note.

### Task 3.2 — Prune history/ to session retention policy

- [ ] **Step 1:** List history entries older than 30 days.

  ```bash
  find ~/.gemini/history -type f -mtime +30 | wc -l
  ```

- [ ] **Step 2:** If the CLI's own retention isn't pruning, invoke the built-in cleanup.

  ```bash
  gemini /sessions prune  # or equivalent v0.37 command — check research/01
  ```

- [ ] **Step 3:** Fallback: manual prune.

  ```bash
  find ~/.gemini/history -type f -mtime +30 -delete
  ```

- [ ] **Step 4:** Commit an audit note.

### Task 3.3 — Decide on antigravity directories

- [ ] **Step 1:** Determine whether Antigravity IDE is still installed and in use.

  ```bash
  which antigravity 2>/dev/null || find / -maxdepth 4 -name "antigravity*" -type f 2>/dev/null | head
  ls -la ~/.gemini/antigravity-browser-profile/Default/Cookies 2>/dev/null
  # Check last access time
  stat ~/.gemini/antigravity-browser-profile/Default 2>/dev/null | grep -E "Access|Modify"
  ```

- [ ] **Step 2:** If not in use, archive and remove. If in use, leave alone but document.

  ```bash
  # IF CONFIRMED UNUSED:
  tar --zstd -cvf ~/gemini-cli-audit/backups/antigravity-${TS}.tar.zst -C ~/.gemini antigravity antigravity-browser-profile
  rm -rf ~/.gemini/antigravity ~/.gemini/antigravity-browser-profile
  du -sh ~/.gemini
  ```

- [ ] **Step 3:** Commit an audit note.

### Task 3.4 — Remove orphaned extension-enablement entries

- [ ] **Step 1:** Build the canonical list of actually-installed extensions.

  ```bash
  ls -1 ~/.gemini/extensions/ | grep -v "\.json$" > /tmp/installed-exts.txt
  ```

- [ ] **Step 2:** Filter `extension-enablement.json` to only keep installed extensions.

  ```bash
  jq --slurpfile installed <(ls -1 ~/.gemini/extensions/ | grep -v "\.json$" | jq -R . | jq -s .) \
    'with_entries(select(.key as $k | $installed[0] | index($k)))' \
    ~/.gemini/extensions/extension-enablement.json \
    > /tmp/extension-enablement.cleaned.json
  diff ~/.gemini/extensions/extension-enablement.json /tmp/extension-enablement.cleaned.json | head -40
  ```

- [ ] **Step 3:** Replace after Tyler approves the diff.

  ```bash
  mv /tmp/extension-enablement.cleaned.json ~/.gemini/extensions/extension-enablement.json
  ```

- [ ] **Step 4:** Commit an audit note.

### Task 3.5 — Prune stale projects and trusted folders

- [ ] **Step 1:** Build cleaned projects.json (remove every path that no longer exists).

  ```bash
  jq '{projects: (.projects | to_entries | map(select(.key as $k | $k | test("^/"))) | from_entries)}' \
    ~/.gemini/projects.json > /tmp/projects.cleaned.json
  # Then filter further with shell:
  jq -r '.projects | keys[]' /tmp/projects.cleaned.json | while read p; do
    [ ! -d "$p" ] && echo "$p"
  done > /tmp/stale-projects.txt
  # Remove stale entries
  ```

- [ ] **Step 2:** Remove stale entries from trustedFolders.json similarly.

- [ ] **Step 3:** Commit.

### Task 3.6 — Deduplicate and clean ~/.gemini/GEMINI.md

- [ ] **Step 1:** The original global memory has duplicate lines 2–3. Remove duplicates; this step is pure dedup, not rewrite (Phase 4 does the rewrite).

  ```bash
  awk '!seen[$0]++' ~/.gemini/GEMINI.md > /tmp/gemini-md.deduped
  diff ~/.gemini/GEMINI.md /tmp/gemini-md.deduped
  mv /tmp/gemini-md.deduped ~/.gemini/GEMINI.md
  ```

- [ ] **Step 2:** Verify by reading.

  ```bash
  cat ~/.gemini/GEMINI.md
  ```

- [ ] **Step 3:** Commit.

### Task 3.7 — Remove empty and stale dirs

- [ ] **Step 1:** `~/.gemini/backups/` is empty. Remove it.

  ```bash
  rmdir ~/.gemini/backups 2>/dev/null || echo "not empty"
  ```

- [ ] **Step 2:** `~/.gemini/tools/` has a 79-byte package.json and 325 node_modules — determine purpose. If orphaned, archive and remove.

  ```bash
  cat ~/.gemini/tools/package.json
  # If obviously stale:
  tar --zstd -cvf ~/gemini-cli-audit/backups/tools-${TS}.tar.zst -C ~/.gemini tools
  rm -rf ~/.gemini/tools
  ```

- [ ] **Step 3:** Commit.

### Task 3.8 — Verify CLI still healthy

- [ ] **Step 1:** Run the CLI smoke test.

  ```bash
  gemini --version
  gemini --help | head -20
  ```

- [ ] **Step 2:** If anything broken, immediately rollback via Phase 2 runbook.

- [ ] **Step 3:** Commit.

**Phase 3 gate:** `gemini --version` and `gemini --help` work. Disk usage reduced. Tyler reviews the change log.

---

## Phase 4 — Global GEMINI.md Rewrite

**Goal:** Replace the cross-contaminated global memory with a clean, TRULY global directive set. Project-specific content moves to per-project GEMINI.md files.

**Files:**
- Modify: `~/.gemini/GEMINI.md`
- Create: `~/.gemini/memory/project-directives/<project>.md` (per project, as needed)
- Delete (after migration): project-specific lines from global

### Task 4.1 — Extract project-specific content

- [ ] **Step 1:** From Task 1.6's contamination report, identify each non-global directive. Current known offenders:
  - "Tauri/Rust projects (like Pake)" → belongs in `~/Pake/GEMINI.md`
  - "MANDATORY FRONTEND VERIFICATION" (ProtoPulse-originated) → belongs in `~/Projects/ProtoPulse/AGENTS.md`
  - "ADB screen-capture" directives → belong in `~/Projects/SM-T580_Project/GEMINI.md` or Android-specific
  - "Duplicate of previous line" entries → delete

- [ ] **Step 2:** For each project that needs a directive migrated, ensure a project-level GEMINI.md exists. If missing, create it with the migrated directive.

- [ ] **Step 3:** Commit.

### Task 4.2 — Write the new global GEMINI.md

- [ ] **Step 1:** Compose `~/.gemini/GEMINI.md` containing ONLY truly global directives. Example structure:

  ```markdown
  ## Gemini CLI Global Memory

  ### Identity
  - I am a highly proactive Master Agent. I default to action over asking permission within sanctioned scope. I take accountability for failures and verify my own work before reporting.

  ### Communication
  - Match response length to task: direct answers to simple questions; structured updates for multi-step work.
  - Never ask the user to verify command output — I have tools to do that myself.

  ### Verification
  - Before claiming a task complete, verify empirically: read the file I wrote, run the test I built, query the state I changed. No "should work" claims.

  ### Safety
  - Operate carefully with destructive actions (rm, force-push, branch deletion, dropping tables). Confirm destructive actions on shared state. Fast operations on local reversible state are fine without confirmation.

  ### Tool Preference
  - Prefer specialized tools over generic ones (ast-grep over grep for code; ripgrep for text; jq for JSON; WebFetch/Context7 for library docs over guessing).
  ```

- [ ] **Step 2:** Verify the new file is under ~50 lines and contains zero project names.

- [ ] **Step 3:** Commit.

### Task 4.3 — Verify the new memory loads correctly

- [ ] **Step 1:** Start the CLI and check the context summary footer.

  ```bash
  # In an interactive shell:
  gemini
  # then type: /memory show
  # expect: the new concise global + any auto-loaded project GEMINI.md
  ```

- [ ] **Step 2:** Commit an audit note.

**Phase 4 gate:** Global memory is lean. Project-specific directives live in their projects.

---

## Phase 5 — Settings Hardening

**Goal:** Fix invalid/undocumented keys, add modern v0.37 features, add `$schema` pointer for editor autocomplete, harmonize the four-way approval interaction.

**Files:**
- Modify: `~/.gemini/settings.json`

### Task 5.1 — Add $schema reference for editor validation

- [ ] **Step 1:** Reference the hosted schema at the top of settings.json so any JSON-aware editor provides autocomplete and validation.

  ```json
  {
    "$schema": "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json",
    "security": { ... }
  }
  ```

- [ ] **Step 2:** Verify the CLI still accepts the file.

  ```bash
  gemini --version
  ```

- [ ] **Step 3:** Commit.

### Task 5.2 — Remove invalid/undocumented keys

- [ ] **Step 1:** Remove these keys (confirmed not in v0.37 schema per Phase 0 research):
  - `tools.autoAccept`  ← NOT IN SCHEMA. Approval is controlled by `general.defaultApprovalMode`, `security.enablePermanentToolApproval`, `tools.allowed`, and `security.autoAddToPolicyByDefault`.
  - `experimental.skills` ← NOT IN SCHEMA. Skills are enabled by default in v0.30+.
  - `experimental.introspectionAgentSettings` ← NOT IN SCHEMA.
  - `general.plan.directory: ""` ← empty string. Remove entirely; leave `plan.enabled: true`.

- [ ] **Step 2:** Verify the CLI still starts.

- [ ] **Step 3:** Commit.

### Task 5.3 — Add the missing v0.37 features

- [ ] **Step 1:** Add these settings (with reasoning documented in the commit):

  ```json
  {
    "general": {
      "checkpointing": { "enabled": true },
      "plan": {
        "enabled": true,
        "modelRouting": true
      },
      "sessionRetention": {
        "enabled": true,
        "maxAge": "30d",
        "minRetention": "1d",
        "warningAcknowledged": true
      }
    },
    "experimental": {
      "enableAgents": true,
      "worktrees": true,
      "topicUpdateNarration": true,
      "taskTracker": true,
      "modelSteering": true,
      "directWebFetch": true,
      "extensionManagement": true
    },
    "tools": {
      "shell": {
        "enableInteractiveShell": true,
        "inactivityTimeout": 600,
        "showColor": true
      }
    },
    "context": {
      "fileName": "GEMINI.md",
      "loadMemoryFromIncludeDirectories": true,
      "fileFiltering": {
        "respectGitIgnore": true,
        "respectGeminiIgnore": true
      }
    }
  }
  ```

  **Reasoning per key:**
  - `checkpointing.enabled: true` — session recovery after crash/interrupt. No downside.
  - `plan.modelRouting: true` — auto Pro/Flash switching during Plan Mode. Efficiency win.
  - `worktrees: true` — v0.37 feature. Enables automated git worktree management for parallel branches.
  - `topicUpdateNarration: true` — v0.37 "Chapters" feature. Better long-session narrative.
  - `taskTracker: true` — built-in task list tool.
  - `shell.inactivityTimeout: 600` — bumped from 300s default so long-running builds don't hit the timeout (Tyler's rule: no command timeout under 30 min; 10 min inactivity is reasonable for "still running").

- [ ] **Step 2:** Verify the CLI still starts and loads the new flags.

  ```bash
  gemini --version
  ```

- [ ] **Step 3:** Commit.

### Task 5.4 — Decide on sandbox configuration

- [ ] **Step 1:** Review `research/07-sandbox-guide.md`. On Linux with docker installed, consider `tools.sandbox: "docker"` with `sandboxNetworkAccess: true` if needed.

  Options:
  - **Option A (safe default):** keep `tools.sandbox: undefined`. Gemini runs in the host process. Protected by folderTrust only.
  - **Option B (hardened):** `tools.sandbox: "docker"` with allowed paths set. More secure but adds startup overhead and potential tool friction.

- [ ] **Step 2:** Present both options with trade-offs to Tyler. Get his decision.

- [ ] **Step 3:** If Option B chosen, configure and test with a simple `run_shell_command` smoke test.

- [ ] **Step 4:** Commit.

### Task 5.5 — Review the 4-way approval interaction

- [ ] **Step 1:** Document the current approval state after the above changes:
  - `security.folderTrust.enabled: true` ← OK
  - `security.enablePermanentToolApproval: true` ← allows "Always allow" UI
  - `general.defaultApprovalMode: "auto_edit"` ← auto-approves edits, prompts otherwise
  - `security.autoAddToPolicyByDefault: false` (new default) ← does NOT silently add to policy

- [ ] **Step 2:** Decide: does Tyler want `autoAddToPolicyByDefault: true` (which is probably why the auto-saved.toml grew to 3390 lines)? If yes, keep accumulating; if no, set to false and prune the file in Task 5.6.

- [ ] **Step 3:** Decide: `disableYoloMode: true`? Given Tyler already uses auto_edit, disabling YOLO forever prevents accidental `--yolo` invocation.

- [ ] **Step 4:** Commit decisions.

### Task 5.6 — Prune policies/auto-saved.toml

- [ ] **Step 1:** Archive the current policy file.

  ```bash
  cp ~/.gemini/policies/auto-saved.toml ~/gemini-cli-audit/backups/auto-saved-${TS}.toml
  ```

- [ ] **Step 2:** Based on Task 1.7's stale-references audit, remove rules referencing MCP servers or tools no longer installed. Use a Python script:

  ```python
  # ~/gemini-cli-audit/scripts/prune-policies.py
  import tomllib, sys
  installed_mcp = {"context7", "chrome-devtools", "genkit", "clear-thought", ...}  # from live audit
  # Read, filter, write with tomli-w
  ```

- [ ] **Step 3:** Diff before/after. Get Tyler's approval.

- [ ] **Step 4:** Apply.

- [ ] **Step 5:** Verify CLI still honors approval policies correctly on next session.

- [ ] **Step 6:** Commit.

### Task 5.7 — Validate the final settings.json against schema

- [ ] **Step 1:** Run ajv against the schema.

  ```bash
  npx --yes ajv-cli validate \
    -s ~/gemini-cli-audit/research/settings.schema.json \
    -d ~/.gemini/settings.json
  ```

- [ ] **Step 2:** Ensure zero errors.

- [ ] **Step 3:** Commit.

**Phase 5 gate:** `settings.json` validates cleanly against schema, CLI starts, Tyler has approved every change.

---

## Phase 6 — Extension Audit & Modernization

**Goal:** Validate every installed extension, fix brittle/broken configs, remove duplicates with Claude Code, regenerate integrity signatures.

**Files:**
- Modify: `~/.gemini/extensions/genkit/gemini-extension.json` (fix hardcoded path)
- Modify: `~/.gemini/extensions/chrome-devtools-mcp/gemini-extension.json` (pin version)
- Modify: `~/.gemini/extension_integrity.json` (regenerate)
- Potentially remove: duplicates of Claude Code MCP servers

### Task 6.1 — Fix genkit hardcoded path

- [ ] **Step 1:** Check where genkit actually lives.

  ```bash
  which genkit
  ```

- [ ] **Step 2:** Update the manifest to use PATH-relative discovery or a variable.

  ```json
  {
    "mcpServers": {
      "genkit": {
        "command": "genkit",
        "args": ["mcp", "--", "--no-update-notification", "--non-interactive"],
        "cwd": ".",
        "timeout": 30000,
        "trust": false
      }
    }
  }
  ```

- [ ] **Step 3:** Test that the MCP server still starts from this config.

- [ ] **Step 4:** Commit.

### Task 6.2 — Pin chrome-devtools-mcp version

- [ ] **Step 1:** `version: "latest"` is bad practice (reproducibility). Pin to a specific version.

  ```bash
  npm view chrome-devtools-mcp version
  ```

- [ ] **Step 2:** Update the manifest's `version` and the `args` to match.

- [ ] **Step 3:** Test.

- [ ] **Step 4:** Commit.

### Task 6.3 — Audit each extension against the manifest schema

- [ ] **Step 1:** For every extension, write a findings block in `audit/extension-findings-v2.md`:
  - Does the manifest have `name`, `version`, `description`?
  - Does `name` match directory name?
  - Are MCP command paths portable (no hardcoded absolute paths)?
  - Do MCP configs have `timeout`?
  - Do extensions with shell access have `excludeTools`?
  - Are settings with secrets marked `sensitive: true`?

- [ ] **Step 2:** For each finding, propose and apply a fix. Commit per-extension.

### Task 6.4 — Identify duplicates with Claude Code

- [ ] **Step 1:** For each Gemini extension that also exists as a Claude Code MCP server (check `~/.claude.json` and `~/.claude/` for the same server command), decide: keep both, keep one, or unify.

  Known candidates: chrome-devtools-mcp, context7, clear-thought, code-review.

- [ ] **Step 2:** For each duplicate, note that running both simultaneously can cause port clashes, double-charging (for API-key MCPs), and confusion.

- [ ] **Step 3:** Recommend disabling the Gemini side if Tyler already uses it in Claude Code — but keep the option to re-enable via `gemini extensions enable <name>`.

- [ ] **Step 4:** Apply Tyler-approved changes.

- [ ] **Step 5:** Commit.

### Task 6.5 — Regenerate extension integrity

- [ ] **Step 1:** The current `extension_integrity.json` only tracks context7. Use the CLI's built-in integrity check to rehash all 25 extensions.

  ```bash
  gemini /extensions verify --all   # check exact command in research/03
  ```

- [ ] **Step 2:** If the CLI doesn't expose a command, write a script that mimics the official integrity format: hash the manifest + relevant source files with the same algorithm.

- [ ] **Step 3:** Commit.

### Task 6.6 — Try the `gemini extensions link` dev workflow

- [ ] **Step 1:** For any extension Tyler has authored (not third-party), convert to a linked dev install.

  ```bash
  cd ~/.gemini/extensions/<my-ext>
  gemini extensions link .
  ```

- [ ] **Step 2:** Verify it shows up in `gemini /extensions`.

- [ ] **Step 3:** Document the workflow in the runbook.

- [ ] **Step 4:** Commit.

**Phase 6 gate:** Every manifest validates, every MCP server starts, no hardcoded paths remain, duplicates resolved.

---

## Phase 7 — Skills Modernization (Agent Skills Spec Compliance)

**Goal:** Every skill in `~/.gemini/skills/` conforms to the v0.23+ Agent Skills spec (SKILL.md with frontmatter, name matches directory, valid description, proper assets directory).

**Files:**
- Modify: non-compliant skills under `~/.gemini/skills/`
- Delete: broken symlinks
- Delete (after Tyler approval): stray files like `playground-enhancements.md`

### Task 7.1 — Score every skill

- [ ] **Step 1:** Run the validator checklist from `research/04-agent-skills-spec.md` against each of the 51 entries. Produce a scoreboard table:

  ```
  | skill | SKILL.md | frontmatter | name matches dir | desc < 200 chars | when_to_use | score |
  ```

- [ ] **Step 2:** Commit the scoreboard.

### Task 7.2 — Fix symlinks

- [ ] **Step 1:** `file-organizer` symlinks to `~/.claude/skills/file-organizer`. Check if Gemini follows symlinks correctly for skills discovery.

- [ ] **Step 2:** If not supported, either copy the skill contents or remove the symlink.

- [ ] **Step 3:** Commit.

### Task 7.3 — Remove stray files

- [ ] **Step 1:** `~/.gemini/skills/playground-enhancements.md` is a bare file, not a skill. Move to `~/gemini-cli-audit/backups/stray-skills/` or delete.

- [ ] **Step 2:** Commit.

### Task 7.4 — Upgrade legacy skills to v0.23+ frontmatter

- [ ] **Step 1:** For each skill missing valid frontmatter, add:

  ```markdown
  ---
  name: skill-name
  description: One-line description under 200 chars.
  version: 1.0.0
  tags: [tag1, tag2]
  when_to_use: When user asks X, Y, or Z.
  ---

  # Skill body...
  ```

- [ ] **Step 2:** For each legacy skill, commit the frontmatter migration.

### Task 7.5 — Verify skill activation

- [ ] **Step 1:** Start the CLI and invoke `activate_skill` for a representative sample of skills.

  ```bash
  # Interactive
  gemini
  # /skills list
  # > activate brainstorming
  # verify: description loads into context, assets become readable
  ```

- [ ] **Step 2:** Commit verification notes.

**Phase 7 gate:** `gemini /skills list` shows every skill with valid metadata; sample activations work.

---

## Phase 8 — MCP Server Health Check & OAuth Refresh Workaround

**Goal:** Every declared MCP server actually starts, registers tools, and stays alive. Document OAuth refresh limitation.

**Files:**
- Modify: individual `gemini-extension.json` files (fix timeouts, trust, env)
- Create: `~/gemini-cli-audit/runbooks/mcp-health.md`

### Task 8.1 — Start each MCP server in isolation and verify tool registration

- [ ] **Step 1:** For each MCP server declared in any `~/.gemini/extensions/*/gemini-extension.json`, run the command in isolation. Capture: start success, stderr output, whether the server responds to the `list_tools` MCP request.

  ```bash
  # Example: context7
  timeout 15 npx -y @upstash/context7-mcp --api-key dummy </dev/null 2>&1 | head
  ```

- [ ] **Step 2:** Record results in `audit/mcp-servers-health-v2.md`.

### Task 8.2 — Fix timeouts and trust flags

- [ ] **Step 1:** For slow MCP servers, bump the `timeout` to 120000 (120 s) per `research/05`.

- [ ] **Step 2:** For servers where Tyler wants auto-approve (no confirmation on every call), set `trust: true` only after explicit approval.

- [ ] **Step 3:** Commit per-server.

### Task 8.3 — Document OAuth token refresh limitation

- [ ] **Step 1:** Write `runbooks/mcp-health.md` documenting:
  - The ~1hr OAuth token expiry bug (gh #23776, gh #23296)
  - The workaround: restart the CLI every ~55 min for OAuth-based MCPs
  - Alternative: prefer API-key MCPs where possible
  - How to tell if a session has a dead MCP: `/mcp status`

- [ ] **Step 2:** Commit.

### Task 8.4 — Full CLI MCP test

- [ ] **Step 1:** Start the CLI and run:

  ```bash
  gemini
  # /mcp list
  # /mcp status
  ```

- [ ] **Step 2:** Verify every declared MCP server is present and "connected".

- [ ] **Step 3:** Commit verification.

**Phase 8 gate:** `/mcp list` shows every declared server, every one is connected or explicitly disabled.

---

## Phase 9 — New Feature Adoption (v0.23 → v0.37)

**Goal:** Actively try every relevant new feature between Tyler's original install point and v0.37.1. Record which work, which don't, which he wants to keep.

**Files:**
- Create: `~/gemini-cli-audit/runbooks/feature-adoption-notes.md`

### Task 9.1 — Plan Mode (`/plan`)

- [ ] **Step 1:** In an interactive session, invoke `/plan` on a sample task. Verify plan artifacts get written to the directory defined in `general.plan.directory`.

- [ ] **Step 2:** Document in `feature-adoption-notes.md`.

### Task 9.2 — Worktrees

- [ ] **Step 1:** In a git repo (use `~/Projects/ProtoPulse/` or a throwaway), try the worktree workflow.

- [ ] **Step 2:** Document: does it create a git worktree in a separate dir? Does it clean up after? Does it interact with Tyler's existing `/using-git-worktrees` Claude skill?

- [ ] **Step 3:** Commit notes.

### Task 9.3 — Chapters (topic update narration)

- [ ] **Step 1:** Run a multi-tool session and verify Chapters grouping appears in the output.

- [ ] **Step 2:** Document.

### Task 9.4 — Task Tracker

- [ ] **Step 1:** In a session, trigger the task tracker tool. Verify it surfaces tasks and persists them across the session.

- [ ] **Step 2:** Document.

### Task 9.5 — Browser Agent

- [ ] **Step 1:** Try the browser agent on a benign test URL.

- [ ] **Step 2:** Document.

### Task 9.6 — Model Steering

- [ ] **Step 1:** Try supplying a steering hint mid-session. Verify the model respects it.

- [ ] **Step 2:** Document.

### Task 9.7 — Decision matrix

- [ ] **Step 1:** For each feature tested, record: works? valuable? should stay enabled? any bugs?

- [ ] **Step 2:** If any feature is broken or unwanted, flip its flag in `settings.json` and commit.

- [ ] **Step 3:** Commit the decision matrix.

**Phase 9 gate:** Every enabled experimental flag is validated to work or has been disabled.

---

## Phase 10 — Project-Level Audit & Cleanup

**Goal:** Apply the same audit to every `.gemini/` folder under `~/Projects/` and ensure `GEMINI.md` files at project roots are lean and correct.

**Files:**
- Audit: `~/Projects/ProtoPulse/.gemini/`
- Audit: `~/Projects/SM-T580_Project/.gemini/`
- Audit: `~/Projects/GEMINI.md`
- Possibly modify: per-project command TOMLs with naming collisions

### Task 10.1 — ProtoPulse `.gemini/`

- [ ] **Step 1:** Review `~/Projects/ProtoPulse/.gemini/commands/`. It has three namespaces:
  - `claude/assistant.toml`
  - `gemini-cli-maestro/assistant.toml`
  - `scribe/` (13 tomls)

- [ ] **Step 2:** Verify these work (e.g., `/scribe:draft` inside a Gemini session in the ProtoPulse dir).

- [ ] **Step 3:** Check for collision with Tyler's Claude slash commands of the same name.

- [ ] **Step 4:** Commit findings.

### Task 10.2 — SM-T580_Project `.gemini/`

- [ ] **Step 1:** Enumerate contents, validate, and audit for stale references.

- [ ] **Step 2:** Commit.

### Task 10.3 — `~/Projects/GEMINI.md`

- [ ] **Step 1:** This is the workspace-root "Master Agent Protocol" file. Confirm its content is not duplicating `~/.gemini/GEMINI.md`.

- [ ] **Step 2:** Confirm no project-specific ProtoPulse/Void/PartScout content lives here (that should be in per-project GEMINI.md or AGENTS.md).

- [ ] **Step 3:** Commit.

### Task 10.4 — Audit other GEMINI.md files

- [ ] **Step 1:** For each of `~/cheat/`, `~/Parts-List/`, `~/OpenLinkHub/`, `~/circuitmind-ai/`, `~/VOID/`, `~/th3-syst3m/`, decide: keep, update, delete. A GEMINI.md in a directory Tyler never uses with Gemini CLI is just dead weight.

- [ ] **Step 2:** Commit decisions.

**Phase 10 gate:** Every project-level GEMINI.md has a purpose and no project-specific content lives in global scope.

---

## Phase 11 — Verification & End-to-End Smoke Test

**Goal:** Prove the entire system works end-to-end after all changes. No skipped tests. No "should work" claims.

**Files:**
- Create: `~/gemini-cli-audit/runbooks/smoke-test-results.md`

### Task 11.1 — Version and help

- [ ] **Step 1:** `gemini --version` returns `0.37.1` (or current).
- [ ] **Step 2:** `gemini --help` returns a clean help text.
- [ ] **Step 3:** Record output.

### Task 11.2 — Authentication

- [ ] **Step 1:** Start the CLI, verify authenticated state via `/auth status`.
- [ ] **Step 2:** Record.

### Task 11.3 — Memory load

- [ ] **Step 1:** Verify `/memory show` returns the new lean global GEMINI.md + any project memory for CWD.
- [ ] **Step 2:** Record.

### Task 11.4 — Extensions list

- [ ] **Step 1:** `/extensions list` shows all intended extensions as enabled.
- [ ] **Step 2:** Record.

### Task 11.5 — MCP status

- [ ] **Step 1:** `/mcp list` and `/mcp status` show every server connected.
- [ ] **Step 2:** Record.

### Task 11.6 — Skills list and activation

- [ ] **Step 1:** `/skills list` returns every valid skill.
- [ ] **Step 2:** Activate one skill; verify context loads.
- [ ] **Step 3:** Record.

### Task 11.7 — Model call

- [ ] **Step 1:** Submit a simple prompt to verify the model responds: "What model are you running on?"
- [ ] **Step 2:** Verify response uses `gemini-3.1-pro-preview`.
- [ ] **Step 3:** Record.

### Task 11.8 — Tool call

- [ ] **Step 1:** Trigger a file read and a shell command via the model. Verify auto_edit mode approves the edit but prompts (or applies policy) for the shell command.
- [ ] **Step 2:** Record.

### Task 11.9 — New feature smoke (Chapters, worktrees, task tracker)

- [ ] **Step 1:** Multi-tool session that triggers Chapters; verify grouping.
- [ ] **Step 2:** Trigger a worktree create; verify the worktree exists on disk.
- [ ] **Step 3:** Trigger the task tracker; verify persistence.
- [ ] **Step 4:** Record.

### Task 11.10 — Disk usage after

- [ ] **Step 1:** `du -sh ~/.gemini` — target: < 2 GB (from 6.5 GB).
- [ ] **Step 2:** Record.

### Task 11.11 — Rollback smoke

- [ ] **Step 1:** On a scratch copy, extract the Phase 2 backup and verify a fresh CLI start works against the restored config.

  ```bash
  mkdir -p /tmp/rollback-test/.gemini
  tar --zstd -xf ~/gemini-cli-audit/backups/gemini-${TS}.tar.zst -C /tmp/rollback-test/
  GEMINI_CLI_HOME=/tmp/rollback-test/.gemini gemini --version
  rm -rf /tmp/rollback-test
  ```

- [ ] **Step 2:** Record.

**Phase 11 gate:** Every smoke test green. Disk usage target met. Rollback proven.

---

## Phase 12 — Documentation & Handoff

**Goal:** Leave Tyler with a runbook, a changelog, and a maintenance checklist so he can keep the system healthy without re-doing this audit.

**Files:**
- Create: `~/gemini-cli-audit/runbooks/GEMINI_CLI_RUNBOOK.md`
- Create: `~/gemini-cli-audit/runbooks/CHANGELOG.md`
- Create: `~/gemini-cli-audit/runbooks/MAINTENANCE-CHECKLIST.md`
- Optionally: symlink the runbook into `~/.gemini/RUNBOOK.md`

### Task 12.1 — Write the runbook

- [ ] **Step 1:** Author `GEMINI_CLI_RUNBOOK.md` with sections:
  - Quick reference: common commands, key paths, key config files
  - How to add a new extension
  - How to add a new skill
  - How to add a new MCP server
  - How to restore from backup
  - How to upgrade the CLI safely
  - How to diagnose a broken MCP server
  - Known issues (OAuth token expiry)
  - Feature flags cheat sheet

- [ ] **Step 2:** Commit.

### Task 12.2 — Changelog of this entire audit

- [ ] **Step 1:** Write `CHANGELOG.md` summarizing every phase, every change, every file touched, with dates and commit hashes from the audit git repo.

- [ ] **Step 2:** Commit.

### Task 12.3 — Quarterly maintenance checklist

- [ ] **Step 1:** Write `MAINTENANCE-CHECKLIST.md` — a checklist Tyler can run quarterly:
  - [ ] `gemini --version` — is a new stable available?
  - [ ] Check `~/.gemini/tmp/` size, clean if > 500 MB
  - [ ] Check `~/.gemini/history/` size vs retention policy
  - [ ] `/mcp status` — any disconnected servers?
  - [ ] Validate `settings.json` against the current schema
  - [ ] Dedupe `GEMINI.md` files
  - [ ] Check for orphaned enablement entries
  - [ ] Review `auto-saved.toml` growth
  - [ ] Try any new features since last audit (pull latest changelog)

- [ ] **Step 2:** Commit.

### Task 12.4 — Install the `/gemini-audit` slash command (optional)

- [ ] **Step 1:** If Tyler wants a repeatable audit, create `~/.claude/commands/gemini-audit.toml` (or similar) that runs the Phase 1 audit scripts and drops a fresh consolidated findings report.

- [ ] **Step 2:** Commit.

### Task 12.5 — Final review with Tyler

- [ ] **Step 1:** Surface `CHANGELOG.md`, `RUNBOOK.md`, `MAINTENANCE-CHECKLIST.md`, and the final disk usage numbers.

- [ ] **Step 2:** Get Tyler's sign-off.

- [ ] **Step 3:** Commit the final state.

**Phase 12 gate:** Tyler has everything he needs to maintain this going forward.

---

## Rollback Procedures (Quick Reference)

**If anything goes wrong at any phase, stop and restore.**

### Restore everything

```bash
TS=<timestamp-from-Phase-2>
mv ~/.gemini ~/.gemini.broken-$(date +%Y%m%d-%H%M%S)
tar --zstd -xf ~/gemini-cli-audit/backups/gemini-${TS}.tar.zst -C /home/wtyler
gemini --version  # verify
```

### Restore just settings.json

```bash
tar --zstd -xf ~/gemini-cli-audit/backups/gemini-${TS}.tar.zst .gemini/settings.json
mv .gemini/settings.json ~/.gemini/settings.json
```

### Restore just the global GEMINI.md

```bash
cp ~/gemini-cli-audit/backups/gemini-md/_home_wtyler_.gemini_GEMINI.md ~/.gemini/GEMINI.md
```

### Restore the auto-saved policy file

```bash
cp ~/gemini-cli-audit/backups/auto-saved-${TS}.toml ~/.gemini/policies/auto-saved.toml
```

### Restore extension-enablement.json

```bash
tar --zstd -xf ~/gemini-cli-audit/backups/gemini-${TS}.tar.zst .gemini/extensions/extension-enablement.json
mv .gemini/extensions/extension-enablement.json ~/.gemini/extensions/extension-enablement.json
```

### Reinstall CLI

```bash
npm install -g @google/gemini-cli@0.37.1
# or downgrade:
npm install -g @google/gemini-cli@<prior-version>
```

---

## Execution Checklist (Top-Level)

- [ ] **Phase 0:** Research & documentation ingest complete; executive summary reviewed
- [ ] **Phase 1:** Audit complete; CONSOLIDATED-FINDINGS.md reviewed and approved by Tyler
- [ ] **Phase 2:** Full backup created and verified; ROLLBACK.md written
- [ ] **Phase 3:** Hygiene cleanup complete; CLI still starts; disk usage reduced
- [ ] **Phase 4:** Global GEMINI.md rewritten and verified
- [ ] **Phase 5:** Settings validated against schema; no invalid keys; new features added
- [ ] **Phase 6:** Every extension manifest validated and fixed; duplicates resolved
- [ ] **Phase 7:** Every skill complies with Agent Skills spec
- [ ] **Phase 8:** Every MCP server connects; OAuth limitation documented
- [ ] **Phase 9:** Every new v0.23–v0.37 feature tested and decision recorded
- [ ] **Phase 10:** Every project-level `.gemini/` audited
- [ ] **Phase 11:** End-to-end smoke test green; rollback proven
- [ ] **Phase 12:** Runbook, changelog, maintenance checklist handed off

---

## File Ownership (If Dispatched to /agent-teams)

This plan is primarily sequential because many phases depend on prior phases (you can't write the backup before the audit, can't modify settings before backing up). **Recommended execution mode: inline with executing-plans skill, not parallel agent-teams.**

If parallelization is desired, only these phases can run in parallel:

**Parallel group A (after Phase 1 complete):**
- Phase 6 (extensions) — owns `~/.gemini/extensions/*/gemini-extension.json`
- Phase 7 (skills) — owns `~/.gemini/skills/*/`
- Phase 10 (project-level) — owns `~/Projects/*/.gemini/`

**Sequential and single-agent only:**
- Phase 0, 1, 2, 3 (hygiene), 4 (global memory), 5 (settings), 8 (MCP), 9 (feature adoption), 11 (smoke), 12 (docs)

---

## Success Criteria

- [ ] `gemini --version` returns `0.37.1` (or latest stable)
- [ ] `settings.json` validates against the canonical schema with zero errors
- [ ] Zero undocumented/invalid keys remain in `settings.json`
- [ ] `~/.gemini/` disk usage < 2 GB (from 6.5 GB)
- [ ] `~/.gemini/GEMINI.md` contains zero project-specific content
- [ ] Every GEMINI.md file has a reason to exist or has been removed
- [ ] `/extensions list` shows exactly the extensions Tyler wants, all with valid manifests
- [ ] `/mcp list` shows every server connected
- [ ] `/skills list` shows every skill with valid frontmatter
- [ ] Phase 2 rollback tarball exists and has been verified to extract cleanly
- [ ] Every new v0.37 feature that Tyler wants is enabled and tested
- [ ] `GEMINI_CLI_RUNBOOK.md`, `CHANGELOG.md`, `MAINTENANCE-CHECKLIST.md` exist and are accurate
- [ ] Tyler has signed off on the final state

---

## Appendix A — Quick Reference of Tyler's Current Setup (2026-04-10)

- **CLI:** `@google/gemini-cli@0.37.1`
- **Binary:** `~/.nvm/versions/node/v22.22.0/bin/gemini`
- **Config root:** `~/.gemini/`
- **Global memory:** `~/.gemini/GEMINI.md` (contaminated — Phase 4 rewrite)
- **Settings:** `~/.gemini/settings.json` (invalid keys — Phase 5 fix)
- **Auth:** OAuth personal, `~/.gemini/oauth_creds.json`
- **Model:** `gemini-3.1-pro-preview`
- **Extensions:** 25 directories, 2.7 GB, enablement file stale
- **Skills:** 51 entries, mixed spec compliance
- **Policies:** `~/.gemini/policies/auto-saved.toml` (3390 lines)
- **MCP tokens:** `~/.gemini/mcp-oauth-tokens-v2.json` (hit by GH #23776)
- **Project folders:** `~/Projects/ProtoPulse/.gemini/`, `~/Projects/SM-T580_Project/.gemini/`
- **Antigravity:** `~/.gemini/antigravity/` + `antigravity-browser-profile/` = 2.5 GB

---

## Appendix B — Source Citations

All research phases fetch from:
- https://geminicli.com/docs/ — official user documentation
- https://geminicli.com/docs/changelogs/ — release notes index
- https://geminicli.com/docs/changelogs/latest/ — v0.37.0 notes
- https://geminicli.com/docs/reference/configuration/ — settings schema reference
- https://geminicli.com/docs/extensions/best-practices/ — extension authoring
- https://geminicli.com/docs/cli/skills/ — Agent Skills spec
- https://geminicli.com/docs/tools/mcp-server/ — MCP server config
- https://github.com/google-gemini/gemini-cli — source repo
- https://github.com/google-gemini/gemini-cli/releases — release artifacts
- https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json — canonical schema
- https://github.com/google-gemini/gemini-cli/issues/23776 — OAuth token refresh bug
- https://github.com/google-gemini/gemini-cli/issues/23296 — MCP HTTP OAuth mid-session failure
- https://ai.google.dev/gemini-api/docs/models — Gemini model roster
- https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro/ — model announcement
- https://www.npmjs.com/package/@google/gemini-cli — npm package

Current state captured on: **2026-04-10**

---

**End of plan. Total phases: 12. Estimated tasks: ~95. Estimated effort: 8–16 hours of focused work.**
