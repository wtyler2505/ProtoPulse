/**
 * BreadboardToolbar — top bar for the breadboard editor.
 *
 * Extracted verbatim from BreadboardView.tsx (audit #29).
 * Contains: workbench panel toggle, circuit selector, live simulation toggle,
 * and active circuit name label.
 */

import { useSimulation } from '@/lib/contexts/simulation-context';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Activity, PanelLeftClose, PanelLeftOpen, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CircuitDesignRow } from '@shared/schema';

export interface BreadboardToolbarProps {
  circuits: CircuitDesignRow[];
  activeCircuit: CircuitDesignRow | null;
  onSelectCircuit: (id: number) => void;
  workbenchOpen: boolean;
  onToggleWorkbench: () => void;
}

export function BreadboardToolbar({
  circuits,
  activeCircuit,
  onSelectCircuit,
  workbenchOpen,
  onToggleWorkbench,
}: BreadboardToolbarProps) {
  const { isLive, setIsLive, clearStates } = useSimulation();

  return (
    <div className="h-10 border-b border-border bg-card/60 backdrop-blur-xl flex items-center px-3 gap-2 shrink-0" data-testid="breadboard-toolbar">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid="button-toggle-breadboard-bench"
        onClick={onToggleWorkbench}
        className="h-7 px-1.5 text-muted-foreground hover:text-foreground"
      >
        {workbenchOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </Button>
      <div className="w-px h-4 bg-border" />
      <Select
        value={String(activeCircuit?.id ?? '')}
        onValueChange={v => onSelectCircuit(Number(v))}
      >
        <SelectTrigger className="h-7 w-48 text-xs" data-testid="select-breadboard-circuit">
          <SelectValue placeholder="Select circuit" />
        </SelectTrigger>
        <SelectContent>
          {circuits.map((c: CircuitDesignRow) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-px h-4 bg-border mx-1" />

      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-7 gap-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider transition-all",
          isLive
            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => {
          if (isLive) clearStates();
          setIsLive(!isLive);
        }}
      >
        {isLive ? <Square className="w-3 h-3 fill-current" /> : <Activity className="w-3 h-3" />}
        {isLive ? 'Stop Simulation' : 'Live Simulation'}
      </Button>

      <div className="flex-1" />
      <span className="text-xs text-muted-foreground">
        {activeCircuit ? activeCircuit.name : 'No circuit selected'} — Wiring Bench
      </span>
    </div>
  );
}
