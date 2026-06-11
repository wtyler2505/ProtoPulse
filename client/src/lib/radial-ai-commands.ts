import type { MenuContext, RadialCommandEventDetail } from '@/lib/radial-menu-actions';
import { recordRadialTelemetry } from '@/lib/radial-menu-telemetry';

export type RadialAiIntent =
  | 'generate'
  | 'explain'
  | 'propose_connection'
  | 'expand_block'
  | 'fix_issue'
  | 'find_alternates'
  | 'supply_risk'
  | 'summarize_tradeoffs'
  | 'review_schematic'
  | 'review_pcb'
  | 'breadboard_wiring'
  | 'serial_decode'
  | 'inspect_3d_fit'
  | 'explain_simulation'
  | 'starter_learn'
  | 'export_plan'
  | 'firmware_review'
  | 'inventory_plan';

export interface RadialAiPromptSection {
  title: string;
  lines: string[];
}

export interface BuildRadialAiPromptOptions {
  intent: RadialAiIntent;
  intro: string;
  summary: string;
  context?: MenuContext;
  targetDetails?: string[];
  sections?: RadialAiPromptSection[];
  finalInstruction?: string;
}

export interface RadialAiChatMessage {
  id: string;
  role: 'user';
  content: string;
  timestamp: number;
  mode: 'chat';
}

export type RadialAiAddMessage = (message: RadialAiChatMessage) => void;
export type RadialAiPromptDelivery = 'draft' | 'send-now';

export const LAST_RADIAL_AI_COMMAND_EVENT = 'protopulse:radial-ai-last-command-changed';
export const RADIAL_AI_CHAT_DRAFT_EVENT = 'protopulse:chat-draft';

export interface LastRadialAiCommand {
  intent: RadialAiIntent;
  label: string;
  summary: string;
  message: string;
  context?: MenuContext;
  createdAt: number;
}

interface RadialAiDraftTelemetry {
  intent: RadialAiIntent;
  context?: MenuContext;
  summary?: string;
}

const radialAiHistoryListeners = new Set<() => void>();
let lastRadialAiCommand: LastRadialAiCommand | null = null;

function appendContext(lines: string[], context: MenuContext): void {
  const targetLabel = context.targetLabel ?? context.targetId ?? context.target;
  lines.push(
    '',
    'Radial command context:',
    `- View: ${context.view}`,
    `- Target: ${context.target}${targetLabel ? ` "${targetLabel}"` : ''}`,
  );

  if (context.targetId) {
    lines.push(`- Target id: ${context.targetId}`);
  }

  if (context.pointer) {
    lines.push(`- Pointer: ${String(Math.round(context.pointer.x))}, ${String(Math.round(context.pointer.y))}`);
  }
}

function formatIntentLabel(intent: RadialAiIntent): string {
  return intent
    .split('_')
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(' ');
}

function getDefaultRadialAiHistoryLabel({
  intent,
  context,
}: Pick<BuildRadialAiPromptOptions, 'intent' | 'context'>): string {
  const targetLabel = context?.targetLabel ?? context?.targetId ?? context?.target;
  return targetLabel ? `${formatIntentLabel(intent)}: ${targetLabel}` : formatIntentLabel(intent);
}

function emitLastRadialAiCommandChange(): void {
  radialAiHistoryListeners.forEach((listener) => listener());

  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(LAST_RADIAL_AI_COMMAND_EVENT, {
      detail: { command: lastRadialAiCommand },
    }),
  );
}

function truncateTelemetryReason(summary: string | undefined): string | undefined {
  if (!summary) {
    return undefined;
  }
  return summary.length > 80 ? `${summary.slice(0, 77)}...` : summary;
}

function recordRadialAiPromptTelemetry(
  message: string,
  telemetry: RadialAiDraftTelemetry | undefined,
  delivery: RadialAiPromptDelivery,
): void {
  if (!telemetry?.context) {
    return;
  }

  recordRadialTelemetry({
    name: delivery === 'send-now' ? 'ai-send-now' : 'ai-draft',
    view: telemetry.context.view,
    target: telemetry.context.target,
    commandId: telemetry.intent,
    intent: telemetry.intent,
    promptChars: message.length,
    reason: truncateTelemetryReason(telemetry.summary),
  });
}

export function getRadialAiPromptDelivery(
  detail: Pick<RadialCommandEventDetail, 'activation'>,
): RadialAiPromptDelivery {
  return detail.activation?.sendNow ? 'send-now' : 'draft';
}

