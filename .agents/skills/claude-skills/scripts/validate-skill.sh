#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  validate-skill.sh <skill-dir> [--strict]

What it does:
  - Validates SKILL.md YAML frontmatter against the current Claude Code spec
    (description recommended; invocation-control fields like
    disable-model-invocation, user-invocable, context: fork, agent,
    allowed-tools, model, effort, paths are accepted and value-checked)
  - Performs lightweight structural checks
  - In --strict mode, enforces the recommended section layout

Examples (run from the claude-skills skill root):
  ./scripts/validate-skill.sh ../postgresql
  ./scripts/validate-skill.sh ../my-skill --strict
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

warn() {
  echo "Warning: $*" >&2
}

strict=0
skill_dir=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --strict)
      strict=1
      shift
      ;;
    --)
      shift
      break
      ;;
    -*)
      die "Unknown argument: $1 (use --help)"
      ;;
    *)
      if [[ -z "$skill_dir" ]]; then
        skill_dir="$1"
        shift
      else
        die "Extra argument: $1 (only one <skill-dir> is allowed)"
      fi
      ;;
  esac
done

[[ -n "$skill_dir" ]] || { usage; exit 1; }
[[ -d "$skill_dir" ]] || die "Not a directory: $skill_dir"

skill_md="$skill_dir/SKILL.md"
[[ -f "$skill_md" ]] || die "Missing SKILL.md: $skill_md"

base_name="$(basename -- "${skill_dir%/}")"

# -------------------- Parse YAML frontmatter --------------------

frontmatter=""
if frontmatter="$(
  awk '
    BEGIN { in_fm=0; closed=0 }
    NR==1 {
      if ($0 != "---") exit 2
      in_fm=1
      next
    }
    in_fm==1 {
      if ($0 == "---") { closed=1; exit 0 }
      print
      next
    }
    END {
      if (closed == 0) exit 3
    }
  ' "$skill_md"
)"; then
  :
else
  rc=$?
  case "$rc" in
    2) die "SKILL.md must start with YAML frontmatter (--- as the first line)" ;;
    3) die "YAML frontmatter is not closed (missing ---)" ;;
    *) die "Failed to parse YAML frontmatter (awk exit=$rc)" ;;
  esac
fi

name="$(
  printf "%s\n" "$frontmatter" | awk -F: '
    tolower($1) ~ /^name$/ {
      sub(/^[^:]*:[[:space:]]*/, "", $0)
      gsub(/[[:space:]]+$/, "", $0)
      print
      exit
    }
  '
)"

description="$(
  printf "%s\n" "$frontmatter" | awk -F: '
    tolower($1) ~ /^description$/ {
      sub(/^[^:]*:[[:space:]]*/, "", $0)
      gsub(/[[:space:]]+$/, "", $0)
      print
      exit
    }
  '
)"

# Per the current Claude Code spec (code.claude.com/docs/en/skills), all
# frontmatter fields are optional; the /command comes from the directory name.
# This repo still requires a decidable description.

if [[ ! "$base_name" =~ ^[a-z][a-z0-9-]*$ ]]; then
  die "Invalid skill directory name: '$base_name' (expected ^[a-z][a-z0-9-]*$; it is the /command)"
fi

if [[ -z "$description" ]]; then
  if [[ "$strict" -eq 1 ]]; then
    die "Strict mode: missing frontmatter field: description"
  fi
  warn "Missing recommended frontmatter field: description (Claude cannot auto-load this skill reliably)"
fi

if [[ -n "$name" && "$name" != "$base_name" ]]; then
  warn "Frontmatter name ('$name') differs from directory name ('$base_name'); 'name' is display-only, the /command stays '$base_name'"
fi

# -------------------- Frontmatter field validation --------------------

# Known fields from the current Claude Code skill spec. Unknown top-level keys
# are warnings (typos), never errors.
known_fields="name description when_to_use argument-hint arguments disable-model-invocation user-invocable allowed-tools disallowed-tools model effort context agent hooks paths shell license version author metadata"

while IFS= read -r key; do
  [[ -n "$key" ]] || continue
  found=0
  for k in $known_fields; do
    if [[ "$key" == "$k" ]]; then found=1; break; fi
  done
  if [[ "$found" -eq 0 ]]; then
    warn "Unknown frontmatter field: '$key' (not in the current Claude Code skill spec)"
  fi
done < <(printf "%s\n" "$frontmatter" | awk -F: '/^[A-Za-z][A-Za-z0-9_-]*:/ { print $1 }')

