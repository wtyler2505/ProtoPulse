import type { Connector, PartMeta } from '@shared/component-types';
import { buildExactPartAiPolicy } from '@shared/exact-part-ai-policy';
import type { CircuitAiExactPartIntent } from '@shared/circuit-ai-types';
import {
  findExactPartPlaybooksInText,
  resolveExactPartRequest,
  type ExactPartResolution,
  type ExactPartResolutionKind,
} from '@shared/exact-part-resolver';
import type { ComponentPart } from '@shared/schema';

function formatPins(connectors: Connector[]): string {
  if (connectors.length === 0) {
    return 'none listed';
  }
  return connectors.map((connector) => `${connector.id}(${connector.name})`).join(', ');
}

function formatPartLine(part: ComponentPart): string {
  const meta = (part.meta ?? {}) as Partial<PartMeta>;
  const connectors = (part.connectors ?? []) as Connector[];
  const policy = buildExactPartAiPolicy(part);

  return `  - Part #${String(part.id)}: "${policy.title}" (family: ${meta.family || policy.family || 'unknown'}, pins: ${formatPins(connectors)}, exact-part: ${policy.placementMode}, verification: ${policy.status}/${policy.level}, authoritative wiring: ${policy.authoritativeWiringAllowed ? 'yes' : 'no'}, rule: ${policy.aiRule})`;
}

function buildExactPartIntentMessage(resolution: ExactPartResolution): string {
  switch (resolution.kind) {
    case 'verified-match':
      return `${resolution.playbook?.title ?? resolution.query}: verified exact part ready as Part #${String(resolution.topMatch?.part.id ?? 0)}.`;
    case 'candidate-match':
      return `${resolution.playbook?.title ?? resolution.query}: only a candidate exact part is available as Part #${String(resolution.topMatch?.part.id ?? 0)}. Placement may be provisional, but exact wiring is not authoritative yet.`;
    case 'ambiguous-match':
      return `${resolution.playbook?.title ?? resolution.query}: multiple close exact matches exist. Do not invent exact wiring details if the requested revision is unclear.`;
    case 'needs-draft':
      return `${resolution.playbook?.title ?? resolution.query}: no trustworthy exact part is available yet. Do not substitute a generic board/module; omit it from JSON instead of inventing connector names or fake board details.`;
    case 'empty':
      return `${resolution.query}: no exact-part request detected.`;
  }
}

export function collectCircuitAiExactPartIntents(
  description: string,
  parts: ComponentPart[],
): CircuitAiExactPartIntent[] {
  return findExactPartPlaybooksInText(description).map((playbook) => {
    const resolution = resolveExactPartRequest(playbook.title, parts);
    return {
      kind: resolution.kind,
      message: buildExactPartIntentMessage(resolution),
      recommendedDraftDescription: resolution.recommendedDraftDescription,
      title: playbook.title,
      topMatchPartId: resolution.topMatch?.part.id ?? null,
    };
  });
}

export function buildGeneratePrompt(description: string, parts: ComponentPart[]): string {
  const partsList = parts.map(formatPartLine).join('\n');
  const exactPartIntents = collectCircuitAiExactPartIntents(description, parts);
  const exactPartIntentBlock = exactPartIntents.length > 0
    ? `\n\nEXACT PART REQUESTS DETECTED FROM THE USER DESCRIPTION:\n${exactPartIntents.map((intent) => `  - ${intent.message}`).join('\n')}`
    : '';

  return `You are an electronics design assistant. Given a circuit description and available component parts, generate a schematic.

AVAILABLE PARTS:
${partsList || '  (no parts available)'}${exactPartIntentBlock}

USER'S CIRCUIT DESCRIPTION:
${description}

Generate a JSON response with this structure:
{
  "instances": [
    { "partId": <number>, "referenceDesignator": "<string>", "x": <number>, "y": <number> }
  ],
  "nets": [
    { "name": "<string>", "netType": "signal"|"power"|"ground"|"bus", "segments": [
      { "fromInstanceRefDes": "<string>", "fromPin": "<string>", "toInstanceRefDes": "<string>", "toPin": "<string>" }
    ]}
  ]
}

Rules:
- Only use parts from the AVAILABLE PARTS list (reference by Part #id)
- Assign IEEE reference designators (U1, R1, C1, J1, etc.)
- Create nets for all electrical connections
- In fromPin/toPin fields, use the pin ID (e.g., "pin1"), not the display name
- Power nets should be named (VCC, GND, 3V3, etc.)
- Position instances on a grid with ~200px spacing
- Treat "verified-exact" parts as authoritative for connector identity
- Treat "provisional-exact" parts as placement-only candidates: you may place them, but do not invent extra connectors, pin names, or exact hookup details beyond the listed pins
- If an exact board/module request has no trustworthy match, omit that board/module from the JSON instead of substituting a different part
- Respond ONLY with valid JSON, no markdown fences or extra text`;
}
