# Safe Commit Slicing Checklist (Claude/Codex Mixed Workflow)

Use this checklist before each commit in a mixed-lane dirty tree.

## 1) Define the slice

- Commit objective is one sentence.
- File set is explicitly listed (`git add <paths>` only).
- Unrelated lanes are explicitly excluded.

## 2) Verify lane boundaries

- Confirm claimed/forbidden files from active handoff notes.
- Do not include active `COLLAB_*` or unrelated handoff artifacts unless this slice owns them.

## 3) Contract-sensitive gates (Tauri lane)

- `npm run lint:ipc-contract`
- Focused tests for touched Tauri workflow files.
- If contract artifacts changed:
  - `npm run tauri:bindings:sync-check`
  - `bash scripts/ci/regen-tauri-contract-artifacts.sh`

## 4) Dirty-tree triage pass

- Review `git status --short`.
- Split into:
  - intended for this commit
  - defer to another commit/lane
- For ProtoPulse NotebookLM cleanup, keep `data/pp-nlm/**` isolated from runtime/Tauri edits.

## 5) Commit message quality

- Subject states behavioral intent, not just file names.
- Body includes:
  - what changed
  - why
  - verification commands run

## 6) Post-commit sanity

- `git show --name-status --stat HEAD`
- Ensure no accidental lock/cache/generated noise slipped in.
