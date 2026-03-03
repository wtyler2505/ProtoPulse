/**
 * Anthropic Message Batches API integration for background analysis.
 *
 * Runs non-interactive analysis tasks (architecture review, DRC deep-dive,
 * BOM optimization, design-for-manufacturing) asynchronously at 50% cost
 * via Anthropic's batch endpoint. Results are polled and stored for later
 * retrieval by the client.
 *
 * @see https://docs.anthropic.com/en/docs/build-with-claude/batch-processing
 */

import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { getAnthropicClient } from './ai';
import { storage } from './storage';
import { logger } from './logger';

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
  status: 'in_progress' | 'ended' | 'canceling' | 'canceled' | 'expired' | 'failed';
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
  content?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// In-memory batch tracking (persisted to storage via chat messages)
// ---------------------------------------------------------------------------

const activeBatches = new Map<string, BatchAnalysisStatus>();

// ---------------------------------------------------------------------------
// Analysis prompt builders
// ---------------------------------------------------------------------------

interface ProjectSnapshot {
  name: string;
  description: string;
  nodes: Array<{ label: string; type: string; description?: string }>;
  edges: Array<{ source: string; target: string; label?: string; signalType?: string; voltage?: string }>;
  bom: Array<{ partNumber: string; manufacturer: string; description: string; quantity: number; unitPrice: number; status: string }>;
  validationIssues: Array<{ severity: string; message: string; suggestion?: string }>;
}

function buildAnalysisPrompt(kind: AnalysisKind, snapshot: ProjectSnapshot): string {
  const projectContext = [
    `Project: ${snapshot.name}`,
    snapshot.description ? `Description: ${snapshot.description}` : '',
    '',
    `Architecture (${snapshot.nodes.length} nodes, ${snapshot.edges.length} edges):`,
    ...snapshot.nodes.map(n => `  - ${n.label} (${n.type})${n.description ? `: ${n.description}` : ''}`),
    '',
    'Connections:',
    ...snapshot.edges.map(e => {
      const meta = [e.signalType, e.voltage].filter(Boolean).join(', ');
      return `  - ${e.source} → ${e.target}${e.label ? ` [${e.label}]` : ''}${meta ? ` (${meta})` : ''}`;
    }),
    '',
    `BOM (${snapshot.bom.length} items):`,
    ...snapshot.bom.map(b => `  - ${b.partNumber} | ${b.manufacturer} | qty:${b.quantity} | $${b.unitPrice} | ${b.status}`),
    '',
    `Validation Issues (${snapshot.validationIssues.length}):`,
    ...snapshot.validationIssues.map(v => `  - [${v.severity}] ${v.message}${v.suggestion ? ` → ${v.suggestion}` : ''}`),
  ].filter(line => line !== undefined).join('\n');

  const prompts: Record<AnalysisKind, string> = {
    architecture_review: `You are a senior electronics systems architect reviewing a hardware design. Analyze the architecture for:

1. **Block-level completeness**: Are all necessary subsystems present? Missing power regulation, clock distribution, reset circuitry, decoupling, or protection?
2. **Signal integrity concerns**: Identify potential SI issues at the block diagram level (long buses, impedance mismatches, mixed signal domains).
3. **Power domain analysis**: Map power domains, identify voltage level translation needs, estimate power budget.
4. **Interface compliance**: Check that bus types and signal types match standard protocols (I2C, SPI, UART, USB, etc.).
5. **Reliability concerns**: Single points of failure, missing redundancy, thermal considerations.
6. **Scalability**: How well does this architecture support future expansion?

Provide a structured report with severity ratings (Critical/Warning/Info) for each finding. Include specific, actionable recommendations.`,

    drc_deep_dive: `You are an EDA design rule checking expert performing a deep analysis. Go beyond basic DRC and analyze:

1. **Electrical rule violations**: Net connectivity, floating pins, shorted nets, dangling connections.
2. **Signal integrity rules**: Termination requirements, matched-length pairs, guard traces needed.
3. **Power integrity**: Decoupling capacitor placement, power plane splits, current path analysis.
4. **EMC/EMI concerns**: Loop area minimization, ground plane continuity, shield requirements.
5. **Thermal rules**: Component spacing for thermal relief, heat sink requirements, thermal via needs.
6. **Manufacturing rules**: Component orientation consistency, fiducial placement, test point access.

For each finding, provide: severity, affected components/nets, the specific rule violated, and a recommended fix.`,

    bom_optimization: `You are a procurement and BOM optimization specialist. Analyze the BOM for:

1. **Cost reduction opportunities**: Alternative parts, volume pricing tiers, second-source options.
2. **Consolidation**: Can multiple part numbers be consolidated into a single part? (e.g., same value caps from different manufacturers)
3. **Availability risk**: Identify components with single-source risk, long lead times, or end-of-life status.
4. **Standardization**: Recommend standardizing on fewer package sizes, voltage ratings, and manufacturers.
5. **Missing items**: Based on the architecture, identify components that should be in the BOM but are missing (decoupling caps, pull-ups, test points, connectors, mounting hardware).
6. **Total cost analysis**: Provide estimated total cost at 1, 100, and 1000 unit quantities.

Provide a prioritized list of recommendations with estimated cost savings.`,

    dfm_check: `You are a DFM (Design for Manufacturability) specialist. Review this design for manufacturing issues:

1. **Assembly concerns**: Component placement density, orientation consistency, reflow vs wave solder compatibility.
2. **Testability**: Sufficient test points for ICT/flying probe? Boundary scan support?
3. **Panel utilization**: Board outline optimization suggestions.
4. **Component availability**: Are all components available in the specified packages for automated assembly?
5. **Documentation completeness**: What additional documentation is needed for manufacturing handoff?
6. **Quality risks**: Identify areas prone to manufacturing defects (fine-pitch ICs, BGA concerns, thermal pad requirements).

Rate each finding as Must-Fix, Should-Fix, or Nice-to-Have. Include estimated impact on yield.`,

    security_audit: `You are a hardware security specialist. Audit this design for security concerns:

1. **Debug interfaces**: Are JTAG/SWD ports exposed without protection? Can they be disabled in production?
2. **Firmware security**: Secure boot chain, encrypted storage, firmware update mechanism.
3. **Side-channel risks**: Power analysis vulnerability, EM emission concerns, timing attacks.
4. **Physical security**: Tamper detection, enclosure requirements, conformal coating needs.
5. **Communication security**: Encryption on external interfaces, key storage, certificate handling.
6. **Supply chain risks**: Counterfeit component risk, trusted source requirements.

Classify each finding by CVSS-like severity. Include mitigation recommendations.`,

    thermal_analysis: `You are a thermal engineer reviewing a board-level design. Analyze:

1. **Power dissipation**: Estimate per-component power dissipation based on component types and operating conditions.
2. **Thermal coupling**: Identify components that may thermally affect each other.
3. **Heat sink requirements**: Which components need heat sinks? Estimate required thermal resistance.
4. **Airflow requirements**: Does this design need forced convection? Estimate required airflow.
5. **Thermal relief**: Are thermal vias needed under power pads? Sufficient copper pour for heat spreading?
6. **Operating temperature**: Identify components with the narrowest temperature margins.

Provide a thermal budget table and prioritized recommendations for thermal management.`,
  };

  return `${prompts[kind]}\n\n--- PROJECT DATA ---\n\n${projectContext}`;
}

