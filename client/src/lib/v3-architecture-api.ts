import { apiRequest } from '@/lib/queryClient';
import type { V3ArchitectureCompileReport } from '@/lib/v3-architecture-compiler';
import type { V3ExecutionReadiness } from '@/lib/v3-execution-readiness';
import type { V3ResolvedHardwareFact } from '@/lib/v3-verified-fact-enrichment';

export interface StoredV3CompileRun {
  id: number;
  projectId: number;
  status: 'ready' | 'blocked' | 'failed';
  createdAt: string;
}

export async function saveV3CompileRun(
  projectId: number,
  report: V3ArchitectureCompileReport,
): Promise<StoredV3CompileRun> {
  const res = await apiRequest('POST', `/api/projects/${projectId}/v3-architecture/compile-runs`, {
    status: report.status,
    acceptedFacts: report.acceptedFacts,
    missingFacts: report.missingFacts,
    blockedTasks: report.blockedTasks,
    emittedTsx: report.emittedTsx ?? null,
    compileInput: report.compileInput ?? {},
    compileSummary: report.summary,
  });
  return res.json() as Promise<StoredV3CompileRun>;
}

export interface StoredV3VerifiedFact {
  id: number;
  projectId: number;
  subject: string;
  factType: string;
  sourceType: string;
  sourceRef: string;
  createdAt: string;
}

export async function saveV3VerifiedFacts(
  projectId: number,
  facts: V3ResolvedHardwareFact[],
): Promise<StoredV3VerifiedFact[]> {
  const saved: StoredV3VerifiedFact[] = [];
  for (const fact of facts) {
    const res = await apiRequest('POST', `/api/projects/${projectId}/v3-architecture/verified-facts`, {
      sourceType: fact.sourceType,
      sourceRef: fact.sourceRef,
      factType: fact.factType,
      subject: fact.subject,
      value: fact.value,
      provenance: fact.provenance,
      confidence: 'verified',
    });
    saved.push(await res.json() as StoredV3VerifiedFact);
  }
  return saved;
}

export interface SaveV3InspectionReportInput {
  mode: 'visual' | 'layout';
  query: string;
  chassisDescription?: string;
  imageDigest?: string;
  markdown: string;
  provenance: string[];
}

export interface StoredV3InspectionReport {
  id: number;
  projectId: number;
  mode: 'visual' | 'layout';
  query: string;
  markdown: string;
  createdAt: string;
}

export async function saveV3InspectionReport(
  projectId: number,
  report: SaveV3InspectionReportInput,
): Promise<StoredV3InspectionReport> {
  const res = await apiRequest('POST', `/api/projects/${projectId}/v3-architecture/inspection-reports`, report);
  return res.json() as Promise<StoredV3InspectionReport>;
}

export interface StoredV3SwarmTask {
  id: number;
  projectId: number;
  taskId: string;
  status: 'planned' | 'running' | 'completed' | 'failed' | 'blocked';
  agentType: string;
  createdAt: string;
  updatedAt: string;
}

export async function saveV3SwarmTasks(
  projectId: number,
  execution: V3ExecutionReadiness,
): Promise<StoredV3SwarmTask[]> {
  const saved: StoredV3SwarmTask[] = [];
  for (const task of execution.swarmPlan.tasks) {
    const codexTemplate = execution.codexTemplates.templates.find((template) => template.taskId === task.id);
    const res = await apiRequest('POST', `/api/projects/${projectId}/v3-architecture/swarm-tasks`, {
      taskId: task.id,
      status: execution.status === 'ready' ? 'planned' : 'blocked',
      agentType: task.role,
      claimedFiles: task.claimedFiles,
      forbiddenFiles: [],
      commandTemplate: codexTemplate?.command ?? null,
      result: {
        prompt: task.prompt,
        requiresHardwareFacts: task.requiresHardwareFacts,
        verifiedHardwareFacts: task.verifiedHardwareFacts,
        blockedReasons: execution.blockedReasons,
      },
    });
    saved.push(await res.json() as StoredV3SwarmTask);
  }
  return saved;
}
