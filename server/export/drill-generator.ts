/**
 * Excellon NC Drill File Generator (Phase 12.5)
 *
 * Generates industry-standard Excellon drill files from PCB data.
 * Supports through-hole pad drilling and via drilling.
 *
 * Format: Excellon Version 2 (METRIC, trailing zeros)
 * Coordinates: integer micrometers (mm * 1000)
 *
 * Reference: IPC-NC-349 / Excellon CNC-7 format
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DrillConnector {
  id: string;
  padType?: string; // 'tht' or 'smd'
  drillDiameter?: number; // mm, default 0.8
  offsetX?: number; // relative to instance position, mm
  offsetY?: number; // relative to instance position, mm
}

export interface DrillInstance {
  pcbX: number; // mm
  pcbY: number; // mm
  pcbRotation: number; // degrees
  connectors: DrillConnector[];
}

export interface DrillVia {
  x: number; // mm, absolute position
  y: number; // mm, absolute position
  diameter: number; // mm
}

export interface DrillInput {
  instances: DrillInstance[];
  vias?: DrillVia[];
  boardWidth: number; // mm
  boardHeight: number; // mm
}

export interface DrillOutput {
  content: string;
  toolCount: number;
  holeCount: number;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface DrillHole {
  x: number; // mm, absolute board position
  y: number; // mm, absolute board position
}

interface ToolEntry {
  toolNumber: number;
  diameter: number; // mm
  holes: DrillHole[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DRILL_DIAMETER = 0.8; // mm
const COORDINATE_SCALE = 1000; // mm -> integer micrometers

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts degrees to radians.
 */
function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Applies a 2D rotation around the origin (0, 0) and returns
 * the rotated offset. Used to compute connector absolute positions
 * when an instance is rotated.
 */
function rotateOffset(
  offsetX: number,
  offsetY: number,
  rotationDeg: number,
): { rx: number; ry: number } {
  if (rotationDeg === 0) {
    return { rx: offsetX, ry: offsetY };
  }
  const rad = degToRad(rotationDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    rx: offsetX * cos - offsetY * sin,
    ry: offsetX * sin + offsetY * cos,
  };
}

/**
 * Rounds a diameter to 3 decimal places to avoid floating-point
 * grouping issues (e.g., 0.8000000001 vs 0.8).
 */
function normalizeDiameter(d: number): number {
  return Math.round(d * 1000) / 1000;
}

/**
 * Converts a mm value to the Excellon integer coordinate format
 * (micrometers, no decimal point).
 */
function toExcellonCoord(mm: number): number {
  return Math.round(mm * COORDINATE_SCALE);
}

/**
 * Formats an Excellon coordinate value. Positive values are emitted
 * without a sign; negative values include the minus sign.
 */
function formatCoord(value: number): string {
  const intVal = toExcellonCoord(value);
  return String(intVal);
}

/**
 * Formats a tool diameter for the header. Excellon expects diameters
 * with exactly 3 decimal places (e.g., C0.800).
 */
function formatDiameter(mm: number): string {
  return mm.toFixed(3);
}

/**
 * Comparison function that sorts holes by Y ascending, then X ascending.
 * This produces an efficient serpentine-like drilling path.
 */
function compareHoles(a: DrillHole, b: DrillHole): number {
  if (a.y !== b.y) return a.y - b.y;
  return a.x - b.x;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Collects all drill-eligible holes from instances and vias, groups them
 * by normalized diameter, and returns sorted tool entries.
 */
function collectTools(input: DrillInput): ToolEntry[] {
  // Map from normalized diameter (as string key) to array of holes.
  // Using string keys avoids floating-point equality issues.
  const diameterMap = new Map<string, DrillHole[]>();

  // Helper to add a hole under a given diameter
  function addHole(diameter: number, hole: DrillHole): void {
    const key = normalizeDiameter(diameter).toFixed(3);
    const existing = diameterMap.get(key);
    if (existing) {
      existing.push(hole);
    } else {
      diameterMap.set(key, [hole]);
    }
  }

  // Process component instances — only THT pads generate drill hits
  input.instances.forEach((instance) => {
    instance.connectors.forEach((connector) => {
      // Skip SMD pads entirely — they have no drill hole
      if (connector.padType === 'smd') {
        return;
      }

      const diameter = connector.drillDiameter ?? DEFAULT_DRILL_DIAMETER;
      const ox = connector.offsetX ?? 0;
      const oy = connector.offsetY ?? 0;

      // Apply instance rotation to the connector offset
      const { rx, ry } = rotateOffset(ox, oy, instance.pcbRotation);

      addHole(diameter, {
        x: instance.pcbX + rx,
        y: instance.pcbY + ry,
      });
    });
  });

  // Process vias
  if (input.vias) {
    input.vias.forEach((via) => {
      addHole(via.diameter, { x: via.x, y: via.y });
    });
  }

  // Convert the map to an array of ToolEntry, sorted by ascending diameter.
  // Avoiding for...of on Map per project constraints — using Array.from().
  const entries = Array.from(diameterMap.entries());

  // Sort by diameter ascending
  entries.sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));

  return entries.map(([key, holes], index) => {
    // Sort holes within each tool: Y ascending, then X ascending
    holes.sort(compareHoles);

    return {
      toolNumber: index + 1,
      diameter: parseFloat(key),
      holes,
    };
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates an Excellon NC drill file from PCB instance and via data.
 *
 * The output follows the Excellon Version 2 format:
 * - M48 header with FMAT,2 and METRIC,TZ
 * - Tool definitions (T1C0.800, T2C1.000, etc.)
 * - Drill body with tool selections and X/Y coordinates
 * - M30 end-of-file
 *
 * Only THT pads (padType !== 'smd') and vias produce drill hits.
 * Tools are sorted by ascending diameter. Holes within each tool
 * are sorted by Y then X for efficient machine traversal.
 *
 * @param input - PCB instances, vias, and board dimensions
 * @returns Excellon file content, tool count, and total hole count
 */
export function generateDrillFile(input: DrillInput): DrillOutput {
  const tools = collectTools(input);

  const lines: string[] = [];

  // --- Header ---
  lines.push('M48');
  lines.push('FMAT,2');
  lines.push('METRIC,TZ');

  // Tool definitions
  tools.forEach((tool) => {
    lines.push(`T${tool.toolNumber}C${formatDiameter(tool.diameter)}`);
  });

  // End of header
  lines.push('%');

  // --- Drill body ---
  let totalHoles = 0;

  tools.forEach((tool) => {
    // Select tool
    lines.push(`T${tool.toolNumber}`);

    // Drill hits
    tool.holes.forEach((hole) => {
      lines.push(`X${formatCoord(hole.x)}Y${formatCoord(hole.y)}`);
      totalHoles++;
    });
  });

  // --- Footer ---
  lines.push('M30');

  return {
    content: lines.join('\n'),
    toolCount: tools.length,
    holeCount: totalHoles,
  };
}
