#!/usr/bin/env bash
# baseline-metrics.sh — Generate baseline metrics table for product analysis report
# Usage: ./baseline-metrics.sh [project-directory]
# Output: Markdown-formatted metrics table to stdout

set -euo pipefail

PROJECT_ROOT="${1:-$(pwd)}"
PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"

has_cmd() { command -v "$1" &>/dev/null; }

# ─── COLLECT METRICS ────────────────────────────────────────────────────────────

total_files="N/A"
total_loc="N/A"
languages="N/A"
avg_complexity="N/A"
test_files="N/A"
cocomo="N/A"
commits_30d="N/A"
open_issues="N/A"
contributors="N/A"

# scc — primary source for LOC, files, languages, COCOMO
if has_cmd scc; then
    scc_json=$(scc "$PROJECT_ROOT" --format json 2>/dev/null || echo "[]")
    total_files=$(echo "$scc_json" | jq '[.[].Count] | add // 0' 2>/dev/null || echo "N/A")
    total_loc=$(echo "$scc_json" | jq '[.[].Code] | add // 0' 2>/dev/null || echo "N/A")
    languages=$(echo "$scc_json" | jq -r '[.[] | select(.Code > 50) | .Name] | join(", ")' 2>/dev/null || echo "N/A")

    # COCOMO from full scc output
    cocomo_raw=$(scc "$PROJECT_ROOT" 2>/dev/null | grep -i 'estimated cost' | head -1 || true)
    if [[ -n "$cocomo_raw" ]]; then
        cocomo=$(echo "$cocomo_raw" | sed 's/.*: *//')
    fi
fi

# lizard — average complexity
if has_cmd lizard; then
    lizard_summary=$(lizard "$PROJECT_ROOT" --csv 2>/dev/null | tail -1 || true)
    if [[ -n "$lizard_summary" ]]; then
        avg_complexity=$(echo "$lizard_summary" | awk -F',' '{if(NF>=3) print $3}' || echo "N/A")
    fi
fi

# Test file count
if has_cmd fd; then
    test_files=$(fd -g '*test*' -g '*spec*' -g '__tests__' "$PROJECT_ROOT" --type f 2>/dev/null | wc -l | tr -d ' ')
elif has_cmd find; then
    test_files=$(find "$PROJECT_ROOT" -name '*test*' -o -name '*spec*' | grep -v node_modules | wc -l | tr -d ' ')
fi

# Git metrics
if git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree &>/dev/null; then
    commits_30d=$(git -C "$PROJECT_ROOT" log --since="30 days ago" --oneline 2>/dev/null | wc -l | tr -d ' ')
    contributors=$(git -C "$PROJECT_ROOT" shortlog -sn --all 2>/dev/null | wc -l | tr -d ' ')
fi

# GitHub metrics
if has_cmd gh; then
    open_issues=$(gh issue list --state open --limit 1000 --json 'number' 2>/dev/null | jq 'length' 2>/dev/null || echo "N/A")
fi

# ─── OUTPUT MARKDOWN TABLE ──────────────────────────────────────────────────────

cat <<EOF
## Baseline Metrics

| Metric | Value |
|--------|-------|
| Total files | $total_files |
| Total LOC | $total_loc |
| Languages | $languages |
| Avg complexity | $avg_complexity |
| Test files | $test_files |
| COCOMO estimate | $cocomo |
| Git commits (30d) | $commits_30d |
| Open issues | $open_issues |
| Contributors | $contributors |
EOF

# ─── RAW SCC OUTPUT ─────────────────────────────────────────────────────────────

if has_cmd scc; then
    echo ""
    echo "### Raw scc Output"
    echo '```'
    scc "$PROJECT_ROOT" 2>/dev/null || echo "scc failed"
    echo '```'
fi

# ─── RAW TOKEI OUTPUT ───────────────────────────────────────────────────────────

if has_cmd tokei; then
    echo ""
    echo "### Raw tokei Output"
    echo '```'
    tokei "$PROJECT_ROOT" 2>/dev/null || echo "tokei failed"
    echo '```'
fi
