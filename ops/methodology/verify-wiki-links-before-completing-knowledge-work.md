---
description: Always verify that wiki links in created knowledge notes resolve to real files — broken links violate the graph and frustrate Tyler
type: methodology
category: quality
source: session-mining
session_source: b74d6dde-24dd-47f5-9dcd-8b256ab0fa60.jsonl
created: 2026-04-06
status: active
---

# Verify wiki links in knowledge notes resolve to real files before finishing

## What to Do

After creating any knowledge note that includes `[[wiki-links]]`, confirm that each linked note actually exists in the vault. For topic map references (`[[index]]`, `[[methodology]]`, etc.), check that the target file is present.

When batch-creating notes (e.g., during `/extract`), verify link targets for the full batch before reporting completion. If a target note does not exist and should exist, create it — do not leave an orphaned reference.

## What to Avoid

Creating notes with `[[links]]` that point to files that don't exist. Do not assume a link target exists because it sounds like it should — check the filesystem. Do not defer link verification as a "cleanup step" — it becomes someone else's problem (Tyler's).

## Why This Matters

Direct quote: "i dont care if they are yours or not... fix the broken links asshole."

Broken wiki links corrupt the graph, break Obsidian navigation, and waste time to audit and fix after the fact. The entire point of wiki links is traversable connectivity — a broken link is worse than no link.

## Scope

All knowledge system work: `/extract`, `/connect`, direct note creation. Any time a `[[link]]` is written into a file, it must be validated before the task is considered done.

---

Related: [[methodology]]
