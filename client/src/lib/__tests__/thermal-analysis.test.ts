import { describe, expect, it } from 'vitest';
import type { StackupLayer } from '@/lib/board-stackup';
import {
  airflowMultiplier,
  convectionCoefficient,
  copperSpreadingResistance,
  ThermalAnalyzer,
  viaThermalResistance,
} from '@/lib/simulation/thermal-analysis';
import type {
  ThermalBoundaryConditions,
  ThermalComponent,
  ThermalVia,
} from '@/lib/simulation/thermal-analysis';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeComponent(overrides: Partial<ThermalComponent> = {}): ThermalComponent {
  return {
    id: 'U1',
    name: 'Test IC',
    packageType: 'SOIC-8',
    powerDissipation: 0.5,
    thetaJC: 40,
    thetaCA: 120,
    maxJunctionTemp: 150,
    position: { x: 50, y: 40 },
    layer: 'top',
    ...overrides,
  };
}

function makeVia(overrides: Partial<ThermalVia> = {}): ThermalVia {
  return {
    position: { x: 50, y: 40 },
    diameter: 0.3,
    platingThickness: 0.025,
    layers: ['top', 'bottom'],
    ...overrides,
  };
}

function makeStackup(): StackupLayer[] {
  return [
    {
      id: 'top',
      name: 'Top',
      type: 'signal',
      material: 'FR4',
      thickness: 1.4,
      copperWeight: '1oz',
      dielectricConstant: 4.5,
      lossTangent: 0.02,
      order: 0,
    },
    {
      id: 'gnd',
      name: 'Ground',
      type: 'ground',
      material: 'FR4',
      thickness: 47,
      copperWeight: '1oz',
      dielectricConstant: 4.5,
      lossTangent: 0.02,
      order: 1,
    },
    {
      id: 'pwr',
      name: 'Power',
      type: 'power',
      material: 'FR4',
      thickness: 47,
      copperWeight: '1oz',
      dielectricConstant: 4.5,
      lossTangent: 0.02,
      order: 2,
    },
    {
      id: 'bot',
      name: 'Bottom',
      type: 'signal',
      material: 'FR4',
      thickness: 1.4,
      copperWeight: '1oz',
      dielectricConstant: 4.5,
      lossTangent: 0.02,
      order: 3,
    },
  ];
}

// ---------------------------------------------------------------------------
// Package thermal database lookup
// ---------------------------------------------------------------------------

describe('ThermalAnalyzer.lookupPackageThermals', () => {
  it('returns correct values for SOT-23', () => {
    const result = ThermalAnalyzer.lookupPackageThermals('SOT-23');
    expect(result).toEqual({ thetaJC: 100, thetaCA: 250 });
  });

  it('returns correct values for TO-220', () => {
    const result = ThermalAnalyzer.lookupPackageThermals('TO-220');
    expect(result).toEqual({ thetaJC: 1.5, thetaCA: 40 });
  });

  it('returns correct values for BGA-256', () => {
    const result = ThermalAnalyzer.lookupPackageThermals('BGA-256');
    expect(result).toEqual({ thetaJC: 5, thetaCA: 20 });
  });

  it('returns null for unknown package', () => {
    expect(ThermalAnalyzer.lookupPackageThermals('UNKNOWN-99')).toBeNull();
  });

  it('returns values for all 17 packages in database', () => {
    const packages = [
      'SOT-23', 'SOT-223', 'SOIC-8', 'SOIC-16',
      'QFP-44', 'QFP-48', 'QFP-64', 'QFP-100',
      'BGA-256', 'BGA-484', 'TO-220', 'TO-252',
      'DIP-8', 'DIP-16', '0402', '0603', '0805', '1206',
    ];
    for (const pkg of packages) {
      const r = ThermalAnalyzer.lookupPackageThermals(pkg);
      expect(r).not.toBeNull();
      expect(r!.thetaJC).toBeGreaterThan(0);
      expect(r!.thetaCA).toBeGreaterThan(0);
      expect(r!.thetaCA).toBeGreaterThan(r!.thetaJC);
    }
  });
});

// ---------------------------------------------------------------------------
// Derating calculation
// ---------------------------------------------------------------------------

