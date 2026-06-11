import sample from '../examples/sample-architecture.json';
import { bindShapeToBoundary, extractBoundariesFromTldrawShapes } from '../src/components/canvas/CanvasBindings';
import { evaluateBoundaryRules } from '../src/components/canvas/BoundaryRules';
import {
  compileBoundariesToCircuitNodes,
  compileCanvasBoundariesToTscircuit,
  emitVerifiedTscircuitTsx,
  getNoEmitReasons,
} from '../src/components/circuits/SchematicCompiler';
import {
  checkPinOwnershipBeforeFirmware,
  validateArduinoCppFirmwareOutput,
  validateFirmwareRequest,
} from '../src/ai/swarms/firmware-writer';
import { checkHardwareFacts } from '../src/hardware/fact-gate';
import { createTscircuitDraft, emitTscircuitTsx } from '../src/components/circuits/tscircuit-contract';
import { renderTscircuitDraftProof } from '../src/components/circuits/tscircuit-render-proof';
import sampleSwarm from '../examples/sample-swarm.json';
import sampleSwarmBad from '../examples/sample-swarm-bad.json';
import sampleSwarmReady from '../examples/sample-swarm-ready.json';
import { planSwarmDispatch } from '../src/ai/swarms/orchestrator';
import { dispatchOpenAIAgents, planOpenAIAgentDispatch } from '../src/ai/swarms/openai-agents-dispatch';
import { createCodexCommandTemplates } from '../src/ai/swarms/codex-command-templates';
import { draftFlowRunners, flowRegistry } from '../src/ai/flows';
import {
  getLayoutAnalysisEndpoint,
  getVisualInspectionEndpoint,
  LayoutAnalysisApiRequestSchema,
  VisualInspectionApiRequestSchema,
} from '../src/api/hardware-inspection-client';
import { loadVerifiedHardwareFacts } from '../src/hardware/knowledge-source';
import { v3ArchitectureTableNames, v3ArchitectureTablesSql, v3ProvenanceEventsSql } from '../src/db/provenance-ddl';
import { createV3CompileReport, renderV3CompileReportMarkdown } from '../src/reports/v3-compile-report';
import { architectureViewDecision } from '../src/architecture/view-decision';
import { migrateXyflowArchitectureToTldraw } from '../src/architecture/xyflow-to-tldraw';
import { liveEntryDecision } from '../src/architecture/live-entry-decision';

const boundaries = sample.boundaries.map(bindShapeToBoundary);
const migrationResult = migrateXyflowArchitectureToTldraw(sample.legacyArchitecture);
const tldrawBoundaries = extractBoundariesFromTldrawShapes(sample.tldrawShapes);
const migratedBoundaries = extractBoundariesFromTldrawShapes(migrationResult.tldrawShapes);
const boundaryRuleResults = evaluateBoundaryRules(tldrawBoundaries);
const circuitNodes = compileBoundariesToCircuitNodes(boundaries);
const canvasCompileResult = compileCanvasBoundariesToTscircuit(tldrawBoundaries, boundaryRuleResults);
const verifiedCanvasTsx = emitVerifiedTscircuitTsx(canvasCompileResult);
const noEmitReasons = getNoEmitReasons(canvasCompileResult);
const sourcedFacts = await loadVerifiedHardwareFacts(
  sample.hardwareFactRequest.partNumber,
  sample.hardwareFactRequest.requiredFacts,
);
const hardwareFactRequest = {
  ...sample.hardwareFactRequest,
  knownFacts: {
    ...sample.hardwareFactRequest.knownFacts,
    ...sourcedFacts.facts,
  },
};
const factGate = checkHardwareFacts(hardwareFactRequest);
const firmwareRequest = validateFirmwareRequest(sample.firmwareRequest);
const firmwareOutput = validateArduinoCppFirmwareOutput(sample.firmwareOutput);
const pinOwnership = checkPinOwnershipBeforeFirmware(sample.firmwareRequest, Object.keys(sourcedFacts.facts));
const tscircuitDraft = createTscircuitDraft(sample.tscircuitDraft);
const tscircuitTsx = emitTscircuitTsx(tscircuitDraft);
const tscircuitRenderProof = await renderTscircuitDraftProof(tscircuitDraft);
const swarmPlan = planSwarmDispatch(sampleSwarm.tasks);
const badSwarmPlan = planSwarmDispatch(sampleSwarmBad.tasks);
const readySwarmPlan = planSwarmDispatch(sampleSwarmReady.tasks);
const blockedAgentDispatch = planOpenAIAgentDispatch(swarmPlan);
const readyAgentDispatch = await dispatchOpenAIAgents(readySwarmPlan);
const blockedCodexTemplates = createCodexCommandTemplates(swarmPlan);
const readyCodexTemplates = createCodexCommandTemplates(readySwarmPlan);
const compileReport = createV3CompileReport({
  status: canvasCompileResult.status === 'ready' && factGate.status === 'verified' && swarmPlan.status === 'ready' ? 'ready' : 'blocked',
  acceptedFacts: factGate.acceptedFacts,
  missingFacts: factGate.missingFacts,
  blockedTasks: [
    ...canvasCompileResult.blockedReasons.map((reason) => ({ id: 'compile', reason })),
    ...factGate.missingFacts.map((fact) => ({ id: 'hardware-facts', reason: `missing verified hardware fact: ${fact}` })),
    ...swarmPlan.blockedReasons.map((reason) => ({ id: 'swarm', reason })),
  ],
  emittedTsx: verifiedCanvasTsx ?? null,
});
const compileReportMarkdown = renderV3CompileReportMarkdown(compileReport);
const datasheetFlow = draftFlowRunners.multimodalDatasheet(sample.multimodalDatasheetInput);
const inspectionFlow = draftFlowRunners.visualHardwareInspection(sample.visualHardwareInspectionInput);
const layoutFlow = draftFlowRunners.embodiedLayoutAnalysis(sample.embodiedLayoutAnalysisInput);
const visualApiRequest = VisualInspectionApiRequestSchema.parse({
  projectId: sample.visualHardwareInspectionInput.projectId,
  imageUrl: sample.visualHardwareInspectionInput.imageUrl,
  query: sample.visualHardwareInspectionInput.query,
});
const layoutApiRequest = LayoutAnalysisApiRequestSchema.parse(sample.embodiedLayoutAnalysisInput);
let unsafeDraftBlocked = false;
try {
  createTscircuitDraft(sample.unsafeTscircuitDraft);
} catch {
  unsafeDraftBlocked = true;
}

