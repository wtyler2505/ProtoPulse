#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <skill-dir>"
  exit 1
fi

SKILL_DIR="${1%/}"
SKILL_FILE="$SKILL_DIR/SKILL.md"
OPENAI_YAML="$SKILL_DIR/agents/openai.yaml"

if [[ ! -d "$SKILL_DIR" ]]; then
  echo "Missing skill directory: $SKILL_DIR"
  exit 1
fi

if [[ ! -f "$SKILL_FILE" ]]; then
  echo "Missing SKILL.md"
  exit 1
fi

echo "Auditing $SKILL_DIR"

if grep -q '^name:' "$SKILL_FILE"; then
  echo "PASS: frontmatter has name"
else
  echo "FAIL: frontmatter missing name"
fi

if grep -q '^description:' "$SKILL_FILE"; then
  echo "PASS: frontmatter has description"
else
  echo "FAIL: frontmatter missing description"
fi

if [[ "$SKILL_DIR" == .agents/skills/* || "$SKILL_DIR" == */.agents/skills/* ]]; then
  echo "PASS: repo-scoped location"
else
  echo "WARN: not under .agents/skills"
fi

for optional_dir in references scripts assets; do
  if [[ -d "$SKILL_DIR/$optional_dir" ]]; then
    echo "INFO: found $optional_dir/"
  fi
done

if [[ -f "$OPENAI_YAML" ]]; then
  echo "INFO: found agents/openai.yaml"
  if grep -q 'allow_implicit_invocation:' "$OPENAI_YAML"; then
    echo "PASS: invocation policy declared"
  else
    echo "INFO: invocation policy omitted (defaults to implicit)"
  fi
fi

for extra_doc in README.md CHANGELOG.md NOTES.md; do
  if [[ -f "$SKILL_DIR/$extra_doc" ]]; then
    echo "WARN: extra file $extra_doc may add avoidable context"
  fi
done
