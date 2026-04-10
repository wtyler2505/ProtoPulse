#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <skill-name> [skills-root]"
  exit 1
fi

SKILL_NAME="$1"
SKILLS_ROOT="${2:-.agents/skills}"
TARGET_DIR="${SKILLS_ROOT%/}/$SKILL_NAME"
ASSET_DIR="$(cd "$(dirname "$0")/.." && pwd)/assets"

if [[ ! "$SKILL_NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "Skill name must be kebab-case."
  exit 1
fi

mkdir -p "$TARGET_DIR"/{references,assets,agents,scripts}

if [[ ! -f "$TARGET_DIR/SKILL.md" ]]; then
  cp "$ASSET_DIR/skill-template.md" "$TARGET_DIR/SKILL.md"
  sed -i "s/{{SKILL_NAME}}/$SKILL_NAME/g" "$TARGET_DIR/SKILL.md"
fi

if [[ ! -f "$TARGET_DIR/agents/openai.yaml" ]]; then
  cp "$ASSET_DIR/openai.yaml.template" "$TARGET_DIR/agents/openai.yaml"
  sed -i "s/{{DISPLAY_NAME}}/$SKILL_NAME/g" "$TARGET_DIR/agents/openai.yaml"
fi

if [[ ! -f "$TARGET_DIR/references/overview.md" ]]; then
  cp "$ASSET_DIR/reference-template.md" "$TARGET_DIR/references/overview.md"
  sed -i "s/{{SKILL_NAME}}/$SKILL_NAME/g" "$TARGET_DIR/references/overview.md"
fi

echo "Scaffolded $TARGET_DIR"
