---
summary: PCB layout, footprints, routing, DRC, copper pour, and 3D viewer insights
type: moc
---

# PCB Layout

Insights related to ProtoPulse's PCB layout subsystem and its integration with other tools.

## Insights

- [[circuits-zero-defaulting-in-export-and-ordering-is-a-latent-multi-project-regression-because-it-silently-picks-the-wrong-circuit]] — circuits[0] default will break multi-circuit designs
- [[cross-tool-integration-is-the-hardest-category-because-it-requires-shared-source-of-truth-decisions]] — PCB layout depends on shared source of truth with schematic
- [[drc-explanations-embed-pedagogical-content-directly-in-the-engine-making-the-validation-system-a-teaching-tool-not-just-a-checker]] — 10 PCB-level DRC rules have beginner-friendly explanations embedded in the shared engine
- [[every-component-must-define-geometry-three-times-because-the-triple-view-architecture-couples-identity-to-representation]] — PCB view is one of the three mandatory geometry representations; standard library components currently have empty PCB views
- [[progressive-disclosure-hides-downstream-views-until-architecture-nodes-exist-preventing-empty-state-errors]] — PCB view is hidden until architecture nodes exist, preventing empty canvas errors
- [[errorboundary-suppresses-resizeobserver-loop-errors-because-they-are-benign-browser-noise-that-would-crash-every-canvas-view]] — PCB canvas SVG with dynamic sizing triggers ResizeObserver loop errors that the ErrorBoundary suppresses
