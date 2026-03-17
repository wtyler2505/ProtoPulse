import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobQueue } from '../../job-queue';
import {
  registerAllExecutors,
  validateExecutorRegistration,
  aiAnalysisExecutor,
  exportGenerationExecutor,
  batchDrcExecutor,
  reportGenerationExecutor,
  importProcessingExecutor,
  aiAnalysisPayloadSchema,
  exportGenerationPayloadSchema,
  batchDrcPayloadSchema,
  reportGenerationPayloadSchema,
  importProcessingPayloadSchema,
} from '../job-executors';

import type { JobExecutionContext } from '../../job-queue';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockStorage = vi.hoisted(() => ({
  getProject: vi.fn(),
  getNodes: vi.fn(),
  getEdges: vi.fn(),
  getBomItems: vi.fn(),
  getValidationIssues: vi.fn(),
  getComponentParts: vi.fn(),
  bulkCreateValidationIssues: vi.fn(),
  createHistoryItem: vi.fn(),
}));

vi.mock('../../storage', () => ({
  storage: mockStorage,
}));

vi.mock('@shared/drc-engine', () => ({
  runDRC: vi.fn().mockReturnValue([]),
  getDefaultDRCRules: vi.fn().mockReturnValue([
    { type: 'min-clearance', params: { minClearance: 8 }, severity: 'error', enabled: true },
  ]),
}));

vi.mock('../../export/bom-exporter', () => ({
  exportBom: vi.fn().mockReturnValue('part,qty\nR1,10'),
}));

vi.mock('../../export/design-report', () => ({
  generateDesignReportMd: vi.fn().mockReturnValue({
    content: '# Design Report',
    encoding: 'utf8',
    mimeType: 'text/markdown',
    filename: 'report.md',
  }),
}));

