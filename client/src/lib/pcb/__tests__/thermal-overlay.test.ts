import { describe, it, expect } from 'vitest';
import {
  ThermalOverlayManager,
  HOTSPOT_THRESHOLD_C,
} from '../thermal-overlay';
import type {
  ThermalMapData,
  ThermalComponent,
  TempRange,
} from '../thermal-overlay';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeComponent(overrides: Partial<ThermalComponent> & { id: string }): ThermalComponent {
  return {
    name: overrides.id,
    position: { x: 10, y: 10 },
    temperature: 40,
    powerDissipation: 1.0,
    packageType: 'SOIC-8',
    boundingBox: { width: 5, height: 4 },
    ...overrides,
  };
}

function makeData(overrides: Partial<ThermalMapData> = {}): ThermalMapData {
  return {
    boardWidth: 20,
    boardHeight: 20,
    ambientTemp: 25,
    components: [
      makeComponent({ id: 'U1', temperature: 60, position: { x: 10, y: 10 } }),
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Enable / Disable
// ---------------------------------------------------------------------------

describe('ThermalOverlayManager — enable/disable', () => {
  it('starts disabled', () => {
    const mgr = ThermalOverlayManager.create();
    expect(mgr.isEnabled()).toBe(false);
  });

  it('can be enabled', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.setEnabled(true);
    expect(mgr.isEnabled()).toBe(true);
  });

  it('can be disabled after enabling', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.setEnabled(true);
    mgr.setEnabled(false);
    expect(mgr.isEnabled()).toBe(false);
  });

  it('does not notify when setting same value', () => {
    const mgr = ThermalOverlayManager.create();
    let count = 0;
    mgr.subscribe(() => { count++; });
    mgr.setEnabled(false); // already false
    expect(count).toBe(0);
  });

  it('notifies on enable change', () => {
    const mgr = ThermalOverlayManager.create();
    let count = 0;
    mgr.subscribe(() => { count++; });
    mgr.setEnabled(true);
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

describe('ThermalOverlayManager — subscription', () => {
  it('subscribe returns an unsubscribe function', () => {
    const mgr = ThermalOverlayManager.create();
    let count = 0;
    const unsub = mgr.subscribe(() => { count++; });
    mgr.setEnabled(true);
    expect(count).toBe(1);
    unsub();
    mgr.setEnabled(false);
    expect(count).toBe(1); // no further notification
  });

  it('supports multiple subscribers', () => {
    const mgr = ThermalOverlayManager.create();
    let a = 0;
    let b = 0;
    mgr.subscribe(() => { a++; });
    mgr.subscribe(() => { b++; });
    mgr.setEnabled(true);
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('notifies on updateThermalData', () => {
    const mgr = ThermalOverlayManager.create();
    let count = 0;
    mgr.subscribe(() => { count++; });
    mgr.updateThermalData(makeData());
    expect(count).toBe(1);
  });

  it('notifies on clearThermalData', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData());
    let count = 0;
    mgr.subscribe(() => { count++; });
    mgr.clearThermalData();
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Temperature range
// ---------------------------------------------------------------------------

describe('ThermalOverlayManager — temperature range', () => {
  it('returns default range when no data loaded', () => {
    const mgr = ThermalOverlayManager.create();
    const range = mgr.getTemperatureRange();
    expect(range.min).toBe(25);
    expect(range.max).toBe(25);
  });

  it('returns range from component temperatures', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      ambientTemp: 20,
      components: [
        makeComponent({ id: 'U1', temperature: 45 }),
        makeComponent({ id: 'U2', temperature: 80 }),
      ],
    }));
    const range = mgr.getTemperatureRange();
    expect(range.min).toBe(20);
    expect(range.max).toBe(80);
  });

  it('uses ambient as lower bound when all components are hotter', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      ambientTemp: 25,
      components: [
        makeComponent({ id: 'U1', temperature: 50 }),
      ],
    }));
    const range = mgr.getTemperatureRange();
    expect(range.min).toBe(25);
    expect(range.max).toBe(50);
  });

  it('handles degenerate range (single component at ambient)', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      ambientTemp: 25,
      components: [
        makeComponent({ id: 'U1', temperature: 25 }),
      ],
    }));
    const range = mgr.getTemperatureRange();
    // Should be non-degenerate (max > min)
    expect(range.max).toBeGreaterThan(range.min);
  });

  it('considers heatGrid values for range', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      ambientTemp: 20,
      components: [makeComponent({ id: 'U1', temperature: 40 })],
      heatGrid: [[20, 30], [50, 90]],
      cellSizeMm: 10,
    }));
    const range = mgr.getTemperatureRange();
    expect(range.min).toBe(20);
    expect(range.max).toBe(90);
  });

  it('caches range and invalidates on data update', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      components: [makeComponent({ id: 'U1', temperature: 50 })],
    }));
    const range1 = mgr.getTemperatureRange();
    mgr.updateThermalData(makeData({
      components: [makeComponent({ id: 'U1', temperature: 100 })],
    }));
    const range2 = mgr.getTemperatureRange();
    expect(range2.max).toBe(100);
    expect(range1.max).not.toBe(range2.max);
  });
});

