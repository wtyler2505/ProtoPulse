/**
 * ThermalOverlayManager — Manages thermal heatmap data for the PCB layout view.
 *
 * Converts thermal analysis results into a grid of colored cells for SVG overlay
 * rendering. Color gradient: blue (cold) → green → yellow → orange → red (hot).
 * Hotspot detection flags components exceeding 70°C.
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThermalComponent {
  id: string;
  name: string;
  position: { x: number; y: number };
  temperature: number; // °C (junction or case temp)
  powerDissipation: number; // watts
  packageType: string;
  /** Footprint bounding box in mm. */
  boundingBox: { width: number; height: number };
}

export interface ThermalMapData {
  /** Board dimensions in mm. */
  boardWidth: number;
  boardHeight: number;
  /** Ambient temperature in °C. */
  ambientTemp: number;
  /** Components with their thermal data. */
  components: ThermalComponent[];
  /** Optional pre-computed 2D heatmap grid (row-major, °C values). */
  heatGrid?: number[][];
  /** Cell size in mm for the heatGrid (default 1). */
  cellSizeMm?: number;
}

export interface HeatmapCell {
  /** Grid column index. */
  col: number;
  /** Grid row index. */
  row: number;
  /** X position in mm. */
  x: number;
  /** Y position in mm. */
  y: number;
  /** Cell width in mm. */
  width: number;
  /** Cell height in mm. */
  height: number;
  /** Temperature at this cell in °C. */
  temperature: number;
  /** CSS color string for this cell. */
  color: string;
}

export interface TempRange {
  min: number;
  max: number;
}

export interface LegendStop {
  /** Normalized position 0–1 from bottom (cold) to top (hot). */
  position: number;
  /** Temperature at this stop in °C. */
  temperature: number;
  /** CSS color at this stop. */
  color: string;
}

export interface Hotspot {
  componentId: string;
  componentName: string;
  temperature: number;
  position: { x: number; y: number };
  boundingBox: { width: number; height: number };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Components above this temperature are flagged as hotspots. */
export const HOTSPOT_THRESHOLD_C = 70;

/** Default cell size in mm for generated heatmap grids. */
const DEFAULT_CELL_SIZE_MM = 2;

/** Minimum number of legend stops. */
const LEGEND_STOP_COUNT = 6;

/**
 * Color gradient stops: temperature fraction 0 (cold) → 1 (hot).
 * Blue → Cyan → Green → Yellow → Orange → Red.
 */
const GRADIENT_STOPS: Array<{ frac: number; r: number; g: number; b: number }> = [
  { frac: 0.0, r: 0x33, g: 0x66, b: 0xff }, // blue
  { frac: 0.2, r: 0x00, g: 0xcc, b: 0xff }, // cyan
  { frac: 0.4, r: 0x00, g: 0xdd, b: 0x44 }, // green
  { frac: 0.6, r: 0xff, g: 0xee, b: 0x00 }, // yellow
  { frac: 0.8, r: 0xff, g: 0x88, b: 0x00 }, // orange
  { frac: 1.0, r: 0xff, g: 0x22, b: 0x00 }, // red
];

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Color interpolation
// ---------------------------------------------------------------------------

/**
 * Linearly interpolate the thermal gradient at a normalized fraction [0, 1].
 * Clamps out-of-range values to the nearest endpoint.
 */
function interpolateGradient(frac: number): { r: number; g: number; b: number } {
  const t = Math.max(0, Math.min(1, frac));

  // Find the two stops that bracket t
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    const a = GRADIENT_STOPS[i];
    const b = GRADIENT_STOPS[i + 1];
    if (t >= a.frac && t <= b.frac) {
      const span = b.frac - a.frac;
      const local = span === 0 ? 0 : (t - a.frac) / span;
      return {
        r: Math.round(a.r + (b.r - a.r) * local),
        g: Math.round(a.g + (b.g - a.g) * local),
        b: Math.round(a.b + (b.b - a.b) * local),
      };
    }
  }

  // Fallback: return last stop
  const last = GRADIENT_STOPS[GRADIENT_STOPS.length - 1];
  return { r: last.r, g: last.g, b: last.b };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const hex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// ---------------------------------------------------------------------------
// ThermalOverlayManager
// ---------------------------------------------------------------------------

export class ThermalOverlayManager {
  private enabled = false;
  private thermalData: ThermalMapData | null = null;
  private cachedCells: HeatmapCell[] | null = null;
  private cachedRange: TempRange | null = null;
  private listeners = new Set<Listener>();

  private constructor() {}

