import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import realProject from '../examples/real-sample-project.json';
import { extractBoundariesFromTldrawShapes } from '../src/components/canvas/CanvasBindings';
import { evaluateBoundaryRules } from '../src/components/canvas/BoundaryRules';
import { compileCanvasBoundariesToTscircuit, emitVerifiedTscircuitTsx } from '../src/components/circuits/SchematicCompiler';
import { renderTscircuitDraftProof } from '../src/components/circuits/tscircuit-render-proof';
import { checkPinOwnershipBeforeFirmware, validateArduinoCppFirmwareOutput } from '../src/ai/swarms/firmware-writer';
import { planSwarmDispatch } from '../src/ai/swarms/orchestrator';
import { dispatchOpenAIAgents } from '../src/ai/swarms/openai-agents-dispatch';
import { createCodexCommandTemplates } from '../src/ai/swarms/codex-command-templates';
import { checkHardwareFacts } from '../src/hardware/fact-gate';
import { loadVerifiedHardwareFacts } from '../src/hardware/knowledge-source';
import { createV3CompileReport } from '../src/reports/v3-compile-report';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../../..');
const sourcedFacts = await loadVerifiedHardwareFacts(
  realProject.hardwareFactRequest.partNumber,
  realProject.hardwareFactRequest.requiredFacts,
  repoRoot,
);
const factGate = checkHardwareFacts({
  ...realProject.hardwareFactRequest,
  knownFacts: {
    ...realProject.hardwareFactRequest.knownFacts,
    ...sourcedFacts.facts,
  },
});
const boundaries = extractBoundariesFromTldrawShapes(realProject.tldrawShapes);
const ruleResults = evaluateBoundaryRules(boundaries);
const compileResult = compileCanvasBoundariesToTscircuit(boundaries, ruleResults);
const emittedTsx = emitVerifiedTscircuitTsx(compileResult);
const pinOwnership = checkPinOwnershipBeforeFirmware(realProject.firmwareRequest, Object.keys(sourcedFacts.facts));
const firmwareOutput = validateArduinoCppFirmwareOutput(realProject.firmwareOutput);
const swarmPlan = planSwarmDispatch(realProject.swarmTasks);
const agentDispatch = await dispatchOpenAIAgents(swarmPlan);
const codexTemplates = createCodexCommandTemplates(swarmPlan);
const renderProof = await renderTscircuitDraftProof(realProject.tscircuitDraft);
const report = createV3CompileReport({
  status: compileResult.status === 'ready' && factGate.status === 'verified' && pinOwnership.status === 'ready' && swarmPlan.status === 'ready' ? 'ready' : 'blocked',
  acceptedFacts: factGate.acceptedFacts,
  missingFacts: factGate.missingFacts,
  blockedTasks: [
    ...compileResult.blockedReasons.map((reason) => ({ id: 'compile', reason })),
    ...swarmPlan.blockedReasons.map((reason) => ({ id: 'swarm', reason })),
  ],
  emittedTsx: emittedTsx ?? null,
});

assert.equal(factGate.status, 'verified');
assert.equal(compileResult.status, 'ready');
assert.equal(pinOwnership.status, 'ready');
assert.equal(swarmPlan.status, 'ready');
assert.equal(agentDispatch.status, 'ready');
assert.equal(codexTemplates.status, 'ready');
assert.equal(report.status, 'ready');
assert.equal(typeof report.emittedTsx, 'string');
assert.ok(firmwareOutput.ownedPins.length > 0);
assert.ok(renderProof.circuitJsonCount > 0);

console.log(JSON.stringify({
  status: report.status,
  boundaryCount: boundaries.length,
  emittedTsx: Boolean(report.emittedTsx),
  facts: Object.keys(report.acceptedFacts),
  ownedPins: firmwareOutput.ownedPins,
  agentDispatches: agentDispatch.dispatches.length,
  codexTemplates: codexTemplates.templates.length,
  circuitJsonCount: renderProof.circuitJsonCount,
}, null, 2));
