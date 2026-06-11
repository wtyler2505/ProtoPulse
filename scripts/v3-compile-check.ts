import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { GraphEdge, GraphNode } from '@/lib/graph-types';
import { buildLiveArchitectureCompileReport } from '@/lib/v3-architecture-compiler';

const GraphNodeInputSchema = z.object({
  id: z.string().min(1),
  type: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.record(z.unknown()).default({}),
}).passthrough();

const GraphEdgeInputSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional(),
  data: z.record(z.unknown()).optional(),
}).passthrough();

const LegacyNodeSchema = z.object({
  nodeId: z.string().min(1),
  nodeType: z.string().min(1),
  label: z.string().min(1),
  positionX: z.number(),
  positionY: z.number(),
  data: z.record(z.unknown()).nullable().optional(),
});

const LegacyEdgeSchema = z.object({
  edgeId: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional(),
  signalType: z.string().optional(),
  voltage: z.string().optional(),
  busWidth: z.number().optional(),
  netName: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

const V3CompileCheckInputSchema = z.object({
  nodes: z.array(GraphNodeInputSchema).optional(),
  edges: z.array(GraphEdgeInputSchema).optional(),
  legacyArchitecture: z.object({
    nodes: z.array(LegacyNodeSchema).default([]),
    edges: z.array(LegacyEdgeSchema).default([]),
  }).optional(),
});

function usage(): string {
  return 'Usage: npm run v3:compile-check -- <architecture.json> [--markdown] [--allow-blocked]';
}

export async function runV3CompileCheckFromFile(inputPath: string) {
  const absoluteInputPath = resolve(inputPath);
  const raw = JSON.parse(await readFile(absoluteInputPath, 'utf8')) as unknown;
  const input = V3CompileCheckInputSchema.parse(raw);
  const nodes = normalizeNodes(input);
  const edges = normalizeEdges(input);
  const report = buildLiveArchitectureCompileReport(nodes, edges, { enrichFromVerifiedSources: true });

  return {
    inputPath: absoluteInputPath,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    status: report.status,
    acceptedFacts: report.acceptedFacts,
    missingFacts: report.missingFacts,
    blockedTasks: report.blockedTasks,
    emittedTsx: report.emittedTsx ?? null,
    compileInput: report.compileInput ?? null,
    summary: report.summary,
  };
}

export function renderV3CompileCheckMarkdown(result: Awaited<ReturnType<typeof runV3CompileCheckFromFile>>): string {
  return [
    `# ProtoPulse v3 Compile Check`,
    ``,
    `- Status: ${result.status}`,
    `- Nodes: ${String(result.nodeCount)}`,
    `- Edges: ${String(result.edgeCount)}`,
    `- Board: ${result.summary.boardWidth} x ${result.summary.boardHeight}`,
    `- Parts: ${String(result.summary.chips + result.summary.connectors + result.summary.passives)}`,
    `- Traces: ${String(result.summary.traces)}`,
    ``,
    `## Accepted Facts`,
    result.acceptedFacts.length > 0 ? result.acceptedFacts.map((fact) => `- ${fact}`).join('\n') : '- none',
    ``,
    `## Missing Facts`,
    result.missingFacts.length > 0 ? result.missingFacts.map((fact) => `- ${fact}`).join('\n') : '- none',
    ``,
    `## Blocked Tasks`,
    result.blockedTasks.length > 0 ? result.blockedTasks.map((task) => `- ${task}`).join('\n') : '- none',
    ``,
    `## Emitted TSX`,
    result.emittedTsx ? `\`\`\`tsx\n${result.emittedTsx}\`\`\`` : 'No TSX emitted.',
    ``,
  ].join('\n');
}

function normalizeNodes(input: z.infer<typeof V3CompileCheckInputSchema>): GraphNode[] {
  if (input.nodes) {
    return input.nodes as GraphNode[];
  }
  return (input.legacyArchitecture?.nodes ?? []).map((node): GraphNode => ({
    id: node.nodeId,
    type: 'custom',
    position: { x: node.positionX, y: node.positionY },
    data: {
      ...(node.data ?? {}),
      label: node.label,
      type: node.nodeType,
    },
  }));
}

function normalizeEdges(input: z.infer<typeof V3CompileCheckInputSchema>): GraphEdge[] {
  if (input.edges) {
    return input.edges as GraphEdge[];
  }
  return (input.legacyArchitecture?.edges ?? []).map((edge): GraphEdge => ({
    id: edge.edgeId,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    data: {
      ...(edge.data ?? {}),
      signalType: edge.signalType,
      voltage: edge.voltage,
      busWidth: edge.busWidth,
      netName: edge.netName,
    },
  }));
}

async function main() {
  const inputPath = process.argv.find((arg, index) => index > 1 && !arg.startsWith('--'));
  if (!inputPath) {
    console.error(usage());
    process.exit(1);
  }

  const result = await runV3CompileCheckFromFile(inputPath);
  const markdown = process.argv.includes('--markdown');
  console.log(markdown ? renderV3CompileCheckMarkdown(result) : JSON.stringify(result, null, 2));

  if (result.status !== 'ready' && !process.argv.includes('--allow-blocked')) {
    process.exit(2);
  }
}

if (process.argv[1]?.endsWith('v3-compile-check.ts')) {
  await main();
}