  /** Factory — creates a fresh instance (testing-friendly, no global singleton). */
  static create(): ThermalOverlayManager {
    return new ThermalOverlayManager();
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    Array.from(this.listeners).forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Enable / Disable
  // -----------------------------------------------------------------------

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;
    this.notify();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // -----------------------------------------------------------------------
  // Data management
  // -----------------------------------------------------------------------

  updateThermalData(data: ThermalMapData): void {
    this.thermalData = data;
    this.invalidateCache();
    this.notify();
  }

  getThermalData(): ThermalMapData | null {
    return this.thermalData;
  }

  clearThermalData(): void {
    this.thermalData = null;
    this.invalidateCache();
    this.notify();
  }

  private invalidateCache(): void {
    this.cachedCells = null;
    this.cachedRange = null;
  }

  // -----------------------------------------------------------------------
  // Temperature range
  // -----------------------------------------------------------------------

  getTemperatureRange(): TempRange {
    if (this.cachedRange) {
      return this.cachedRange;
    }

    if (!this.thermalData || this.thermalData.components.length === 0) {
      const range: TempRange = { min: 25, max: 25 };
      this.cachedRange = range;
      return range;
    }

    const data = this.thermalData;
    let min = data.ambientTemp;
    let max = data.ambientTemp;

    // Check component temps
    for (const comp of data.components) {
      if (comp.temperature < min) {
        min = comp.temperature;
      }
      if (comp.temperature > max) {
        max = comp.temperature;
      }
    }

    // Check pre-computed grid
    if (data.heatGrid) {
      for (const row of data.heatGrid) {
        for (const val of row) {
          if (val < min) {
            min = val;
          }
          if (val > max) {
            max = val;
          }
        }
      }
    }

    // Ensure range is non-degenerate
    if (min === max) {
      max = min + 1;
    }

    const range: TempRange = { min, max };
    this.cachedRange = range;
    return range;
  }

  // -----------------------------------------------------------------------
  // Temperature → Color
  // -----------------------------------------------------------------------

  temperatureToColor(tempC: number, range: TempRange): string {
    const span = range.max - range.min;
    const frac = span <= 0 ? 0 : (tempC - range.min) / span;
    const { r, g, b } = interpolateGradient(frac);
    return rgbToHex(r, g, b);
  }

  // -----------------------------------------------------------------------
  // Heatmap cell generation
  // -----------------------------------------------------------------------

  getHeatmapCells(): HeatmapCell[] {
    if (this.cachedCells) {
      return this.cachedCells;
    }

    if (!this.thermalData) {
      this.cachedCells = [];
      return this.cachedCells;
    }

    const data = this.thermalData;
    const range = this.getTemperatureRange();

    if (data.heatGrid && data.heatGrid.length > 0) {
      this.cachedCells = this.cellsFromGrid(data, range);
    } else {
      this.cachedCells = this.cellsFromComponents(data, range);
    }

    return this.cachedCells;
  }

  /**
   * Build cells from a pre-computed 2D temperature grid.
   */
  private cellsFromGrid(data: ThermalMapData, range: TempRange): HeatmapCell[] {
    const grid = data.heatGrid!;
    const cellSize = data.cellSizeMm ?? DEFAULT_CELL_SIZE_MM;
    const cells: HeatmapCell[] = [];

    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const temperature = grid[row][col];
        cells.push({
          col,
          row,
          x: col * cellSize,
          y: row * cellSize,
          width: cellSize,
          height: cellSize,
          temperature,
          color: this.temperatureToColor(temperature, range),
        });
      }
    }

    return cells;
  }

  /**
   * Generate an approximate heatmap from component positions using
   * inverse-distance weighting (IDW). Each component radiates heat
   * that falls off with distance squared.
   */
  private cellsFromComponents(data: ThermalMapData, range: TempRange): HeatmapCell[] {
    const cellSize = DEFAULT_CELL_SIZE_MM;
    const cols = Math.max(1, Math.ceil(data.boardWidth / cellSize));
    const rows = Math.max(1, Math.ceil(data.boardHeight / cellSize));
    const cells: HeatmapCell[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = (col + 0.5) * cellSize;
        const cy = (row + 0.5) * cellSize;
        const temperature = this.idwTemperature(cx, cy, data);
        cells.push({
          col,
          row,
          x: col * cellSize,
          y: row * cellSize,
          width: cellSize,
          height: cellSize,
          temperature,
          color: this.temperatureToColor(temperature, range),
        });
      }
    }

    return cells;
  }

  /**
   * Inverse-distance weighted temperature interpolation.
   * Components contribute their excess temperature (above ambient)
   * weighted by 1/d^2, blended additively onto the ambient baseline.
   */
  private idwTemperature(x: number, y: number, data: ThermalMapData): number {
    let totalWeight = 0;
    let weightedExcess = 0;

    for (const comp of data.components) {
      const dx = x - comp.position.x;
      const dy = y - comp.position.y;
      const distSq = dx * dx + dy * dy;

      // Inside component bounding box: full temperature
      const halfW = comp.boundingBox.width / 2;
      const halfH = comp.boundingBox.height / 2;
      if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
        return comp.temperature;
      }

      // Weight by power dissipation and inverse-distance squared
      const weight = comp.powerDissipation / Math.max(distSq, 0.01);
      totalWeight += weight;
      weightedExcess += weight * (comp.temperature - data.ambientTemp);
    }

    if (totalWeight === 0) {
      return data.ambientTemp;
    }

    return data.ambientTemp + weightedExcess / totalWeight;
  }

  // -----------------------------------------------------------------------
  // Hotspot detection
  // -----------------------------------------------------------------------

  getHotspots(): Hotspot[] {
    if (!this.thermalData) {
      return [];
    }

    return this.thermalData.components
      .filter((c) => c.temperature > HOTSPOT_THRESHOLD_C)
      .map((c) => ({
        componentId: c.id,
        componentName: c.name,
        temperature: c.temperature,
        position: { ...c.position },
        boundingBox: { ...c.boundingBox },
      }));
  }

  // -----------------------------------------------------------------------
  // Legend
  // -----------------------------------------------------------------------

  getLegendStops(): LegendStop[] {
    const range = this.getTemperatureRange();
    const stops: LegendStop[] = [];

    for (let i = 0; i < LEGEND_STOP_COUNT; i++) {
      const position = i / (LEGEND_STOP_COUNT - 1);
      const temperature = range.min + position * (range.max - range.min);
      stops.push({
        position,
        temperature: Math.round(temperature * 10) / 10,
        color: this.temperatureToColor(temperature, range),
      });
    }

    return stops;
  }
}