// ---------------------------------------------------------------------------
// Core batch operations
// ---------------------------------------------------------------------------

async function gatherProjectSnapshot(projectId: number): Promise<ProjectSnapshot> {
  const project = await storage.getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const [nodes, edges, bom, issues] = await Promise.all([
    storage.getNodes(projectId),
    storage.getEdges(projectId),
    storage.getBomItems(projectId),
    storage.getValidationIssues(projectId),
  ]);

  return {
    name: project.name,
    description: project.description ?? '',
    nodes: nodes.map(n => {
      const data = n.data as Record<string, unknown> | null;
      return {
        label: n.label,
        type: n.nodeType,
        description: (data?.description as string | undefined) ?? undefined,
      };
    }),
    edges: edges.map(e => {
      const srcNode = nodes.find(n => n.nodeId === e.source);
      const tgtNode = nodes.find(n => n.nodeId === e.target);
      return {
        source: srcNode?.label ?? e.source,
        target: tgtNode?.label ?? e.target,
        label: e.label ?? undefined,
        signalType: e.signalType ?? undefined,
        voltage: e.voltage ?? undefined,
      };
    }),
    bom: bom.map(b => ({
      partNumber: b.partNumber,
      manufacturer: b.manufacturer,
      description: b.description,
      quantity: b.quantity,
      unitPrice: Number(b.unitPrice),
      status: b.status ?? 'unknown',
    })),
    validationIssues: issues.map(v => ({
      severity: v.severity,
      message: v.message,
      suggestion: v.suggestion ?? undefined,
    })),
  };
}

/**
 * Submit a batch of analysis requests to Anthropic's Message Batches API.
 * Returns the batch ID for polling.
 */