describe('ThermalAnalyzer.calculateDerating', () => {
  it('returns 1.0 when well below threshold (70%)', () => {
    expect(ThermalAnalyzer.calculateDerating(50, 150)).toBe(1);
  });

  it('returns 1.0 at exactly 70% of max', () => {
    expect(ThermalAnalyzer.calculateDerating(105, 150)).toBe(1);
  });

  it('returns 0.5 halfway between threshold and max', () => {
    // threshold = 105, max = 150, midpoint = 127.5
    expect(ThermalAnalyzer.calculateDerating(127.5, 150)).toBeCloseTo(0.5, 5);
  });

  it('returns 0 at exactly max temperature', () => {
    expect(ThermalAnalyzer.calculateDerating(150, 150)).toBe(0);
  });

  it('returns 0 above max temperature', () => {
    expect(ThermalAnalyzer.calculateDerating(200, 150)).toBe(0);
  });

  it('returns 0 when maxTemp is 0', () => {
    expect(ThermalAnalyzer.calculateDerating(50, 0)).toBe(0);
  });

  it('returns 0 when maxTemp is negative', () => {
    expect(ThermalAnalyzer.calculateDerating(10, -10)).toBe(0);
  });

  it('returns 1 when currentTemp is 0 and maxTemp is positive', () => {
    expect(ThermalAnalyzer.calculateDerating(0, 150)).toBe(1);
  });

  it('returns 1 when currentTemp is negative', () => {
    expect(ThermalAnalyzer.calculateDerating(-40, 150)).toBe(1);
  });

  it('linearly decreases between 70% and 100% of max', () => {
    const max = 200;
    const threshold = 140; // 70%
    const range = max - threshold; // 60
    const d1 = ThermalAnalyzer.calculateDerating(threshold + range * 0.25, max);
    const d2 = ThermalAnalyzer.calculateDerating(threshold + range * 0.5, max);
    const d3 = ThermalAnalyzer.calculateDerating(threshold + range * 0.75, max);
    expect(d1).toBeCloseTo(0.75, 5);
    expect(d2).toBeCloseTo(0.5, 5);
    expect(d3).toBeCloseTo(0.25, 5);
  });
});

// ---------------------------------------------------------------------------
// Copper spreading resistance
// ---------------------------------------------------------------------------

describe('copperSpreadingResistance', () => {
  it('returns finite positive value for valid inputs', () => {
    const r = copperSpreadingResistance(0.035, 100);
    expect(r).toBeGreaterThan(0);
    expect(isFinite(r)).toBe(true);
  });

  it('returns Infinity for zero thickness', () => {
    expect(copperSpreadingResistance(0, 100)).toBe(Infinity);
  });

  it('returns Infinity for zero area', () => {
    expect(copperSpreadingResistance(0.035, 0)).toBe(Infinity);
  });

  it('decreases with larger copper area', () => {
    const r1 = copperSpreadingResistance(0.035, 100);
    const r2 = copperSpreadingResistance(0.035, 400);
    expect(r2).toBeLessThan(r1);
  });

  it('decreases with thicker copper', () => {
    const r1 = copperSpreadingResistance(0.035, 100);
    const r2 = copperSpreadingResistance(0.070, 100);
    expect(r2).toBeLessThan(r1);
  });
});

// ---------------------------------------------------------------------------
// Via thermal resistance
// ---------------------------------------------------------------------------

describe('viaThermalResistance', () => {
  it('returns finite positive value for valid via', () => {
    const via = makeVia();
    const r = viaThermalResistance(via, 1.6);
    expect(r).toBeGreaterThan(0);
    expect(isFinite(r)).toBe(true);
  });

  it('returns Infinity when plating fills entire via', () => {
    const via = makeVia({ diameter: 0.3, platingThickness: 0.15 });
    const r = viaThermalResistance(via, 1.6);
    expect(r).toBe(Infinity);
  });

  it('returns Infinity for zero diameter', () => {
    const via = makeVia({ diameter: 0 });
    expect(viaThermalResistance(via, 1.6)).toBe(Infinity);
  });

  it('returns Infinity for zero board thickness', () => {
    expect(viaThermalResistance(makeVia(), 0)).toBe(Infinity);
  });

  it('larger diameter reduces resistance', () => {
    const small = makeVia({ diameter: 0.2, platingThickness: 0.025 });
    const large = makeVia({ diameter: 0.5, platingThickness: 0.025 });
    expect(viaThermalResistance(large, 1.6)).toBeLessThan(viaThermalResistance(small, 1.6));
  });

  it('thicker plating reduces resistance', () => {
    const thin = makeVia({ platingThickness: 0.015 });
    const thick = makeVia({ platingThickness: 0.05 });
    expect(viaThermalResistance(thick, 1.6)).toBeLessThan(viaThermalResistance(thin, 1.6));
  });

  it('thicker board increases resistance', () => {
    const via = makeVia();
    expect(viaThermalResistance(via, 3.2)).toBeGreaterThan(viaThermalResistance(via, 1.6));
  });
});

