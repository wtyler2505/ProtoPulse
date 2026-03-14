---
summary: bom-diff, arch-diff, and netlist-diff use the same Map-iterate-sort algorithm but are copy-pasted rather than abstracted, creating triple maintenance cost
type: pattern
---

# Three diff engines share identical algorithm shape but are not abstracted

`shared/bom-diff.ts`, `shared/arch-diff.ts`, and `shared/netlist-diff.ts` all implement the same algorithm:

1. Build a `Map<string, T>` for baseline by identity key (partNumber, nodeId/edgeId, net name/refDes)
2. Iterate current map: if key absent in baseline, emit `added`; if present, diff tracked fields and emit `modified` if changes found
3. Iterate baseline map: if key absent in current, emit `removed`
4. Sort results in `removed → modified → added` order, alphabetical within groups
5. Compute summary counts

`arch-diff.ts` partially generalizes this with `diffElements<T, D, K>()`, but bom-diff and netlist-diff don't use it. The three engines also share the same `{ field, oldValue, newValue }` change representation but define it independently (`BomFieldChange`, `ArchFieldChange`, inline in netlist-diff).

This is a textbook "Rule of Three" refactoring candidate — there are exactly three instances of the pattern, each with minor variations (different tracked fields, different identity keys, different type names). A generic `structuredDiff<T, Identity, TrackedKey>()` utility could replace all three core loops.

The current approach works but means any algorithmic improvement (e.g., adding similarity scoring, fuzzy matching, or move detection) must be implemented three times. It also means bugs in the diffing logic (e.g., the `String(oldVal) !== String(newVal)` comparison, which would treat `0` and `"0"` as equal) must be fixed in three places.

**Connection:** This is an instance of the broader pattern where vertical-slice development (each diff engine was a separate backlog item) naturally produces duplicated infrastructure. See [[wave-based-development-enables-rapid-shipping-but-creates-integration-debt]].