// ---------------------------------------------------------------------------
// Temperature → Color mapping
// ---------------------------------------------------------------------------

describe('ThermalOverlayManager — temperatureToColor', () => {
  const mgr = ThermalOverlayManager.create();
  const range: TempRange = { min: 0, max: 100 };

  it('returns blue-ish color at minimum temperature', () => {
    const color = mgr.temperatureToColor(0, range);
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
    // Blue channel should dominate at frac=0
    const b = parseInt(color.slice(5, 7), 16);
    const r = parseInt(color.slice(1, 3), 16);
    expect(b).toBeGreaterThan(r);
  });

  it('returns red-ish color at maximum temperature', () => {
    const color = mgr.temperatureToColor(100, range);
    const r = parseInt(color.slice(1, 3), 16);
    const b = parseInt(color.slice(5, 7), 16);
    expect(r).toBeGreaterThan(b);
  });

  it('returns green-ish color at midpoint', () => {
    const color = mgr.temperatureToColor(40, range);
    // At frac=0.4 we expect green to be the dominant channel
    const g = parseInt(color.slice(3, 5), 16);
    expect(g).toBeGreaterThan(100);
  });

  it('clamps below minimum to blue', () => {
    const color = mgr.temperatureToColor(-50, range);
    const atMin = mgr.temperatureToColor(0, range);
    expect(color).toBe(atMin);
  });

  it('clamps above maximum to red', () => {
    const color = mgr.temperatureToColor(200, range);
    const atMax = mgr.temperatureToColor(100, range);
    expect(color).toBe(atMax);
  });

  it('handles degenerate (zero-span) range', () => {
    const color = mgr.temperatureToColor(50, { min: 50, max: 50 });
    // frac = 0 → blue
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('produces distinct colors for different temperatures', () => {
    const c25 = mgr.temperatureToColor(25, range);
    const c50 = mgr.temperatureToColor(50, range);
    const c75 = mgr.temperatureToColor(75, range);
    expect(c25).not.toBe(c50);
    expect(c50).not.toBe(c75);
    expect(c25).not.toBe(c75);
  });
});

// ---------------------------------------------------------------------------
// Heatmap cell generation
// ---------------------------------------------------------------------------

describe('ThermalOverlayManager — getHeatmapCells', () => {
  it('returns empty array when no data loaded', () => {
    const mgr = ThermalOverlayManager.create();
    expect(mgr.getHeatmapCells()).toEqual([]);
  });

  it('generates cells from pre-computed heatGrid', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      boardWidth: 20,
      boardHeight: 20,
      heatGrid: [[30, 40], [50, 60]],
      cellSizeMm: 10,
    }));
    const cells = mgr.getHeatmapCells();
    expect(cells).toHaveLength(4);
    expect(cells[0].col).toBe(0);
    expect(cells[0].row).toBe(0);
    expect(cells[0].temperature).toBe(30);
    expect(cells[3].temperature).toBe(60);
  });

  it('respects cellSizeMm from data', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      heatGrid: [[25, 30]],
      cellSizeMm: 5,
    }));
    const cells = mgr.getHeatmapCells();
    expect(cells[0].width).toBe(5);
    expect(cells[0].height).toBe(5);
    expect(cells[1].x).toBe(5);
  });

  it('generates IDW cells when no heatGrid provided', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      boardWidth: 10,
      boardHeight: 10,
      ambientTemp: 25,
      components: [
        makeComponent({ id: 'U1', temperature: 80, position: { x: 5, y: 5 }, powerDissipation: 2 }),
      ],
    }));
    const cells = mgr.getHeatmapCells();
    expect(cells.length).toBeGreaterThan(0);
    // All cells should have valid temperatures
    for (const cell of cells) {
      expect(cell.temperature).toBeGreaterThanOrEqual(25);
      expect(cell.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('cells near component are hotter than distant cells', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      boardWidth: 20,
      boardHeight: 4,
      ambientTemp: 25,
      components: [
        makeComponent({
          id: 'U1',
          temperature: 100,
          position: { x: 1, y: 1 },
          powerDissipation: 5,
          boundingBox: { width: 1, height: 1 },
        }),
      ],
    }));
    const cells = mgr.getHeatmapCells();
    // Find cell at position closest to component vs furthest
    const near = cells.find((c) => c.col === 0 && c.row === 0);
    const far = cells.find((c) => c.col === cells.reduce((max, cc) => Math.max(max, cc.col), 0) && c.row === 1);
    expect(near).toBeDefined();
    expect(far).toBeDefined();
    if (near && far) {
      expect(near.temperature).toBeGreaterThan(far.temperature);
    }
  });

  it('caches cells and invalidates on data update', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({ heatGrid: [[30]] }));
    const cells1 = mgr.getHeatmapCells();
    // Same reference from cache
    const cells2 = mgr.getHeatmapCells();
    expect(cells1).toBe(cells2);
    // After update, new reference
    mgr.updateThermalData(makeData({ heatGrid: [[50]] }));
    const cells3 = mgr.getHeatmapCells();
    expect(cells3).not.toBe(cells1);
    expect(cells3[0].temperature).toBe(50);
  });

  it('handles zero-size board gracefully', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      boardWidth: 0,
      boardHeight: 0,
      components: [],
    }));
    // Should not throw, produces minimal grid
    const cells = mgr.getHeatmapCells();
    expect(cells).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Hotspot detection
