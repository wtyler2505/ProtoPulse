---
name: fix-audit-failures
description: Parse a visual audit checklist and deploy an agent team to fix all unchecked items with strict file ownership
---

# /fix-audit-failures

Parse a visual audit checklist markdown file, group unchecked items by affected files, generate an agent team with strict file ownership, deploy the team, and verify fixes.

## Arguments

- `checklist_path` (required) — Path to the audit checklist markdown file (e.g., `docs/visual-audit-checklist.md`)

If no argument provided, glob for `docs/*audit*checklist*.md` or `docs/*CHECKLIST*.md` and use the most recently modified one.

## Procedure

### Step 1: Parse the Checklist

1. Read the checklist file at the provided path
2. Extract all unchecked items: lines matching `- [ ] **{ID}**`
3. For each item, extract:
   - Issue ID (e.g., `VA-001`)
   - Priority (P0/P1/P2/P3 — from the section it's under)
   - View name (in brackets)
   - Description
   - File path and line (from backtick-quoted `file:line` if present)
4. Skip already-checked items: `- [x]`

### Step 2: Map Issues to Files

1. For each unchecked issue, identify the source file(s) it affects
   - Use the `file:line` annotation if present
   - If no file annotation, infer from the view name:
     - Architecture → `client/src/components/views/ArchitectureView.tsx`
     - Schematic → `client/src/components/views/SchematicView.tsx`
     - Breadboard → `client/src/components/views/BreadboardView.tsx`
     - PCB Layout → `client/src/components/views/PCBLayoutView.tsx`
     - Component Editor → `client/src/components/views/ComponentEditorView.tsx`
     - Procurement → `client/src/components/views/ProcurementView.tsx`
     - Validation → `client/src/components/views/ValidationView.tsx`
     - Output → `client/src/components/views/OutputView.tsx`
     - Sidebar → `client/src/components/layout/Sidebar.tsx`
     - Chat Panel → `client/src/components/panels/ChatPanel.tsx`
   - For shared UI issues (shadcn components), map to `client/src/components/ui/`
   - For CSS/theme issues, map to `client/src/index.css` or Tailwind config

2. Group issues by file — each file gets ONE owner

### Step 3: Generate Agent Team

Design the agent team with these constraints:

1. **File ownership is absolute** — no two agents edit the same file
2. **5-6 tasks per agent maximum**
3. **Priority ordering** — P0 items first, then P1, P2, P3
4. **Each agent gets a clear context prompt** including:
   - The specific issues assigned to them (ID, description, priority)
   - The exact files they own (absolute paths)
   - ProtoPulse conventions (dark theme, shadcn/ui, Tailwind v4, data-testid)
   - What NOT to change (don't break existing functionality)
   - How to verify their fix (visual check, TypeScript check)

Example agent structure:
```
Agent: "views-agent-1"
  Owns: ArchitectureView.tsx, ProcurementView.tsx
  Tasks: VA-001 (P0), VA-015 (P1), VA-023 (P2)

Agent: "sidebar-chat-agent"
  Owns: Sidebar.tsx, ChatPanel.tsx, ChatHeader.tsx
  Tasks: VA-005 (P1), VA-012 (P2), VA-030 (P3)

Agent: "ui-components-agent"
  Owns: button.tsx, dialog.tsx, input.tsx (under ui/)
  Tasks: VA-008 (P1), VA-019 (P2)
```

### Step 4: Deploy and Monitor

1. Spawn each agent using the Agent tool or teammate system
2. Include in each agent's prompt:
   - The checklist path so they can mark items as done
   - BUT tell them NOT to edit the checklist — the lead will update it
   - Instructions to run `npm run check` after their changes
3. Monitor agent progress
4. Collect results from each agent

### Step 5: Verify and Update Checklist

1. Run `npm run check` — must pass with zero errors
2. For each successfully fixed issue, update the checklist:
   - Change `- [ ]` to `- [x]`
   - Append fix description: `- [x] **VA-001** [Architecture] Fixed contrast... (fixed in commit abc123)`
3. Update summary counts at top of checklist
4. Report to user:
   - Issues fixed: N/M
   - Issues remaining: list with reasons
   - Any new issues introduced: flag them

## Error Handling

- If checklist file not found: tell user and list available checklist files
- If no unchecked items: report "all items already checked" and exit
- If an agent fails: collect its errors, report which issues remain unfixed
- If `npm run check` fails after fixes: identify which agent's changes caused errors, report specific failures
- NEVER force through TypeScript errors — fix them or revert the change

## Important Constraints

- NEVER have two agents edit the same file
- NEVER skip P0 items — they must all be addressed
- Agents should make minimal, focused changes — don't refactor surrounding code
- All changes must preserve dark theme compatibility
- All interactive elements must keep their `data-testid` attributes
