import { useCallback, useEffect } from 'react';
import { Crosshair, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  getRadialAiDeliveryVerb,
  getRadialAiPromptDelivery,
  runRadialAiCommand,
  type RadialAiPromptSection,
} from '@/lib/radial-ai-commands';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';

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
  const { toast } = useToast();

  const addProbe = useCallback(() => {
    const newProbe: Probe = {
      id: crypto.randomUUID(),
      name: `Probe ${probes.length + 1}`,
      type: 'voltage',
      nodeOrComponent: '',
    };
    onProbesChange([...probes, newProbe]);
  }, [probes, onProbesChange]);

  const removeProbe = useCallback(
    (probeId: string) => {
      onProbesChange(probes.filter((p) => p.id !== probeId));
    },
    [probes, onProbesChange],
  );

  const updateProbe = useCallback(
    (probeId: string, updates: Partial<Omit<Probe, 'id'>>) => {
      onProbesChange(probes.map((p) => (p.id === probeId ? { ...p, ...updates } : p)));
    },
    [probes, onProbesChange],
  );

  const handleRemoveProbeCommand = useCallback(
    (detail: RadialCommandEventDetail): void => {
      const selected = detail.context.targetId
        ? (probes.find((probe) => probe.id === detail.context.targetId) ?? null)
        : (probes[0] ?? null);

      if (!selected) {
        toast({
          title: 'No probe to remove',
          description: 'Add or select a simulation probe first.',
          variant: 'destructive',
        });
        return;
      }

      removeProbe(selected.id);
      toast({
        title: 'Probe removed',
        description: `${selected.name} was removed from the simulation setup.`,
      });
    },
    [probes, removeProbe, toast],
  );

  const handleAiSimulationExplain = useCallback(
    (detail: RadialCommandEventDetail): void => {
      const selected = detail.context.targetId
        ? (probes.find((probe) => probe.id === detail.context.targetId) ?? null)
        : (probes[0] ?? null);
      const targetLabel = detail.context.targetLabel ?? selected?.name ?? selected?.nodeOrComponent;
      const delivery = getRadialAiPromptDelivery(detail);
      const deliveryVerb = getRadialAiDeliveryVerb(delivery);
      const formatProbe = (probe: Probe): string =>
        `${probe.name} id=${probe.id} type=${probe.type} target=${probe.nodeOrComponent || 'unset'}`;
      const sections: RadialAiPromptSection[] = [
        {
          title: 'Simulation probes',
          lines: probes.slice(0, 10).map(formatProbe),
        },
        {
          title: 'Simulation control state',
          lines: [`Probe controls: ${disabled ? 'disabled' : 'enabled'}`, `Probe count: ${String(probes.length)}`],
        },
      ].filter((section) => section.lines.length > 0);

      runRadialAiCommand({
        intent: 'explain_simulation',
        intro:
          'Explain this simulation probe setup like a circuit debugging partner. Focus on what the selected probe is measuring, what result would be expected, and what Tyler should run or compare next.',
        summary: `Simulation explanation: ${String(probes.length)} probe(s), selected ${targetLabel ?? 'simulation setup'}.`,
        historyLabel: targetLabel ? `Simulation explain: ${targetLabel}` : 'Simulation explain',
        context: detail.context,
        delivery,
        targetDetails: [selected ? `Selected probe: ${formatProbe(selected)}` : 'Selected probe: simulation setup'],
        sections,
        finalInstruction:
          'Give Tyler a concise simulation explanation with expected signal behavior, likely measurement mistakes, and the next probe or waveform comparison to run.',
      });
      toast({
        title: `AI Simulation ${deliveryVerb}`,
        description: targetLabel
          ? `${deliveryVerb} ${targetLabel} simulation prompt ${delivery === 'send-now' ? 'to' : 'in'} AI chat.`
          : `${deliveryVerb} simulation prompt ${delivery === 'send-now' ? 'to' : 'in'} AI chat.`,
      });
    },
    [disabled, probes, toast],
  );

  useEffect(() => {
    const handleCommandEvent = (event: Event) => {
      const detail = (event as CustomEvent<RadialCommandEventDetail>).detail;
      if (!detail || detail.source !== 'radial-menu' || detail.context.view !== 'simulation') {
        return;
      }

      if (detail.commandId === 'ai_simulation_explain') {
        handleAiSimulationExplain(detail);
        detail.handled = true;
        return;
      }

      if (detail.commandId === 'remove_probe') {
        handleRemoveProbeCommand(detail);
        detail.handled = true;
      }
    };

    window.addEventListener(RADIAL_COMMAND_EVENT, handleCommandEvent);
    return () => window.removeEventListener(RADIAL_COMMAND_EVENT, handleCommandEvent);
  }, [handleAiSimulationExplain, handleRemoveProbeCommand]);

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
              data-probe-id={probe.id}
              data-probe-label={probe.name}
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
                onChange={(e) => updateProbe(probe.id, { type: e.target.value as 'voltage' | 'current' })}
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