console.log(JSON.stringify({
  boundaries: boundaries.length,
  migratedNodeCount: migrationResult.migratedNodeCount,
  migratedEdgeCount: migrationResult.migratedEdgeCount,
  migratedShapeCount: migrationResult.tldrawShapes.length,
  migratedBoundaryKinds: migratedBoundaries.map((boundary) => boundary.kind),
  tldrawBoundaries: tldrawBoundaries.length,
  tldrawBoundaryKinds: tldrawBoundaries.map((boundary) => boundary.kind),
  boundaryRuleResults,
  circuitNodes: circuitNodes.length,
  canvasCompileStatus: canvasCompileResult.status,
  compileGateReady: canvasCompileResult.status === 'ready' && factGate.status === 'verified' && pinOwnership.status === 'ready' && Boolean(verifiedCanvasTsx),
  canvasCompileBlockedReasons: canvasCompileResult.blockedReasons,
  canvasCompileElementKinds: canvasCompileResult.draft?.elements.map((element) => element.kind) ?? [],
  verifiedCanvasTsxEmitted: Boolean(verifiedCanvasTsx),
  noEmitReasons,
  hardwareStatus: factGate.status,
  missingFacts: factGate.missingFacts,
  sourcedFactSource: sourcedFacts.sourcePath,
  sourcedFactKeys: Object.keys(sourcedFacts.facts),
  sourcedMissingFacts: sourcedFacts.missingFacts,
  provenanceStorage: 'drizzle-postgres',
  provenanceDdlIncludesJsonb: v3ProvenanceEventsSql.includes('jsonb'),
  architectureStorageTables: v3ArchitectureTableNames,
  architectureTablesReady: v3ArchitectureTableNames.every((tableName) => v3ArchitectureTablesSql.includes(tableName)),
  architectureTablesIncludeJsonb: v3ArchitectureTablesSql.includes('jsonb'),
  firmwareBoard: firmwareRequest.board,
  firmwareOutputSketch: firmwareOutput.sketchName,
  firmwareOutputFiles: firmwareOutput.files.map((file) => file.path),
  pinOwnershipStatus: pinOwnership.status,
  pinOwnershipBlockedReasons: pinOwnership.blockedReasons,
  tscircuitElements: tscircuitDraft.elements.length,
  tscircuitRenderProof,
  unsafeDraftBlocked,
  swarmStatus: swarmPlan.status,
  swarmBlockedReasons: swarmPlan.blockedReasons,
  badSwarmStatus: badSwarmPlan.status,
  badSwarmBlockedReasons: badSwarmPlan.blockedReasons,
  readySwarmStatus: readySwarmPlan.status,
  blockedAgentDispatchStatus: blockedAgentDispatch.status,
  readyAgentDispatchStatus: readyAgentDispatch.status,
  readyAgentDispatchMode: readyAgentDispatch.mode,
  readyAgentDispatchCount: readyAgentDispatch.dispatches.length,
  blockedCodexTemplateStatus: blockedCodexTemplates.status,
  readyCodexTemplateStatus: readyCodexTemplates.status,
  readyCodexTemplateCount: readyCodexTemplates.templates.length,
  readyCodexTemplateCommandHead: readyCodexTemplates.templates[0]?.argv.slice(0, 6) ?? [],
  compileReportStatus: compileReport.status,
  compileReportAcceptedFacts: Object.keys(compileReport.acceptedFacts),
  compileReportMissingFacts: compileReport.missingFacts,
  compileReportBlockedTasks: compileReport.blockedTasks,
  compileReportHasEmittedTsx: Boolean(compileReport.emittedTsx),
  compileReportMarkdownHead: compileReportMarkdown.split('\n').slice(0, 6),
  registeredFlows: Object.keys(flowRegistry),
  datasheetMissingFacts: datasheetFlow.missingFacts,
  inspectionStatus: inspectionFlow.status,
  inspectionMissingFacts: inspectionFlow.missingFacts,
  inspectionMarkdownHead: inspectionFlow.markdown.split('\n').slice(0, 4),
  inspectionReportStorageReady: v3ArchitectureTablesSql.includes('v3_inspection_reports'),
  layoutStatus: layoutFlow.status,
  layoutMissingFacts: layoutFlow.missingFacts,
  layoutMarkdownHead: layoutFlow.markdown.split('\n').slice(0, 4),
  visualInspectionEndpoint: getVisualInspectionEndpoint(visualApiRequest.projectId),
  layoutAnalysisEndpoint: getLayoutAnalysisEndpoint(layoutApiRequest.projectId),
  architectureViewDecision,
  liveEntryDecision,
  tscircuitPreview: tscircuitTsx.split('\n').slice(0, 4),
}, null, 2));
