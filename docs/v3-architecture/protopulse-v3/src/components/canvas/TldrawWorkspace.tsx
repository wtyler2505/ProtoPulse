import { Tldraw } from 'tldraw';
import { useEffect, useState } from 'react';
import sample from '../../../examples/sample-architecture.json';
import type { VerifiedFact } from '../../db/schema';
import { extractBoundariesFromTldrawShapes } from './CanvasBindings';
import { evaluateBoundaryRules } from './BoundaryRules';
import { compileCanvasBoundariesToTscircuit, emitVerifiedTscircuitTsx, getNoEmitReasons } from '../circuits/SchematicCompiler';
import { BoundaryPreviewPanel } from '../status/BoundaryPreviewPanel';
import { ArchitectureDecisionPanel } from '../status/ArchitectureDecisionPanel';
import { CompileCheckCommandPanel } from '../status/CompileCheckCommandPanel';
import { CompileGateChecklistPanel } from '../status/CompileGateChecklistPanel';
import { CompileReportPanel } from '../status/CompileReportPanel';
import { CompileStatusPanel } from '../status/CompileStatusPanel';
import { CodexTemplatesPanel } from '../status/CodexTemplatesPanel';
import { FirmwareContractPanel } from '../status/FirmwareContractPanel';
import { PinOwnershipPanel } from '../status/PinOwnershipPanel';
import { RealSampleValidationPanel } from '../status/RealSampleValidationPanel';
import { KnowledgeFactsPanel } from '../status/KnowledgeFactsPanel';
import { LiveEntryDecisionPanel } from '../status/LiveEntryDecisionPanel';
import { MigrationPlanPanel } from '../status/MigrationPlanPanel';
import { NoEmitProofPanel } from '../status/NoEmitProofPanel';
import { StorageTablesPanel } from '../status/StorageTablesPanel';
import { SwarmSafetyPanel } from '../status/SwarmSafetyPanel';
import { TscircuitProofPanel } from '../status/TscircuitProofPanel';
import { VisualInspectionDock } from '../status/VisualInspectionDock';
import { OpenAIDispatchPanel } from '../status/OpenAIDispatchPanel';
import sampleSwarm from '../../../examples/sample-swarm.json';
import { planSwarmDispatch } from '../../ai/swarms/orchestrator';
import { planOpenAIAgentDispatch } from '../../ai/swarms/openai-agents-dispatch';
import { createCodexCommandTemplates } from '../../ai/swarms/codex-command-templates';
import { checkPinOwnershipBeforeFirmware, validateArduinoCppFirmwareOutput } from '../../ai/swarms/firmware-writer';
import { createV3CompileReport } from '../../reports/v3-compile-report';
import { renderTscircuitDraftProof, type TscircuitRenderProof } from '../circuits/tscircuit-render-proof';
import { migrateXyflowArchitectureToTldraw } from '../../architecture/xyflow-to-tldraw';
import 'tldraw/tldraw.css';

export function TldrawWorkspace() {
  const [tscircuitProof, setTscircuitProof] = useState<TscircuitRenderProof | null>(null);
  const boundaries = extractBoundariesFromTldrawShapes(sample.tldrawShapes);
  const ruleResults = evaluateBoundaryRules(boundaries);
  const compileResult = compileCanvasBoundariesToTscircuit(boundaries, ruleResults);
  const preview = emitVerifiedTscircuitTsx(compileResult) ?? '';
  const noEmitReasons = getNoEmitReasons(compileResult);
  const elementKinds = compileResult.draft?.elements.map((element) => element.kind) ?? [];
  const swarmPlan = planSwarmDispatch(sampleSwarm.tasks);
  const openAiDispatch = planOpenAIAgentDispatch(swarmPlan);
  const codexTemplates = createCodexCommandTemplates(swarmPlan);
  const firmwareOutput = validateArduinoCppFirmwareOutput(sample.firmwareOutput);
  const pinOwnership = checkPinOwnershipBeforeFirmware(sample.firmwareRequest, Object.keys(sample.knowledgeFactPreview.facts));
  const migrationResult = migrateXyflowArchitectureToTldraw(sample.legacyArchitecture);
  const report = createV3CompileReport({
    status: compileResult.status,
    acceptedFacts: Object.fromEntries(Object.entries(sample.knowledgeFactPreview.facts).map(([key, fact]) => [key, fact.value])),
    missingFacts: sample.knowledgeFactPreview.missingFacts,
    blockedTasks: [
      ...compileResult.blockedReasons.map((reason) => ({ id: 'compile', reason })),
      ...swarmPlan.blockedReasons.map((reason) => ({ id: 'swarm', reason })),
    ],
    emittedTsx: preview || null,
  });

  useEffect(() => {
    let mounted = true;
    void renderTscircuitDraftProof(sample.tscircuitDraft).then((proof) => {
      if (mounted) {
        setTscircuitProof(proof);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main style={{ position: 'fixed', inset: 0 }}>
      <CompileStatusPanel
        readyCount={1}
        blockedCount={1}
        missingFacts={['pinout', 'usb_interface']}
        compileStatus={compileResult.status}
        blockedReasons={compileResult.blockedReasons}
        preview={preview}
        elementKinds={elementKinds}
      />
      <NoEmitProofPanel compileStatus={compileResult.status} noEmitReasons={noEmitReasons} />
      <CompileCheckCommandPanel />
      <FirmwareContractPanel output={firmwareOutput} />
      <PinOwnershipPanel gate={pinOwnership} />
      <StorageTablesPanel />
      <SwarmSafetyPanel
        status={swarmPlan.status}
        workerCap={swarmPlan.workerCap}
        taskCount={swarmPlan.tasks.length}
        blockedReasons={swarmPlan.blockedReasons}
      />
      <OpenAIDispatchPanel result={openAiDispatch} />
      <CodexTemplatesPanel result={codexTemplates} />
      <VisualInspectionDock />
      <BoundaryPreviewPanel boundaries={boundaries} ruleResults={ruleResults} />
      <CompileReportPanel report={report} />
      {tscircuitProof && <TscircuitProofPanel proof={tscircuitProof} />}
      <CompileGateChecklistPanel
        compileReady={compileResult.status === 'ready'}
        factsReady={sample.knowledgeFactPreview.missingFacts.length === 0}
        pinsReady={pinOwnership.status === 'ready'}
        emitted={Boolean(preview)}
      />
      <ArchitectureDecisionPanel />
      <MigrationPlanPanel result={migrationResult} />
      <RealSampleValidationPanel />
      <LiveEntryDecisionPanel />
      <KnowledgeFactsPanel
        sourcePath={sample.knowledgeFactPreview.sourcePath}
        facts={sample.knowledgeFactPreview.facts as Record<string, VerifiedFact>}
        missingFacts={sample.knowledgeFactPreview.missingFacts}
        storage="Drizzle/Postgres"
      />
      <Tldraw persistenceKey="protopulse-v3-architecture" />
    </main>
  );
}
