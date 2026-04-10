#!/usr/bin/env bash
# scaffold-extension.sh: Creates boilerplate for a new Claude Code extension
TYPE="$1"
NAME="$2"
DEST_DIR=".claude/$TYPE"

if [ -z "$NAME" ]; then
    echo "Usage: $0 <commands|skills|agents> <name>"
    exit 1
fi

mkdir -p "$DEST_DIR"
FILE_PATH="$DEST_DIR/$NAME.md"

if [ -f "$FILE_PATH" ]; then
    echo "❌ Error: $FILE_PATH already exists."
    exit 1
fi

if [ "$TYPE" == "commands" ]; then
cat << 'EOF' > "$FILE_PATH"
---
description: A brief summary of what this command does
allowed-tools: Bash, Read, Write
argument-hint: "[arguments]"
---

# Command Name

You have been invoked. Execute your logic based on the user's arguments.

```!
# Pre-computation bash block
# Commands here execute BEFORE the prompt is sent to Claude.
# The stdout of these commands is injected into the context.
```

---
User Args: $ARGUMENTS
EOF

elif [ "$TYPE" == "skills" ]; then
cat << 'EOF' > "$FILE_PATH"
---
name: my-custom-skill
description: A description of what this skill does and when to use it
disable-model-invocation: true
allowed-tools: Bash, Read
---

# Skill Instructions

When using this skill, follow these instructions:
1. Step one
2. Step two
EOF

elif [ "$TYPE" == "agents" ]; then
cat << 'EOF' > "$FILE_PATH"
---
name: my-expert-agent
description: Use PROACTIVELY to solve problems related to [domain].
# tools: [Read, Glob, Grep]
isolation: worktree
memory: project
---

# Domain Expert: [Domain]

You are an expert in [Domain]. 

## 1. Environment Detection
Use Glob and Read to understand the current state.

## 2. Solution Implementation
Implement the solution using best practices.
EOF

else
    echo "❌ Invalid type. Use commands, skills, or agents."
    exit 1
fi

echo "✅ Generated $FILE_PATH successfully."
