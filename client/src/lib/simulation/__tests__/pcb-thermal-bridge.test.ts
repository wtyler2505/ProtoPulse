import { describe, expect, it } from 'vitest';
import type { ThermalComponent } from '../thermal-analysis';
import {
  PACKAGE_THERMAL_DB,
  extractThermalComponents,
} from '../pcb-thermal-bridge';
import type { CircuitInstanceData } from '../pcb-thermal-bridge';

// ---------------------------------------------------------------------------
// Helper: create a minimal CircuitInstanceData for testing
// ---------------------------------------------------------------------------
function makeInstance(overrides: Partial<CircuitInstanceData> = {}): CircuitInstanceData {
  return {
    id: 1,
    instanceId: 'inst-1',
    label: 'U1',
    componentId: 'comp-1',
    properties: {},
    positionX: 10,
    positionY: 20,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PACKAGE_THERMAL_DB
// ---------------------------------------------------------------------------
describe('PACKAGE_THERMAL_DB', () => {
  it('contains at least 15 packages', () => {
    expect(Object.keys(PACKAGE_THERMAL_DB).length).toBeGreaterThanOrEqual(15);
  });

  const expectedPackages = [
    'DIP-8', 'DIP-14', 'DIP-16',
    'SOIC-8', 'SOIC-16',
    'SOT-23', 'SOT-223',
    'QFP-44', 'QFP-64',
    'QFN-32', 'QFN-48',
    'TO-220', 'TO-92', 'TO-252',
    'BGA-256',
  ];

  it.each(expectedPackages)('contains %s', (pkg) => {
    expect(PACKAGE_THERMAL_DB[pkg]).toBeDefined();
    expect(PACKAGE_THERMAL_DB[pkg].thetaJC).toBeGreaterThan(0);
    expect(PACKAGE_THERMAL_DB[pkg].thetaCA).toBeGreaterThan(0);
    expect(PACKAGE_THERMAL_DB[pkg].maxJunctionTemp).toBeGreaterThan(0);
  });

  it('each entry has valid thermal properties', () => {
    for (const [_pkg, data] of Object.entries(PACKAGE_THERMAL_DB)) {
      expect(data.thetaJC).toBeGreaterThan(0);
      expect(data.thetaCA).toBeGreaterThan(0);
      expect(data.maxJunctionTemp).toBeGreaterThanOrEqual(125);
    }
  });
});

// ---------------------------------------------------------------------------
// extractThermalComponents
// ---------------------------------------------------------------------------
describe('extractThermalComponents', () => {
  it('returns empty array for empty input', () => {
    const result = extractThermalComponents([]);
    expect(result).toEqual([]);
  });

  it('extracts component with known package type from properties', () => {
    const instances: CircuitInstanceData[] = [
      makeInstance({
        instanceId: 'u1',
        label: 'U1',
        properties: { packageType: 'SOIC-8' },
        positionX: 50,
        positionY: 60,
      }),
    ];
    const result = extractThermalComponents(instances);
    expect(result).toHaveLength(1);
    const comp = result[0];
    expect(comp.id).toBe('u1');
    expect(comp.name).toBe('U1');
    expect(comp.packageType).toBe('SOIC-8');
    expect(comp.position).toEqual({ x: 50, y: 60 });
    expect(comp.thetaJC).toBe(PACKAGE_THERMAL_DB['SOIC-8'].thetaJC);
    expect(comp.thetaCA).toBe(PACKAGE_THERMAL_DB['SOIC-8'].thetaCA);
    expect(comp.maxJunctionTemp).toBe(PACKAGE_THERMAL_DB['SOIC-8'].maxJunctionTemp);
  });

  it('uses default power dissipation of 0.1W', () => {
    const instances = [makeInstance({ properties: { packageType: 'TO-220' } })];
    const result = extractThermalComponents(instances);
    expect(result[0].powerDissipation).toBeCloseTo(0.1);
  });

  it('uses custom default power when provided', () => {
    const instances = [makeInstance({ properties: { packageType: 'TO-220' } })];
    const result = extractThermalComponents(instances, 0.5);
    expect(result[0].powerDissipation).toBeCloseTo(0.5);
  });

  it('reads powerDissipation from properties if present', () => {
    const instances = [
      makeInstance({ properties: { packageType: 'SOT-23', powerDissipation: 0.25 } }),
    ];
    const result = extractThermalComponents(instances);
    expect(result[0].powerDissipation).toBeCloseTo(0.25);
  });

  it('uses fallback thermal values for unknown package types', () => {
    const instances = [
      makeInstance({ properties: { packageType: 'UNKNOWN-PKG' } }),
    ];
    const result = extractThermalComponents(instances);
    expect(result).toHaveLength(1);
    expect(result[0].packageType).toBe('UNKNOWN-PKG');
    // Should get reasonable fallback values
    expect(result[0].thetaJC).toBeGreaterThan(0);
    expect(result[0].thetaCA).toBeGreaterThan(0);
    expect(result[0].maxJunctionTemp).toBeGreaterThanOrEqual(125);
  });

  it('skips instances with no packageType in properties', () => {
    const instances = [
      makeInstance({ instanceId: 'u1', properties: {} }),
      makeInstance({ instanceId: 'u2', properties: { packageType: 'DIP-8' } }),
    ];
    const result = extractThermalComponents(instances);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('u2');
  });

  it('skips instances where properties is null-ish', () => {
    const instances = [
      makeInstance({ instanceId: 'u1', properties: null }),
    ];
    const result = extractThermalComponents(instances);
    expect(result).toHaveLength(0);
  });

  it('sets layer to "F.Cu" by default', () => {
    const instances = [makeInstance({ properties: { packageType: 'QFN-32' } })];
    const result = extractThermalComponents(instances);
    expect(result[0].layer).toBe('F.Cu');
  });

  it('reads layer from properties if present', () => {
    const instances = [makeInstance({ properties: { packageType: 'QFN-32', layer: 'B.Cu' } })];
    const result = extractThermalComponents(instances);
    expect(result[0].layer).toBe('B.Cu');
  });

  it('handles multiple instances correctly', () => {
    const instances: CircuitInstanceData[] = [
      makeInstance({ id: 1, instanceId: 'u1', label: 'U1', positionX: 10, positionY: 20, properties: { packageType: 'SOIC-8' } }),
      makeInstance({ id: 2, instanceId: 'r1', label: 'R1', positionX: 30, positionY: 40, properties: { packageType: 'DIP-8' } }),
      makeInstance({ id: 3, instanceId: 'q1', label: 'Q1', positionX: 50, positionY: 60, properties: { packageType: 'TO-92' } }),
    ];
    const result = extractThermalComponents(instances);
    expect(result).toHaveLength(3);
    expect(result.map((c) => c.id)).toEqual(['u1', 'r1', 'q1']);
    expect(result.map((c) => c.packageType)).toEqual(['SOIC-8', 'DIP-8', 'TO-92']);
  });

  it('result conforms to ThermalComponent interface', () => {
    const instances = [makeInstance({ properties: { packageType: 'BGA-256' } })];
    const result = extractThermalComponents(instances);
    const comp: ThermalComponent = result[0];
    expect(comp.id).toBeDefined();
    expect(comp.name).toBeDefined();
    expect(comp.packageType).toBeDefined();
    expect(comp.powerDissipation).toBeDefined();
    expect(comp.thetaJC).toBeDefined();
    expect(comp.thetaCA).toBeDefined();
    expect(comp.maxJunctionTemp).toBeDefined();
    expect(comp.position).toBeDefined();
    expect(comp.layer).toBeDefined();
  });

  it('handles case-insensitive package lookup', () => {
    const instances = [makeInstance({ properties: { packageType: 'soic-8' } })];
    const result = extractThermalComponents(instances);
    expect(result).toHaveLength(1);
    expect(result[0].thetaJC).toBe(PACKAGE_THERMAL_DB['SOIC-8'].thetaJC);
  });
});