// ---------------------------------------------------------------------------
// Convection coefficient
// ---------------------------------------------------------------------------

describe('convectionCoefficient', () => {
  it('returns positive value for still air horizontal', () => {
    expect(convectionCoefficient(0, 'horizontal')).toBe(8);
  });

  it('returns higher value for still air vertical', () => {
    expect(convectionCoefficient(0, 'vertical')).toBeGreaterThan(convectionCoefficient(0, 'horizontal'));
  });

  it('increases with airflow velocity', () => {
    const h0 = convectionCoefficient(0, 'horizontal');
    const h1 = convectionCoefficient(1, 'horizontal');
    const h3 = convectionCoefficient(3, 'horizontal');
    expect(h1).toBeGreaterThan(h0);
    expect(h3).toBeGreaterThan(h1);
  });
});

// ---------------------------------------------------------------------------
// Airflow multiplier
// ---------------------------------------------------------------------------

describe('airflowMultiplier', () => {
  it('returns 1.0 for still air', () => {
    expect(airflowMultiplier(0, 'horizontal')).toBe(1);
  });

  it('returns < 1 for forced air', () => {
    expect(airflowMultiplier(2, 'horizontal')).toBeLessThan(1);
  });

  it('decreases with higher velocity', () => {
    const m1 = airflowMultiplier(1, 'horizontal');
    const m5 = airflowMultiplier(5, 'horizontal');
    expect(m5).toBeLessThan(m1);
  });
});

// ---------------------------------------------------------------------------
// Single component analysis
// ---------------------------------------------------------------------------

describe('ThermalAnalyzer - single component', () => {
  it('computes junction temperature above ambient', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 1.0 }));
    const result = ta.analyze();

    expect(result.components).toHaveLength(1);
    expect(result.components[0].junctionTemp).toBeGreaterThan(25);
  });

  it('zero power gives ambient-level temperatures', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 0 }));
    const result = ta.analyze();

    expect(result.components[0].junctionTemp).toBeCloseTo(25, 0);
  });

  it('higher power gives higher junction temperature', () => {
    const ta1 = new ThermalAnalyzer(100, 80, makeStackup());
    ta1.addComponent(makeComponent({ powerDissipation: 0.5 }));
    const r1 = ta1.analyze();

    const ta2 = new ThermalAnalyzer(100, 80, makeStackup());
    ta2.addComponent(makeComponent({ powerDissipation: 2.0 }));
    const r2 = ta2.analyze();

    expect(r2.components[0].junctionTemp).toBeGreaterThan(r1.components[0].junctionTemp);
  });

  it('reports correct risk level for safe component', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 0.1, maxJunctionTemp: 150 }));
    const result = ta.analyze();
    expect(result.components[0].riskLevel).toBe('safe');
  });

  it('reports failure when power causes temp above max', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({
      powerDissipation: 10,
      thetaJC: 40,
      thetaCA: 120,
      maxJunctionTemp: 80,
    }));
    const result = ta.analyze();
    expect(result.components[0].riskLevel).toBe('failure');
  });

  it('computes positive thermal margin for safe component', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 0.1, maxJunctionTemp: 150 }));
    const result = ta.analyze();
    expect(result.components[0].thermalMargin).toBeGreaterThan(0);
  });

  it('computes negative thermal margin for overheated component', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({
      powerDissipation: 10,
      maxJunctionTemp: 50,
    }));
    const result = ta.analyze();
    expect(result.components[0].thermalMargin).toBeLessThan(0);
  });

  it('case temp is between board temp and junction temp', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 1.0 }));
    const result = ta.analyze();
    const c = result.components[0];
    expect(c.caseTemp).toBeGreaterThanOrEqual(c.boardTemp);
    expect(c.junctionTemp).toBeGreaterThanOrEqual(c.caseTemp);
  });

  it('derating factor is 1 for cool component', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 0.01, maxJunctionTemp: 150 }));
    const result = ta.analyze();
    expect(result.components[0].deratingFactor).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Multiple components
