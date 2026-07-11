#!/usr/bin/env bash
# merge-phases.sh — Merge phase checklist files into a unified categorized checklist
# Usage: ./merge-phases.sh [analysis-dir] [output-file]
# If output-file is omitted, writes to stdout
# Called by synthesis agent as a starting point before refinement

set -euo pipefail

ANALYSIS_DIR="${1:-.claude/analysis}"
OUTPUT_FILE="${2:-}"

# ─── CATEGORY DEFINITIONS ────────────────────────────────────────────────────

declare -A CATEGORY_NAMES=(
    ["FG"]="Feature Gaps"
    ["UI"]="UX Issues"
    ["TD"]="Tech Debt"
    ["EN"]="Enhancements"
    ["IN"]="Innovations"
)

# Ordered list (bash associative arrays don't preserve insertion order)
CATEGORY_ORDER=("FG" "UI" "TD" "EN" "IN")

# Associative arrays to hold items per category
declare -A CATEGORY_ITEMS
for cat in "${CATEGORY_ORDER[@]}"; do
    CATEGORY_ITEMS["$cat"]=""
done

# ─── COLLECT ITEMS FROM PHASE FILES ──────────────────────────────────────────

phase_count=0
missing_count=0

for phase_file in "$ANALYSIS_DIR"/phase-*-checklist.md; do
    if [[ ! -f "$phase_file" ]]; then
        echo "Warning: No phase checklist files found in $ANALYSIS_DIR" >&2
        missing_count=$((missing_count + 1))
        continue
    fi

    phase_count=$((phase_count + 1))
    basename_file="$(basename "$phase_file")"

    while IFS= read -r line; do
        # Match checklist items: - [ ] or - [x] followed by category prefix
        if [[ "$line" =~ ^[[:space:]]*-[[:space:]]\[([ xX])\][[:space:]]+ ]]; then
            for cat in "${CATEGORY_ORDER[@]}"; do
                if [[ "$line" =~ ${cat}- ]]; then
                    CATEGORY_ITEMS["$cat"]+="${line}"$'\n'
                    break
                fi
            done
        fi
    done < "$phase_file"
done

if [[ $phase_count -eq 0 ]]; then
    echo "Error: No phase-*-checklist.md files found in $ANALYSIS_DIR" >&2
    exit 1
fi

# ─── BUILD OUTPUT ────────────────────────────────────────────────────────────

build_output() {
    cat <<'HEADER'
# Merged Product Analysis Checklist

> Auto-merged from phase checklists. Refine before finalizing.
> Priority: P0 (critical) → P3 (nice-to-have)
> Effort: S (hours) / M (days) / L (weeks) / XL (months)
HEADER

    total_items=0

    for cat in "${CATEGORY_ORDER[@]}"; do
        local name="${CATEGORY_NAMES[$cat]}"
        local items="${CATEGORY_ITEMS[$cat]}"

        echo ""
        echo "## ${name} (${cat}-)"
        echo ""

        if [[ -z "$items" ]]; then
            echo "<!-- No items in this category -->"
        else
            # Deduplicate and print items
            local count=0
            while IFS= read -r item; do
                [[ -z "$item" ]] && continue
                echo "$item"
                count=$((count + 1))
            done <<< "$items"
            total_items=$((total_items + count))
            echo ""
            echo "<!-- ${count} items -->"
        fi
    done

    echo ""
    echo "---"
    echo ""
    echo "**Summary:** ${total_items} items merged from ${phase_count} phase files"

    # Per-category breakdown
    echo ""
    echo "| Category | Count |"
    echo "|----------|-------|"
    for cat in "${CATEGORY_ORDER[@]}"; do
        local name="${CATEGORY_NAMES[$cat]}"
        local items="${CATEGORY_ITEMS[$cat]}"
        local count=0
        if [[ -n "$items" ]]; then
            while IFS= read -r item; do
                [[ -z "$item" ]] && continue
                count=$((count + 1))
            done <<< "$items"
        fi
        echo "| ${name} (${cat}-) | ${count} |"
    done
    echo "| **Total** | **${total_items}** |"
}

# ─── OUTPUT ──────────────────────────────────────────────────────────────────

if [[ -n "$OUTPUT_FILE" ]]; then
    build_output > "$OUTPUT_FILE"
    echo "Merged checklist written to: $OUTPUT_FILE" >&2
    echo "Source: ${phase_count} phase files from ${ANALYSIS_DIR}" >&2
else
    build_output
fi
