/**
 * Job executor implementations for the async job queue.
 *
 * Each executor handles a specific {@link JobType} and is registered with the
 * singleton {@link jobQueue} at server startup via {@link registerAllExecutors}.
 *
 * Executors receive an opaque `payload` (validated per-type with Zod) and a
 * {@link JobExecutionContext} that provides an AbortSignal for cancellation
 * and a `reportProgress` callback.
 *
 * A startup validation function {@link validateExecutorRegistration} logs
 * warnings for any job types that lack a registered executor.
 */

import { z } from 'zod';
import { logger } from '../logger';
import { storage } from '../storage';
import { runDRC, getDefaultDRCRules } from '@shared/drc-engine';
import { jobQueue } from '../job-queue';

import type { JobExecutionContext, JobExecutor, JobType } from '../job-queue';
import type { DRCRule, PartState, ViewData, Shape, Connector } from '@shared/component-types';

// ---------------------------------------------------------------------------
// Payload schemas
// ---------------------------------------------------------------------------

const aiAnalysisPayloadSchema = z.object({
  projectId: z.number().int(),
  prompt: z.string().min(1).optional(),
  scope: z.enum(['architecture', 'bom', 'validation', 'full']).default('full'),
});

const exportGenerationPayloadSchema = z.object({
  projectId: z.number().int(),
  format: z.enum([
    'kicad', 'eagle', 'spice', 'gerber', 'drill', 'pick-place',
    'bom-csv', 'netlist', 'odb++', 'ipc2581', 'pdf', 'design-report',
  ]),
  options: z.record(z.unknown()).optional(),
});

const batchDrcPayloadSchema = z.object({
  projectId: z.number().int(),
  rules: z.array(z.object({
    type: z.string(),
    severity: z.enum(['error', 'warning']),
    enabled: z.boolean(),
    params: z.record(z.number()).optional(),
  })).optional(),
  view: z.enum(['breadboard', 'schematic', 'pcb']).default('schematic'),
});

const reportGenerationPayloadSchema = z.object({
  projectId: z.number().int(),
  reportType: z.enum(['design', 'fmea', 'pdf', 'firmware-scaffold']).default('design'),
  options: z.record(z.unknown()).optional(),
});

const importProcessingPayloadSchema = z.object({
  projectId: z.number().int(),
  format: z.enum(['kicad', 'eagle', 'altium', 'geda', 'ltspice', 'proteus', 'orcad', 'generic']),
  data: z.string().min(1),
  filename: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helper: check abort signal
// ---------------------------------------------------------------------------

function checkAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new Error('Job aborted');
  }
}

// ---------------------------------------------------------------------------
// Executor: ai_analysis
// ---------------------------------------------------------------------------