vi.mock('../../export/fmea-generator', () => ({
  generateFmeaReport: vi.fn().mockReturnValue({
    content: 'FMEA CSV',
    encoding: 'utf8',
    mimeType: 'text/csv',
    filename: 'fmea.csv',
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createContext(overrides?: Partial<JobExecutionContext>): JobExecutionContext {
  return {
    signal: new AbortController().signal,
    reportProgress: vi.fn(),
    ...overrides,
  };
}

function createAbortedContext(): JobExecutionContext {
  const controller = new AbortController();
  controller.abort();
  return {
    signal: controller.signal,
    reportProgress: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Payload schema tests
// ---------------------------------------------------------------------------

describe('Payload schemas', () => {
  describe('aiAnalysisPayloadSchema', () => {
    it('accepts valid payload with all fields', () => {
      const result = aiAnalysisPayloadSchema.parse({
        projectId: 1,
        prompt: 'Analyze my circuit',
        scope: 'architecture',
      });
      expect(result.projectId).toBe(1);
      expect(result.scope).toBe('architecture');
    });

    it('defaults scope to full', () => {
      const result = aiAnalysisPayloadSchema.parse({ projectId: 1 });
      expect(result.scope).toBe('full');
    });

    it('rejects missing projectId', () => {
      expect(() => aiAnalysisPayloadSchema.parse({})).toThrow();
    });

    it('rejects invalid scope', () => {
      expect(() => aiAnalysisPayloadSchema.parse({ projectId: 1, scope: 'invalid' })).toThrow();
    });

    it('rejects non-integer projectId', () => {
      expect(() => aiAnalysisPayloadSchema.parse({ projectId: 1.5 })).toThrow();
    });

    it('accepts all valid scope values', () => {
      for (const scope of ['architecture', 'bom', 'validation', 'full'] as const) {
        const result = aiAnalysisPayloadSchema.parse({ projectId: 1, scope });
        expect(result.scope).toBe(scope);
      }
    });

    it('allows prompt to be omitted', () => {
      const result = aiAnalysisPayloadSchema.parse({ projectId: 1, scope: 'bom' });
      expect(result.prompt).toBeUndefined();
    });
  });

  describe('exportGenerationPayloadSchema', () => {
    it('accepts valid payload', () => {
      const result = exportGenerationPayloadSchema.parse({
        projectId: 1,
        format: 'kicad',
      });
      expect(result.format).toBe('kicad');
    });

    it('accepts options record', () => {
      const result = exportGenerationPayloadSchema.parse({
        projectId: 1,
        format: 'gerber',
        options: { layers: ['F.Cu', 'B.Cu'] },
      });
      expect(result.options).toEqual({ layers: ['F.Cu', 'B.Cu'] });
    });

    it('rejects unsupported format', () => {
      expect(() => exportGenerationPayloadSchema.parse({ projectId: 1, format: 'step' })).toThrow();
    });

    it('accepts all 12 supported export formats', () => {
      const formats = [
        'kicad', 'eagle', 'spice', 'gerber', 'drill', 'pick-place',
        'bom-csv', 'netlist', 'odb++', 'ipc2581', 'pdf', 'design-report',
      ] as const;
      for (const format of formats) {
        const result = exportGenerationPayloadSchema.parse({ projectId: 1, format });
        expect(result.format).toBe(format);
      }
    });

    it('defaults options to undefined when omitted', () => {
      const result = exportGenerationPayloadSchema.parse({ projectId: 1, format: 'kicad' });
      expect(result.options).toBeUndefined();
    });
  });

  describe('batchDrcPayloadSchema', () => {
    it('accepts valid payload with custom rules', () => {
      const result = batchDrcPayloadSchema.parse({
        projectId: 1,
        rules: [{ type: 'min-clearance', severity: 'error', enabled: true, params: { minClearance: 0.2 } }],
        view: 'pcb',
      });
      expect(result.view).toBe('pcb');
      expect(result.rules).toHaveLength(1);
    });

    it('defaults view to schematic', () => {
      const result = batchDrcPayloadSchema.parse({ projectId: 1 });
      expect(result.view).toBe('schematic');
    });

    it('rejects invalid severity in rules', () => {
      expect(() =>
        batchDrcPayloadSchema.parse({
          projectId: 1,
          rules: [{ type: 'min-clearance', severity: 'info', enabled: true }],
        }),
      ).toThrow();
    });

    it('accepts all three view types', () => {
      for (const view of ['breadboard', 'schematic', 'pcb'] as const) {
        const result = batchDrcPayloadSchema.parse({ projectId: 1, view });
        expect(result.view).toBe(view);
      }
    });

    it('accepts rules without params', () => {
      const result = batchDrcPayloadSchema.parse({
        projectId: 1,
        rules: [{ type: 'overlap', severity: 'warning', enabled: false }],
      });
      expect(result.rules![0].params).toBeUndefined();
    });

    it('accepts multiple rules', () => {
      const result = batchDrcPayloadSchema.parse({
        projectId: 1,
        rules: [
          { type: 'min-clearance', severity: 'error', enabled: true },
          { type: 'overlap', severity: 'warning', enabled: true },
          { type: 'unconnected', severity: 'error', enabled: false },
        ],
      });
      expect(result.rules).toHaveLength(3);
    });
  });

  describe('reportGenerationPayloadSchema', () => {
    it('accepts valid payload', () => {
      const result = reportGenerationPayloadSchema.parse({
        projectId: 1,
        reportType: 'fmea',
      });
      expect(result.reportType).toBe('fmea');
    });

    it('defaults reportType to design', () => {
      const result = reportGenerationPayloadSchema.parse({ projectId: 1 });
      expect(result.reportType).toBe('design');
    });

    it('accepts all four report types', () => {
      for (const reportType of ['design', 'fmea', 'pdf', 'firmware-scaffold'] as const) {
        const result = reportGenerationPayloadSchema.parse({ projectId: 1, reportType });
        expect(result.reportType).toBe(reportType);
      }
    });

    it('rejects invalid report type', () => {
      expect(() =>
        reportGenerationPayloadSchema.parse({ projectId: 1, reportType: 'invalid' }),
      ).toThrow();
    });

    it('accepts options record', () => {
      const result = reportGenerationPayloadSchema.parse({
        projectId: 1,
        reportType: 'design',
        options: { includeImages: true },
      });
      expect(result.options).toEqual({ includeImages: true });
    });
  });

  describe('importProcessingPayloadSchema', () => {
    it('accepts valid payload', () => {
      const result = importProcessingPayloadSchema.parse({
        projectId: 1,
        format: 'kicad',
        data: '<some kicad content>',
        filename: 'circuit.kicad_sch',
      });
      expect(result.format).toBe('kicad');
      expect(result.filename).toBe('circuit.kicad_sch');
    });

    it('rejects empty data', () => {
      expect(() =>
        importProcessingPayloadSchema.parse({
          projectId: 1,
          format: 'kicad',
          data: '',
          filename: 'test.sch',
        }),
      ).toThrow();
    });

    it('rejects empty filename', () => {
      expect(() =>
        importProcessingPayloadSchema.parse({
          projectId: 1,
          format: 'kicad',
          data: 'content',
          filename: '',
        }),
      ).toThrow();
    });

    it('accepts all 8 supported import formats', () => {
      const formats = ['kicad', 'eagle', 'altium', 'geda', 'ltspice', 'proteus', 'orcad', 'generic'] as const;
      for (const format of formats) {
        const result = importProcessingPayloadSchema.parse({
          projectId: 1,
          format,
          data: 'content',
          filename: 'test.sch',
        });
        expect(result.format).toBe(format);
      }
    });

    it('rejects unsupported import format', () => {
      expect(() =>
        importProcessingPayloadSchema.parse({
          projectId: 1,
          format: 'fritzing',
          data: 'content',
          filename: 'test.fzz',
        }),
      ).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// ai_analysis executor
// ---------------------------------------------------------------------------

describe('aiAnalysisExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getNodes.mockResolvedValue([
      { nodeId: 'n1', label: 'MCU', nodeType: 'mcu', positionX: 0, positionY: 0 },
      { nodeId: 'n2', label: 'LED', nodeType: 'led', positionX: 100, positionY: 0 },
    ]);
    mockStorage.getEdges.mockResolvedValue([
      { edgeId: 'e1', source: 'n1', target: 'n2', label: null, signalType: null, voltage: null, busWidth: null },
    ]);
    mockStorage.getBomItems.mockResolvedValue([
      { partNumber: 'ATmega328P', totalPrice: '2.50', quantity: 1 },
      { partNumber: '', totalPrice: '0', quantity: 1 },
    ]);
    mockStorage.getValidationIssues.mockResolvedValue([
      { severity: 'error', message: 'Missing decoupling cap' },
      { severity: 'warning', message: 'Long trace' },
    ]);
  });

  it('analyzes full scope by default', async () => {
    const ctx = createContext();
    const result = await aiAnalysisExecutor({ projectId: 1 }, ctx) as Record<string, unknown>;

    expect(result.projectId).toBe(1);
    expect(result.scope).toBe('full');

    const analysis = result.analysis as Record<string, unknown>;
    expect(analysis.architecture).toBeDefined();
    expect(analysis.bom).toBeDefined();
    expect(analysis.validation).toBeDefined();
  });

  it('identifies disconnected nodes', async () => {
    mockStorage.getEdges.mockResolvedValue([]);
    const ctx = createContext();
    const result = await aiAnalysisExecutor({ projectId: 1, scope: 'architecture' }, ctx) as Record<string, unknown>;

    const arch = (result.analysis as Record<string, unknown>).architecture as Record<string, unknown>;
    expect(arch.disconnectedNodes).toEqual(['n1', 'n2']);
  });

  it('identifies connected nodes correctly', async () => {
    const ctx = createContext();
    const result = await aiAnalysisExecutor({ projectId: 1, scope: 'architecture' }, ctx) as Record<string, unknown>;

    const arch = (result.analysis as Record<string, unknown>).architecture as Record<string, unknown>;
    expect(arch.disconnectedNodes).toEqual([]);
    expect(arch.nodeCount).toBe(2);
    expect(arch.edgeCount).toBe(1);
  });

  it('calculates BOM totals', async () => {
    const ctx = createContext();
    const result = await aiAnalysisExecutor({ projectId: 1, scope: 'bom' }, ctx) as Record<string, unknown>;

    const bom = (result.analysis as Record<string, unknown>).bom as Record<string, unknown>;
    expect(bom.itemCount).toBe(2);
    expect(bom.totalCost).toBe(2.5);
    expect(bom.missingParts).toBe(1);
  });

  it('counts validation issues by severity', async () => {
    const ctx = createContext();
    const result = await aiAnalysisExecutor({ projectId: 1, scope: 'validation' }, ctx) as Record<string, unknown>;

    const val = (result.analysis as Record<string, unknown>).validation as Record<string, unknown>;
    expect(val.totalIssues).toBe(2);
    const bySev = val.bySeverity as Record<string, number>;
    expect(bySev.error).toBe(1);
    expect(bySev.warning).toBe(1);
    expect(bySev.info).toBe(0);
  });

  it('reports progress during execution', async () => {
    const ctx = createContext();
    await aiAnalysisExecutor({ projectId: 1 }, ctx);

    expect(ctx.reportProgress).toHaveBeenCalledWith(5);
    expect(ctx.reportProgress).toHaveBeenCalledWith(25);
    expect(ctx.reportProgress).toHaveBeenCalledWith(50);
    expect(ctx.reportProgress).toHaveBeenCalledWith(75);
    expect(ctx.reportProgress).toHaveBeenCalledWith(100);
  });

  it('throws when signal is already aborted', async () => {
    const ctx = createAbortedContext();
    await expect(aiAnalysisExecutor({ projectId: 1 }, ctx)).rejects.toThrow('Job aborted');
  });

  it('throws on invalid payload', async () => {
    const ctx = createContext();
    await expect(aiAnalysisExecutor({}, ctx)).rejects.toThrow();
  });

  it('only fetches architecture data when scope is architecture', async () => {
    const ctx = createContext();
    await aiAnalysisExecutor({ projectId: 1, scope: 'architecture' }, ctx);

    expect(mockStorage.getNodes).toHaveBeenCalledWith(1);
    expect(mockStorage.getEdges).toHaveBeenCalledWith(1);
    expect(mockStorage.getBomItems).not.toHaveBeenCalled();
    expect(mockStorage.getValidationIssues).not.toHaveBeenCalled();
  });

  it('only fetches BOM data when scope is bom', async () => {
    const ctx = createContext();
    await aiAnalysisExecutor({ projectId: 1, scope: 'bom' }, ctx);

    expect(mockStorage.getBomItems).toHaveBeenCalledWith(1);
    expect(mockStorage.getNodes).not.toHaveBeenCalled();
    expect(mockStorage.getEdges).not.toHaveBeenCalled();
    expect(mockStorage.getValidationIssues).not.toHaveBeenCalled();
  });

  it('only fetches validation data when scope is validation', async () => {
    const ctx = createContext();
    await aiAnalysisExecutor({ projectId: 1, scope: 'validation' }, ctx);

    expect(mockStorage.getValidationIssues).toHaveBeenCalledWith(1);
    expect(mockStorage.getNodes).not.toHaveBeenCalled();
    expect(mockStorage.getEdges).not.toHaveBeenCalled();
    expect(mockStorage.getBomItems).not.toHaveBeenCalled();
  });

  it('handles non-string totalPrice by treating as 0', async () => {
    mockStorage.getBomItems.mockResolvedValue([
      { partNumber: 'R1', totalPrice: 42, quantity: 1 },
      { partNumber: 'C1', totalPrice: null, quantity: 1 },
      { partNumber: 'L1', totalPrice: undefined, quantity: 1 },
    ]);

    const ctx = createContext();
    const result = await aiAnalysisExecutor({ projectId: 1, scope: 'bom' }, ctx) as Record<string, unknown>;

    const bom = (result.analysis as Record<string, unknown>).bom as Record<string, unknown>;
    expect(bom.totalCost).toBe(0);
    expect(bom.itemCount).toBe(3);
  });

  it('handles NaN totalPrice gracefully', async () => {
    mockStorage.getBomItems.mockResolvedValue([
      { partNumber: 'R1', totalPrice: 'not-a-number', quantity: 1 },
      { partNumber: 'C1', totalPrice: '5.00', quantity: 1 },
    ]);

    const ctx = createContext();
    const result = await aiAnalysisExecutor({ projectId: 1, scope: 'bom' }, ctx) as Record<string, unknown>;

    const bom = (result.analysis as Record<string, unknown>).bom as Record<string, unknown>;
    expect(bom.totalCost).toBe(5);
  });

  it('counts missing parts with null partNumber', async () => {
    mockStorage.getBomItems.mockResolvedValue([
      { partNumber: null, totalPrice: '0', quantity: 1 },
      { partNumber: 'ATmega328P', totalPrice: '2.50', quantity: 1 },
    ]);

    const ctx = createContext();
    const result = await aiAnalysisExecutor({ projectId: 1, scope: 'bom' }, ctx) as Record<string, unknown>;

    const bom = (result.analysis as Record<string, unknown>).bom as Record<string, unknown>;
    expect(bom.missingParts).toBe(1);
  });

  it('extracts unique node types in architecture analysis', async () => {
    mockStorage.getNodes.mockResolvedValue([
      { nodeId: 'n1', label: 'MCU1', nodeType: 'mcu', positionX: 0, positionY: 0 },
      { nodeId: 'n2', label: 'MCU2', nodeType: 'mcu', positionX: 100, positionY: 0 },
      { nodeId: 'n3', label: 'LED', nodeType: 'led', positionX: 200, positionY: 0 },
    ]);
    mockStorage.getEdges.mockResolvedValue([]);

    const ctx = createContext();
    const result = await aiAnalysisExecutor({ projectId: 1, scope: 'architecture' }, ctx) as Record<string, unknown>;

    const arch = (result.analysis as Record<string, unknown>).architecture as Record<string, unknown>;
    const types = arch.nodeTypes as string[];
    expect(types).toHaveLength(2);
    expect(types).toContain('mcu');
    expect(types).toContain('led');
  });

  it('includes completedAt ISO timestamp in result', async () => {
    const ctx = createContext();
    const result = await aiAnalysisExecutor({ projectId: 1, scope: 'bom' }, ctx) as Record<string, unknown>;

    expect(result.completedAt).toBeDefined();
    expect(typeof result.completedAt).toBe('string');
    // Should be a valid ISO date
    expect(new Date(result.completedAt as string).toISOString()).toBe(result.completedAt);
  });

  it('handles empty nodes and edges', async () => {
    mockStorage.getNodes.mockResolvedValue([]);
    mockStorage.getEdges.mockResolvedValue([]);

    const ctx = createContext();
    const result = await aiAnalysisExecutor({ projectId: 1, scope: 'architecture' }, ctx) as Record<string, unknown>;

    const arch = (result.analysis as Record<string, unknown>).architecture as Record<string, unknown>;
    expect(arch.nodeCount).toBe(0);
    expect(arch.edgeCount).toBe(0);
    expect(arch.disconnectedNodes).toEqual([]);
    expect(arch.nodeTypes).toEqual([]);
  });

  it('counts info-severity validation issues as zero when none exist', async () => {
    mockStorage.getValidationIssues.mockResolvedValue([
      { severity: 'error', message: 'err1' },
    ]);

    const ctx = createContext();
    const result = await aiAnalysisExecutor({ projectId: 1, scope: 'validation' }, ctx) as Record<string, unknown>;

    const val = (result.analysis as Record<string, unknown>).validation as Record<string, unknown>;
    const bySev = val.bySeverity as Record<string, number>;
    expect(bySev.info).toBe(0);
    expect(bySev.error).toBe(1);
    expect(bySev.warning).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// export_generation executor
// ---------------------------------------------------------------------------

describe('exportGenerationExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getProject.mockResolvedValue({ id: 1, name: 'TestProject', description: 'A test project' });
    mockStorage.getNodes.mockResolvedValue([]);
    mockStorage.getEdges.mockResolvedValue([]);
    mockStorage.getBomItems.mockResolvedValue([]);
    mockStorage.getValidationIssues.mockResolvedValue([]);
  });

  it('generates BOM CSV export', async () => {
    const ctx = createContext();
    const result = await exportGenerationExecutor(
      { projectId: 1, format: 'bom-csv' },
      ctx,
    ) as Record<string, unknown>;

    expect(result.projectId).toBe(1);
    expect(result.format).toBe('bom-csv');
    const inner = result.result as Record<string, unknown>;
    expect(inner.mimeType).toBe('text/csv');
  });

  it('generates design report export', async () => {
    const ctx = createContext();
    const result = await exportGenerationExecutor(
      { projectId: 1, format: 'design-report' },
      ctx,
    ) as Record<string, unknown>;

    expect(result.format).toBe('design-report');
    const inner = result.result as Record<string, unknown>;
    expect(inner.mimeType).toBe('text/markdown');
  });

  it('returns stub for unsupported format', async () => {
    const ctx = createContext();
    const result = await exportGenerationExecutor(
      { projectId: 1, format: 'gerber' },
      ctx,
    ) as Record<string, unknown>;

    const inner = result.result as Record<string, unknown>;
    expect(inner.status).toBe('generated');
    expect(inner.message).toContain('gerber');
  });

  it('throws when project not found', async () => {
    mockStorage.getProject.mockResolvedValue(undefined);
    const ctx = createContext();

    await expect(
      exportGenerationExecutor({ projectId: 999, format: 'bom-csv' }, ctx),
    ).rejects.toThrow('Project 999 not found');
  });

  it('reports progress', async () => {
    const ctx = createContext();
    await exportGenerationExecutor({ projectId: 1, format: 'bom-csv' }, ctx);

    expect(ctx.reportProgress).toHaveBeenCalledWith(5);
    expect(ctx.reportProgress).toHaveBeenCalledWith(30);
    expect(ctx.reportProgress).toHaveBeenCalledWith(100);
  });

  it('throws when signal is already aborted', async () => {
    const ctx = createAbortedContext();
    await expect(
      exportGenerationExecutor({ projectId: 1, format: 'bom-csv' }, ctx),
    ).rejects.toThrow('Job aborted');
  });

  it('includes completedAt in result', async () => {
    const ctx = createContext();
    const result = await exportGenerationExecutor(
      { projectId: 1, format: 'bom-csv' },
      ctx,
    ) as Record<string, unknown>;

    expect(result.completedAt).toBeDefined();
    expect(new Date(result.completedAt as string).toISOString()).toBe(result.completedAt);
  });

  it('generates BOM CSV with correct filename derived from project name', async () => {
    const ctx = createContext();
    const result = await exportGenerationExecutor(
      { projectId: 1, format: 'bom-csv' },
      ctx,
    ) as Record<string, unknown>;

    const inner = result.result as Record<string, unknown>;
    expect(inner.filename).toBe('TestProject_BOM.csv');
    expect(inner.encoding).toBe('utf8');
  });

  it('passes BOM items to exporter', async () => {
    mockStorage.getBomItems.mockResolvedValue([
      { partNumber: 'R1', totalPrice: '0.10', quantity: 10 },
    ]);

    const ctx = createContext();
    await exportGenerationExecutor({ projectId: 1, format: 'bom-csv' }, ctx);

    const { exportBom } = await import('../../export/bom-exporter');
    expect(exportBom).toHaveBeenCalledWith(
      [{ partNumber: 'R1', totalPrice: '0.10', quantity: 10 }],
      { format: 'generic' },
    );
  });

  it('returns stub with format and options for non-bom/non-report formats', async () => {
    const ctx = createContext();
    const result = await exportGenerationExecutor(
      { projectId: 1, format: 'spice', options: { includeModels: true } },
      ctx,
    ) as Record<string, unknown>;

    const inner = result.result as Record<string, unknown>;
    expect(inner.format).toBe('spice');
    expect(inner.options).toEqual({ includeModels: true });
    expect(inner.projectId).toBe(1);
  });

  it('fetches all project data in parallel', async () => {
    const ctx = createContext();
    await exportGenerationExecutor({ projectId: 1, format: 'gerber' }, ctx);

    expect(mockStorage.getProject).toHaveBeenCalledWith(1);
    expect(mockStorage.getNodes).toHaveBeenCalledWith(1);
    expect(mockStorage.getEdges).toHaveBeenCalledWith(1);
    expect(mockStorage.getBomItems).toHaveBeenCalledWith(1);
    expect(mockStorage.getValidationIssues).toHaveBeenCalledWith(1);
  });

  it('maps node data correctly for design-report format', async () => {
    mockStorage.getNodes.mockResolvedValue([
      { nodeId: 'n1', label: 'MCU', nodeType: 'mcu', positionX: 10, positionY: 20, data: { chip: 'ATmega' } },
    ]);
    mockStorage.getEdges.mockResolvedValue([
      { edgeId: 'e1', source: 'n1', target: 'n2', label: 'I2C', signalType: 'digital', voltage: '3.3V', busWidth: 2, netName: 'I2C_BUS' },
    ]);

    const ctx = createContext();
    await exportGenerationExecutor({ projectId: 1, format: 'design-report' }, ctx);

    const { generateDesignReportMd } = await import('../../export/design-report');
    expect(generateDesignReportMd).toHaveBeenCalledTimes(1);

    const callArg = (generateDesignReportMd as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.projectName).toBe('TestProject');
    const nodes = callArg.nodes as Array<Record<string, unknown>>;
    expect(nodes[0].nodeId).toBe('n1');
    expect(nodes[0].data).toEqual({ chip: 'ATmega' });
  });
});

// ---------------------------------------------------------------------------
// batch_drc executor
// ---------------------------------------------------------------------------

describe('batchDrcExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getComponentParts.mockResolvedValue([]);
    mockStorage.bulkCreateValidationIssues.mockResolvedValue([]);
  });

  it('runs DRC on component parts', async () => {
    mockStorage.getComponentParts.mockResolvedValue([
      {
        id: 1,
        meta: { title: 'Resistor', tags: [], mountingType: 'smd', properties: [], views: { schematic: { shapes: [] } } },
        connectors: [],
      },
    ]);

    const ctx = createContext();
    const result = await batchDrcExecutor({ projectId: 1, view: 'schematic' }, ctx) as Record<string, unknown>;

    expect(result.projectId).toBe(1);
    expect(result.partsChecked).toBe(1);
    expect(result.violationCount).toBe(0);
  });

  it('returns zero violations when no parts exist', async () => {
    const ctx = createContext();
    const result = await batchDrcExecutor({ projectId: 1 }, ctx) as Record<string, unknown>;

    expect(result.partsChecked).toBe(0);
    expect(result.violationCount).toBe(0);
    expect(result.partsWithViolations).toBe(0);
  });

  it('stores violations as validation issues', async () => {
    const { runDRC } = await import('@shared/drc-engine');
    (runDRC as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      { id: 'v1', ruleType: 'min-clearance', severity: 'error', message: 'Too close' },
    ]);

    mockStorage.getComponentParts.mockResolvedValue([
      {
        id: 42,
        meta: {
          title: 'Cap',
          tags: [],
          mountingType: 'smd',
          properties: [],
          views: { schematic: { shapes: [{ id: 's1', type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0 }] } },
        },
        connectors: [],
      },
    ]);

    const ctx = createContext();
    const result = await batchDrcExecutor({ projectId: 1, view: 'schematic' }, ctx) as Record<string, unknown>;

    expect(result.violationCount).toBe(1);
    expect(result.partsWithViolations).toBe(1);
    expect(mockStorage.bulkCreateValidationIssues).toHaveBeenCalledTimes(1);
  });

  it('skips parts with malformed data gracefully', async () => {
    const { runDRC } = await import('@shared/drc-engine');
    (runDRC as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('Bad shape');
    });

    mockStorage.getComponentParts.mockResolvedValue([
      {
        id: 1,
        meta: {
          title: 'Bad',
          tags: [],
          mountingType: '',
          properties: [],
          views: { schematic: { shapes: [{ id: 's1', type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0 }] } },
        },
        connectors: [],
      },
    ]);

    const ctx = createContext();
    const result = await batchDrcExecutor({ projectId: 1 }, ctx) as Record<string, unknown>;

    expect(result.partsChecked).toBe(1);
    expect(result.violationCount).toBe(0);
  });

  it('reports progress proportional to parts processed', async () => {
    mockStorage.getComponentParts.mockResolvedValue([
      { id: 1, meta: { title: 'R1', tags: [], mountingType: '', properties: [], views: {} }, connectors: [] },
      { id: 2, meta: { title: 'R2', tags: [], mountingType: '', properties: [], views: {} }, connectors: [] },
    ]);

    const ctx = createContext();
    await batchDrcExecutor({ projectId: 1 }, ctx);

    expect(ctx.reportProgress).toHaveBeenCalledWith(5);
    expect(ctx.reportProgress).toHaveBeenCalledWith(20);
    expect(ctx.reportProgress).toHaveBeenCalledWith(100);
  });

  it('throws when signal is already aborted', async () => {
    const ctx = createAbortedContext();
    await expect(batchDrcExecutor({ projectId: 1 }, ctx)).rejects.toThrow('Job aborted');
  });

  it('uses default DRC rules when none provided', async () => {
    mockStorage.getComponentParts.mockResolvedValue([
      {
        id: 1,
        meta: {
          title: 'R1',
          tags: [],
          mountingType: 'smd',
          properties: [],
          views: { schematic: { shapes: [{ id: 's1', type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0 }] } },
        },
        connectors: [],
      },
    ]);

    const ctx = createContext();
    await batchDrcExecutor({ projectId: 1 }, ctx);

    const { getDefaultDRCRules, runDRC } = await import('@shared/drc-engine');
    expect(getDefaultDRCRules).toHaveBeenCalled();
    expect(runDRC).toHaveBeenCalled();
  });

  it('uses custom rules when provided in payload', async () => {
    mockStorage.getComponentParts.mockResolvedValue([
      {
        id: 1,
        meta: {
          title: 'R1',
          tags: [],
          mountingType: 'smd',
          properties: [],
          views: { schematic: { shapes: [{ id: 's1', type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0 }] } },
        },
        connectors: [],
      },
    ]);

    const customRules = [
      { type: 'min-clearance', severity: 'warning' as const, enabled: true, params: { minClearance: 0.5 } },
    ];

    const ctx = createContext();
    await batchDrcExecutor({ projectId: 1, rules: customRules }, ctx);

    const { runDRC } = await import('@shared/drc-engine');
    const lastCall = (runDRC as ReturnType<typeof vi.fn>).mock.calls[0];
    const passedRules = lastCall[1] as Array<{ type: string; severity: string }>;
    expect(passedRules[0].type).toBe('min-clearance');
    expect(passedRules[0].severity).toBe('warning');
  });

  it('handles parts with array-type view entries', async () => {
    mockStorage.getComponentParts.mockResolvedValue([
      {
        id: 1,
        meta: {
          title: 'R1',
          tags: [],
          mountingType: 'smd',
          properties: [],
          views: { schematic: [{ id: 's1', type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0 }] },
        },
        connectors: [],
      },
    ]);

    const ctx = createContext();
    const result = await batchDrcExecutor({ projectId: 1, view: 'schematic' }, ctx) as Record<string, unknown>;

    const { runDRC } = await import('@shared/drc-engine');
    expect(runDRC).toHaveBeenCalled();
    expect(result.partsChecked).toBe(1);
  });

  it('handles multiple parts with violations from different parts', async () => {
    const { runDRC } = await import('@shared/drc-engine');
    (runDRC as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce([{ id: 'v1', ruleType: 'min-clearance', severity: 'error', message: 'Too close on part 1' }])
      .mockReturnValueOnce([
        { id: 'v2', ruleType: 'overlap', severity: 'warning', message: 'Overlap on part 2' },
        { id: 'v3', ruleType: 'min-width', severity: 'error', message: 'Trace too thin' },
      ]);

    mockStorage.getComponentParts.mockResolvedValue([
      {
        id: 10,
        meta: { title: 'P1', tags: [], mountingType: '', properties: [], views: { pcb: { shapes: [{ id: 's1', type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0 }] } } },
        connectors: [],
      },
      {
        id: 20,
        meta: { title: 'P2', tags: [], mountingType: '', properties: [], views: { pcb: { shapes: [{ id: 's2', type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0 }] } } },
        connectors: [],
      },
    ]);

    const ctx = createContext();
    const result = await batchDrcExecutor({ projectId: 1, view: 'pcb' }, ctx) as Record<string, unknown>;

    expect(result.partsChecked).toBe(2);
    expect(result.violationCount).toBe(3);
    expect(result.partsWithViolations).toBe(2);
  });

  it('does not store violations when none are found', async () => {
    mockStorage.getComponentParts.mockResolvedValue([
      {
        id: 1,
        meta: { title: 'R1', tags: [], mountingType: '', properties: [], views: { schematic: { shapes: [{ id: 's1', type: 'rect', x: 0, y: 0, width: 5, height: 5, rotation: 0 }] } } },
        connectors: [],
      },
    ]);

    const ctx = createContext();
    await batchDrcExecutor({ projectId: 1 }, ctx);

    expect(mockStorage.bulkCreateValidationIssues).not.toHaveBeenCalled();
  });

  it('builds correct PartState with connectors for the target view', async () => {
    const { runDRC } = await import('@shared/drc-engine');

    mockStorage.getComponentParts.mockResolvedValue([
      {
        id: 5,
        meta: {
          title: 'IC1',
          tags: ['microcontroller'],
          mountingType: 'dip',
          properties: [{ key: 'pins', value: '28' }],
          views: {
            breadboard: { shapes: [{ id: 'bb1', type: 'rect', x: 0, y: 0, width: 20, height: 40, rotation: 0 }] },
            schematic: { shapes: [] },
            pcb: { shapes: [] },
          },
        },
        connectors: [{ id: 'pin1', name: 'VCC', type: 'male' }],
      },
    ]);

    const ctx = createContext();
    await batchDrcExecutor({ projectId: 1, view: 'breadboard' }, ctx);

    expect(runDRC).toHaveBeenCalledTimes(1);
    const callArgs = (runDRC as ReturnType<typeof vi.fn>).mock.calls[0];
    const partState = callArgs[0] as Record<string, unknown>;
    const meta = partState.meta as Record<string, unknown>;
    expect(meta.title).toBe('IC1');
    expect(meta.tags).toEqual(['microcontroller']);
    expect(callArgs[2]).toBe('breadboard');
  });

  it('includes completedAt timestamp in result', async () => {
    const ctx = createContext();
    const result = await batchDrcExecutor({ projectId: 1 }, ctx) as Record<string, unknown>;

    expect(result.completedAt).toBeDefined();
    expect(new Date(result.completedAt as string).toISOString()).toBe(result.completedAt);
  });

  it('handles parts with null meta gracefully', async () => {
    mockStorage.getComponentParts.mockResolvedValue([
      {
        id: 1,
        meta: null,
        connectors: [],
      },
    ]);

    const ctx = createContext();
    const result = await batchDrcExecutor({ projectId: 1 }, ctx) as Record<string, unknown>;

    // Part has no views, so no shapes to check — should just pass through
    expect(result.partsChecked).toBe(1);
    expect(result.violationCount).toBe(0);
  });

  it('handles parts with null connectors', async () => {
    mockStorage.getComponentParts.mockResolvedValue([
      {
        id: 1,
        meta: {
          title: 'R1',
          views: { schematic: { shapes: [{ id: 's1', type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0 }] } },
        },
        connectors: null,
      },
    ]);

    const ctx = createContext();
    const result = await batchDrcExecutor({ projectId: 1 }, ctx) as Record<string, unknown>;

    expect(result.partsChecked).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// report_generation executor
// ---------------------------------------------------------------------------

describe('reportGenerationExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getProject.mockResolvedValue({ id: 1, name: 'TestProject', description: 'desc' });
    mockStorage.getNodes.mockResolvedValue([]);
    mockStorage.getEdges.mockResolvedValue([]);
    mockStorage.getBomItems.mockResolvedValue([]);
    mockStorage.getValidationIssues.mockResolvedValue([]);
  });

  it('generates design report', async () => {
    const ctx = createContext();
    const result = await reportGenerationExecutor(
      { projectId: 1, reportType: 'design' },
      ctx,
    ) as Record<string, unknown>;

    expect(result.projectId).toBe(1);
    expect(result.reportType).toBe('design');
    const inner = result.result as Record<string, unknown>;
    expect(inner.mimeType).toBe('text/markdown');
  });

  it('generates FMEA report', async () => {
    const ctx = createContext();
    const result = await reportGenerationExecutor(
      { projectId: 1, reportType: 'fmea' },
      ctx,
    ) as Record<string, unknown>;

    expect(result.reportType).toBe('fmea');
    const inner = result.result as Record<string, unknown>;
    expect(inner.mimeType).toBe('text/csv');
  });

  it('returns stub for unsupported report type', async () => {
    const ctx = createContext();
    const result = await reportGenerationExecutor(
      { projectId: 1, reportType: 'pdf' },
      ctx,
    ) as Record<string, unknown>;

    const inner = result.result as Record<string, unknown>;
    expect(inner.status).toBe('generated');
    expect(inner.message).toContain('pdf');
  });

  it('throws when project not found', async () => {
    mockStorage.getProject.mockResolvedValue(undefined);
    const ctx = createContext();

    await expect(
      reportGenerationExecutor({ projectId: 999, reportType: 'design' }, ctx),
    ).rejects.toThrow('Project 999 not found');
  });

  it('reports progress', async () => {
    const ctx = createContext();
    await reportGenerationExecutor({ projectId: 1, reportType: 'fmea' }, ctx);

    expect(ctx.reportProgress).toHaveBeenCalledWith(5);
    expect(ctx.reportProgress).toHaveBeenCalledWith(30);
    expect(ctx.reportProgress).toHaveBeenCalledWith(100);
  });

  it('throws when signal is already aborted', async () => {
    const ctx = createAbortedContext();
    await expect(
      reportGenerationExecutor({ projectId: 1, reportType: 'design' }, ctx),
    ).rejects.toThrow('Job aborted');
  });

  it('includes completedAt in result', async () => {
    const ctx = createContext();
    const result = await reportGenerationExecutor(
      { projectId: 1, reportType: 'design' },
      ctx,
    ) as Record<string, unknown>;

    expect(result.completedAt).toBeDefined();
    expect(new Date(result.completedAt as string).toISOString()).toBe(result.completedAt);
  });

  it('fetches BOM items only for design report type', async () => {
    const ctx = createContext();
    await reportGenerationExecutor({ projectId: 1, reportType: 'design' }, ctx);

    expect(mockStorage.getBomItems).toHaveBeenCalledWith(1);
  });

  it('does not fetch BOM items for FMEA report type', async () => {
    const ctx = createContext();
    await reportGenerationExecutor({ projectId: 1, reportType: 'fmea' }, ctx);

    expect(mockStorage.getBomItems).not.toHaveBeenCalled();
  });

  it('handles null project description gracefully for design report', async () => {
    mockStorage.getProject.mockResolvedValue({ id: 1, name: 'NoDesc', description: null });

    const ctx = createContext();
    await reportGenerationExecutor({ projectId: 1, reportType: 'design' }, ctx);

    const { generateDesignReportMd } = await import('../../export/design-report');
    const callArg = (generateDesignReportMd as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.projectDescription).toBe('');
  });

  it('returns firmware-scaffold as stub', async () => {
    const ctx = createContext();
    const result = await reportGenerationExecutor(
      { projectId: 1, reportType: 'firmware-scaffold' },
      ctx,
    ) as Record<string, unknown>;

    const inner = result.result as Record<string, unknown>;
    expect(inner.status).toBe('generated');
    expect(inner.message).toContain('firmware-scaffold');
  });

  it('maps edge data correctly for FMEA report', async () => {
    mockStorage.getEdges.mockResolvedValue([
      {
        edgeId: 'e1', source: 'n1', target: 'n2',
        label: 'PWR', signalType: 'power', voltage: '5V', busWidth: 1, netName: 'VCC',
      },
    ]);

    const ctx = createContext();
    await reportGenerationExecutor({ projectId: 1, reportType: 'fmea' }, ctx);

    const { generateFmeaReport } = await import('../../export/fmea-generator');
    const callArg = (generateFmeaReport as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    const edges = callArg.edges as Array<Record<string, unknown>>;
    expect(edges[0].netName).toBe('VCC');
    expect(edges[0].signalType).toBe('power');
  });
});

// ---------------------------------------------------------------------------
// import_processing executor
// ---------------------------------------------------------------------------

describe('importProcessingExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getProject.mockResolvedValue({ id: 1, name: 'TestProject' });
    mockStorage.createHistoryItem.mockResolvedValue({ id: 1 });
  });

  it('processes an import and creates history item', async () => {
    const ctx = createContext();
    const result = await importProcessingExecutor(
      { projectId: 1, format: 'kicad', data: '<kicad content>', filename: 'circuit.kicad_sch' },
      ctx,
    ) as Record<string, unknown>;

    expect(result.projectId).toBe(1);
    expect(result.format).toBe('kicad');
    expect(result.filename).toBe('circuit.kicad_sch');
    expect(result.status).toBe('processed');

    expect(mockStorage.createHistoryItem).toHaveBeenCalledWith({
      projectId: 1,
      action: 'import:kicad:circuit.kicad_sch',
      user: 'system',
    });
  });

  it('throws when project not found', async () => {
    mockStorage.getProject.mockResolvedValue(undefined);
    const ctx = createContext();

    await expect(
      importProcessingExecutor(
        { projectId: 999, format: 'eagle', data: 'content', filename: 'test.sch' },
        ctx,
      ),
    ).rejects.toThrow('Project 999 not found');
  });

  it('returns metadata about the import', async () => {
    const ctx = createContext();
    const result = await importProcessingExecutor(
      { projectId: 1, format: 'altium', data: 'some altium data', filename: 'board.PcbDoc' },
      ctx,
    ) as Record<string, unknown>;

    const meta = result.metadata as Record<string, unknown>;
    expect(meta.format).toBe('altium');
    expect(meta.filename).toBe('board.PcbDoc');
    expect(meta.dataLength).toBe(16);
    expect(meta.importedAt).toBeDefined();
  });

  it('reports progress', async () => {
    const ctx = createContext();
    await importProcessingExecutor(
      { projectId: 1, format: 'kicad', data: 'x', filename: 'f.sch' },
      ctx,
    );

    expect(ctx.reportProgress).toHaveBeenCalledWith(5);
    expect(ctx.reportProgress).toHaveBeenCalledWith(15);
    expect(ctx.reportProgress).toHaveBeenCalledWith(50);
    expect(ctx.reportProgress).toHaveBeenCalledWith(100);
  });

  it('throws when signal is already aborted', async () => {
    const ctx = createAbortedContext();
    await expect(
      importProcessingExecutor(
        { projectId: 1, format: 'kicad', data: 'x', filename: 'f.sch' },
        ctx,
      ),
    ).rejects.toThrow('Job aborted');
  });

  it('includes completedAt in result', async () => {
    const ctx = createContext();
    const result = await importProcessingExecutor(
      { projectId: 1, format: 'kicad', data: 'x', filename: 'f.sch' },
      ctx,
    ) as Record<string, unknown>;

    expect(result.completedAt).toBeDefined();
    expect(new Date(result.completedAt as string).toISOString()).toBe(result.completedAt);
  });

  it('records history action with correct format and filename', async () => {
    const ctx = createContext();
    await importProcessingExecutor(
      { projectId: 1, format: 'eagle', data: 'eagle data', filename: 'board.brd' },
      ctx,
    );

    expect(mockStorage.createHistoryItem).toHaveBeenCalledWith({
      projectId: 1,
      action: 'import:eagle:board.brd',
      user: 'system',
    });
  });

  it('calculates dataLength correctly from data string', async () => {
    const data = 'a'.repeat(1000);
    const ctx = createContext();
    const result = await importProcessingExecutor(
      { projectId: 1, format: 'generic', data, filename: 'big.sch' },
      ctx,
    ) as Record<string, unknown>;

    const meta = result.metadata as Record<string, unknown>;
    expect(meta.dataLength).toBe(1000);
  });

  it('processes all supported import formats', async () => {
    const formats = ['kicad', 'eagle', 'altium', 'geda', 'ltspice', 'proteus', 'orcad', 'generic'] as const;

    for (const format of formats) {
      vi.clearAllMocks();
      mockStorage.getProject.mockResolvedValue({ id: 1, name: 'Test' });
      mockStorage.createHistoryItem.mockResolvedValue({ id: 1 });

      const ctx = createContext();
      const result = await importProcessingExecutor(
        { projectId: 1, format, data: 'content', filename: `test.${format}` },
        ctx,
      ) as Record<string, unknown>;

      expect(result.format).toBe(format);
      expect(result.status).toBe('processed');
    }
  });
});

// ---------------------------------------------------------------------------
// registerAllExecutors
// ---------------------------------------------------------------------------

describe('registerAllExecutors', () => {
  let queue: JobQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new JobQueue({ concurrency: 1, cleanupIntervalMs: 999_999 });
  });

  afterEach(() => {
    queue.shutdown();
    vi.useRealTimers();
  });

  it('registers executors for all 5 job types', async () => {
    registerAllExecutors(queue);

    // Submit a job of each type — none should fail with "No executor registered"
    const types = ['ai_analysis', 'export_generation', 'batch_drc', 'report_generation', 'import_processing'] as const;

    for (const type of types) {
      // Submit with projectId required by all payloads
      const job = queue.submit(type, { projectId: 1 });
      expect(job.status).toBe('pending');
    }
  });

  it('uses the singleton queue when no argument provided', () => {
    // Should not throw
    expect(() => registerAllExecutors()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateExecutorRegistration
// ---------------------------------------------------------------------------

describe('validateExecutorRegistration', () => {
  let queue: JobQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new JobQueue({ concurrency: 1, cleanupIntervalMs: 999_999 });
  });

  afterEach(() => {
    queue.shutdown();
    vi.useRealTimers();
  });

  it('returns empty array when all executors are present', () => {
    registerAllExecutors(queue);
    const missing = validateExecutorRegistration(queue);
    expect(missing).toEqual([]);
  });

  it('validates against the singleton queue when no argument provided', () => {
    const missing = validateExecutorRegistration();
    expect(missing).toEqual([]);
  });
});