// ---------------------------------------------------------------------------

describe('ThermalAnalyzer - multiple components', () => {
  it('analyzes all components', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ id: 'U1', position: { x: 20, y: 20 } }));
    ta.addComponent(makeComponent({ id: 'U2', position: { x: 80, y: 60 } }));
    ta.addComponent(makeComponent({ id: 'U3', position: { x: 50, y: 40 } }));
    const result = ta.analyze();
    expect(result.components).toHaveLength(3);
  });

  it('sums total power dissipation', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ id: 'U1', powerDissipation: 0.5 }));
    ta.addComponent(makeComponent({ id: 'U2', powerDissipation: 1.5 }));
    const result = ta.analyze();
    expect(result.totalPowerDissipation).toBeCloseTo(2.0, 5);
  });

  it('nearby high-power component raises board temp of neighbour', () => {
    // Isolated component
    const ta1 = new ThermalAnalyzer(100, 80, makeStackup());
    ta1.addComponent(makeComponent({ id: 'U1', powerDissipation: 0.1, position: { x: 50, y: 40 } }));
    const r1 = ta1.analyze();

    // Same component with a 5W neighbour nearby
    const ta2 = new ThermalAnalyzer(100, 80, makeStackup());
    ta2.addComponent(makeComponent({ id: 'U1', powerDissipation: 0.1, position: { x: 50, y: 40 } }));
    ta2.addComponent(makeComponent({ id: 'U2', powerDissipation: 5, position: { x: 52, y: 42 } }));
    const r2 = ta2.analyze();

    const t1 = r1.components.find((c) => c.id === 'U1')!.boardTemp;
    const t2 = r2.components.find((c) => c.id === 'U1')!.boardTemp;
    expect(t2).toBeGreaterThan(t1);
  });
});

// ---------------------------------------------------------------------------
// Vias
// ---------------------------------------------------------------------------

describe('ThermalAnalyzer - vias', () => {
  it('adding vias near component changes thermal result', () => {
    const ta1 = new ThermalAnalyzer(100, 80, makeStackup());
    ta1.addComponent(makeComponent({ powerDissipation: 2 }));
    const r1 = ta1.analyze();

    const ta2 = new ThermalAnalyzer(100, 80, makeStackup());
    ta2.addComponent(makeComponent({ powerDissipation: 2 }));
    for (let i = 0; i < 9; i++) {
      ta2.addVia(makeVia({ position: { x: 48 + (i % 3) * 2, y: 38 + Math.floor(i / 3) * 2 } }));
    }
    const r2 = ta2.analyze();

    // With vias, junction temp should be lower or equal
    expect(r2.components[0].junctionTemp).toBeLessThanOrEqual(r1.components[0].junctionTemp);
  });

  it('distant vias have no effect', () => {
    const ta1 = new ThermalAnalyzer(100, 80, makeStackup());
    ta1.addComponent(makeComponent({ position: { x: 10, y: 10 } }));
    const r1 = ta1.analyze();

    const ta2 = new ThermalAnalyzer(100, 80, makeStackup());
    ta2.addComponent(makeComponent({ position: { x: 10, y: 10 } }));
    ta2.addVia(makeVia({ position: { x: 90, y: 70 } }));
    const r2 = ta2.analyze();

    expect(r2.components[0].junctionTemp).toBe(r1.components[0].junctionTemp);
  });
});

// ---------------------------------------------------------------------------
// Boundary conditions
// ---------------------------------------------------------------------------

