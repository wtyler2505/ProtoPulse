import { z } from 'zod';
import { VerificationStatusSchema } from '../../contracts/status';

export const TscircuitElementSchema = z.object({
  kind: z.enum(['board', 'resistor', 'capacitor', 'trace', 'chip', 'connector', 'powerRail']),
  name: z.string().optional(),
  props: z.record(z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.record(z.string()),
  ])).default({}),
  provenance: z.array(z.string().min(1)).min(1),
  status: VerificationStatusSchema,
});

export const TscircuitDraftSchema = z.object({
  elements: z.array(TscircuitElementSchema),
});

export type TscircuitDraft = z.infer<typeof TscircuitDraftSchema>;

export function createTscircuitDraft(input: unknown): TscircuitDraft {
  const draft = TscircuitDraftSchema.parse(input);
  const unsafe = draft.elements.filter((element) => element.status !== 'verified');
  if (unsafe.length > 0) {
    throw new Error(`Cannot emit tscircuit TSX with unverified elements: ${unsafe.map((e) => e.name ?? e.kind).join(', ')}`);
  }
  return draft;
}

export function emitTscircuitTsx(draft: TscircuitDraft): string {
  const verifiedDraft = createTscircuitDraft(draft);
  const body = verifiedDraft.elements
    .filter((element) => element.kind !== 'board')
    .map((element) => `    ${emitElement(element)}`)
    .join('\n');

  const board = verifiedDraft.elements.find((element) => element.kind === 'board');
  const boardProps = board ? emitProps(board.props) : '';

  return [
    'export default () => (',
    `  <board${boardProps}>`,
    body,
    '  </board>',
    ')',
    '',
  ].join('\n');
}

function emitElement(element: z.infer<typeof TscircuitElementSchema>): string {
  const nameProp: Record<string, string> = element.name ? { name: element.name } : {};
  if (element.kind === 'powerRail') {
    return `{/* powerRail ${element.name ?? ''}: ${JSON.stringify(element.props)} */}`;
  }
  return `<${element.kind}${emitProps({ ...nameProp, ...element.props })} />`;
}

function emitProps(props: Record<string, string | number | boolean | Record<string, string>>): string {
  const entries = Object.entries(props);
  if (entries.length === 0) {
    return '';
  }
  return entries.map(([key, value]) => {
    if (typeof value === 'number' || typeof value === 'boolean') {
      return ` ${key}={${JSON.stringify(value)}}`;
    }
    if (typeof value === 'object') {
      return ` ${key}={${JSON.stringify(value)}}`;
    }
    return ` ${key}=${JSON.stringify(value)}`;
  }).join('');
}
