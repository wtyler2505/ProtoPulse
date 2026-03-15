import { useMemo, useState } from 'react';
import { Layers, ChevronDown, ChevronRight, Zap, BarChart3, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { cn } from '@/lib/utils';
import {
  groupBomByAssembly,
  getOrderedGroups,
  GROUP_COLORS,
  GROUP_DESCRIPTIONS,
} from '@/lib/assembly-grouping';
import type { BomItem } from '@/lib/project-context';
import type { GroupStats } from '@/lib/assembly-grouping';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AssemblyGroupPanelProps {
  bom: BomItem[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GroupSection({ stats }: { stats: GroupStats }) {
  const [expanded, setExpanded] = useState(true);
  const colors = GROUP_COLORS[stats.group];
  const totalCost = stats.totalCost;

  return (
    <div className={cn('border', colors.border, colors.bg)} data-testid={`asm-group-${stats.group}`}>
      <button
        type="button"
        onClick={() => { setExpanded((v) => !v); }}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-background/20 transition-colors"
        aria-expanded={expanded}
        data-testid={`asm-group-toggle-${stats.group}`}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <Layers className={cn('w-4 h-4', colors.text)} />
          <h4 className={cn('text-sm font-medium', colors.text)}>{stats.label}</h4>
          <Badge variant="outline" className={cn('text-[10px] font-mono', colors.text, colors.border)}>
            {stats.itemCount} item{stats.itemCount !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">Qty: <span className="font-mono text-foreground">{stats.totalQuantity}</span></span>
          <span className="font-mono text-foreground" data-testid={`asm-group-cost-${stats.group}`}>
            ${(Math.round(totalCost * 100) / 100).toFixed(2)}
          </span>
        </div>
      </button>

      {expanded && (
        <>
          <p className="text-xs text-muted-foreground px-4 pb-2" data-testid={`asm-group-desc-${stats.group}`}>
            {GROUP_DESCRIPTIONS[stats.group]}
          </p>
          <div className="px-4 pb-3 space-y-1">
            {stats.items.map((gi) => (
              <div
                key={gi.item.id}
                className="flex items-center justify-between text-xs py-1.5 px-2 bg-background/20 hover:bg-background/40 transition-colors"
                data-testid={`asm-item-${gi.item.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {gi.item.esdSensitive && (
                    <StyledTooltip content="ESD Sensitive" side="right">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    </StyledTooltip>
                  )}
                  <span className="font-mono font-medium text-foreground truncate">{gi.item.partNumber}</span>
                  <span className="text-muted-foreground truncate hidden sm:inline">{gi.item.description}</span>
                  {gi.confidence < 1.0 && (
                    <StyledTooltip content={`Confidence: ${Math.round(gi.confidence * 100)}% (rule: ${gi.matchedRule ?? 'none'})`} side="right">
                      <Info className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                    </StyledTooltip>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-muted-foreground">x{gi.item.quantity}</span>
                  <span className="font-mono text-foreground">${(Math.round(Number(gi.item.totalPrice) * 100) / 100).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function AssemblyGroupPanel({ bom }: AssemblyGroupPanelProps) {
  const result = useMemo(() => groupBomByAssembly(bom), [bom]);
  const orderedGroups = useMemo(() => getOrderedGroups(result), [result]);

  if (bom.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm" data-testid="asm-group-empty">
        Add items to the BOM to see assembly grouping.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4" data-testid="assembly-group-panel">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="asm-stat-total">
          <div className="flex items-center gap-1.5 mb-1">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Items</span>
          </div>
          <div className="text-lg font-mono font-bold text-foreground">{result.totalItems}</div>
        </div>
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="asm-stat-smt">
          <div className="flex items-center gap-1.5 mb-1">
            <Layers className={cn('w-3.5 h-3.5', GROUP_COLORS.smt.text)} />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">SMT</span>
          </div>
          <div className="text-lg font-mono font-bold text-foreground">{result.groups.smt.itemCount}</div>
        </div>
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="asm-stat-tht">
          <div className="flex items-center gap-1.5 mb-1">
            <Layers className={cn('w-3.5 h-3.5', GROUP_COLORS.tht.text)} />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">THT</span>
          </div>
          <div className="text-lg font-mono font-bold text-foreground">{result.groups.tht.itemCount}</div>
        </div>
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="asm-stat-rate">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Classified</span>
          </div>
          <div className="text-lg font-mono font-bold text-foreground">{Math.round(result.classificationRate * 100)}%</div>
        </div>
      </div>

      {/* Classification rate warning */}
      {result.classificationRate < 1 && result.groups.unclassified.itemCount > 0 && (
        <div className="text-xs text-muted-foreground border border-border bg-card/60 px-3 py-2" data-testid="asm-unclassified-notice">
          {result.groups.unclassified.itemCount} item{result.groups.unclassified.itemCount !== 1 ? 's' : ''} could not be auto-classified.
          Add package type keywords (e.g. 0402, SOIC, DIP, connector) to the description for automatic grouping.
        </div>
      )}

      {/* Group sections */}
      <div className="space-y-3">
        {orderedGroups.map((gs) => (
          <GroupSection key={gs.group} stats={gs} />
        ))}
      </div>

      {/* Total cost footer */}
      <div className="flex items-center justify-between border border-border bg-card/80 p-3 text-sm" data-testid="asm-total-cost">
        <span className="text-muted-foreground">Total BOM Cost</span>
        <span className="font-mono font-medium text-foreground">${(Math.round(result.totalCost * 100) / 100).toFixed(2)}</span>
      </div>
    </div>
  );
}
