/**
 * Shared data interfaces and utility functions for all export generators.
 *
 * These types define the "simple" shapes that callers (e.g. ai-tools.ts)
 * pass in. Individual export modules may define richer input types that
 * extend or wrap these.
 */

// ---------------------------------------------------------------------------
// Data interfaces — match the shapes callers will pass in
// ---------------------------------------------------------------------------

export interface BomItemData {
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  supplier: string;
  stock: number;
  status: string;
  leadTime: string | null;
}

export interface ComponentPartData {
  id: number;
  nodeId: string | null;
  meta: Record<string, unknown>;
  connectors: unknown[];
  buses: unknown[];
  constraints: unknown[];
}

export interface ArchNodeData {
  nodeId: string;
  label: string;
  nodeType: string;
  positionX: number;
  positionY: number;
  data: Record<string, unknown> | null;
}

export interface ArchEdgeData {
  edgeId: string;
  source: string;
  target: string;
  label: string | null;
  signalType: string | null;
  voltage: string | null;
  busWidth: string | null;
  netName: string | null;
}

export interface CircuitInstanceData {
  id: number;
  partId: number | null;
  /* NOTE: partId was changed from `number` to `number | null` to match the Drizzle schema
     (ON DELETE SET NULL). All Map.get(inst.partId) callsites must guard for null. */
  referenceDesignator: string;
  schematicX: number;
  schematicY: number;
  schematicRotation: number;
  pcbX: number | null;
  pcbY: number | null;
  pcbRotation: number | null;
  pcbSide: string | null;
  properties: Record<string, unknown>;
}

export interface CircuitNetData {
  id: number;
  name: string;
  netType: string;
  voltage: string | null;
  busWidth: number | null;
  segments: unknown[];
  labels: unknown[];
}

export interface CircuitWireData {
  id: number;
  netId: number;
  view: string;
  points: unknown[];
  layer: string | null;
  width: number;
}

export interface ValidationIssueData {
  severity: string;
  message: string;
  componentId: string | null;
  suggestion: string | null;
}

// ---------------------------------------------------------------------------
// Export result
// ---------------------------------------------------------------------------

export interface ExportResult {
  content: string;
  encoding: 'utf8' | 'base64';
  mimeType: string;
  filename: string;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Sanitize a filename: remove path separators and problematic characters. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim() || 'untitled';
}

/** Extract a string from a meta record, returning fallback if missing/non-string. */
export function metaStr(meta: Record<string, unknown>, key: string, fallback: string = ''): string {
  const v = meta[key];
  return typeof v === 'string' ? v : fallback;
}

/** Escape a string for CSV — wraps in double quotes if it contains delimiters. */
export function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV row from an array of values. */
export function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCSV).join(',');
}

/** Escape a string for XML attributes/text content. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