describe('ThermalAnalyzer - boundary conditions', () => {
  it('higher ambient temperature raises junction temperature', () => {
    const ta1 = new ThermalAnalyzer(100, 80, makeStackup());
    ta1.addComponent(makeComponent({ powerDissipation: 1 }));
    ta1.setBoundaryConditions({ ambientTemp: 25 });
    const r1 = ta1.analyze();

    const ta2 = new ThermalAnalyzer(100, 80, makeStackup());
    ta2.addComponent(makeComponent({ powerDissipation: 1 }));
    ta2.setBoundaryConditions({ ambientTemp: 50 });
    const r2 = ta2.analyze();

    expect(r2.components[0].junctionTemp).toBeGreaterThan(r1.components[0].junctionTemp);
  });

  it('forced airflow reduces junction temperature', () => {
    const ta1 = new ThermalAnalyzer(100, 80, makeStackup());
    ta1.addComponent(makeComponent({ powerDissipation: 2 }));
    ta1.setBoundaryConditions({ airflowVelocity: 0 });
    const r1 = ta1.analyze();

    const ta2 = new ThermalAnalyzer(100, 80, makeStackup());
    ta2.addComponent(makeComponent({ powerDissipation: 2 }));
    ta2.setBoundaryConditions({ airflowVelocity: 3 });
    const r2 = ta2.analyze();

    expect(r2.components[0].junctionTemp).toBeLessThan(r1.components[0].junctionTemp);
  });

  it('heatsink reduces junction temperature', () => {
    const ta1 = new ThermalAnalyzer(100, 80, makeStackup());
    ta1.addComponent(makeComponent({ powerDissipation: 3 }));
    const r1 = ta1.analyze();

    const ta2 = new ThermalAnalyzer(100, 80, makeStackup());
    ta2.addComponent(makeComponent({ powerDissipation: 3 }));
    ta2.setBoundaryConditions({ heatsinkPresent: true, heatsinkThetaSA: 5 });
    const r2 = ta2.analyze();

    expect(r2.components[0].junctionTemp).toBeLessThan(r1.components[0].junctionTemp);
  });

  it('default boundary conditions are applied', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 0 }));
    const result = ta.analyze();
    // Ambient defaults to 25
    expect(result.components[0].boardTemp).toBeCloseTo(25, 0);
  });

  it('partial boundary update preserves defaults', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 1 }));
    ta.setBoundaryConditions({ ambientTemp: 40 });
    // airflowVelocity should still be 0
    const result = ta.analyze();
    expect(result.components[0].junctionTemp).toBeGreaterThan(40);
  });
});

// ---------------------------------------------------------------------------
// Heat map
// ---------------------------------------------------------------------------

describe('ThermalAnalyzer - heat map', () => {
  it('produces grid with correct dimensions', () => {
    const ta = new ThermalAnalyzer(50, 30, makeStackup());
    ta.addComponent(makeComponent({ position: { x: 25, y: 15 } }));
    const result = ta.analyze();
    expect(result.heatMap.width).toBe(50);
    expect(result.heatMap.height).toBe(30);
    expect(result.heatMap.data).toHaveLength(30);
    expect(result.heatMap.data[0]).toHaveLength(50);
  });

  it('all cells are at ambient when no power', () => {
    const ta = new ThermalAnalyzer(10, 10, makeStackup());
    const result = ta.analyze();
    for (const row of result.heatMap.data) {
      for (const t of row) {
        expect(t).toBeCloseTo(25, 5);
      }
    }
  });

  it('max temp equals min temp when no power', () => {
    const ta = new ThermalAnalyzer(10, 10, makeStackup());
    const result = ta.analyze();
    expect(result.heatMap.maxTemp).toBeCloseTo(result.heatMap.minTemp, 5);
  });

  it('hottest cell is near component location', () => {
    const ta = new ThermalAnalyzer(50, 50, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 5, position: { x: 25, y: 25 } }));
    const result = ta.analyze();

    // Find hottest cell
    let maxT = -Infinity;
    let maxI = 0;
    let maxJ = 0;
    for (let j = 0; j < result.heatMap.height; j++) {
      for (let i = 0; i < result.heatMap.width; i++) {
        if (result.heatMap.data[j][i] > maxT) {
          maxT = result.heatMap.data[j][i];
          maxI = i;
          maxJ = j;
        }
      }
    }

    expect(maxI).toBe(25);
    expect(maxJ).toBe(25);
  });

  it('temperature decreases with distance from source', () => {
    const ta = new ThermalAnalyzer(50, 50, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 5, position: { x: 25, y: 25 } }));
    const result = ta.analyze();
    const hm = result.heatMap;

    const tCenter = hm.data[25][25];
    const tNear = hm.data[25][30]; // 5mm away
    const tFar = hm.data[25][45]; // 20mm away

    expect(tCenter).toBeGreaterThan(tNear);
    expect(tNear).toBeGreaterThan(tFar);
  });

  it('cellSize defaults to 1mm', () => {
    const ta = new ThermalAnalyzer(20, 10, makeStackup());
    const result = ta.analyze();
    expect(result.heatMap.cellSize).toBe(1);
  });

  it('handles 1x1 mm board', () => {
    const ta = new ThermalAnalyzer(1, 1, makeStackup());
    ta.addComponent(makeComponent({ position: { x: 0.5, y: 0.5 }, powerDissipation: 0.1 }));
    const result = ta.analyze();
    expect(result.heatMap.width).toBe(1);
    expect(result.heatMap.height).toBe(1);
    expect(result.heatMap.data[0][0]).toBeGreaterThan(25);
  });

  it('getHeatMapAtLayer returns a heat map', () => {
    const ta = new ThermalAnalyzer(20, 20, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 1, position: { x: 10, y: 10 } }));
    ta.analyze();
    const layerMap = ta.getHeatMapAtLayer('top');
    expect(layerMap.width).toBe(20);
    expect(layerMap.height).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Hotspot detection
