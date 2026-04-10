#!/usr/bin/env bash
# generate_index.sh: Creates a highly compressed semantic map of the raw_docs
DOCS_DIR="/home/wtyler/Projects/ProtoPulse/.agents/skills/claude-code-maestro/references/raw_docs"
MAP_FILE="/home/wtyler/Projects/ProtoPulse/.agents/skills/claude-code-maestro/references/KNOWLEDGE_MAP.md"

echo "# Claude Code Raw Docs Knowledge Map" > "$MAP_FILE"
echo "Use this to quickly find which raw markdown file contains the topic you need." >> "$MAP_FILE"

if [ -d "$DOCS_DIR" ]; then
    for f in "$DOCS_DIR"/*.md; do
        filename=$(basename "$f")
        echo -e "\n## File: $filename" >> "$MAP_FILE"
        # Extract H1, H2, and H3 headers to build a table of contents
        grep -E "^#{1,3} " "$f" | sed 's/^/  /' >> "$MAP_FILE"
    done
    echo "Successfully generated KNOWLEDGE_MAP.md"
else
    echo "Error: raw_docs directory not found."
fi
