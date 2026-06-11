import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  getTargetSummary,
  getViewSummary,
  radialSlotMeta,
  type MenuContext,
  type RadialCommandGroup,
  type RadialMenuItem,
} from '@/lib/radial-menu-actions';

export interface RadialCommandPreviewState {
  context: MenuContext;
  item: RadialMenuItem;
  position: { x: number; y: number };
}

interface RadialCommandPreviewProps {
  preview: RadialCommandPreviewState;
}

type PreviewKind = 'create' | 'connect' | 'inspect' | 'run' | 'delete' | 'edit' | 'reuse' | 'transform' | 'rail' | 'ai';

interface PreviewTone {
  stroke: string;
  fill: string;
  chip: string;
  muted: string;
}

const toneByKind: Record<PreviewKind, PreviewTone> = {
  create: {
    stroke: 'stroke-emerald-300',
    fill: 'fill-emerald-300/15',
    chip: 'border-emerald-300/45 bg-emerald-500/15 text-emerald-50',
    muted: 'text-emerald-100/80',
  },
  connect: {
    stroke: 'stroke-cyan-300',
    fill: 'fill-cyan-300/15',
    chip: 'border-cyan-300/45 bg-cyan-500/15 text-cyan-50',
    muted: 'text-cyan-100/80',
  },
  inspect: {
    stroke: 'stroke-teal-300',
    fill: 'fill-teal-300/15',
    chip: 'border-teal-300/45 bg-teal-500/15 text-teal-50',
    muted: 'text-teal-100/80',
  },
  run: {
    stroke: 'stroke-amber-300',
    fill: 'fill-amber-300/15',
    chip: 'border-amber-300/45 bg-amber-500/15 text-amber-50',
    muted: 'text-amber-100/80',
  },
  delete: {
    stroke: 'stroke-red-300',
    fill: 'fill-red-400/15',
    chip: 'border-red-300/45 bg-red-500/15 text-red-50',
    muted: 'text-red-100/80',
  },
  edit: {
    stroke: 'stroke-blue-300',
    fill: 'fill-blue-300/15',
    chip: 'border-blue-300/45 bg-blue-500/15 text-blue-50',
    muted: 'text-blue-100/80',
  },
  reuse: {
    stroke: 'stroke-lime-300',
    fill: 'fill-lime-300/15',
    chip: 'border-lime-300/45 bg-lime-500/15 text-lime-50',
    muted: 'text-lime-100/80',
  },
  transform: {
    stroke: 'stroke-sky-300',
    fill: 'fill-sky-300/15',
    chip: 'border-sky-300/45 bg-sky-500/15 text-sky-50',
    muted: 'text-sky-100/80',
  },
  rail: {
    stroke: 'stroke-violet-300',
    fill: 'fill-violet-300/15',
    chip: 'border-violet-300/45 bg-violet-500/15 text-violet-50',
    muted: 'text-violet-100/80',
  },
  ai: {
    stroke: 'stroke-fuchsia-200',
    fill: 'fill-fuchsia-300/15',
    chip: 'border-fuchsia-300/45 bg-fuchsia-500/15 text-fuchsia-50',
    muted: 'text-fuchsia-100/80',
  },
};

const AI_COMMAND_IDS = new Set([
  'generate_architecture',
  'ai_propose_connection',
  'ai_explain_architecture',
  'ai_expand_block',
  'explain_issue',
  'ai_part_tradeoffs',
]);
const AI_DELIVERY_HINT = 'Click drafts / Shift-click sends';

interface AiPromptPreview {
  detail: string;
  packet: string;
  scope: string;
  bound: string;
  delivery: string;
}

type AiPromptDescriptor = Omit<AiPromptPreview, 'scope' | 'bound'> & {
  bound?: string;
};

