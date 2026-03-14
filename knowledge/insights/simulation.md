---
summary: SPICE simulation, circuit solver, Monte Carlo, and analysis insights
type: moc
---

# Simulation

Insights related to ProtoPulse's simulation capabilities and their relationship to user trust.

## Insights

- [[the-perception-gap-between-simulation-capability-and-usability-is-the-biggest-competitive-threat]] — TinkerCAD feels more powerful because results are visible on the circuit; closing this requires sim-to-schematic overlay (a cross-tool integration problem)
- [[architecture-expansion-using-placeholder-first-pin-mapping-produces-semantically-wrong-schematics-that-erode-trust-in-ai-generated-designs]] — placeholder pins erode trust in AI designs
- [[manufacturing-trust-requires-real-data-because-fake-confidence-is-worse-than-no-confidence]] — simulation results share the same trust dynamic: authoritative-looking output must be real
- [[drc-explanations-embed-pedagogical-content-directly-in-the-engine-making-the-validation-system-a-teaching-tool-not-just-a-checker]] — DRC explanations make validation feel accessible for beginners, closing the same perception gap that sim overlays would close for simulation
- [[ai-action-executor-uses-mutable-accumulators-to-prevent-stale-closure-bugs-in-multi-action-batches]] — AI actions that modify simulation-related state (add components, connect nets) go through the accumulator pattern to avoid stale-closure bugs
- [[design-variables-test-suite-validates-a-complete-expression-language-with-si-prefix-parsing-and-dependency-graph-resolution]] — VariableStore is a parametric constraint system: changing one value propagates through a dependency graph, forming the foundation for what-if analysis
- [[design-gateway-rules-use-string-matching-heuristics-instead-of-schematic-netlist-analysis-because-architecture-nodes-lack-electrical-types]] — heuristic validation at the architecture level catches missing decoupling caps before the user even reaches simulation
- [[circuit-ai-selectively-enables-extended-thinking-based-on-operation-type-not-model-or-prompt-size]] — circuit analysis enables extended thinking for deep reasoning about circuit behavior
