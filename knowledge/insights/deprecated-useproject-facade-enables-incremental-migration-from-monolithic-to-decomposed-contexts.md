---
summary: The deprecated useProject() hook composes all 7 domain hooks into the original flat shape, allowing consumer components to migrate one at a time without a big-bang rewrite
category: architectural-decision
areas: ["[[architecture]]"]
wave: "extraction"
---

# Deprecated useProject facade enables incremental migration from monolithic to decomposed contexts

When the monolithic ProjectProvider was split into 10 domain contexts (architecture, bom, chat, validation, history, output, project-meta, project-id, arduino, simulation), a backward-compatible `useProject()` hook was preserved in `client/src/lib/project-context.tsx` (line 218-291).

This hook calls all 7 original domain hooks internally and reassembles their values into the flat shape that existing consumers expect:

```ts
export const useProject = () => {
  const meta = useProjectMeta();
  const arch = useArchitecture();
  const bom = useBom();
  // ... etc
  return { activeView: meta.activeView, nodes: arch.nodes, bom: bom.bom, ... };
};
```

This is marked `@deprecated` with a migration guide pointing to the domain-specific hooks. The pattern enables:

1. **Incremental migration.** Each component can switch from `useProject()` to `useArchitecture()` / `useBom()` independently. No coordinated big-bang rewrite needed.
2. **No broken imports during transition.** `project-context.tsx` re-exports all domain hooks (`export { useArchitecture } from '@/lib/contexts/architecture-context'`), so the import path doesn't change.
3. **Render performance incentive.** Components using `useProject()` subscribe to ALL domain state changes (every context re-renders them). Migrating to `useArchitecture()` means only architecture changes trigger re-renders — a concrete performance win that motivates migration.

The file shrank from 1500+ lines to 291 lines. The remaining code is: type exports (Position, BlockNode, BomItem, etc.), the `ProjectProvider` root component, `SeededProviders` nesting, and the deprecated `useProject` facade.

---

Related:
- [[projectprovider-is-known-tech-debt-because-monolithic-context-forces-full-tree-rerenders-on-any-state-change]] — the original problem
- [[barrel-files-enable-incremental-decomposition-because-they-preserve-the-public-api-while-splitting-internal-modules]] — same principle applied to module structure

Areas:
- [[architecture]]
