#!/usr/bin/env bash
# validate-report.sh — Verify product analysis report and checklist pass quality gates
# Usage: ./validate-report.sh [report-path] [checklist-path]
# Exit code: 0 if all gates pass, 1 if any fail

set -euo pipefail

REPORT="${1:-docs/product-analysis-report.md}"
CHECKLIST="${2:-docs/product-analysis-checklist.md}"

PASS=0
FAIL=0
WARN=0

# ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────────

check_pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
check_fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
check_warn() { echo "  WARN: $1"; WARN=$((WARN + 1)); }

# Check if a section has content (not just the header)
section_has_content() {
    local file="$1"
    local section="$2"

    # Extract content between this section header and the next ## header
    local content
    content=$(awk "
        /^## $section/ { found=1; next }
        found && /^## / { exit }
        found { print }
    " "$file" 2>/dev/null | tr -d '[:space:]')

    [[ ${#content} -gt 20 ]]  # More than 20 non-whitespace chars = has content
}

# ─── REPORT CHECKS ──────────────────────────────────────────────────────────────

echo "=== Product Analysis Quality Gates ==="
echo ""
echo "Report: $REPORT"
echo "Checklist: $CHECKLIST"
echo ""

# Gate 1: Report exists and is not empty
echo "--- Report File ---"
if [[ -f "$REPORT" ]]; then
    local_lines=$(wc -l < "$REPORT")
    if [[ "$local_lines" -gt 20 ]]; then
        check_pass "Report exists ($local_lines lines)"
    else
        check_fail "Report exists but is too short ($local_lines lines)"
    fi
else
    check_fail "Report file not found: $REPORT"
fi

# Gate 2: Report has all 5 phase sections with content
if [[ -f "$REPORT" ]]; then
    echo ""
    echo "--- Phase Sections ---"

    for phase in "Phase 1" "Phase 2" "Phase 3" "Phase 4" "Phase 5"; do
        if grep -q "## $phase" "$REPORT" 2>/dev/null; then
            if section_has_content "$REPORT" "$phase"; then
                check_pass "$phase has content"
            else
                check_fail "$phase header exists but no substantive content"
            fi
        else
            check_fail "$phase section missing from report"
        fi
    done

    # Gate 3: Executive Summary
    echo ""
    echo "--- Executive Summary ---"
    if grep -q "## Executive Summary" "$REPORT" 2>/dev/null; then
        if section_has_content "$REPORT" "Executive Summary"; then
            check_pass "Executive Summary has content"
        else
            check_fail "Executive Summary is empty or placeholder"
        fi
    else
        check_fail "Executive Summary section missing"
    fi

    # Gate 4: Baseline Metrics filled
    echo ""
    echo "--- Baseline Metrics ---"
    if grep -q "## Baseline Metrics" "$REPORT" 2>/dev/null; then
        # Check if the metrics table has actual values (not just empty cells)
        empty_cells=$(grep -c '| *|$' "$REPORT" 2>/dev/null || true)
        empty_cells=${empty_cells:-0}
        if [[ "$empty_cells" -lt 3 ]]; then
            check_pass "Baseline Metrics table appears filled"
        else
            check_warn "Baseline Metrics table may have empty cells ($empty_cells found)"
        fi
    else
        check_fail "Baseline Metrics section missing"
    fi

    # Gate 5: lizard output present
    echo ""
    echo "--- Tool Output Evidence ---"
    if grep -qi 'lizard\|cyclomatic' "$REPORT" 2>/dev/null; then
        check_pass "Phase 4 references complexity analysis"
    else
        check_fail "No lizard/complexity output found in report"
    fi

    if grep -qi 'scc\|COCOMO\|lines of code' "$REPORT" 2>/dev/null; then
        check_pass "Phase 4 references codebase statistics"
    else
        check_fail "No scc/codebase statistics found in report"
    fi

    # Gate 6: No placeholder text
    if grep -q '{{' "$REPORT" 2>/dev/null; then
        check_fail "Unfilled placeholders found in report"
    else
        check_pass "No unfilled placeholders"
    fi

    if grep -q '<!-- Fill' "$REPORT" 2>/dev/null || grep -q '<!-- Paste' "$REPORT" 2>/dev/null; then
        check_warn "Template comments still present (<!-- Fill... -->)"
    fi
fi

# ─── CHECKLIST CHECKS ───────────────────────────────────────────────────────────

echo ""
echo "--- Checklist File ---"

if [[ -f "$CHECKLIST" ]]; then
    local_lines=$(wc -l < "$CHECKLIST")
    check_pass "Checklist exists ($local_lines lines)"

    echo ""
    echo "--- Checklist Categories ---"

    for category in "FG-" "UI-" "TD-" "EN-" "IN-"; do
        count=$(grep -c "^- \[.\] $category\|^- $category\|^$category" "$CHECKLIST" 2>/dev/null || echo 0)
        if [[ "$count" -gt 0 ]]; then
            check_pass "Category $category has $count items"
        else
            check_fail "Category $category has no items"
        fi
    done

    # Check for effort and priority annotations
    echo ""
    echo "--- Item Quality ---"
    total_items=$(grep -c '^- \[.\]\|^- [A-Z][A-Z]-' "$CHECKLIST" 2>/dev/null || echo 0)

    has_effort=$(grep -c '[SMLX]\{1,2\}[|)]' "$CHECKLIST" 2>/dev/null || echo 0)

    has_priority=$(grep -c 'P[0-3]' "$CHECKLIST" 2>/dev/null || echo 0)

    if [[ "$total_items" -gt 0 ]]; then
        check_pass "Total checklist items: $total_items"
    else
        check_fail "No checklist items found"
    fi

    if [[ "$has_effort" -gt 0 ]]; then
        check_pass "Items with effort ratings: $has_effort"
    else
        check_warn "No effort ratings (S/M/L/XL) found"
    fi

    if [[ "$has_priority" -gt 0 ]]; then
        check_pass "Items with priority ratings: $has_priority"
    else
        check_warn "No priority ratings (P0-P3) found"
    fi
else
    check_fail "Checklist file not found: $CHECKLIST"
fi

# ─── SUMMARY ────────────────────────────────────────────────────────────────────

echo ""
echo "================================"
echo "Results: $PASS passed, $FAIL failed, $WARN warnings"
echo "================================"

if [[ "$FAIL" -gt 0 ]]; then
    echo ""
    echo "Quality gates NOT met. Continue iterating."
    exit 1
else
    echo ""
    echo "All quality gates passed."
    exit 0
fi
