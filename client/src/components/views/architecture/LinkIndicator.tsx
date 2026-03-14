/**
 * LinkIndicator — Small icon that shows whether an architecture node
 * is linked to a circuit instance. Click opens a Popover to manually
 * link/unlink.
 */

import { useState, useMemo, useSyncExternalStore } from 'react';
import { Link, Unlink } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getComponentLinkManager } from '@/lib/component-linkage';
import type { CircuitInstanceInfo } from '@/lib/component-linkage';
import { useProjectId } from '@/lib/contexts/project-id-context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function instanceDisplayName(inst: CircuitInstanceInfo): string {
  const props = inst.properties;
  const name = (props.name as string) ?? (props.componentId as string) ?? (props.label as string) ?? '';
  if (name) {
    return `${inst.referenceDesignator} — ${name}`;
  }
  return inst.referenceDesignator;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LinkIndicatorProps {
  nodeId: string;
  circuitInstances: readonly CircuitInstanceInfo[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LinkIndicator({ nodeId, circuitInstances, className }: LinkIndicatorProps) {
  const projectId = useProjectId();
  const manager = useMemo(() => getComponentLinkManager(projectId), [projectId]);
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
  const [open, setOpen] = useState(false);

  const currentLink = state.links.find((l) => l.architectureNodeId === nodeId);
  const isLinked = !!currentLink;

  // Instances already linked to other nodes (exclude from dropdown)
  const linkedInstanceIds = useMemo(() => {
    const ids = new Set<number>();
    for (const link of state.links) {
      if (link.architectureNodeId !== nodeId) {
        ids.add(link.circuitInstanceId);
      }
    }
    return ids;
  }, [state.links, nodeId]);

  const availableInstances = useMemo(
    () => circuitInstances.filter((inst) => !linkedInstanceIds.has(inst.id)),
    [circuitInstances, linkedInstanceIds],
  );

  const handleSelect = (value: string) => {
    if (value === '__unlink__') {
      if (currentLink) {
        manager.unlinkComponents(nodeId, currentLink.circuitInstanceId);
      }
    } else {
      const instanceId = Number(value);
      if (!isNaN(instanceId)) {
        manager.linkComponents(nodeId, instanceId, 'manual');
      }
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid={`link-indicator-${nodeId}`}
          className={cn(
            'p-0.5 rounded transition-colors focus-ring',
            isLinked
              ? 'text-green-400 hover:text-green-300 hover:bg-green-400/10'
              : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30',
            className,
          )}
          aria-label={isLinked ? 'Linked to circuit instance' : 'Not linked to any circuit instance'}
          title={
            isLinked
              ? `Linked (${currentLink.linkType}${currentLink.confidence != null ? `, ${Math.round(currentLink.confidence * 100)}%` : ''})`
              : 'Unlinked'
          }
        >
          {isLinked ? <Link className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-64 p-3"
        side="right"
        align="start"
        data-testid={`link-popover-${nodeId}`}
      >
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Link to Circuit Instance
          </p>

          {availableInstances.length === 0 && !isLinked ? (
            <p className="text-xs text-muted-foreground/70" data-testid={`link-no-instances-${nodeId}`}>
              No unlinked circuit instances available.
            </p>
          ) : (
            <Select
              value={currentLink ? String(currentLink.circuitInstanceId) : ''}
              onValueChange={handleSelect}
            >
              <SelectTrigger
                className="h-7 text-xs"
                data-testid={`link-select-${nodeId}`}
              >
                <SelectValue placeholder="Select instance..." />
              </SelectTrigger>
              <SelectContent>
                {availableInstances.map((inst) => (
                  <SelectItem
                    key={inst.id}
                    value={String(inst.id)}
                    data-testid={`link-option-${nodeId}-${inst.id}`}
                  >
                    {instanceDisplayName(inst)}
                  </SelectItem>
                ))}
                {isLinked && currentLink && (
                  <SelectItem
                    key={currentLink.circuitInstanceId}
                    value={String(currentLink.circuitInstanceId)}
                    data-testid={`link-option-${nodeId}-${currentLink.circuitInstanceId}`}
                  >
                    {instanceDisplayName(
                      circuitInstances.find((i) => i.id === currentLink.circuitInstanceId) ?? {
                        id: currentLink.circuitInstanceId,
                        referenceDesignator: `#${currentLink.circuitInstanceId}`,
                        properties: {},
                      },
                    )}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          )}

          {isLinked && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => handleSelect('__unlink__')}
              data-testid={`link-unlink-btn-${nodeId}`}
            >
              <Unlink className="w-3 h-3 mr-1.5" />
              Unlink
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