const AI_PROMPT_PREVIEWS: Record<string, AiPromptDescriptor> = {
  generate_architecture: {
    detail: 'Drafts a starting architecture from the project goal and current canvas.',
    packet: 'Project goal, blocks, edges',
    delivery: 'Click to open assistant action',
  },
  ai_propose_connection: {
    detail: 'Suggests the next useful block-to-block connection.',
    packet: 'Selected block, ports, nearby edges',
    bound: 'Architecture connection prompt',
    delivery: 'Click to ask for a proposal',
  },
  ai_explain_architecture: {
    detail: 'Explains architecture intent, tradeoffs, and missing links.',
    packet: 'Block role, edges, analysis signals',
    bound: 'Architecture explanation prompt',
    delivery: 'Click to open assistant notes',
  },
  ai_expand_block: {
    detail: 'Expands a block into practical parts, interfaces, and next steps.',
    packet: 'Block summary, links, project context',
    bound: 'Block expansion prompt',
    delivery: 'Click to draft expansion',
  },
  ai_schematic_review: {
    detail: 'Reviews symbol wiring, nets, ERC risk, and missing protections.',
    packet: 'Symbol, pins, nets, ERC signals',
    bound: 'Schematic review prompt',
    delivery: 'Click to start review',
  },
  ai_pcb_review: {
    detail: 'Reviews footprint placement, routing, DRC, and DFM risk.',
    packet: 'Footprint, traces, vias, DRC signals',
    bound: 'PCB review prompt',
    delivery: 'Click to start review',
  },
  ai_breadboard_wiring: {
    detail: 'Reviews jumpers, rails, placement, and bench-build risk.',
    packet: 'Part, jumpers, rails, audit state',
    bound: 'Breadboard wiring prompt',
    delivery: 'Click to start wiring review',
  },
  explain_issue: {
    detail: 'Explains cause, impact, and fix path for this validation issue.',
    packet: 'Issue, source link, rule context',
    bound: 'Validation issue prompt',
    delivery: 'Click to explain issue',
  },
  ai_part_tradeoffs: {
    detail: 'Compares cost, availability, lifecycle, and substitution risk.',
    packet: 'BOM line, alternates, supply signals',
    bound: 'Part tradeoff prompt',
    delivery: 'Click to compare options',
  },
  ai_simulation_explain: {
    detail: 'Explains probe intent, expected behavior, and next simulation checks.',
    packet: 'Selected probe, sweep state, controls',
    bound: 'Simulation explanation prompt',
    delivery: 'Click to explain signals',
  },
  ai_starter_learn: {
    detail: 'Explains the starter circuit, wiring idea, and first safe build step.',
    packet: 'Circuit goal, parts, sketch preview',
    bound: 'Starter circuit learning prompt',
    delivery: 'Click to open lesson prompt',
  },
  ai_3d_fit_inspection: {
    detail: 'Checks 3D fit, route provenance, clearance, and physical risk.',
    packet: 'Model part, traces, vias, bridge data',
    bound: '3D fit inspection prompt',
    delivery: 'Click to inspect fit',
  },
  ai_serial_decode: {
    detail: 'Decodes recent serial output and likely hardware or firmware causes.',
    packet: 'Recent log lines, baud, board state',
    bound: 'Serial decode prompt',
    delivery: 'Click to decode stream',
  },
};

function isAiCommand(item: RadialMenuItem): boolean {
  return AI_COMMAND_IDS.has(item.id) || item.id.startsWith('ai_') || /\bai\b/i.test(item.label);
}

function previewKind(context: MenuContext, item: RadialMenuItem): PreviewKind {
  if (isAiCommand(item)) {
    return 'ai';
  }
  if (context.view === 'breadboard' && item.id === 'show_rails') {
    return 'rail';
  }
  if (item.destructive || item.group === 'delete') {
    return 'delete';
  }
  if (item.id === 'add_wire' || item.id === 'route_trace' || item.id === 'connect' || item.id === 'cross_probe') {
    return 'connect';
  }
  return item.group as PreviewKind;
}

function previewDetail(context: MenuContext, item: RadialMenuItem, kind: PreviewKind): string {
  if (item.disabled && item.disabledReason) {
    return item.disabledReason;
  }
  if (kind === 'ai') {
    return `AI prompt with ${getViewSummary(context)} ${getTargetSummary(context)} context`;
  }
  if (kind === 'rail') {
    return 'rail continuity highlight';
  }
  if (kind === 'connect') {
    if (context.view === 'pcb') { return 'route ghost from pointer'; }
    if (context.view === 'breadboard') { return 'jumper wire ghost'; }
    return 'connection ghost from target';
  }
  if (kind === 'delete') {
    return `delete outline on ${getTargetSummary(context)}`;
  }
  if (item.id === 'measure') {
    return 'measurement anchor ready';
  }
  return `${getViewSummary(context)} ${context.target}`;
}

