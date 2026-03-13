import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../ai-tools/registry';
import { registerExportTools } from '../ai-tools/export';
import type { ToolContext } from '../ai-tools/types';
import type { IStorage } from '../storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerExportTools(registry);
  return registry;
}

function createMockStorage(overrides: Partial<Record<string, unknown>> = {}): IStorage {
  return {
    getBomItems: vi.fn().mockResolvedValue(overrides.bomItems ?? []),
    getCircuitDesigns: vi.fn().mockResolvedValue(overrides.circuits ?? []),
    getNodes: vi.fn().mockResolvedValue(overrides.nodes ?? []),
    getEdges: vi.fn().mockResolvedValue([]),
    getComponentParts: vi.fn().mockResolvedValue([]),
    getProject: vi.fn().mockResolvedValue(overrides.project ?? { name: 'TestProject', description: '' }),
    getCircuitInstances: vi.fn().mockResolvedValue([]),
    getCircuitNets: vi.fn().mockResolvedValue([]),
    getCircuitWires: vi.fn().mockResolvedValue([]),
    getValidationIssues: vi.fn().mockResolvedValue([]),
  } as unknown as IStorage;
}

function createCtx(storage?: IStorage): ToolContext {
  return {
    projectId: 1,
    storage: storage ?? createMockStorage(),
    confirmed: true,
  };
}

// ---------------------------------------------------------------------------
// Tests: get_export_status
// ---------------------------------------------------------------------------

describe('get_export_status', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('is registered', () => {
    expect(registry.get('get_export_status')).toBeDefined();
  });

  it('returns all formats with readiness when project has no data', async () => {
    const ctx = createCtx();
    const result = await registry.execute('get_export_status', {}, ctx);
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('type', 'export_status');
    const formats = (result.data as { formats: Array<{ format: string; ready: boolean; reason?: string }> }).formats;
    expect(Array.isArray(formats)).toBe(true);
    expect(formats.length).toBeGreaterThan(0);

    // All circuit-requiring formats should not be ready
    const gerber = formats.find((f) => f.format === 'gerber');
    expect(gerber).toBeDefined();
    expect(gerber!.ready).toBe(false);
    expect(gerber!.reason).toContain('no circuit design');

    // BOM CSV should not be ready
    const bomCsv = formats.find((f) => f.format === 'bom-csv');
    expect(bomCsv).toBeDefined();
    expect(bomCsv!.ready).toBe(false);
    expect(bomCsv!.reason).toContain('no BOM items');
  });

  it('marks circuit formats as ready when circuits exist', async () => {
    const storage = createMockStorage({
      circuits: [{ id: 1, name: 'Main Circuit', description: '' }],
      bomItems: [{ id: 1, partNumber: 'R1', quantity: 1 }],
      nodes: [{ nodeId: 'n1', label: 'MCU', nodeType: 'mcu' }],
    });
    const ctx = createCtx(storage);
    const result = await registry.execute('get_export_status', {}, ctx);
    expect(result.success).toBe(true);
    const formats = (result.data as { formats: Array<{ format: string; ready: boolean }> }).formats;

    const gerber = formats.find((f) => f.format === 'gerber');
    expect(gerber!.ready).toBe(true);

    const bomCsv = formats.find((f) => f.format === 'bom-csv');
    expect(bomCsv!.ready).toBe(true);

    const kicad = formats.find((f) => f.format === 'kicad');
    expect(kicad!.ready).toBe(true);
  });

  it('message includes circuit name and BOM count', async () => {
    const storage = createMockStorage({
      circuits: [{ id: 1, name: 'PowerSupply', description: '' }],
      bomItems: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    const ctx = createCtx(storage);
    const result = await registry.execute('get_export_status', {}, ctx);
    expect(result.message).toContain('PowerSupply');
    expect(result.message).toContain('3 items');
  });
});

// ---------------------------------------------------------------------------
// Tests: trigger_export
// ---------------------------------------------------------------------------

describe('trigger_export', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  it('is registered', () => {
    expect(registry.get('trigger_export')).toBeDefined();
  });

  it('returns error for unknown format', async () => {
    const ctx = createCtx();
    const result = await registry.execute('trigger_export', { format: 'nonexistent' }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown export format');
    expect(result.message).toContain('nonexistent');
  });

  it('returns download URL for bom-csv when BOM items exist', async () => {
    const storage = createMockStorage({
      bomItems: [{ id: 1, partNumber: 'R1' }],
    });
    const ctx = createCtx(storage);
    const result = await registry.execute('trigger_export', { format: 'bom-csv' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { type: string; downloadUrl: string; method: string; format: string };
    expect(data.type).toBe('export_download');
    expect(data.downloadUrl).toBe('/api/projects/1/export/bom');
    expect(data.method).toBe('POST');
    expect(data.format).toBe('bom-csv');
  });

  it('returns error for bom-csv when no BOM items', async () => {
    const ctx = createCtx();
    const result = await registry.execute('trigger_export', { format: 'bom-csv' }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('no BOM items');
  });

  it('returns error for circuit-dependent format when no circuits exist', async () => {
    const ctx = createCtx();
    const result = await registry.execute('trigger_export', { format: 'gerber' }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toContain('no circuit designs');
  });

  it('returns download URL for gerber when circuit exists', async () => {
    const storage = createMockStorage({
      circuits: [{ id: 1, name: 'Main', description: '' }],
    });
    const ctx = createCtx(storage);
    const result = await registry.execute('trigger_export', { format: 'gerber' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { downloadUrl: string; label: string };
    expect(data.downloadUrl).toBe('/api/projects/1/export/gerber');
    expect(data.label).toBe('Gerber (RS-274X)');
  });

  it('includes netlist format body hint for SPICE netlist', async () => {
    const storage = createMockStorage({
      circuits: [{ id: 1, name: 'Main', description: '' }],
    });
    const ctx = createCtx(storage);
    const result = await registry.execute('trigger_export', { format: 'netlist-spice' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { body: Record<string, unknown> };
    expect(data.body).toEqual({ netlistFormat: 'spice' });
  });

  it('includes netlist format body hint for KiCad netlist', async () => {
    const storage = createMockStorage({
      circuits: [{ id: 1, name: 'Main', description: '' }],
    });
    const ctx = createCtx(storage);
    const result = await registry.execute('trigger_export', { format: 'netlist-kicad' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { body: Record<string, unknown> };
    expect(data.body).toEqual({ netlistFormat: 'kicad' });
  });

  it('returns download URL for firmware scaffold (no circuit required)', async () => {
    const ctx = createCtx();
    const result = await registry.execute('trigger_export', { format: 'firmware' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { downloadUrl: string };
    expect(data.downloadUrl).toBe('/api/projects/1/export/firmware');
  });

  it('returns download URL for report-pdf (no circuit required)', async () => {
    const ctx = createCtx();
    const result = await registry.execute('trigger_export', { format: 'report-pdf' }, ctx);
    expect(result.success).toBe(true);
    const data = result.data as { downloadUrl: string };
    expect(data.downloadUrl).toBe('/api/projects/1/export/report-pdf');
  });
});