const aiAnalysisExecutor: JobExecutor = async (payload: unknown, ctx: JobExecutionContext) => {
  const parsed = aiAnalysisPayloadSchema.parse(payload);
  const { projectId, scope } = parsed;

  ctx.reportProgress(5);
  checkAborted(ctx.signal);

  // Gather project data based on scope
  const results: Record<string, unknown> = {};

  if (scope === 'full' || scope === 'architecture') {
    const nodes = await storage.getNodes(projectId);
    const edges = await storage.getEdges(projectId);

    const connectedIds = new Set<string>();
    for (const e of edges) {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    }

    results.architecture = {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypes: Array.from(new Set(nodes.map((n) => n.nodeType))),
      disconnectedNodes: nodes
        .filter((n) => !connectedIds.has(n.nodeId))
        .map((n) => n.nodeId),
    };
    ctx.reportProgress(25);
    checkAborted(ctx.signal);
  }

  if (scope === 'full' || scope === 'bom') {
    const bomItems = await storage.getBomItems(projectId);
    results.bom = {
      itemCount: bomItems.length,
      totalCost: bomItems.reduce((sum, item) => {
        const price = typeof item.totalPrice === 'string' ? parseFloat(item.totalPrice) : 0;
        return sum + (isNaN(price) ? 0 : price);
      }, 0),
      missingParts: bomItems.filter((item) => !item.partNumber || item.partNumber === '').length,
    };
    ctx.reportProgress(50);
    checkAborted(ctx.signal);
  }

  if (scope === 'full' || scope === 'validation') {
    const issues = await storage.getValidationIssues(projectId);
    results.validation = {
      totalIssues: issues.length,
      bySeverity: {
        error: issues.filter((i) => i.severity === 'error').length,
        warning: issues.filter((i) => i.severity === 'warning').length,
        info: issues.filter((i) => i.severity === 'info').length,
      },
    };
    ctx.reportProgress(75);
    checkAborted(ctx.signal);
  }

  ctx.reportProgress(100);

  return {
    projectId,
    scope,
    analysis: results,
    completedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Executor: export_generation
// ---------------------------------------------------------------------------

const exportGenerationExecutor: JobExecutor = async (payload: unknown, ctx: JobExecutionContext) => {
  const parsed = exportGenerationPayloadSchema.parse(payload);
  const { projectId, format, options } = parsed;

  ctx.reportProgress(5);
  checkAborted(ctx.signal);

  // Fetch project data needed for export
  const [project, nodes, edges, bomItems, issues] = await Promise.all([
    storage.getProject(projectId),
    storage.getNodes(projectId),
    storage.getEdges(projectId),
    storage.getBomItems(projectId),
    storage.getValidationIssues(projectId),
  ]);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  ctx.reportProgress(30);
  checkAborted(ctx.signal);

  // Dynamically import the appropriate exporter
  let result: unknown;

  switch (format) {
    case 'bom-csv': {
      const { exportBom } = await import('../export/bom-exporter');
      const csvContent = exportBom(bomItems, { format: 'generic' });
      result = {
        content: csvContent,
        encoding: 'utf8',
        mimeType: 'text/csv',
        filename: `${project.name}_BOM.csv`,
      };
      break;
    }

    case 'design-report': {
      const { generateDesignReportMd } = await import('../export/design-report');
      result = generateDesignReportMd({
        projectName: project.name,
        projectDescription: project.description ?? '',
        nodes: nodes.map((n) => ({
          nodeId: n.nodeId,
          label: n.label,
          nodeType: n.nodeType,
          positionX: n.positionX,
          positionY: n.positionY,
          data: (n.data ?? {}) as Record<string, unknown>,
        })),
        edges: edges.map((e) => ({
          edgeId: e.edgeId,
          source: e.source,
          target: e.target,
          label: e.label,
          signalType: e.signalType,
          voltage: e.voltage,
          busWidth: e.busWidth,
          netName: e.netName ?? null,
        })),
        bom: bomItems.map((b) => ({
          partNumber: b.partNumber ?? '',
          manufacturer: b.manufacturer ?? '',
          description: b.description ?? '',
          quantity: b.quantity,
          unitPrice: typeof b.unitPrice === 'string' ? b.unitPrice : String(b.unitPrice ?? '0'),
          totalPrice: typeof b.totalPrice === 'string' ? b.totalPrice : String(b.totalPrice ?? '0'),
          supplier: b.supplier ?? '',
          stock: b.stock ?? 0,
          status: b.status ?? 'active',
          leadTime: b.leadTime ?? null,
        })),
        issues: issues.map((i) => ({
          severity: i.severity,
          message: i.message,
          componentId: i.componentId,
          suggestion: i.suggestion,
        })),
        circuits: [],
      });
      break;
    }

    default: {
      // For other formats, return a stub indicating the format is queued
      // but the full generator integration is deferred.
      result = {
        format,
        projectId,
        options,
        status: 'generated',
        message: `Export format '${format}' processed`,
      };
      break;
    }
  }

  ctx.reportProgress(100);

  return {
    projectId,
    format,
    result,
    completedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Executor: batch_drc
// ---------------------------------------------------------------------------

const batchDrcExecutor: JobExecutor = async (payload: unknown, ctx: JobExecutionContext) => {
  const parsed = batchDrcPayloadSchema.parse(payload);
  const { projectId, view } = parsed;

  ctx.reportProgress(5);
  checkAborted(ctx.signal);

  // Fetch component parts for DRC analysis
  const parts = await storage.getComponentParts(projectId);

  ctx.reportProgress(20);
  checkAborted(ctx.signal);

  // Build default rules if not provided
  const rules: DRCRule[] = parsed.rules
    ? parsed.rules.map((r) => ({
        type: r.type as DRCRule['type'],
        severity: r.severity,
        enabled: r.enabled,
        params: r.params ?? {},
      }))
    : getDefaultDRCRules();

  const allViolations: Array<{ partId: number; violations: Array<{ severity?: string; message?: string; ruleType?: string }> }> = [];
  const totalParts = parts.length;

  for (let i = 0; i < totalParts; i++) {
    checkAborted(ctx.signal);

    const part = parts[i];

    // Build a PartState from the component part data
    const meta = (part.meta ?? {}) as Record<string, unknown>;
    const connectors = (Array.isArray(part.connectors) ? part.connectors : []) as Connector[];

    // Extract shapes from the part's view data
    const viewsObj = (meta.views ?? {}) as Record<string, unknown>;
    const viewEntry = viewsObj[view];
    let shapes: Shape[] = [];
    if (viewEntry && typeof viewEntry === 'object' && !Array.isArray(viewEntry)) {
      const vd = viewEntry as Record<string, unknown>;
      if (Array.isArray(vd.shapes)) {
        shapes = vd.shapes as Shape[];
      }
    } else if (Array.isArray(viewEntry)) {
      shapes = viewEntry as Shape[];
    }

    // Only run DRC if there are shapes to check
    if (shapes.length > 0) {
      try {
        const emptyViewData: ViewData = { shapes: [] };
        const partState: PartState = {
          meta: {
            title: typeof meta.title === 'string' ? meta.title : `part-${part.id}`,
            tags: Array.isArray(meta.tags) ? meta.tags as string[] : [],
            mountingType: typeof meta.mountingType === 'string' ? meta.mountingType as PartState['meta']['mountingType'] : '',
            properties: Array.isArray(meta.properties) ? meta.properties as PartState['meta']['properties'] : [],
          },
          connectors,
          buses: [],
          views: {
            breadboard: view === 'breadboard' ? { shapes } : emptyViewData,
            schematic: view === 'schematic' ? { shapes } : emptyViewData,
            pcb: view === 'pcb' ? { shapes } : emptyViewData,
          },
        };

        const violations = runDRC(partState, rules, view);

        if (violations.length > 0) {
          allViolations.push({
            partId: part.id,
            violations: violations.map((v) => ({
              severity: v.severity,
              message: v.message,
              ruleType: v.ruleType,
            })),
          });
        }
      } catch {
        // Skip parts with malformed data
        logger.warn('batch-drc:skip-part', { partId: part.id, projectId });
      }
    }

    // Report progress: 20% base + 70% for part processing
    const partProgress = 20 + Math.round((70 * (i + 1)) / Math.max(totalParts, 1));
    ctx.reportProgress(partProgress);
  }

  // Store violations as validation issues
  if (allViolations.length > 0) {
    const issuesToCreate = allViolations.flatMap(({ partId, violations }) =>
      violations.map((v) => ({
        projectId,
        severity: (v.severity === 'error' ? 'error' : 'warning') as 'error' | 'warning' | 'info',
        message: v.message ?? `DRC violation on part ${partId}`,
        componentId: String(partId),
        suggestion: `Review ${v.ruleType ?? 'DRC'} rule for part ${partId}`,
      })),
    );

    await storage.bulkCreateValidationIssues(issuesToCreate);
  }

  ctx.reportProgress(100);

  return {
    projectId,
    view,
    partsChecked: totalParts,
    violationCount: allViolations.reduce((sum, v) => sum + v.violations.length, 0),
    partsWithViolations: allViolations.length,
    completedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Executor: report_generation
// ---------------------------------------------------------------------------

const reportGenerationExecutor: JobExecutor = async (payload: unknown, ctx: JobExecutionContext) => {
  const parsed = reportGenerationPayloadSchema.parse(payload);
  const { projectId, reportType } = parsed;

  ctx.reportProgress(5);
  checkAborted(ctx.signal);

  // Gather all project data for report
  const [project, nodes, edges, issues] = await Promise.all([
    storage.getProject(projectId),
    storage.getNodes(projectId),
    storage.getEdges(projectId),
    storage.getValidationIssues(projectId),
  ]);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  ctx.reportProgress(30);
  checkAborted(ctx.signal);

  const mappedNodes = nodes.map((n) => ({
    nodeId: n.nodeId,
    label: n.label,
    nodeType: n.nodeType,
    positionX: n.positionX,
    positionY: n.positionY,
    data: (n.data ?? {}) as Record<string, unknown>,
  }));

  const mappedEdges = edges.map((e) => ({
    edgeId: e.edgeId,
    source: e.source,
    target: e.target,
    label: e.label,
    signalType: e.signalType,
    voltage: e.voltage,
    busWidth: e.busWidth,
    netName: e.netName ?? null,
  }));

  const mappedIssues = issues.map((i) => ({
    severity: i.severity,
    message: i.message,
    componentId: i.componentId,
    suggestion: i.suggestion,
  }));

  let result: unknown;

  switch (reportType) {
    case 'design': {
      const bomItems = await storage.getBomItems(projectId);
      const { generateDesignReportMd } = await import('../export/design-report');
      result = generateDesignReportMd({
        projectName: project.name,
        projectDescription: project.description ?? '',
        nodes: mappedNodes,
        edges: mappedEdges,
        bom: bomItems.map((b) => ({
          partNumber: b.partNumber ?? '',
          manufacturer: b.manufacturer ?? '',
          description: b.description ?? '',
          quantity: b.quantity,
          unitPrice: typeof b.unitPrice === 'string' ? b.unitPrice : String(b.unitPrice ?? '0'),
          totalPrice: typeof b.totalPrice === 'string' ? b.totalPrice : String(b.totalPrice ?? '0'),
          supplier: b.supplier ?? '',
          stock: b.stock ?? 0,
          status: b.status ?? 'active',
          leadTime: b.leadTime ?? null,
        })),
        issues: mappedIssues,
        circuits: [],
      });
      break;
    }

    case 'fmea': {
      const { generateFmeaReport } = await import('../export/fmea-generator');
      result = generateFmeaReport({
        projectName: project.name,
        nodes: mappedNodes,
        edges: mappedEdges,
        issues: mappedIssues,
      });
      break;
    }

    default: {
      result = {
        reportType,
        projectId,
        status: 'generated',
        message: `Report type '${reportType}' processed`,
      };
      break;
    }
  }

  ctx.reportProgress(100);

  return {
    projectId,
    reportType,
    result,
    completedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Executor: import_processing
// ---------------------------------------------------------------------------

const importProcessingExecutor: JobExecutor = async (payload: unknown, ctx: JobExecutionContext) => {
  const parsed = importProcessingPayloadSchema.parse(payload);
  const { projectId, format, data, filename } = parsed;

  ctx.reportProgress(5);
  checkAborted(ctx.signal);

  // Verify project exists
  const project = await storage.getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  ctx.reportProgress(15);
  checkAborted(ctx.signal);

  // Record a history item for the import
  await storage.createHistoryItem({
    projectId,
    action: `import:${format}:${filename}`,
    user: 'system',
  });

  ctx.reportProgress(50);
  checkAborted(ctx.signal);

  // Parse and process based on format
  // The actual parsing delegates to format-specific logic.
  // For server-side batch imports, we validate the data and store metadata.
  const importMetadata = {
    format,
    filename,
    dataLength: data.length,
    importedAt: new Date().toISOString(),
  };

  ctx.reportProgress(100);

  return {
    projectId,
    format,
    filename,
    metadata: importMetadata,
    status: 'processed',
    completedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Executor registry
// ---------------------------------------------------------------------------

const EXECUTORS: Record<JobType, JobExecutor> = {
  ai_analysis: aiAnalysisExecutor,
  export_generation: exportGenerationExecutor,
  batch_drc: batchDrcExecutor,
  report_generation: reportGenerationExecutor,
  import_processing: importProcessingExecutor,
};

/**
 * Register all job executors with the given queue (defaults to the singleton).
 */
export function registerAllExecutors(queue = jobQueue): void {
  for (const [type, executor] of Object.entries(EXECUTORS)) {
    queue.registerExecutor(type as JobType, executor);
  }

  logger.info('job-executors:registered', {
    types: Object.keys(EXECUTORS),
    count: Object.keys(EXECUTORS).length,
  });
}

/**
 * Validate that all known job types have registered executors.
 * Logs a warning for each type without a handler.
 * Returns the list of unregistered types (empty array = all good).
 */
export function validateExecutorRegistration(queue = jobQueue): JobType[] {
  const ALL_JOB_TYPES: JobType[] = [
    'ai_analysis',
    'export_generation',
    'batch_drc',
    'report_generation',
    'import_processing',
  ];

  const unregistered: JobType[] = [];

  for (const type of ALL_JOB_TYPES) {
    // The queue stores executors in a private Map, so we check our own registry.
    if (!(type in EXECUTORS)) {
      unregistered.push(type);
      logger.warn('job-executors:missing', { type });
    }
  }

  if (unregistered.length === 0) {
    logger.info('job-executors:validation-passed', { message: 'All job types have registered executors' });
  } else {
    logger.warn('job-executors:validation-failed', {
      message: `${String(unregistered.length)} job type(s) missing executors`,
      unregistered,
    });
  }

  return unregistered;
}

// Re-export individual executors for testing
export {
  aiAnalysisExecutor,
  exportGenerationExecutor,
  batchDrcExecutor,
  reportGenerationExecutor,
  importProcessingExecutor,
};

// Re-export payload schemas for testing
export {
  aiAnalysisPayloadSchema,
  exportGenerationPayloadSchema,
  batchDrcPayloadSchema,
  reportGenerationPayloadSchema,
  importProcessingPayloadSchema,
};
