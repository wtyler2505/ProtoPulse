#!/bin/bash
cd /home/wtyler/Projects/ProtoPulse/.agents/skills/claude-code-maestro/references/raw_docs

while read url; do
  # Ignore empty lines
  if [[ -n "$url" && "$url" == http* ]]; then
    # Convert URL path to filename (e.g., agent-sdk/overview -> agent-sdk-overview.md)
    filename=$(echo "$url" | sed -e 's|https://code.claude.com/docs/en/||' -e 's|/|-|g').md
    echo "Fetching ${url}.md -> $filename"
    curl -sL "${url}.md" -o "$filename"
    # Small delay to be polite to the server
    sleep 0.1
  fi
done < /home/wtyler/Projects/ProtoPulse/docs/claude-code-cli-knowledge.txt

echo "Finished downloading all reference files."
