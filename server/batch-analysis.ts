/**
 * Background analysis integration using Genkit (Gemini).
 * Simulates the batch API interface for backward compatibility.
 */
import { storage } from './storage';
import { logger } from './logger';
import { ai } from './genkit';
import { googleAI } from '@genkit-ai/google-genai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnalysisKind =
  | 'architecture_review'
  | 'drc_deep_dive'
  | 'bom_optimization'
  | 'dfm_check'
  | 'security_audit'
  | 'thermal_analysis';

export interface BatchAnalysisRequest {
  projectId: number;
  analyses: AnalysisKind[];
  apiKey: string;
  model?: string;
}

export interface BatchAnalysisStatus {
  batchId: string;
  projectId: number;
  analyses: AnalysisKind[];
  status: 'in_progress' | 'completed' | 'canceled' | 'failed';
  createdAt: string;
  endedAt?: string;
  requestCounts?: {
    processing: number;
    succeeded: number;
    errored: number;
    canceled: number;
    expired: number;
  };
}

export interface AnalysisResult {
  kind: AnalysisKind;
  customId: string;
  status: 'succeeded' | 'errored' | 'canceled' | 'expired';
  resultText?: string;
  error?: string;
}

// In-memory mock for batch state (since we are doing it locally now)
interface LocalBatch {
  status: BatchAnalysisStatus;
  results: AnalysisResult[];
  promises: Promise<void>[];
  abortController: AbortController;
}

const activeBatches = new Map<string, LocalBatch>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function gatherProjectSnapshot(projectId: number) {
  const [project, nodes, edges, bom, validationIssues] = await Promise.all([
    storage.getProject(projectId),
    storage.getNodes(projectId),
    storage.getEdges(projectId),
    storage.getBomItems(projectId),
    storage.getValidationIssues(projectId),
  ]);

  return {
    projectName: project?.name,
    description: project?.description,
    nodes: nodes.map(n => ({ type: n.nodeType, label: n.label, data: n.data })),
    edges: edges.map(e => ({ source: e.source, target: e.target, label: e.label })),
    bom: bom.map(b => ({ part: b.partNumber, qty: b.quantity, status: b.status })),
    validationIssues: validationIssues.map(v => ({ severity: v.severity, message: v.message, suggestion: v.suggestion })),
  };
}

function buildAnalysisPrompt(kind: AnalysisKind, snapshot: any): string {
  const base = `Analyze the following hardware project data.\nProject: ${snapshot.projectName}\n\nData:\n` + JSON.stringify(snapshot, null, 2);
  switch (kind) {
    case 'architecture_review': return base + '\n\nPerform a comprehensive architecture review. Identify single points of failure, missing pull-ups, and structural flaws.';
    case 'drc_deep_dive': return base + '\n\nReview all validation issues and provide detailed root-cause analysis for each.';
    case 'bom_optimization': return base + '\n\nAnalyze the BOM for cost reduction opportunities, alternative parts, and supply chain risks.';
    case 'dfm_check': return base + '\n\nPerform a Design for Manufacturability check based on the components and architecture.';
    case 'security_audit': return base + '\n\nReview the architecture for hardware security vulnerabilities (exposed debug ports, unencrypted comms).';
    case 'thermal_analysis': return base + '\n\nIdentify potential thermal hotspots based on component power dissipation and layout.';
    default: return base + '\n\nPerform a general review.';
  }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const ANALYSIS_CATALOG: Array<{ kind: AnalysisKind; label: string; description: string }> = [
  { kind: 'architecture_review', label: 'Architecture Review', description: 'Comprehensive system architecture analysis.' },
  { kind: 'drc_deep_dive', label: 'DRC Deep Dive', description: 'Detailed root-cause analysis of validation issues.' },
  { kind: 'bom_optimization', label: 'BOM Optimization', description: 'Analyze cost reduction and supply chain risks.' },
  { kind: 'dfm_check', label: 'DFM Check', description: 'Design for Manufacturability review.' },
  { kind: 'security_audit', label: 'Security Audit', description: 'Identify hardware security vulnerabilities.' },
  { kind: 'thermal_analysis', label: 'Thermal Analysis', description: 'Identify thermal hotspots.' }
];

export function listProjectBatches(projectId: number): BatchAnalysisStatus[] {
  const result: BatchAnalysisStatus[] = [];
  for (const batch of Array.from(activeBatches.values())) {
    if (batch.status.projectId === projectId) {
      result.push(batch.status);
    }
  }
  return result;
}

export function getBatchProjectId(batchId: string): number | null {
  const b = activeBatches.get(batchId);
  return b ? b.status.projectId : null;
}

export async function submitBatchAnalysis(req: BatchAnalysisRequest): Promise<BatchAnalysisStatus> {
  const { projectId, analyses, apiKey, model = 'gemini-3-flash-preview' } = req;
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const snapshot = await gatherProjectSnapshot(projectId);
  const abortController = new AbortController();

  const status: BatchAnalysisStatus = {
    batchId,
    projectId,
    analyses,
    status: 'in_progress',
    createdAt: new Date().toISOString(),
    requestCounts: { processing: analyses.length, succeeded: 0, errored: 0, canceled: 0, expired: 0 }
  };

  const results: AnalysisResult[] = [];
  const promises: Promise<void>[] = [];

  for (const kind of analyses) {
    const customId = `${projectId}-${kind}-${Date.now()}`;
    const prompt = buildAnalysisPrompt(kind, snapshot);
    
    const p = ai.generate({
      model: googleAI.model(model),
      prompt,
      config: { temperature: 0.2, apiKey }
    }).then(res => {
      if (abortController.signal.aborted) return;
      results.push({ kind, customId, status: 'succeeded', resultText: res.text });
      status.requestCounts!.succeeded++;
      status.requestCounts!.processing--;
    }).catch(err => {
      if (abortController.signal.aborted) return;
      results.push({ kind, customId, status: 'errored', error: err.message });
      status.requestCounts!.errored++;
      status.requestCounts!.processing--;
    });
    promises.push(p);
  }

  activeBatches.set(batchId, { status, results, promises, abortController });

  Promise.allSettled(promises).then(() => {
    const b = activeBatches.get(batchId);
    if (b && b.status.status === 'in_progress') {
      b.status.status = 'completed';
      b.status.endedAt = new Date().toISOString();
    }
  });

  logger.info('batch:submitted (local emulation via Genkit)', { batchId, projectId, analyses });
  return status;
}

export async function getBatchStatus(batchId: string, apiKey: string): Promise<BatchAnalysisStatus> {
  const b = activeBatches.get(batchId);
  if (!b) throw new Error(`Batch ${batchId} not found`);
  return b.status;
}

export async function getBatchResults(batchId: string, apiKey: string): Promise<AnalysisResult[]> {
  const b = activeBatches.get(batchId);
  if (!b) throw new Error(`Batch ${batchId} not found`);
  return b.results;
}

export async function cancelBatch(batchId: string, apiKey: string): Promise<BatchAnalysisStatus> {
  const b = activeBatches.get(batchId);
  if (!b) throw new Error(`Batch ${batchId} not found`);
  
  if (b.status.status === 'in_progress') {
    b.abortController.abort();
    b.status.status = 'canceled';
    b.status.endedAt = new Date().toISOString();
    b.status.requestCounts!.canceled += b.status.requestCounts!.processing;
    b.status.requestCounts!.processing = 0;
  }
  return b.status;
}
