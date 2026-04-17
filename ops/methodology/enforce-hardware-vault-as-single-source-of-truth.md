---
description: Ensure hardware components are never hallucinated and are synced with the Ars Contexta vault.
type: methodology
category: processing
source: explicit
created: 2026-04-17
status: active
---

# Enforce hardware vault as single source of truth

## What to Do
Always search the `knowledge/` directory using `qmd` or `grep` to locate a part's exact physical dimensions, pinout, and colors before generating, modifying, or suggesting any code related to hardware components. If the component does not exist, research its official manufacturer specs and update the vault. Use the dual-write sync pipeline (`scripts/sync-hardware-vault.ts`) to propagate code changes back to the vault.

## What to Avoid
Never guess, invent, hallucinate, or approximate physical dimensions, pin layouts, or electrical constraints. Do not proceed with hardware implementation without verifying the exact specs.

## Why This Matters
Failing to use exact dimensions leads to physically impossible breadboard and PCB layouts. Relying on AI memory for part specifications causes silent errors in circuit logic and UI rendering. The Ars Contexta vault must remain the canonical representation.

## Scope
Applies to any session involving the creation, modification, or review of hardware component definitions, schematic layout, or PCB routing.