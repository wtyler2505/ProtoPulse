export type SchematicCanvasMode = 'reactflow' | 'tscircuit';

const MODE_TSCIRCUIT: SchematicCanvasMode = 'tscircuit';

export function getSchematicCanvasMode(): SchematicCanvasMode {
  // ProtoPulse v3 enforces tscircuit as the schematic canvas runtime.
  // Legacy reactflow overrides remain unsupported in this mode.
  return MODE_TSCIRCUIT;
}
