import type { GraphEdge, GraphNode } from '@/lib/graph-types';
import type { V3ArchitectureCompileReport } from '@/lib/v3-architecture-compiler';
import {
  checkV3PinOwnershipBeforeFirmware,
  type V3PinOwnershipGate,
} from '@/lib/v3-firmware-contract';
import {
  createV3CodexCommandTemplates,
  planV3OpenAIDispatch,
  planV3SwarmDispatch,
  type V3CodexCommandTemplateResult,
  type V3OpenAIDispatchResult,
  type V3SwarmDispatchPlan,
} from '@/lib/v3-swarm';

export interface V3ExecutionReadiness {
  status: 'ready' | 'blocked';
  pinGate: V3PinOwnershipGate;
  swarmPlan: V3SwarmDispatchPlan;
  openAIDispatch: V3OpenAIDispatchResult;
  codexTemplates: V3CodexCommandTemplateResult;
  blockedReasons: string[];
  summary: {
    workers: number;
    openAIDispatches: number;
    codexCommands: number;
    ownedPins: number;
  };
}

export function buildV3ExecutionReadiness(
  nodes: GraphNode[],
  edges: GraphEdge[],
  compileReport: V3ArchitectureCompileReport,
): V3ExecutionReadiness {
  const firmwareNode = nodes.find((node) => hasKind(node.data, 'firmware'));
  const verifiedFacts = collectVerifiedFacts(nodes);
  const pinGate = checkV3PinOwnershipBeforeFirmware({
    board: readString(firmwareNode?.data, 'board')
      ?? readString(firmwareNode?.data, 'targetBoard')
      ?? 'unselected-board',
    ownedPins: readStringArray(firmwareNode?.data, 'ownedPins')
      ?? readStringArray(firmwareNode?.data, 'pins')
      ?? [],
    behavior: readString(firmwareNode?.data, 'behavior')
      ?? readString(firmwareNode?.data, 'firmwareBehavior')
      ?? 'Generate Arduino/C++ firmware from verified architecture boundaries.',
  }, verifiedFacts);

  const tasks = [
    {
      id: 'v3-tscircuit-compiler',
      role: 'compiler',
      claimedFiles: ['client/src/lib/generated/v3-tscircuit-output.tsx'],
      prompt: `Compile ${String(nodes.length)} architecture nodes and ${String(edges.length)} edges into verified tscircuit output.`,
      requiresHardwareFacts: [],
      verifiedHardwareFacts: verifiedFacts,
    },
    {
      id: 'v3-firmware-writer',
      role: 'firmware-writer',
      claimedFiles: ['client/src/lib/generated/v3-firmware-output.ino'],
      prompt: 'Generate Arduino/C++ firmware only for owned pins listed in the v3 pin gate.',
      requiresHardwareFacts: ['pinout'],
      verifiedHardwareFacts: verifiedFacts,
    },
    {
      id: 'v3-ui-integrator',
      role: 'ui-integrator',
      claimedFiles: ['client/src/components/views/architecture/V3ArchitectureReadinessPanel.tsx'],
      prompt: 'Expose v3 compile, firmware, OpenAI Agents, and Codex dispatch readiness in the Architecture UI.',
      requiresHardwareFacts: [],
      verifiedHardwareFacts: verifiedFacts,
    },
  ] as const;

  const swarmPlan = planV3SwarmDispatch([...tasks]);
  const openAIDispatch = planV3OpenAIDispatch(swarmPlan);
  const codexTemplates = createV3CodexCommandTemplates(swarmPlan);
  const blockedReasons = [
    ...(compileReport.status === 'ready' ? [] : ['compile report must be ready before swarm dispatch']),
    ...(firmwareNode ? [] : ['firmware boundary node is required before firmware generation']),
    ...pinGate.blockedReasons,
    ...swarmPlan.blockedReasons,
    ...openAIDispatch.blockedReasons,
    ...codexTemplates.blockedReasons,
  ];

  return {
    status: blockedReasons.length > 0 ? 'blocked' : 'ready',
    pinGate,
    swarmPlan,
    openAIDispatch,
    codexTemplates,
    blockedReasons: Array.from(new Set(blockedReasons)),
    summary: {
      workers: swarmPlan.tasks.length,
      openAIDispatches: openAIDispatch.dispatches.length,
      codexCommands: codexTemplates.templates.length,
      ownedPins: pinGate.ownedPins.length,
    },
  };
}

function hasKind(data: unknown, expected: string): boolean {
  const kind = readString(data, 'kind') ?? readString(data, 'type') ?? '';
  return kind.toLowerCase().includes(expected);
}

function collectVerifiedFacts(nodes: GraphNode[]): string[] {
  const facts = new Set<string>();
  for (const node of nodes) {
    for (const field of ['verifiedFacts', 'facts', 'sourceFacts']) {
      for (const fact of readStringArray(node.data, field) ?? []) {
        facts.add(fact);
      }
    }
    if (isVerified(node.data) && (readStringArray(node.data, 'pinout') || readStringArray(node.data, 'pins'))) {
      facts.add('pinout');
    }
  }
  return [...facts];
}

function readData(data: unknown): Record<string, unknown> {
  return data && typeof data === 'object' ? data as Record<string, unknown> : {};
}

function readString(data: unknown, key: string): string | undefined {
  const value = readData(data)[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readStringArray(data: unknown, key: string): string[] | undefined {
  const value = readData(data)[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return strings.length > 0 ? strings : undefined;
}

function isVerified(data: unknown): boolean {
  const value = readData(data);
  return value.verified === true
    || value.verificationStatus === 'verified'
    || value.status === 'verified'
    || value.sourceStatus === 'verified';
}
