---
title: "Mocking window URL createObjectURL resolves TypeErrors in tests involving browser-native object URL creation"
description: "JSDOM and Happy-DOM do not implement window.URL.createObjectURL, so code that produces blob or file URLs must stub it in test setup or fail with TypeError."
type: claim
topics: ["[[dev-infrastructure]]"]
tags: [testing, vitest, jsdom, mocking]
confidence: proven
---

# Mocking window URL createObjectURL resolves TypeErrors in tests involving browser-native object URL creation

Frontend code that produces downloadable artifacts — BOM CSV exports, SVG schematic snapshots, KiCad archives — reaches for `URL.createObjectURL(blob)` to turn a `Blob` into a temporary `blob:` URL suitable for `<a download>` or `window.open`. In real browsers this is trivial. In the headless DOM shims used by Vitest (JSDOM, Happy-DOM), the function is simply missing from the `URL` prototype, and any call throws `TypeError: window.URL.createObjectURL is not a function`.

The fix is to register a stub in the Vitest setup file before the component under test mounts:

```ts
// test/setup.ts
Object.defineProperty(window.URL, 'createObjectURL', {
  value: vi.fn(() => 'blob:mock-url'),
  writable: true,
});
Object.defineProperty(window.URL, 'revokeObjectURL', {
  value: vi.fn(),
  writable: true,
});
```

This is not a workaround — it is the correct pattern whenever the test boundary sits below the browser's URL API. The same shape applies to other JSDOM gaps (`ResizeObserver`, `IntersectionObserver`, `matchMedia`), so a single setup file typically accumulates a stable list of mocks. Keeping those mocks centralized also avoids the failure mode where two test files register conflicting stubs mid-run.

For ProtoPulse specifically this hits export-oriented views: [[bom-csv-round-trip-preserves-header-order-through-parser-serializer-symmetry]]-style tests, schematic SVG sanitization, and any future share-link generator that serializes canvas state to a downloadable blob.

---
Related:
- [[dev-infrastructure]] — Vitest setup files live alongside the hook + skill infrastructure that governs the quality pipeline
- [[context7-plugin-provides-real-time-library-docs-that-beat-stale-training-data]] — when mock shapes drift across Vitest versions, query Context7 rather than guessing

Source: [[2026-04-17-codex-recovery-and-verified-boards.md]]
