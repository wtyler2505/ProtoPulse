---
summary: KiCad, Eagle, Gerber, SPICE, PDF, FMEA exporters and format-specific patterns
type: moc
---

# Export System

Insights related to ProtoPulse's multi-format export system and its integration challenges.

## Insights

- [[circuits-zero-defaulting-in-export-and-ordering-is-a-latent-multi-project-regression-because-it-silently-picks-the-wrong-circuit]] — circuits[0] default in exports will break multi-circuit designs
- [[cross-tool-integration-is-the-hardest-category-because-it-requires-shared-source-of-truth-decisions]] — export requires shared source of truth across tools
- [[job-queue-uses-per-type-watchdog-timeouts-and-exponential-backoff-because-ai-analysis-and-export-generation-have-different-runtime-profiles]] — export_generation jobs get 10min watchdog (2x AI analysis) because Gerber/PDF/design reports involve heavy computation and I/O

- [[export-modules-use-a-shared-data-adapter-layer-decoupled-from-drizzle-row-types]] — 17 export modules consume simplified interfaces, not Drizzle row types, isolating from schema changes
- [[drc-gate-is-a-pure-function-pipeline-stage-that-blocks-manufacturing-export-without-touching-the-database]] — pure function validation gate that must pass before Gerber/drill/pick-and-place generation
- [[drc-engine-exports-two-completely-separate-rule-systems-from-one-file-creating-a-hidden-api-surface-split]] — the DRC gate is a third validation system alongside component and PCB DRC engines

## Connection Clusters

### Export Reliability Chain
Export reliability depends on multiple layers: the [[job-queue-uses-per-type-watchdog-timeouts-and-exponential-backoff-because-ai-analysis-and-export-generation-have-different-runtime-profiles|job queue]] manages long-running export jobs with 10-minute watchdogs, but [[circuits-zero-defaulting-in-export-and-ordering-is-a-latent-multi-project-regression-because-it-silently-picks-the-wrong-circuit|wrong circuit selection]] means the entire compute budget produces incorrect output. [[cross-tool-integration-is-the-hardest-category-because-it-requires-shared-source-of-truth-decisions|Cross-tool data ownership]] decisions determine which circuit/design data the exporter actually receives.