function aiPromptPreview(context: MenuContext, item: RadialMenuItem): AiPromptPreview {
  const descriptor = AI_PROMPT_PREVIEWS[item.id];
  const target = getTargetSummary(context);
  const view = getViewSummary(context);

  if (!descriptor) {
    return {
      detail: `AI prompt with ${view} ${target} context`,
      packet: `${view} context and selection`,
      scope: `${view} / ${target}`,
      bound: `${target} prompt`,
      delivery: 'Click to send prompt',
    };
  }

  return {
    ...descriptor,
    scope: `${view} / ${target}`,
    bound: descriptor.bound ?? `${target} prompt`,
  };
}

function chipPosition(position: { x: number; y: number }, kind: PreviewKind): { left: number; top: number } {
  const width = kind === 'ai' ? 276 : 220;
  const height = kind === 'ai' ? 164 : 78;
  const margin = 12;
  const viewportWidth = typeof window === 'undefined' ? 1366 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight;
  return {
    left: Math.max(margin, Math.min(position.x + 28, viewportWidth - width - margin)),
    top: Math.max(margin, Math.min(position.y + 22, viewportHeight - height - margin)),
  };
}

function AiPromptPreviewRows({ prompt, tone }: { prompt: AiPromptPreview; tone: PreviewTone }) {
  return (
    <>
      <div data-testid="radial-command-preview-detail" className={cn('mt-1 line-clamp-2 text-[10px] leading-tight', tone.muted)}>
        {prompt.detail}
      </div>
      <div className="mt-2 space-y-1 text-[9px] leading-tight">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn('shrink-0 font-semibold', tone.muted)}>Packet</span>
          <span data-testid="radial-command-preview-ai-meta" className="min-w-0 truncate font-medium">
            {prompt.packet}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn('shrink-0 font-semibold', tone.muted)}>Scope</span>
          <span data-testid="radial-command-preview-ai-scope" className="min-w-0 truncate font-medium">
            {prompt.scope}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn('shrink-0 font-semibold', tone.muted)}>Bound</span>
          <span data-testid="radial-command-preview-ai-bound" className="min-w-0 truncate font-medium">
            {prompt.bound}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn('shrink-0 font-semibold', tone.muted)}>Run</span>
          <span data-testid="radial-command-preview-ai-delivery" className="min-w-0 truncate font-medium">
            {prompt.delivery}
          </span>
        </div>
      </div>
      <div
        data-testid="radial-command-preview-ai-hint"
        className="mt-2 truncate rounded border border-current/25 bg-background/20 px-1.5 py-1 text-center text-[9px] font-semibold leading-none"
      >
        {AI_DELIVERY_HINT}
      </div>
    </>
  );
}

