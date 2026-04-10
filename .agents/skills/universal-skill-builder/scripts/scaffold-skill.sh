#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <skill-name> [--platform <gemini|codex|claude>] [--arch maestro] [skills-root]"
  exit 1
fi

SKILL_NAME="$1"
shift

ARCH="standard"
PLATFORM="codex"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --arch)
      ARCH="$2"
      shift 2
      ;;
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    *)
      SKILLS_ROOT="$1"
      shift
      ;;
  esac
done

SKILLS_ROOT="${SKILLS_ROOT:-.agents/skills}"
TARGET_DIR="${SKILLS_ROOT%/}/$SKILL_NAME"
ASSET_DIR="$(cd "$(dirname "$0")/.." && pwd)/assets"

if [[ ! "$SKILL_NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "Skill name must be kebab-case."
  exit 1
fi

if [[ "$ARCH" == "maestro" ]]; then
  echo "Scaffolding Maestro-Class Architecture for $SKILL_NAME (Platform: $PLATFORM)..."
  
  # Create multi-directory ecosystem
  mkdir -p "$TARGET_DIR"/{references/raw_docs,scripts,data,templates}
  
  # 1. Main SKILL.md
  if [[ ! -f "$TARGET_DIR/SKILL.md" ]]; then
    cp "$ASSET_DIR/maestro/SKILL.md.template" "$TARGET_DIR/SKILL.md"
    sed -i "s/{{SKILL_NAME}}/$SKILL_NAME/g" "$TARGET_DIR/SKILL.md"
    
    if [[ "$PLATFORM" == "claude" ]]; then
      # Add Claude-specific frontmatter
      sed -i '1i ---\nname: '"$SKILL_NAME"'\ndescription: A Maestro-Class skill for '"$SKILL_NAME"'\nallowed-tools: Bash, Read, Write\n---' "$TARGET_DIR/SKILL.md"
    fi
  fi
  
  # 2. Knowledge Map
  if [[ ! -f "$TARGET_DIR/references/KNOWLEDGE_MAP.md" ]]; then
    cp "$ASSET_DIR/maestro/KNOWLEDGE_MAP.md.template" "$TARGET_DIR/references/KNOWLEDGE_MAP.md"
    sed -i "s/{{SKILL_NAME}}/$SKILL_NAME/g" "$TARGET_DIR/references/KNOWLEDGE_MAP.md"
  fi
  
  # 3. Scripts
  for script_template in doctor.sh auto-backup.sh log-action.sh; do
    script_dest="$TARGET_DIR/scripts/${script_template}"
    if [[ ! -f "$script_dest" ]]; then
      cp "$ASSET_DIR/maestro/${script_template}.template" "$script_dest"
      sed -i "s/{{SKILL_NAME}}/$SKILL_NAME/g" "$script_dest"
      chmod +x "$script_dest"
    fi
  done
  
  # 4. Platform-Specific Command / Metadata Injection
  if [[ "$PLATFORM" == "gemini" || "$PLATFORM" == "codex" ]]; then
    CMD_DIR=".gemini/commands/$SKILL_NAME"
    mkdir -p "$CMD_DIR"
    if [[ ! -f "$CMD_DIR/assistant.toml" ]]; then
      cp "$ASSET_DIR/maestro/command.toml.template" "$CMD_DIR/assistant.toml"
      sed -i "s/{{SKILL_NAME}}/$SKILL_NAME/g" "$CMD_DIR/assistant.toml"
      echo "Created zero-latency Gemini/Codex command at $CMD_DIR/assistant.toml"
    fi
  fi

  if [[ "$PLATFORM" == "codex" ]]; then
    mkdir -p "$TARGET_DIR/agents"
    if [[ ! -f "$TARGET_DIR/agents/openai.yaml" ]]; then
      cp "$ASSET_DIR/openai.yaml.template" "$TARGET_DIR/agents/openai.yaml"
      sed -i "s/{{DISPLAY_NAME}}/$SKILL_NAME/g" "$TARGET_DIR/agents/openai.yaml"
      echo "Created Codex metadata at $TARGET_DIR/agents/openai.yaml"
    fi
  fi

  echo "Scaffolded Maestro ecosystem at $TARGET_DIR"

else
  echo "Scaffolding Standard Architecture for $SKILL_NAME (Platform: $PLATFORM)..."
  
  mkdir -p "$TARGET_DIR"/{references,assets,agents,scripts}

  if [[ ! -f "$TARGET_DIR/SKILL.md" ]]; then
    cp "$ASSET_DIR/skill-template.md" "$TARGET_DIR/SKILL.md"
    sed -i "s/{{SKILL_NAME}}/$SKILL_NAME/g" "$TARGET_DIR/SKILL.md"
    
    if [[ "$PLATFORM" == "claude" ]]; then
      sed -i '1i ---\nname: '"$SKILL_NAME"'\ndescription: A standard skill for '"$SKILL_NAME"'\n---' "$TARGET_DIR/SKILL.md"
    fi
  fi

  if [[ "$PLATFORM" == "codex" || "$PLATFORM" == "gemini" ]]; then
    if [[ ! -f "$TARGET_DIR/agents/openai.yaml" ]]; then
      cp "$ASSET_DIR/openai.yaml.template" "$TARGET_DIR/agents/openai.yaml"
      sed -i "s/{{DISPLAY_NAME}}/$SKILL_NAME/g" "$TARGET_DIR/agents/openai.yaml"
    fi
  fi

  if [[ ! -f "$TARGET_DIR/references/overview.md" ]]; then
    cp "$ASSET_DIR/reference-template.md" "$TARGET_DIR/references/overview.md"
    sed -i "s/{{SKILL_NAME}}/$SKILL_NAME/g" "$TARGET_DIR/references/overview.md"
  fi
  
  echo "Scaffolded standard ecosystem at $TARGET_DIR"
fi
