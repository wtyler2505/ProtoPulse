import { useCallback } from 'react';
import { Crosshair, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

import { CollapsibleSection } from './AnalysisParamsForms';

import type { Probe } from './simulation-types';

// ---------------------------------------------------------------------------
// Probe Manager Section
// ---------------------------------------------------------------------------

export default function ProbeManager({
  probes,
  onProbesChange,
  disabled,
}: {
  probes: Probe[];
  onProbesChange: (probes: Probe[]) => void;
  disabled: boolean;
}) {
  const addProbe = useCallback(() => {
    const newProbe: Probe = {
      id: crypto.randomUUID(),
      name: `Probe ${probes.length + 1}`,
      type: 'voltage',
      nodeOrComponent: '',
    };
    onProbesChange([...probes, newProbe]);
  }, [probes, onProbesChange]);

  const removeProbe = useCallback((probeId: string) => {
    onProbesChange(probes.filter((p) => p.id !== probeId));
  }, [probes, onProbesChange]);

  const updateProbe = useCallback((probeId: string, updates: Partial<Omit<Probe, 'id'>>) => {
    onProbesChange(probes.map((p) => (p.id === probeId ? { ...p, ...updates } : p)));
  }, [probes, onProbesChange]);

  return (
    <CollapsibleSection title="Probes" testId="section-probes">
      {probes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic mb-3">
          No probes placed. Add probes to monitor specific nodes or component currents.
        </p>
      ) : (
        <div className="flex flex-col gap-2 mb-3">
          {probes.map((probe) => (
            <div
              key={probe.id}
              className="flex items-center gap-2 p-2 bg-background border border-border"
              data-testid={`probe-${probe.id}`}
            >
              <Crosshair className="w-3.5 h-3.5 text-primary shrink-0" />
              <input
                type="text"
                value={probe.name}
                onChange={(e) => updateProbe(probe.id, { name: e.target.value })}
                className="flex-1 h-6 px-2 text-xs bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 text-foreground placeholder:text-muted-foreground/50"
                placeholder="Probe name"
                data-testid={`probe-name-${probe.id}`}
              />
              <select
                value={probe.type}
                onChange={(e) =>
                  updateProbe(probe.id, { type: e.target.value as 'voltage' | 'current' })
                }
                className="h-6 px-1 text-[10px] bg-muted/30 border border-border text-muted-foreground appearance-none"
                data-testid={`probe-type-${probe.id}`}
              >
                <option value="voltage">Voltage</option>
                <option value="current">Current</option>
              </select>
              <input
                type="text"
                value={probe.nodeOrComponent}
                onChange={(e) => updateProbe(probe.id, { nodeOrComponent: e.target.value })}
                className="w-28 h-6 px-2 text-xs bg-transparent border border-border focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-cyan-400/50 text-foreground placeholder:text-muted-foreground/50 font-mono"
                placeholder="Node/Comp"
                data-testid={`probe-node-${probe.id}`}
              />
              <button
                type="button"
                onClick={() => removeProbe(probe.id)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                data-testid={`probe-remove-${probe.id}`}
                title="Remove probe"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={addProbe}
        disabled={disabled}
        data-testid="add-probe"
        className={cn(
          'flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <Plus className="w-3.5 h-3.5" />
        Add Probe
      </button>
    </CollapsibleSection>
  );
}
