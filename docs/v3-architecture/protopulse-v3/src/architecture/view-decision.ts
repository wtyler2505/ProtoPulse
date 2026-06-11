export const architectureViewDecision = {
  id: 'ADR-0001',
  title: 'Coexist with xyflow before replacing Architecture view',
  decision: 'coexist-then-replace',
  currentView: '@xyflow/react ArchitectureView',
  v3View: 'tldraw boundary canvas',
  replacementGate: [
    'xyflow nodes and edges migrate to v3 tldraw shapes without data loss',
    'v3 compile checks cover hardware facts, blocked states, and tscircuit render proof',
    'live app can open v3 behind a feature flag or alternate route',
    'export/import round trip passes for a real sample project',
  ],
  nextStep: 'build the node/edge to tldraw-shape migration adapter',
} as const;
