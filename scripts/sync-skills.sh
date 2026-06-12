#!/usr/bin/env bash
# sync-skills.sh — keep .claude/skills/ and .agents/skills/ from drifting.
#
# Class model (see docs/skills-sync.md and docs/audits/2026-06-11-skill-audit.md, Cluster 4):
#   IDENTICAL    claude-* meta family — must be byte-identical (several .claude entries
#                are symlinks into .agents; those are identical by construction).
#   ARSCONTEXTA  14 core skills + stats/tasks — .claude is canonical; .agents copies are
#                domain-vocabulary transforms (ops/derivation-manifest.md). Report-only:
#                we flag staleness, we never overwrite a transform mechanically.
#   BREADBOARD   breadboard-lab — .claude canonical full version, .agents is a
#                hand-maintained condensed variant. Drift reported as info, never synced.
#   EXEMPT       .agents-only cross-agent tooling (maestros, scribe, skill-builder).
#
# Usage:  scripts/sync-skills.sh [--check|--fix]
#   --check (default)  report per-class status + lint; exit 1 if problems found
#   --fix              sync IDENTICAL-class drift newer→older; all else stays report-only
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CLAUDE="$ROOT/.claude/skills"
AGENTS="$ROOT/.agents/skills"
MODE="${1:---check}"
[[ "$MODE" == "--check" || "$MODE" == "--fix" ]] || { echo "usage: $0 [--check|--fix]" >&2; exit 2; }

IDENTICAL=(claude-agent-sdk claude-api claude-code
           claude-hook-writer claude-settings-audit claude-skills claude-update)
# claude-extensibility retired 2026-06-11 (absorbed into claude-skills per docs/audits/2026-06-11-skill-audit.md)
ARSCONTEXTA=(connect extract graph learn next pipeline ralph refactor remember
             rethink revisit seed validate verify)
# Documented rename map: .claude name -> .agents name (frontmatter keeps the .claude name)
declare -A RENAME=([stats]=ars-stats [tasks]=ars-tasks)
EXEMPT_RE='^(claude-code-maestro|scribe-mastery|universal-skill-builder)$'

PROBLEMS=0
problem() { echo "  [PROBLEM] $*"; PROBLEMS=$((PROBLEMS + 1)); }
info()    { echo "  [info]    $*"; }
ok()      { echo "  [ok]      $*"; }

# Newest file mtime (epoch) inside a dir; 0 if empty/missing.
newest() {
  local t=""
  [[ -d "$1" ]] && t="$(find "$1" -type f -printf '%T@\n' 2>/dev/null | sort -rn | head -1 | cut -d. -f1)"
  echo "${t:-0}"
}

# ---------------------------------------------------------------- IDENTICAL class
echo "== IDENTICAL class (claude-* meta family) =="
for s in "${IDENTICAL[@]}"; do
  c="$CLAUDE/$s" a="$AGENTS/$s"
  if [[ ! -e "$a" ]]; then problem "$s: missing in .agents/skills"; continue; fi
  if [[ -L "$c" ]]; then
    if [[ -d "$c" ]]; then ok "$s: .claude is a symlink into .agents (identical by construction)"
    else problem "$s: .claude symlink is dangling -> $(readlink "$c")"; fi
    continue
  fi
  if [[ ! -e "$c" ]]; then problem "$s: missing in .claude/skills"; continue; fi
  if diff -rq "$c" "$a" >/dev/null 2>&1; then ok "$s: byte-identical"; else
    cn=$(newest "$c"); an=$(newest "$a")
    if [[ "$MODE" == "--fix" ]]; then
      if (( cn >= an )); then src="$c"; dst="$a"; else src="$a"; dst="$c"; fi
      echo "  [fix]     $s: syncing newer ($src) -> older ($dst)"
      if command -v rsync >/dev/null; then rsync -a --delete "$src/" "$dst/"
      else rm -rf "$dst"; cp -a "$src" "$dst"; fi
      ok "$s: synced"
    else
      dir=$( (( cn >= an )) && echo ".claude newer" || echo ".agents newer" )
      problem "$s: drifted ($dir) — run with --fix to sync newer -> older"
    fi
  fi
done

