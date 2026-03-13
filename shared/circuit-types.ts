// =============================================================================
// Circuit Design Types — Phase 10: Schematic Capture
// =============================================================================

// ---------------------------------------------------------------------------
// Circuit Design (top-level container)
// ---------------------------------------------------------------------------

/** A freetext annotation placed on the schematic canvas (BL-0492). */
export interface SchematicAnnotation {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

export interface CircuitSettings {
  gridSize: number;
  netColors: Record<string, string>;
  defaultBusWidth: number;
  showPowerNets: boolean;
  showNetLabels: boolean;
  powerSymbols: PowerSymbol[];
  noConnectMarkers: NoConnectMarker[];
  netLabels: SchematicNetLabel[];
  annotations: SchematicAnnotation[];
}

export const DEFAULT_CIRCUIT_SETTINGS: CircuitSettings = {
  gridSize: 50,
  netColors: {},
  defaultBusWidth: 8,
  showPowerNets: true,
  showNetLabels: true,
  powerSymbols: [],
  noConnectMarkers: [],
  netLabels: [],
  annotations: [],
};

export interface CircuitDesign {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  settings: CircuitSettings;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Component Instances (placed on schematic / breadboard / PCB)
// ---------------------------------------------------------------------------

export interface ViewPosition {
  x: number;
  y: number;
  rotation: number;
}

export interface PCBPosition extends ViewPosition {
  side: 'front' | 'back';
}

export interface ComponentInstance {
  id: number;
  circuitId: number;
  partId: number;
  referenceDesignator: string;
  schematicPosition: ViewPosition;
  breadboardPosition?: ViewPosition;
  pcbPosition?: PCBPosition;
  properties: Record<string, string>;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Nets & Segments
// ---------------------------------------------------------------------------

export type NetType = 'signal' | 'power' | 'ground' | 'bus';

export interface NetSegment {
  fromInstanceId: number;
  fromPin: string;
  toInstanceId: number;
  toPin: string;
  waypoints: { x: number; y: number }[];
}

export type NetLabelView = 'schematic' | 'breadboard' | 'pcb';

export interface NetLabel {
  x: number;
  y: number;
  text: string;
  view: NetLabelView;
}

export interface NetStyle {
  color?: string;
  lineStyle?: 'solid' | 'dashed';
}

export interface Net {
  id: number;
  circuitId: number;
  name: string;
  netType: NetType;
  voltage?: string;
  busWidth?: number;
  segments: NetSegment[];
  labels: NetLabel[];
  style: NetStyle;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Power & Special Symbols
// ---------------------------------------------------------------------------

export type PowerSymbolType =
  | 'VCC' | 'VDD' | 'V3V3' | 'V5V' | 'V12V'
  | 'GND' | 'AGND' | 'DGND'
  | 'custom';

export interface PowerSymbol {
  id: string;
  type: PowerSymbolType;
  netName: string;
  x: number;
  y: number;
  rotation: number;
  customLabel?: string;
}

export interface NoConnectMarker {
  id: string;
  instanceId: number;
  pin: string;
  x: number;
  y: number;
}

/** Standalone net label placed on the schematic canvas. */
export interface SchematicNetLabel {
  id: string;
  netName: string;
  x: number;
  y: number;
  rotation: number;
}

// ---------------------------------------------------------------------------
// Reference Designator Prefixes
// ---------------------------------------------------------------------------

export const REFERENCE_DESIGNATOR_PREFIXES: Record<string, string> = {
  IC: 'U',
  Microcontroller: 'U',
  FPGA: 'U',
  Resistor: 'R',
  Capacitor: 'C',
  Inductor: 'L',
  Diode: 'D',
  LED: 'D',
  Transistor: 'Q',
  MOSFET: 'Q',
  Connector: 'J',
  Crystal: 'Y',
  Fuse: 'F',
  Relay: 'K',
  Transformer: 'T',
  Switch: 'SW',
  Battery: 'BT',
  Speaker: 'LS',
  Motor: 'M',
  Sensor: 'U',
  Module: 'U',
};

// ---------------------------------------------------------------------------
// Pin Classification (for ERC analysis)
// ---------------------------------------------------------------------------

export type PinClassification =
  | 'input'
  | 'output'
  | 'bidirectional'
  | 'power-in'
  | 'power-out'
  | 'passive'
  | 'no-connect'
  | 'open-collector'
  | 'open-emitter';

// ---------------------------------------------------------------------------
// ERC (Electrical Rule Check)
// ---------------------------------------------------------------------------

export type ERCRuleType =
  | 'unconnected-pin'
  | 'shorted-power'
  | 'floating-input'
  | 'missing-bypass-cap'
  | 'driver-conflict'
  | 'no-connect-connected'
  | 'power-net-unnamed';

export type ERCSeverity = 'error' | 'warning';

export interface ERCViolation {
  id: string;
  ruleType: ERCRuleType;
  severity: ERCSeverity;
  message: string;
  instanceId?: number;
  pin?: string;
  netId?: number;
  location: { x: number; y: number };
}

export interface ERCRule {
  type: ERCRuleType;
  enabled: boolean;
  severity: ERCSeverity;
  description: string;
}

export const DEFAULT_ERC_RULES: ERCRule[] = [
  { type: 'unconnected-pin', enabled: true, severity: 'warning', description: 'Pin is not connected to any net' },
  { type: 'shorted-power', enabled: true, severity: 'error', description: 'Different power nets are shorted together' },
  { type: 'floating-input', enabled: true, severity: 'warning', description: 'Input pin has no driving source' },
  { type: 'missing-bypass-cap', enabled: true, severity: 'warning', description: 'IC power pin has no nearby bypass capacitor' },
  { type: 'driver-conflict', enabled: true, severity: 'error', description: 'Multiple outputs driving the same net' },
  { type: 'no-connect-connected', enabled: true, severity: 'warning', description: 'Pin marked no-connect has a net connection' },
  { type: 'power-net-unnamed', enabled: true, severity: 'warning', description: 'Power net has no explicit name' },
];

// ---------------------------------------------------------------------------
// Schematic Editor State (client-side)
// ---------------------------------------------------------------------------

export type SchematicTool =
  | 'select'
  | 'place-component'
  | 'draw-net'
  | 'place-power'
  | 'place-no-connect'
  | 'place-label'
  | 'place-annotation'
  | 'pan';

export interface SchematicEditorState {
  circuitId: number | null;
  activeTool: SchematicTool;
  selectedInstanceIds: Set<number>;
  selectedNetIds: Set<number>;
  powerSymbols: PowerSymbol[];
  noConnectMarkers: NoConnectMarker[];
  zoom: number;
  panX: number;
  panY: number;
  gridVisible: boolean;
  snapToGrid: boolean;
}

export function createDefaultSchematicState(): SchematicEditorState {
  return {
    circuitId: null,
    activeTool: 'select',
    selectedInstanceIds: new Set(),
    selectedNetIds: new Set(),
    powerSymbols: [],
    noConnectMarkers: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    gridVisible: true,
    snapToGrid: true,
  };
}
