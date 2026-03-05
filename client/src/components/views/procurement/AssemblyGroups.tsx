import { Layers, Zap } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { cn } from '@/lib/utils';
import { ASSEMBLY_CATEGORY_INFO, type AssemblyCategory } from './bom-utils';
import type { EnrichedBomItem } from './types';

export interface AssemblyGroupsProps {
  assemblyGroups: Record<string, EnrichedBomItem[]>;
}

export function AssemblyGroups({ assemblyGroups }: AssemblyGroupsProps) {
  return (
    <div className="mb-4 space-y-3" data-testid="section-assembly-groups">
      {(Object.entries(assemblyGroups) as [AssemblyCategory | 'unassigned', EnrichedBomItem[]][]).map(([category, items]) => {
        if (items.length === 0) { return null; }
        const info = ASSEMBLY_CATEGORY_INFO[category];
        return (
          <div key={category} className={cn('border p-4', info.bgColor)} data-testid={`assembly-group-${category}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers className={cn('w-4 h-4', info.color)} />
                <h4 className={cn('text-sm font-medium', info.color)} data-testid={`assembly-group-label-${category}`}>{info.label}</h4>
                <span className="text-[10px] font-mono bg-background/30 px-1.5 py-0.5 text-muted-foreground" data-testid={`assembly-group-count-${category}`}>
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3" data-testid={`assembly-group-note-${category}`}>{info.note}</p>
            <div className="space-y-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs py-1.5 px-2 bg-background/20 hover:bg-background/40 transition-colors" data-testid={`assembly-item-${item.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    {item._isEsd && (
                      <StyledTooltip content="ESD Sensitive — Handle with anti-static precautions. Use ESD wrist strap and grounded work surface." side="right">
                        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" data-testid={`esd-badge-assembly-${item.id}`} />
                      </StyledTooltip>
                    )}
                    <span className="font-mono font-medium text-foreground truncate">{item.partNumber}</span>
                    <span className="text-muted-foreground truncate hidden sm:inline">{item.description}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-muted-foreground">x{item.quantity}</span>
                    <span className="font-mono text-foreground">${Number(item.totalPrice).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