# -------------------------------------------------------------- ARSCONTEXTA class
echo
echo "== ARSCONTEXTA class (.claude canonical; .agents = vocabulary transform, report-only) =="
TOL=120  # seconds of mtime slack (checkout noise)
check_ars() { # $1 = .claude name, $2 = .agents name
  local c="$CLAUDE/$1" a="$AGENTS/$2"
  [[ -d "$c" ]] || { problem "$1: missing in .claude/skills (canonical side!)"; return; }
  [[ -d "$a" ]] || { problem "$1: transform missing in .agents/skills ($2)"; return; }
  local cn an; cn=$(newest "$c"); an=$(newest "$a")
  if (( cn > an + TOL )); then
    problem "$1: .claude edited after .agents/$2 — transform is STALE; regenerate via ops/derivation-manifest.md vocabulary map"
  elif (( an > cn + TOL )); then
    info "$1: .agents/$2 newer than canonical .claude — check the edit wasn't made on the wrong side"
  else
    ok "$1: recency aligned (.claude $(date -d @"$cn" +%F) / .agents $(date -d @"$an" +%F))"
  fi
}
for s in "${ARSCONTEXTA[@]}"; do check_ars "$s" "$s"; done
for s in "${!RENAME[@]}"; do check_ars "$s" "${RENAME[$s]}"; done

# ------------------------------------------------------------- BREADBOARD class
echo
echo "== BREADBOARD class (hand-maintained condensed variant — never auto-synced) =="
BB_C="$CLAUDE/breadboard-lab" BB_A="$AGENTS/breadboard-lab"
if [[ -d "$BB_C" && -d "$BB_A" ]]; then
  cn=$(newest "$BB_C"); an=$(newest "$BB_A")
  cf=$(find "$BB_C" -type f | wc -l); af=$(find "$BB_A" -type f | wc -l)
  info "breadboard-lab: .claude $cf files (newest $(date -d @"$cn" +%F)) vs .agents $af files (newest $(date -d @"$an" +%F))"
  if (( cn > an + TOL )); then
    info "breadboard-lab: .claude canonical is newer — hand-refresh the .agents condensed variant (keep its Codex extras)"
  fi
else
  problem "breadboard-lab: missing on one side (.claude=$([[ -d $BB_C ]] && echo yes || echo NO), .agents=$([[ -d $BB_A ]] && echo yes || echo NO))"
fi

# ------------------------------------------------------------------------- LINT
echo
echo "== LINT (both trees) =="
for tree in "$CLAUDE" "$AGENTS"; do
  short="${tree#"$ROOT"/}"
  for d in "$tree"/*/; do
    [[ -d "$d" ]] || continue
    name="$(basename "$d")"
    # Dangling symlink (dir-level)
    if [[ -L "${d%/}" && ! -e "$d" ]]; then problem "lint: $short/$name is a dangling symlink"; continue; fi
    # Skip symlinked .claude entries: their real content is linted under .agents
    [[ "$tree" == "$CLAUDE" && -L "${d%/}" ]] && continue
    # Missing SKILL.md (empty-dir scaffolds included)
    if [[ "$name" == "shared-references" ]]; then continue; fi  # shared reference pool, not a skill
    if [[ ! -f "$d/SKILL.md" ]]; then problem "lint: $short/$name has no SKILL.md"; continue; fi
    fm="$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$d/SKILL.md")"
    # Literal scaffold placeholders in frontmatter
    if grep -qF '[Domain]' <<<"$fm"; then problem "lint: $short/$name frontmatter contains literal [Domain] placeholder"; fi
    # frontmatter name vs dir name (rename map allowed)
    fmname="$(sed -n 's/^name:[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}[[:space:]]*$/\1/p' <<<"$fm" | head -1)"
    if [[ -z "$fmname" ]]; then
      problem "lint: $short/$name SKILL.md has no frontmatter name:"
    elif [[ "$fmname" != "$name" ]]; then
      if [[ "${RENAME[$fmname]:-}" == "$name" ]]; then
        ok "lint: $short/$name keeps canonical name '$fmname' (documented rename)"
      else
        problem "lint: $short/$name frontmatter name '$fmname' != dir name"
      fi
    fi
  done
  # Dangling symlinks at any depth (e.g. broken reference links inside skills)
  while IFS= read -r link; do
    problem "lint: dangling symlink ${link#"$ROOT"/} -> $(readlink "$link")"
  done < <(find "$tree" -xtype l 2>/dev/null)
done

# Note exempt .agents-only tooling so nobody "fixes" it into .claude
echo
echo "== EXEMPT (.agents-only cross-agent tooling) =="
for d in "$AGENTS"/*/; do
  name="$(basename "$d")"
  [[ "$name" =~ $EXEMPT_RE ]] && info "$name: cross-agent only, no .claude mirror expected"
done

echo
if (( PROBLEMS > 0 )); then
  echo "RESULT: $PROBLEMS problem(s) found."
  [[ "$MODE" == "--check" ]] && echo "Identical-class drift is fixable with: scripts/sync-skills.sh --fix"
  echo "Arscontexta/breadboard drift is intentional-by-class: regenerate transforms by hand (see docs/skills-sync.md)."
  exit 1
fi
echo "RESULT: clean — no drift, no lint findings."