// ---------------------------------------------------------------------------

describe('ThermalOverlayManager — hotspot detection', () => {
  it('returns empty array when no data', () => {
    const mgr = ThermalOverlayManager.create();
    expect(mgr.getHotspots()).toEqual([]);
  });

  it('does not flag components below threshold', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      components: [
        makeComponent({ id: 'U1', temperature: 50 }),
        makeComponent({ id: 'U2', temperature: HOTSPOT_THRESHOLD_C }),
      ],
    }));
    expect(mgr.getHotspots()).toHaveLength(0);
  });

  it('flags components above threshold', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      components: [
        makeComponent({ id: 'U1', temperature: 50 }),
        makeComponent({ id: 'HOT', temperature: 85, position: { x: 5, y: 5 } }),
        makeComponent({ id: 'HOTTER', temperature: 110, position: { x: 15, y: 5 } }),
      ],
    }));
    const hotspots = mgr.getHotspots();
    expect(hotspots).toHaveLength(2);
    expect(hotspots[0].componentId).toBe('HOT');
    expect(hotspots[0].temperature).toBe(85);
    expect(hotspots[1].componentId).toBe('HOTTER');
    expect(hotspots[1].temperature).toBe(110);
  });

  it('includes position and bounding box in hotspot', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      components: [
        makeComponent({
          id: 'U1',
          temperature: 90,
          position: { x: 12, y: 8 },
          boundingBox: { width: 6, height: 4 },
        }),
      ],
    }));
    const hotspots = mgr.getHotspots();
    expect(hotspots[0].position).toEqual({ x: 12, y: 8 });
    expect(hotspots[0].boundingBox).toEqual({ width: 6, height: 4 });
  });

  it('uses exported HOTSPOT_THRESHOLD_C constant at 70', () => {
    expect(HOTSPOT_THRESHOLD_C).toBe(70);
  });
});

