---
claim: "Xtensa L32R always addresses backward from a 4-aligned PC because its 16-bit immediate is one-extended"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 067: xtensa l32r always addresses backward from a 4-aligned pc because its immediate is one-extended

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 25-26)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Literal-pool addressing semantic; one-extension forces backward-only reach, which an emulator's decoder must honor.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: `knowledge/xtensa-l32r-always-addresses-backward-from-a-4-aligned-pc-because-its-16-bit-immediate-is-one-extended.md`

Summary: Atomic insight note created (v2 schema). Captures the L32R effective-address formula `addr = ((PC+3) & ~3) + (one_extend(imm16) << 2)` from source lines 25-26. Explains both mechanisms that force backward-only reach: (1) base is PC+3 rounded down to 4-alignment to match the literal pool's 4-byte granularity; (2) imm16 is one-extended (always negative after `<<2`), so the address is always below the instruction — a forward L32R is unencodable. Contrasts with the sign-extended, PC+4, unaligned branch/jump family, and flags the classic decoder bug of sign-extending L32R's immediate. Topics: [[xtensa]], [[emulation]], [[esp32-s3]]. Net-new coverage — no semantic neighbors; connect phase to wire MOC membership.

## connect

Ran dual discovery (filesystem survey of knowledge/ + qmd semantic search; qmd returned no matches — index does not yet cover today's net-new notes in this worktree, so the directory survey was authoritative).

Genuine connections wired (all reciprocal / bidirectional):

1. **[[the-esp32-s3-xtensa-lx7-24-bit-instruction-encoding...]]** — the consolidated encoding reference / hub. Already linked TO this note (its Relevant Notes line 108). This note is the L32R RI16 drill-in for that table's immediate row. Added forward link from this note → ref.
2. **[[xtensa-load-store-offsets-are-zero-extended-and-scaled...]]** — strongest sibling. Forms the three-way immediate-extension split: load/store zero-extend (forward-only), ADDI sign-extend (both ways), L32R one-extend (backward-only). Bidirectional (sibling task had already added the back-link).
3. **[[xtensa-branch-targets-add-the-sign-extended-immediate-to-pc-plus-4...]]** — the contrasting PC-relative form (sign-extend off flat PC+4 vs L32R one-extend off (PC+3)&~3 aligned base). Conflating extension/base schemes is the shared decoder-bug theme. Bidirectional (sibling already linked back, and references the L32R base in prose).
4. **[[a-working-disassembler-source-is-a-stronger-oracle...]]** — the verification discipline that settled one-extend vs sign-extend against ida-xtensa2 rather than the garbled PDF.

**MOC:** `knowledge/xtensa.md` was an auto-generated stub at the start of this phase; a parallel sibling task rebuilt it into a genuine topic map with sectioned Core Ideas, and it already lists this note under "ISA encoding & decode". MOC membership satisfied — no further edit needed (editing would collide with the concurrent task).

No spurious links forced. The ESP32-S3 GPIO/peripheral notes share the `[[esp32-s3]]` topic but have no instruction-set relationship to L32R addressing.

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
