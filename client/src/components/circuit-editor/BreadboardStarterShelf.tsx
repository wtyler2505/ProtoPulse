import type { ComponentType } from 'react';

import { Cpu, Lightbulb, Radio, Shield, ToggleLeft, Waves, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

const LEGACY_COMPONENT_DRAG_TYPE = 'application/reactflow/type';
const LEGACY_COMPONENT_LABEL = 'application/reactflow/label';

interface StarterPart {
  id: string;
  type: string;
  label: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  accentClassName: string;
}

const STARTER_PARTS: StarterPart[] = [
  {
    id: 'microcontroller',
    type: 'mcu',
    label: 'Microcontroller',
    detail: 'Drop a DIP-style MCU body across the trench.',
    icon: Cpu,
    accentClassName: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  },
  {
    id: 'dip-ic',
    type: 'ic',
    label: 'DIP IC',
    detail: 'Quick-start logic and driver packages.',
    icon: Shield,
    accentClassName: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
  },
  {
    id: 'led',
    type: 'led',
    label: 'LED',
    detail: 'Polarized indicator with live-state rendering.',
    icon: Lightbulb,
    accentClassName: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  },
  {
    id: 'resistor',
    type: 'resistor',
    label: 'Resistor',
    detail: 'Starter passive for current limiting and dividers.',
    icon: Waves,
    accentClassName: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  },
  {
    id: 'capacitor',
    type: 'capacitor',
    label: 'Capacitor',
    detail: 'Decoupling, timing, and filtering experiments.',
    icon: Radio,
    accentClassName: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  },
  {
    id: 'diode',
    type: 'diode',
    label: 'Diode',
    detail: 'One-way current flow and protection checks.',
    icon: Zap,
    accentClassName: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  },
  {
    id: 'switch',
    type: 'switch',
    label: 'Switch',
    detail: 'Simple input and state-toggle behavior.',
    icon: ToggleLeft,
    accentClassName: 'border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300',
  },
];

function StarterShelfCard({ part }: { part: StarterPart }) {
  const Icon = part.icon;

  return (
    <button
      type="button"
      draggable
      data-testid={`breadboard-starter-${part.id}`}
      onDragStart={(event) => {
        event.dataTransfer.setData(LEGACY_COMPONENT_DRAG_TYPE, part.type);
        event.dataTransfer.setData(LEGACY_COMPONENT_LABEL, part.label);
        event.dataTransfer.setData('text/plain', part.label);
        event.dataTransfer.effectAllowed = 'copy';
      }}
      className={cn(
        'group flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition-all',
        'hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        part.accentClassName,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-current/20 bg-background/40">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{part.label}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Starter drop</p>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{part.detail}</p>
    </button>
  );
}

export default function BreadboardStarterShelf() {
  return (
    <section
      data-testid="breadboard-starter-shelf"
      className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
    >
      <div className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/90">Starter Shelf</p>
        <h3 className="mt-1 text-sm font-semibold text-foreground">Drag common parts straight onto the board</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Start wiring immediately, then swap to project-linked parts when you want exact library metadata and pin counts.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {STARTER_PARTS.map((part) => (
          <StarterShelfCard key={part.id} part={part} />
        ))}
      </div>
    </section>
  );
}