get_field() {
  printf "%s\n" "$frontmatter" | awk -F: -v f="$1" '
    tolower($1) == f {
      sub(/^[^:]*:[[:space:]]*/, "", $0)
      gsub(/[[:space:]]+$/, "", $0)
      gsub(/^["'\'']|["'\'']$/, "", $0)
      print
      exit
    }
  '
}

for bool_field in disable-model-invocation user-invocable; do
  val="$(get_field "$bool_field")"
  if [[ -n "$val" && "$val" != "true" && "$val" != "false" ]]; then
    die "Invalid value for '$bool_field': '$val' (expected true or false)"
  fi
done

ctx="$(get_field "context")"
if [[ -n "$ctx" && "$ctx" != "fork" ]]; then
  die "Invalid value for 'context': '$ctx' (only 'fork' is supported)"
fi

agent_val="$(get_field "agent")"
if [[ -n "$agent_val" && -z "$ctx" ]]; then
  warn "'agent' is set but 'context: fork' is not; 'agent' only applies to forked skills"
fi

# -------------------- Strip fenced code blocks for section checks --------------------

filtered_md="$(mktemp)"
trap 'rm -f "$filtered_md"' EXIT

awk '
  BEGIN { in_fence=0 }
  /^[[:space:]]*```/ { in_fence = !in_fence; next }
  in_fence==0 { print }
' "$skill_md" > "$filtered_md"

# -------------------- Structural checks --------------------

required_h2=(
  "When to Use This Skill"
  "Not For / Boundaries"
  "Quick Reference"
  "Examples"
  "References"
  "Maintenance"
)

for title in "${required_h2[@]}"; do
  if ! grep -Eq "^##[[:space:]]+${title}([[:space:]]*)$" "$filtered_md"; then
    if [[ "$strict" -eq 1 ]]; then
      die "Strict mode: missing required section heading: '## ${title}'"
    fi
    warn "Missing recommended section heading: '## ${title}'"
  fi
done

# references/index.md presence (only enforced in strict mode when references/ exists)
if [[ -d "$skill_dir/references" && "$strict" -eq 1 && ! -f "$skill_dir/references/index.md" ]]; then
  die "Strict mode: references/ exists but references/index.md is missing"
fi

# -------------------- Heuristics: Quick Reference size --------------------

quick_start="$(awk 'match($0, /^##[[:space:]]+Quick Reference([[:space:]]*)$/){print NR; exit}' "$filtered_md" || true)"
if [[ -n "$quick_start" ]]; then
  quick_end="$(awk -v s="$quick_start" 'NR>s && match($0, /^##[[:space:]]+/){print NR; exit}' "$filtered_md" || true)"
  total_lines="$(wc -l < "$filtered_md" | tr -d ' ')"
  if [[ -z "$quick_end" ]]; then
    quick_end="$((total_lines + 1))"
  fi
  quick_len="$((quick_end - quick_start - 1))"
  if [[ "$quick_len" -gt 250 ]]; then
    if [[ "$strict" -eq 1 ]]; then
      die "Strict mode: Quick Reference section is too long (${quick_len} lines). Move long-form text into references/."
    fi
    warn "Quick Reference section is large (${quick_len} lines). Consider moving long-form text into references/."
  fi
fi

# -------------------- Heuristics: Examples count --------------------

examples_start="$(awk 'match($0, /^##[[:space:]]+Examples([[:space:]]*)$/){print NR; exit}' "$filtered_md" || true)"
if [[ -n "$examples_start" ]]; then
  examples_end="$(awk -v s="$examples_start" 'NR>s && match($0, /^##[[:space:]]+/){print NR; exit}' "$filtered_md" || true)"
  total_lines="$(wc -l < "$filtered_md" | tr -d ' ')"
  if [[ -z "$examples_end" ]]; then
    examples_end="$((total_lines + 1))"
  fi

  example_count="$(
    awk -v s="$examples_start" -v e="$examples_end" '
      NR>s && NR<e && match($0, /^###[[:space:]]+Example([[:space:]]|$)/) { c++ }
      END { print c+0 }
    ' "$filtered_md"
  )"

  if [[ "$example_count" -lt 3 ]]; then
    if [[ "$strict" -eq 1 ]]; then
      die "Strict mode: expected >= 3 examples (found ${example_count})."
    fi
    warn "Recommended: >= 3 examples (found ${example_count})."
  fi
fi

echo "OK: $skill_dir"
