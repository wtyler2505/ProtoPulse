---
summary: ArchitectureBridge exists because ArchitectureProvider needs setActiveView from ProjectMetaProvider, forcing a specific nesting order that a bridge component makes explicit
category: architectural-decision
areas: ["[[architecture]]"]
wave: "extraction"
---

# Context decomposition uses a bridge component to solve cross-provider dependency ordering

When the monolithic ProjectProvider was decomposed into 10 domain contexts (architecture, bom, chat, validation, etc.), a hidden dependency emerged: `ArchitectureProvider.focusNode()` calls `setActiveView('architecture')` to navigate the user to the architecture view when the AI focuses a node. This means ArchitectureProvider depends on a value from ProjectMetaProvider.

The solution is `ArchitectureBridge` in `client/src/lib/project-context.tsx` (line 168): a tiny component that sits *between* ProjectMetaProvider and ArchitectureProvider in the nesting tree. It reads `setActiveView` via `useProjectMeta()` and passes it down as a prop to ArchitectureProvider.

This matters because:
- **Provider nesting order is load-bearing.** Swapping ProjectMetaProvider and ArchitectureProvider would break focusNode. The bridge makes this dependency explicit rather than relying on implicit nesting.
- **The bridge pattern is the general solution for cross-context deps in React.** Without it, you'd need to either merge the contexts back together (defeating the decomposition) or lift the shared value to a parent context (creating an artificial dependency).
- **It documents the coupling.** A future developer trying to reorder providers would hit a clear compilation error rather than a silent runtime bug.

The full nesting order in `SeededProviders` is: OutputProvider > ChatProvider > HistoryProvider > BomProvider > ValidationProvider > ProjectMetaProvider > ArduinoProvider > SimulationProvider > ArchitectureBridge > ArchitectureProvider. The bridge is the only place where one provider consumes another's value during construction.

---

Related:
- [[projectprovider-is-known-tech-debt-because-monolithic-context-forces-full-tree-rerenders-on-any-state-change]] — the problem this decomposition solves
- [[large-component-decomposition-follows-a-consistent-pattern-of-extracting-domain-modules-while-keeping-the-original-file-as-a-thin-orchestrator]] — same thin-orchestrator principle

Areas:
- [[architecture]]