export async function submitBatchAnalysis(req: BatchAnalysisRequest): Promise<BatchAnalysisStatus> {
  const { projectId, analyses, apiKey, model = 'claude-haiku-4-5-20250514' } = req;

  const client = getAnthropicClient(apiKey);
  const snapshot = await gatherProjectSnapshot(projectId);

  const requests: Array<{
    custom_id: string;
    params: MessageCreateParamsNonStreaming;
  }> = analyses.map((kind) => ({
    custom_id: `${projectId}-${kind}-${Date.now()}`,
    params: {
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user' as const,
          content: buildAnalysisPrompt(kind, snapshot),
        },
      ],
    },
  }));

  const batch = await client.messages.batches.create({ requests });

  const status: BatchAnalysisStatus = {
    batchId: batch.id,
    projectId,
    analyses,
    status: batch.processing_status,
    createdAt: new Date().toISOString(),
    requestCounts: batch.request_counts,
  };

  activeBatches.set(batch.id, status);

  logger.info('batch:submitted', {
    batchId: batch.id,
    projectId,
    analyses,
    model,
    requestCount: requests.length,
  });

  return status;
}

/**
 * Check the status of a previously submitted batch.
 */
export async function getBatchStatus(batchId: string, apiKey: string): Promise<BatchAnalysisStatus> {
  const client = getAnthropicClient(apiKey);
  const batch = await client.messages.batches.retrieve(batchId);

  const cached = activeBatches.get(batchId);
  const status: BatchAnalysisStatus = {
    batchId: batch.id,
    projectId: cached?.projectId ?? 0,
    analyses: cached?.analyses ?? [],
    status: batch.processing_status,
    createdAt: cached?.createdAt ?? new Date().toISOString(),
    endedAt: batch.ended_at ?? undefined,
    requestCounts: batch.request_counts,
  };

  activeBatches.set(batchId, status);
  return status;
}

/**
 * Retrieve completed results from a batch. Returns individual analysis results.
 */
export async function getBatchResults(batchId: string, apiKey: string): Promise<AnalysisResult[]> {
  const client = getAnthropicClient(apiKey);
  const results: AnalysisResult[] = [];
  const decoder = await client.messages.batches.results(batchId);

  for await (const result of decoder) {
    const customId = result.custom_id;
    const kindMatch = customId.match(/^\d+-(.+?)-\d+$/);
    const kind = (kindMatch?.[1] ?? 'unknown') as AnalysisKind;

    if (result.result.type === 'succeeded') {
      const message = result.result.message;
      const textParts: string[] = [];
      for (const block of message.content) {
        if (block.type === 'text') {
          textParts.push(block.text);
        }
      }

      results.push({
        kind,
        customId,
        status: 'succeeded',
        content: textParts.join('\n'),
      });
    } else if (result.result.type === 'errored') {
      results.push({
        kind,
        customId,
        status: 'errored',
        error: result.result.error?.error?.message ?? 'Unknown batch error',
      });
    } else {
      results.push({
        kind,
        customId,
        status: result.result.type as 'canceled' | 'expired',
      });
    }
  }

  return results;
}

/**
 * Cancel a running batch.
 */
export async function cancelBatch(batchId: string, apiKey: string): Promise<BatchAnalysisStatus> {
  const client = getAnthropicClient(apiKey);
  const batch = await client.messages.batches.cancel(batchId);

  const cached = activeBatches.get(batchId);
  const status: BatchAnalysisStatus = {
    batchId: batch.id,
    projectId: cached?.projectId ?? 0,
    analyses: cached?.analyses ?? [],
    status: batch.processing_status,
    createdAt: cached?.createdAt ?? new Date().toISOString(),
    requestCounts: batch.request_counts,
  };

  activeBatches.set(batchId, status);

  logger.info('batch:canceled', { batchId });
  return status;
}

/**
 * List all tracked batches for a project (from in-memory cache).
 */
export function listProjectBatches(projectId: number): BatchAnalysisStatus[] {
  return Array.from(activeBatches.values())
    .filter(b => b.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Available analysis kinds with human-readable descriptions.
 */
export const ANALYSIS_CATALOG: Array<{ kind: AnalysisKind; label: string; description: string }> = [
  { kind: 'architecture_review', label: 'Architecture Review', description: 'Block-level completeness, signal integrity, power domains, interface compliance' },
  { kind: 'drc_deep_dive', label: 'Deep DRC Analysis', description: 'Beyond basic DRC: SI rules, power integrity, EMC/EMI, thermal, manufacturing' },
  { kind: 'bom_optimization', label: 'BOM Optimization', description: 'Cost reduction, consolidation, availability risk, standardization, missing items' },
  { kind: 'dfm_check', label: 'DFM Check', description: 'Assembly concerns, testability, panel utilization, documentation completeness' },
  { kind: 'security_audit', label: 'Security Audit', description: 'Debug interfaces, firmware security, side-channel risks, supply chain' },
  { kind: 'thermal_analysis', label: 'Thermal Analysis', description: 'Power dissipation, thermal coupling, heat sink requirements, airflow' },
];