// ---------------------------------------------------------------------------
// Legend stops
// ---------------------------------------------------------------------------

describe('ThermalOverlayManager — legend stops', () => {
  it('returns 6 stops', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData());
    const stops = mgr.getLegendStops();
    expect(stops).toHaveLength(6);
  });

  it('first stop is at position 0, last at position 1', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData());
    const stops = mgr.getLegendStops();
    expect(stops[0].position).toBe(0);
    expect(stops[stops.length - 1].position).toBe(1);
  });

  it('temperatures span from range min to max', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      ambientTemp: 20,
      components: [
        makeComponent({ id: 'U1', temperature: 80 }),
      ],
    }));
    const stops = mgr.getLegendStops();
    expect(stops[0].temperature).toBeCloseTo(20, 0);
    expect(stops[stops.length - 1].temperature).toBeCloseTo(80, 0);
  });

  it('stop colors match temperatureToColor for same temp', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      ambientTemp: 0,
      components: [makeComponent({ id: 'U1', temperature: 100 })],
    }));
    const range = mgr.getTemperatureRange();
    const stops = mgr.getLegendStops();
    for (const stop of stops) {
      expect(stop.color).toBe(mgr.temperatureToColor(stop.temperature, range));
    }
  });

  it('positions are monotonically increasing', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData());
    const stops = mgr.getLegendStops();
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].position).toBeGreaterThan(stops[i - 1].position);
    }
  });
});

// ---------------------------------------------------------------------------
// Data management
// ---------------------------------------------------------------------------

describe('ThermalOverlayManager — data management', () => {
  it('starts with null data', () => {
    const mgr = ThermalOverlayManager.create();
    expect(mgr.getThermalData()).toBeNull();
  });

  it('stores data after update', () => {
    const mgr = ThermalOverlayManager.create();
    const data = makeData();
    mgr.updateThermalData(data);
    expect(mgr.getThermalData()).toBe(data);
  });

  it('clear sets data back to null', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData());
    mgr.clearThermalData();
    expect(mgr.getThermalData()).toBeNull();
  });

  it('clear returns empty cells', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData());
    expect(mgr.getHeatmapCells().length).toBeGreaterThan(0);
    mgr.clearThermalData();
    expect(mgr.getHeatmapCells()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('ThermalOverlayManager — edge cases', () => {
  it('handles empty components array', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({ components: [] }));
    const range = mgr.getTemperatureRange();
    expect(range.min).toBe(25);
    const cells = mgr.getHeatmapCells();
    // All cells should be at ambient
    for (const cell of cells) {
      expect(cell.temperature).toBe(25);
    }
  });

  it('handles component with zero power dissipation', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      components: [
        makeComponent({ id: 'U1', temperature: 25, powerDissipation: 0 }),
      ],
    }));
    // Should not throw
    const cells = mgr.getHeatmapCells();
    expect(cells.length).toBeGreaterThan(0);
  });

  it('handles negative ambient temperature', () => {
    const mgr = ThermalOverlayManager.create();
    mgr.updateThermalData(makeData({
      ambientTemp: -20,
      components: [
        makeComponent({ id: 'U1', temperature: 10 }),
      ],
    }));
    const range = mgr.getTemperatureRange();
    expect(range.min).toBe(-20);
    expect(range.max).toBe(10);
  });

  it('multiple create() calls produce independent instances', () => {
    const a = ThermalOverlayManager.create();
    const b = ThermalOverlayManager.create();
    a.setEnabled(true);
    a.updateThermalData(makeData());
    expect(b.isEnabled()).toBe(false);
    expect(b.getThermalData()).toBeNull();
  });
});
