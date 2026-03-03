export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  textAnchor?: string;
}

export interface BaseShape {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  style?: ShapeStyle;
  layer?: string;
}

export interface RectShape extends BaseShape {
  type: 'rect';
  rx?: number;
}

export interface CircleShape extends BaseShape {
  type: 'circle';
  cx: number;
  cy: number;
}

export interface PathShape extends BaseShape {
  type: 'path';
  d: string;
}

export interface TextShape extends BaseShape {
  type: 'text';
  text: string;
}

export interface GroupShape extends BaseShape {
  type: 'group';
  children: Shape[];
}

export type Shape = RectShape | CircleShape | PathShape | TextShape | GroupShape;

export interface PadSpec {
  type: 'tht' | 'smd';
  shape: 'circle' | 'rect' | 'oblong' | 'square';
  diameter?: number;
  drill?: number;
  width?: number;
  height?: number;
}

export interface TerminalPosition {
  x: number;
  y: number;
}

export interface Connector {
  id: string;
  name: string;
  description?: string;
  connectorType: 'male' | 'female' | 'pad';
  shapeIds: Record<string, string[]>;
  terminalPositions: Record<string, TerminalPosition>;
  padSpec?: PadSpec;
}

export interface Bus {
  id: string;
  name: string;
  connectorIds: string[];
}

export interface PartProperty {
  key: string;
  value: string;
  showInLabel?: boolean;
}

export interface PartMeta {
  title: string;
  family?: string;
  manufacturer?: string;
  mpn?: string;
  description?: string;
  tags: string[];
  mountingType: 'tht' | 'smd' | 'other' | '';
  packageType?: string;
  properties: PartProperty[];
  datasheetUrl?: string;
  version?: string;
}

export interface ViewData {
  shapes: Shape[];
  layerConfig?: Record<string, { visible: boolean; locked: boolean; color?: string }>;
}

export interface PartViews {
  breadboard: ViewData;
  schematic: ViewData;
  pcb: ViewData;
}

export type ConstraintType = 'distance' | 'alignment' | 'pitch' | 'symmetric' | 'equal' | 'fixed';

export interface Constraint {
  id: string;
  type: ConstraintType;
  shapeIds: string[];
  params: Record<string, number | string>;
  enabled: boolean;
}

export interface PartState {
  meta: PartMeta;
  connectors: Connector[];
  buses: Bus[];
  views: PartViews;
  constraints?: Constraint[];
}

export type DRCRuleType =
  | 'min-clearance'
  | 'min-trace-width'
  | 'courtyard-overlap'
  | 'pin-spacing'
  | 'pad-size'
  | 'silk-overlap'
  | 'annular-ring'
  | 'thermal-relief'
  | 'trace-to-edge'
  | 'via-in-pad'
  | 'solder-mask';

export interface DRCRule {
  type: DRCRuleType;
  params: Record<string, number>;
  severity: 'error' | 'warning';
  enabled: boolean;
}

export interface DRCViolation {
  id: string;
  ruleType: DRCRuleType;
  severity: 'error' | 'warning';
  message: string;
  shapeIds: string[];
  view: 'breadboard' | 'schematic' | 'pcb';
  location: { x: number; y: number };
  actual?: number;
  required?: number;
}

export interface ComponentValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  view?: string;
  elementId?: string;
  suggestion?: string;
}

export type EditorViewType = 'breadboard' | 'schematic' | 'pcb' | 'metadata' | 'pin-table';

export function createDefaultPartMeta(): PartMeta {
  return {
    title: '',
    tags: [],
    mountingType: '',
    properties: [],
  };
}

export function createDefaultViewData(): ViewData {
  return {
    shapes: [],
  };
}

export function createDefaultPartState(): PartState {
  return {
    meta: createDefaultPartMeta(),
    connectors: [],
    buses: [],
    views: {
      breadboard: createDefaultViewData(),
      schematic: createDefaultViewData(),
      pcb: createDefaultViewData(),
    },
  };
}