function previewGlyph(kind: PreviewKind, tone: PreviewTone, x: number, y: number) {
  switch (kind) {
    case 'connect':
      return (
        <g>
          <line x1={x - 82} y1={y + 34} x2={x + 108} y2={y - 30} className={tone.stroke} strokeWidth={4} strokeLinecap="round" strokeDasharray="10 8" />
          <circle cx={x - 82} cy={y + 34} r={9} className={cn(tone.fill, tone.stroke)} strokeWidth={2} />
          <circle cx={x + 108} cy={y - 30} r={12} className={cn(tone.fill, tone.stroke)} strokeWidth={2.5} />
        </g>
      );
    case 'delete':
      return (
        <g>
          <rect x={x - 58} y={y - 38} width={116} height={76} rx={10} className={cn(tone.fill, tone.stroke)} strokeWidth={3} strokeDasharray="9 7" />
          <line x1={x - 42} y1={y - 28} x2={x + 42} y2={y + 28} className={tone.stroke} strokeWidth={4} strokeLinecap="round" />
          <line x1={x + 42} y1={y - 28} x2={x - 42} y2={y + 28} className={tone.stroke} strokeWidth={4} strokeLinecap="round" />
        </g>
      );
    case 'inspect':
      return (
        <g>
          <circle cx={x} cy={y} r={48} className={cn(tone.fill, tone.stroke)} strokeWidth={2.5} strokeDasharray="5 7" />
          <line x1={x - 70} y1={y} x2={x - 24} y2={y} className={tone.stroke} strokeWidth={3} strokeLinecap="round" />
          <line x1={x + 24} y1={y} x2={x + 70} y2={y} className={tone.stroke} strokeWidth={3} strokeLinecap="round" />
          <line x1={x} y1={y - 70} x2={x} y2={y - 24} className={tone.stroke} strokeWidth={3} strokeLinecap="round" />
          <line x1={x} y1={y + 24} x2={x} y2={y + 70} className={tone.stroke} strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    case 'rail':
      return (
        <g>
          <rect x={x - 118} y={y - 46} width={236} height={18} rx={9} className="fill-red-400/20 stroke-red-300" strokeWidth={2} />
          <rect x={x - 118} y={y + 28} width={236} height={18} rx={9} className="fill-blue-400/20 stroke-blue-300" strokeWidth={2} />
          <line x1={x - 88} y1={y - 37} x2={x + 88} y2={y + 37} className={tone.stroke} strokeWidth={3} strokeLinecap="round" strokeDasharray="8 7" />
        </g>
      );
    case 'ai':
      return (
        <g>
          <path d={`M ${String(x - 78)} ${String(y - 32)} Q ${String(x - 78)} ${String(y - 58)} ${String(x - 48)} ${String(y - 58)} H ${String(x + 56)} Q ${String(x + 86)} ${String(y - 58)} ${String(x + 86)} ${String(y - 28)} V ${String(y + 20)} Q ${String(x + 86)} ${String(y + 48)} ${String(x + 54)} ${String(y + 48)} H ${String(x + 6)} L ${String(x - 34)} ${String(y + 70)} L ${String(x - 26)} ${String(y + 48)} H ${String(x - 48)} Q ${String(x - 78)} ${String(y + 48)} ${String(x - 78)} ${String(y + 18)} Z`} className={cn(tone.fill, tone.stroke)} strokeWidth={2.5} strokeLinejoin="round" />
          <path d={`M ${String(x - 42)} ${String(y - 14)} H ${String(x + 42)} M ${String(x - 42)} ${String(y + 8)} H ${String(x + 18)}`} className={tone.stroke} strokeWidth={4} strokeLinecap="round" />
          <path d={`M ${String(x + 54)} ${String(y - 34)} L ${String(x + 60)} ${String(y - 20)} L ${String(x + 74)} ${String(y - 14)} L ${String(x + 60)} ${String(y - 8)} L ${String(x + 54)} ${String(y + 6)} L ${String(x + 48)} ${String(y - 8)} L ${String(x + 34)} ${String(y - 14)} L ${String(x + 48)} ${String(y - 20)} Z`} className={tone.fill} />
        </g>
      );
    case 'run':
      return (
        <g>
          <path d={`M ${String(x)} ${String(y - 58)} L ${String(x + 54)} ${String(y - 32)} L ${String(x + 40)} ${String(y + 42)} L ${String(x)} ${String(y + 62)} L ${String(x - 40)} ${String(y + 42)} L ${String(x - 54)} ${String(y - 32)} Z`} className={cn(tone.fill, tone.stroke)} strokeWidth={2.5} />
          <path d={`M ${String(x - 23)} ${String(y + 2)} L ${String(x - 5)} ${String(y + 22)} L ${String(x + 28)} ${String(y - 18)}`} className={tone.stroke} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      );
    case 'edit':
      return (
        <g>
          <rect x={x - 62} y={y - 42} width={124} height={84} rx={9} className={cn(tone.fill, tone.stroke)} strokeWidth={2.5} />
          <line x1={x - 38} y1={y - 12} x2={x + 36} y2={y - 12} className={tone.stroke} strokeWidth={3} strokeLinecap="round" />
          <line x1={x - 38} y1={y + 11} x2={x + 16} y2={y + 11} className={tone.stroke} strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    case 'reuse':
      return (
        <g>
          <rect x={x - 70} y={y - 24} width={82} height={58} rx={8} className={cn(tone.fill, tone.stroke)} strokeWidth={2.5} />
          <rect x={x - 12} y={y - 44} width={82} height={58} rx={8} className={cn(tone.fill, tone.stroke)} strokeWidth={2.5} />
        </g>
      );
    case 'transform':
      return (
        <g>
          <rect x={x - 54} y={y - 34} width={108} height={68} rx={10} className={cn(tone.fill, tone.stroke)} strokeWidth={2.5} strokeDasharray="8 6" />
          <path d={`M ${String(x - 42)} ${String(y - 48)} C ${String(x + 8)} ${String(y - 84)}, ${String(x + 72)} ${String(y - 38)}, ${String(x + 36)} ${String(y + 8)}`} className={tone.stroke} strokeWidth={4} strokeLinecap="round" fill="none" />
          <path d={`M ${String(x + 36)} ${String(y + 8)} L ${String(x + 38)} ${String(y - 20)} L ${String(x + 12)} ${String(y - 8)} Z`} className={tone.fill} />
        </g>
      );
    case 'create':
    default:
      return (
        <g>
          <rect x={x - 54} y={y - 36} width={108} height={72} rx={10} className={cn(tone.fill, tone.stroke)} strokeWidth={2.5} strokeDasharray="8 6" />
          <line x1={x} y1={y - 21} x2={x} y2={y + 21} className={tone.stroke} strokeWidth={4} strokeLinecap="round" />
          <line x1={x - 21} y1={y} x2={x + 21} y2={y} className={tone.stroke} strokeWidth={4} strokeLinecap="round" />
        </g>
      );
  }
}

function RadialCommandPreview({ preview }: RadialCommandPreviewProps) {
  const kind = previewKind(preview.context, preview.item);
  const tone = preview.item.disabled ? {
    stroke: 'stroke-muted-foreground',
    fill: 'fill-muted/20',
    chip: 'border-border bg-background/90 text-muted-foreground',
    muted: 'text-muted-foreground',
  } : toneByKind[kind];
  const slot = radialSlotMeta[preview.item.slot];
  const chip = useMemo(() => chipPosition(preview.position, kind), [preview.position, kind]);
  const detail = previewDetail(preview.context, preview.item, kind);
  const aiPrompt = useMemo(
    () => (kind === 'ai' && !preview.item.disabled ? aiPromptPreview(preview.context, preview.item) : null),
    [kind, preview.context, preview.item],
  );

  return (
    <div
      data-testid="radial-command-preview"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9997] [contain:layout_paint_style]"
    >
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <filter id="radial-command-preview-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="rgba(34,211,238,0.32)" />
          </filter>
        </defs>
        <g filter="url(#radial-command-preview-glow)">
          {previewGlyph(kind, tone, preview.position.x, preview.position.y)}
        </g>
      </svg>
      <div
        data-testid="radial-command-preview-chip"
        className={cn(
          'fixed rounded border px-2.5 py-2 text-xs shadow-2xl backdrop-blur-xl',
          kind === 'ai' ? 'h-[9.75rem] w-[17.25rem]' : 'w-[13.75rem]',
          tone.chip,
        )}
        style={{ left: chip.left, top: chip.top }}
      >
        <div className="flex items-center justify-between gap-2">
          <span data-testid="radial-command-preview-label" className="min-w-0 truncate font-semibold">
            {preview.item.label}
          </span>
          <span className="shrink-0 rounded border border-current/35 px-1.5 py-0.5 text-[9px] font-semibold leading-none">
            {slot.direction}
          </span>
          {kind === 'ai' && (
            <span data-testid="radial-command-preview-ai-badge" className="shrink-0 rounded border border-current/35 px-1.5 py-0.5 text-[9px] font-semibold leading-none">
              AI
            </span>
          )}
        </div>
        {aiPrompt ? (
          <AiPromptPreviewRows prompt={aiPrompt} tone={tone} />
        ) : (
          <div data-testid="radial-command-preview-detail" className={cn('mt-1 truncate text-[10px]', tone.muted)}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(RadialCommandPreview);
