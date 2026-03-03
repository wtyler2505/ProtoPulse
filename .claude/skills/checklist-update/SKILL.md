---
name: checklist-update
description: Toggle checklist items by issue ID and update summary counts in audit checklists
---

# /checklist-update

Toggle checklist items by issue ID (check/uncheck) and update summary counts. Supports single and batch operations.

## Arguments

Format: `<ID> [action] [-- description]` or batch: `<ID1>,<ID2>,<ID3> [action]`

- `ID` — Issue ID to toggle (e.g., `VA-001`, `VL-01`, `FA-012`)
- `action` — `check` (default) or `uncheck`
- `description` — Optional fix description appended after checking (use `--` separator)

### Examples

```
/checklist-update VA-001                          # check VA-001
/checklist-update VA-001 check -- Fixed contrast ratio to 4.6:1
/checklist-update VA-001 uncheck                  # uncheck VA-001
/checklist-update VA-001,VA-005,VA-012 check      # batch check
/checklist-update VA-001,VA-005 check -- Batch fix for contrast issues
```

## Procedure

### Step 1: Locate the Checklist

1. If the conversation has a recently referenced checklist file, use that
2. Otherwise, glob for checklist files:
   ```
   docs/*checklist*.md
   docs/*CHECKLIST*.md
   docs/*audit*.md
   ```
3. Use the most recently modified match
4. If no file found: tell user and ask for the path

### Step 2: Parse Arguments

1. Split input on commas to get list of IDs (trim whitespace)
2. Determine action: `check` or `uncheck` (default: `check`)
3. Extract description if `--` separator is present

### Step 3: Toggle Items

For each ID in the list:

1. Search the checklist file for the line containing `**{ID}**`
2. If checking:
   - Replace `- [ ] **{ID}**` with `- [x] **{ID}**`
   - If a description was provided, append it: `- [x] **{ID}** [View] Original text *(fixed: {description})*`
3. If unchecking:
   - Replace `- [x] **{ID}**` with `- [ ] **{ID}**`
   - Remove any previously appended fix description (the `*(fixed: ...)*` part)
4. Track which IDs were found and toggled, and which were not found

### Step 4: Update Summary Counts

After toggling, recount and update the summary section at the top of the checklist:

1. Count all `- [x]` lines → checked count
2. Count all `- [ ]` lines → unchecked count
3. Total = checked + unchecked
4. Count by priority section (P0/P1/P2/P3): both checked and unchecked in each section
5. Update the summary block:
   ```
   ## Summary
   - Total issues: {total}
   - Resolved: {checked}/{total} ({percentage}%)
   - P0 (Critical): {resolved}/{total_p0}
   - P1 (High): {resolved}/{total_p1}
   - P2 (Medium): {resolved}/{total_p2}
   - P3 (Low): {resolved}/{total_p3}
   ```
6. If no summary section exists, add one at the top (after the title)

### Step 5: Report

Print a concise report:
```
Checklist updated: docs/visual-audit-checklist.md
  Checked: VA-001, VA-005, VA-012
  Not found: (none)
  Progress: 45/107 (42%)
```

## Error Handling

- ID not found in checklist: report it but continue with remaining IDs
- Checklist file not found: list available checklist files and ask user
- ID already in target state (checking an already-checked item): skip silently, note in report
- Malformed checklist line: report the issue but don't corrupt the file

## Notes

- This skill is purely a file editing operation — no builds, no git
- Preserve all existing formatting and content outside the toggled lines
- The summary update must be accurate — recount from the actual `[x]` and `[ ]` markers
- Support any ID prefix pattern (VA-, VL-, FA-, etc.)