export function isRadialAiSendNow(detail: Pick<RadialCommandEventDetail, 'activation'>): boolean {
  return getRadialAiPromptDelivery(detail) === 'send-now';
}

export function getRadialAiDeliveryVerb(delivery: RadialAiPromptDelivery): 'Drafted' | 'Sent' {
  return delivery === 'send-now' ? 'Sent' : 'Drafted';
}

export function subscribeLastRadialAiCommand(listener: () => void): () => void {
  radialAiHistoryListeners.add(listener);
  return () => radialAiHistoryListeners.delete(listener);
}

export function getLastRadialAiCommand(): LastRadialAiCommand | null {
  return lastRadialAiCommand;
}

export function rememberRadialAiCommand(
  command: Omit<LastRadialAiCommand, 'createdAt'> & { createdAt?: number },
): void {
  lastRadialAiCommand = {
    ...command,
    createdAt: command.createdAt ?? Date.now(),
  };
  emitLastRadialAiCommandChange();
}

export function clearLastRadialAiCommandForTests(): void {
  lastRadialAiCommand = null;
  emitLastRadialAiCommandChange();
}

export function buildRadialAiPrompt({
  intent,
  intro,
  summary,
  context,
  targetDetails = [],
  sections = [],
  finalInstruction = 'Use the target context if it exists. Be specific about what should be added, changed, connected, validated, or moved next.',
}: BuildRadialAiPromptOptions): string {
  const lines = [intro, '', `AI intent: ${intent}.`, summary];

  if (context) {
    appendContext(lines, context);
  }

  if (targetDetails.length > 0) {
    lines.push('', 'Target details:');
    targetDetails.forEach((detail) => lines.push(`- ${detail}`));
  }

  sections.forEach((section) => {
    if (section.lines.length === 0) {
      return;
    }
    lines.push('', `${section.title}:`);
    section.lines.forEach((line) => lines.push(line.startsWith('- ') ? line : `- ${line}`));
  });

  lines.push('', finalInstruction);
  return lines.join('\n');
}

export function dispatchRadialAiPrompt({
  message,
  addMessage,
  telemetry,
  delivery = 'draft',
}: {
  message: string;
  addMessage?: RadialAiAddMessage;
  telemetry?: RadialAiDraftTelemetry;
  delivery?: RadialAiPromptDelivery;
}): void {
  void addMessage;
  recordRadialAiPromptTelemetry(message, telemetry, delivery);

  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent('protopulse:open-chat-panel', { detail: { designAgent: false } }));
  if (delivery === 'send-now') {
    window.dispatchEvent(
      new CustomEvent('protopulse:chat-send', {
        detail: {
          message,
          source: 'radial-ai',
          delivery,
        },
      }),
    );
    return;
  }

  window.dispatchEvent(
    new CustomEvent(RADIAL_AI_CHAT_DRAFT_EVENT, {
      detail: {
        message,
        source: 'radial-ai',
        delivery,
      },
    }),
  );
}

export function repeatLastRadialAiCommand({
  addMessage,
}: {
  addMessage?: RadialAiAddMessage;
} = {}): LastRadialAiCommand | null {
  const command = lastRadialAiCommand;
  if (!command) {
    return null;
  }

  dispatchRadialAiPrompt({
    message: command.message,
    addMessage,
    telemetry: {
      intent: command.intent,
      context: command.context,
      summary: command.summary,
    },
  });
  rememberRadialAiCommand({ ...command, createdAt: Date.now() });
  return command;
}

export function runRadialAiCommand({
  addMessage,
  historyLabel,
  remember = true,
  ...options
}: BuildRadialAiPromptOptions & {
  addMessage?: RadialAiAddMessage;
  delivery?: RadialAiPromptDelivery;
  historyLabel?: string;
  remember?: boolean;
}): string {
  const message = buildRadialAiPrompt(options);
  if (remember) {
    rememberRadialAiCommand({
      intent: options.intent,
      label: historyLabel ?? getDefaultRadialAiHistoryLabel(options),
      summary: options.summary,
      message,
      context: options.context,
    });
  }
  dispatchRadialAiPrompt({
    message,
    addMessage,
    delivery: options.delivery,
    telemetry: {
      intent: options.intent,
      context: options.context,
      summary: options.summary,
    },
  });
  return message;
}