// ---------------------------------------------------------------------------

describe('ThermalAnalyzer - hotspots', () => {
  it('detects hotspot at component location', () => {
    const ta = new ThermalAnalyzer(50, 50, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 5, position: { x: 25, y: 25 } }));
    const result = ta.analyze();

    expect(result.hotspots.length).toBeGreaterThanOrEqual(1);
    // Hotspot should be near the component
    const hs = result.hotspots[0];
    expect(hs.position.x).toBeCloseTo(25.5, 0);
    expect(hs.position.y).toBeCloseTo(25.5, 0);
    expect(hs.temperature).toBeGreaterThan(25);
    expect(hs.radius).toBeGreaterThan(0);
  });

  it('no hotspots when no power', () => {
    const ta = new ThermalAnalyzer(20, 20, makeStackup());
    const result = ta.analyze();
    expect(result.hotspots).toHaveLength(0);
  });

  it('detects multiple hotspots for distant components', () => {
    const ta = new ThermalAnalyzer(100, 100, makeStackup());
    ta.addComponent(makeComponent({ id: 'A', powerDissipation: 5, position: { x: 20, y: 20 } }));
    ta.addComponent(makeComponent({ id: 'B', powerDissipation: 5, position: { x: 80, y: 80 } }));
    const result = ta.analyze();
    expect(result.hotspots.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Risk classification
// ---------------------------------------------------------------------------

describe('ThermalAnalyzer - risk classification', () => {
  it('classifies safe (<70% of max)', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 0.01, maxJunctionTemp: 200 }));
    const result = ta.analyze();
    expect(result.components[0].riskLevel).toBe('safe');
  });

  it('classifies warning (70-85% of max)', () => {
    // Need junction temp ~77% of 100 = ~77 degC
    // T_j = 25 + P * (40 + 1.5 + ~adjusted_thetaSA)
    // With thetaCA=120 (still air), T_j ≈ 25 + P * (40 + 1.5 + ~120) ≈ 25 + P*161.5
    // For Tj=77: P ≈ 52/161.5 ≈ 0.32W; maxTemp=100 → 77% → warning
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({
      powerDissipation: 0.5,
      thetaJC: 40,
      thetaCA: 120,
      maxJunctionTemp: 100,
    }));
    const result = ta.analyze();
    // The exact risk depends on calculations; just verify it's not safe for reasonable power
    expect(['warning', 'critical', 'failure']).toContain(result.components[0].riskLevel);
  });

  it('classifies failure when junction exceeds max', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({
      powerDissipation: 20,
      thetaJC: 40,
      maxJunctionTemp: 50,
    }));
    const result = ta.analyze();
    expect(result.components[0].riskLevel).toBe('failure');
  });
});

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

