import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { extractBoundariesFromTldrawShapes } from '../src/components/canvas/CanvasBindings';
import { evaluateBoundaryRules } from '../src/components/canvas/BoundaryRules';
import {
  compileCanvasBoundariesToTscircuit,
  emitVerifiedTscircuitTsx,
  getNoEmitReasons,
} from '../src/components/circuits/SchematicCompiler';
import { checkHardwareFacts, HardwareFactRequestSchema } from '../src/hardware/fact-gate';
import { loadVerifiedHardwareFacts } from '../src/hardware/knowledge-source';
import { planSwarmDispatch, SwarmTaskSchema } from '../src/ai/swarms/orchestrator';
import { createV3CompileReport, renderV3CompileReportMarkdown } from '../src/reports/v3-compile-report';

const V3CompileInputSchema = z.object({
  tldrawShapes: z.array(z.unknown()),
  hardwareFactRequest: HardwareFactRequestSchema,
  swarmTasks: z.array(SwarmTaskSchema).default([]),
});

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: npm run compile:check -- <path-to-v3-json>');
  process.exit(1);
}

const absoluteInputPath = resolve(inputPath);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../../..');
const inputJson = JSON.parse(await readFile(absoluteInputPath, 'utf8')) as unknown;
const input = V3CompileInputSchema.parse(inputJson);

const sourcedFacts = await loadVerifiedHardwareFacts(
  input.hardwareFactRequest.partNumber,
  input.hardwareFactRequest.requiredFacts,
  repoRoot,
);
const factGate = checkHardwareFacts({
  ...input.hardwareFactRequest,
  knownFacts: {
    ...input.hardwareFactRequest.knownFacts,
    ...sourcedFacts.facts,
  },
});
const boundaries = extractBoundariesFromTldrawShapes(input.tldrawShapes);
const ruleResults = evaluateBoundaryRules(boundaries);
const compileResult = compileCanvasBoundariesToTscircuit(boundaries, ruleResults);
const swarmPlan = planSwarmDispatch(input.swarmTasks);
const emittedTsx = emitVerifiedTscircuitTsx(compileResult);
const noEmitReasons = getNoEmitReasons(compileResult);
const blockedTasks = [
  ...compileResult.blockedReasons.map((reason) => ({ id: 'compile', reason })),
  ...factGate.missingFacts.map((fact) => ({ id: 'hardware-facts', reason: `missing verified hardware fact: ${fact}` })),
  ...swarmPlan.blockedReasons.map((reason) => ({ id: 'swarm', reason })),
];
const report = createV3CompileReport({
  status: compileResult.status === 'ready' && factGate.status === 'verified' && swarmPlan.status === 'ready' ? 'ready' : 'blocked',
  acceptedFacts: factGate.acceptedFacts,
  missingFacts: factGate.missingFacts,
  blockedTasks,
  emittedTsx: emittedTsx ?? null,
});
const outputFormat = process.argv.includes('--markdown') ? 'markdown' : 'json';

const payload = {
  inputPath: absoluteInputPath,
  status: report.status,
  hardwareStatus: factGate.status,
  missingFacts: factGate.missingFacts,
  sourcedFactSource: sourcedFacts.sourcePath,
  boundaryCount: boundaries.length,
  blockedReasons: blockedTasks.map((task) => task.reason),
  noEmitReasons,
  report,
};

console.log(outputFormat === 'markdown' ? renderV3CompileReportMarkdown(report) : JSON.stringify(payload, null, 2));
