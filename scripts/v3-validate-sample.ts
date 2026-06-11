import { resolve } from 'node:path';
import { evaluateLiveV3Readiness } from '@/lib/v3-architecture-live';
import { buildLiveArchitectureCompileReport } from '@/lib/v3-architecture-compiler';
import { buildV3ExecutionReadiness } from '@/lib/v3-execution-readiness';
import {
  renderV3CompileCheckMarkdown,
  runV3CompileCheckFromFile,
} from './v3-compile-check';

const DEFAULT_SAMPLE = 'scripts/fixtures/v3-real-sample-project.json';

export async function validateV3SampleProject(inputPath = DEFAULT_SAMPLE) {
  const blockedReasons: string[] = [];
  const sample = await runV3CompileCheckFromFile(inputPath);
  const normalized = await importSampleForReadiness(inputPath);
  const migrationReadiness = evaluateLiveV3Readiness(normalized.nodes, normalized.edges);
  const compileReport = buildLiveArchitectureCompileReport(normalized.nodes, normalized.edges, { enrichFromVerifiedSources: true });
  const executionReadiness = buildV3ExecutionReadiness(normalized.nodes, normalized.edges, compileReport);
  const markdown = renderV3CompileCheckMarkdown(sample);

  if (sample.status !== 'ready') {
    blockedReasons.push('sample compile check is blocked');
  }
  if (migrationReadiness.status !== 'ready') {
    blockedReasons.push(...migrationReadiness.blockedReasons);
  }
  if (compileReport.status !== 'ready' || !compileReport.emittedTsx) {
    blockedReasons.push('sample did not emit verified TSX');
  }
  if (executionReadiness.status !== 'ready') {
    blockedReasons.push(...executionReadiness.blockedReasons);
  }
  if (!markdown.includes('## Accepted Facts') || !markdown.includes('## Emitted TSX')) {
    blockedReasons.push('sample Markdown report is missing required sections');
  }

  return {
    inputPath: resolve(inputPath),
    status: blockedReasons.length > 0 ? 'blocked' as const : 'ready' as const,
    blockedReasons: Array.from(new Set(blockedReasons)),
    nodeCount: sample.nodeCount,
    edgeCount: sample.edgeCount,
    migrationStatus: migrationReadiness.status,
    compileStatus: compileReport.status,
    executionStatus: executionReadiness.status,
    acceptedFacts: sample.acceptedFacts,
    missingFacts: sample.missingFacts,
    emittedTsx: sample.emittedTsx,
    executionSummary: executionReadiness.summary,
  };
}

async function importSampleForReadiness(inputPath: string) {
  const { readFile } = await import('node:fs/promises');
  const raw = JSON.parse(await readFile(resolve(inputPath), 'utf8')) as {
    nodes?: unknown[];
    edges?: unknown[];
  };

  return {
    nodes: (raw.nodes ?? []) as Parameters<typeof evaluateLiveV3Readiness>[0],
    edges: (raw.edges ?? []) as Parameters<typeof evaluateLiveV3Readiness>[1],
  };
}

async function main() {
  const inputPath = process.argv.find((arg, index) => index > 1 && !arg.startsWith('--')) ?? DEFAULT_SAMPLE;
  const result = await validateV3SampleProject(inputPath);
  console.log(JSON.stringify(result, null, 2));

  if (result.status !== 'ready') {
    process.exit(2);
  }
}

if (process.argv[1]?.endsWith('v3-validate-sample.ts')) {
  await main();
}