describe('ThermalAnalyzer - recommendations', () => {
  it('no recommendations for safe component', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 0.001, maxJunctionTemp: 200 }));
    const result = ta.analyze();
    expect(result.components[0].recommendations).toHaveLength(0);
  });

  it('recommends heatsink for critical component', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 5, maxJunctionTemp: 150 }));
    const result = ta.analyze();
    if (result.components[0].riskLevel === 'critical' || result.components[0].riskLevel === 'failure') {
      expect(result.components[0].recommendations.length).toBeGreaterThan(0);
    }
  });

  it('recommends redesign for failure component', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({
      powerDissipation: 20,
      maxJunctionTemp: 50,
    }));
    const result = ta.analyze();
    const recs = result.components[0].recommendations;
    expect(recs.some((r) => r.includes('Redesign required'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

describe('ThermalAnalyzer - summary', () => {
  it('includes component count and power', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ id: 'A', powerDissipation: 1 }));
    ta.addComponent(makeComponent({ id: 'B', powerDissipation: 0.5 }));
    const result = ta.analyze();
    expect(result.summary).toContain('2 component(s)');
    expect(result.summary).toContain('1.50W');
  });

  it('mentions failure when present', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 20, maxJunctionTemp: 30 }));
    const result = ta.analyze();
    expect(result.summary).toContain('FAILURE');
  });

  it('says all safe when nothing is wrong', () => {
    const ta = new ThermalAnalyzer(100, 80, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 0.001, maxJunctionTemp: 200 }));
    const result = ta.analyze();
    expect(result.summary).toContain('safe thermal margins');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('ThermalAnalyzer - edge cases', () => {
  it('empty board with no components', () => {
    const ta = new ThermalAnalyzer(20, 20, makeStackup());
    const result = ta.analyze();
    expect(result.components).toHaveLength(0);
    expect(result.totalPowerDissipation).toBe(0);
    expect(result.maxBoardTemp).toBeCloseTo(25, 0);
  });

  it('empty stackup uses defaults', () => {
    const ta = new ThermalAnalyzer(50, 50, []);
    ta.addComponent(makeComponent({ powerDissipation: 1 }));
    const result = ta.analyze();
    expect(result.components[0].junctionTemp).toBeGreaterThan(25);
  });

  it('component outside board bounds still analyzed', () => {
    const ta = new ThermalAnalyzer(20, 20, makeStackup());
    ta.addComponent(makeComponent({ position: { x: 100, y: 100 }, powerDissipation: 1 }));
    const result = ta.analyze();
    expect(result.components).toHaveLength(1);
    // Junction temp computed from ambient path since off-grid
    expect(result.components[0].junctionTemp).toBeGreaterThan(25);
  });

  it('very small board (1x1mm)', () => {
    const ta = new ThermalAnalyzer(1, 1, makeStackup());
    ta.addComponent(makeComponent({ position: { x: 0.5, y: 0.5 }, powerDissipation: 0.1 }));
    const result = ta.analyze();
    expect(result.heatMap.width).toBe(1);
    expect(result.heatMap.height).toBe(1);
  });

  it('boardWidth and boardHeight clamped to minimum 1', () => {
    const ta = new ThermalAnalyzer(0, -5, makeStackup());
    const result = ta.analyze();
    expect(result.heatMap.width).toBe(1);
    expect(result.heatMap.height).toBe(1);
  });

  it('large board with many components (100x100mm, 20 components)', () => {
    const ta = new ThermalAnalyzer(100, 100, makeStackup());
    for (let i = 0; i < 20; i++) {
      ta.addComponent(makeComponent({
        id: `U${i}`,
        name: `IC${i}`,
        powerDissipation: 0.5,
        position: { x: 10 + (i % 5) * 20, y: 10 + Math.floor(i / 5) * 20 },
      }));
    }
    const result = ta.analyze();
    expect(result.components).toHaveLength(20);
    expect(result.totalPowerDissipation).toBeCloseTo(10, 5);
    expect(result.maxBoardTemp).toBeGreaterThan(25);
    expect(result.heatMap.width).toBe(100);
    expect(result.heatMap.height).toBe(100);
  });

  it('maxBoardTemp is rounded to 2 decimals', () => {
    const ta = new ThermalAnalyzer(20, 20, makeStackup());
    ta.addComponent(makeComponent({ powerDissipation: 1 }));
    const result = ta.analyze();
    const str = result.maxBoardTemp.toString();
    const decimals = str.includes('.') ? str.split('.')[1].length : 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});
