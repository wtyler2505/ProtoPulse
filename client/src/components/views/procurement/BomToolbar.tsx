import { Search, SlidersHorizontal, Plus, Download, Zap, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { VaultInfoIcon } from '@/components/ui/vault-info-icon';
import { cn } from '@/lib/utils';

export interface BomToolbarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  showSettings: boolean;
  onToggleSettings: () => void;
  esdFilterOnly: boolean;
  onToggleEsdFilter: () => void;
  esdCount: number;
  showAssemblyGroups: boolean;
  onToggleAssemblyGroups: () => void;
  onAddItem: () => void;
  totalCost: number;
  onExportCSV: () => void;
  exportBlocked?: boolean;
  exportBlockerCount?: number;
  exportWarningCount?: number;
}

export function BomToolbar({
  searchTerm,
  onSearchChange,
  showSettings,
  onToggleSettings,
  esdFilterOnly,
  onToggleEsdFilter,
  esdCount,
  showAssemblyGroups,
  onToggleAssemblyGroups,
  onAddItem,
  totalCost,
  onExportCSV,
  exportBlocked = false,
  exportBlockerCount = 0,
  exportWarningCount = 0,
}: BomToolbarProps) {
  const exportTooltip = exportBlocked
    ? `Resolve ${exportBlockerCount} procurement safety blocker${exportBlockerCount === 1 ? '' : 's'} before exporting.`
    : exportWarningCount > 0
      ? `Review ${exportWarningCount} procurement warning${exportWarningCount === 1 ? '' : 's'} before ordering.`
      : 'Download BOM as CSV file';

  return (
    <div className="flex flex-col gap-4 border-b border-border bg-card/30 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search components..."
            aria-label="Search components"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            data-testid="input-search-bom"
            className="w-full border border-border bg-muted/30 py-2.5 pl-9 pr-4 text-sm transition-all focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-cyan-400/50 sm:w-64"
          />
        </div>
        <StyledTooltip content="Configure BOM optimization settings" side="bottom">
          <Button
            variant="outline"
            size="sm"
            className={showSettings ? 'bg-primary/10 border-primary text-primary' : ''}
            onClick={onToggleSettings}
            data-testid="button-toggle-settings"
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Cost Optimisation
          </Button>
        </StyledTooltip>
        <div className="inline-flex items-center gap-1">
          <StyledTooltip content={esdFilterOnly ? 'Show all components' : `Show ESD-sensitive only (${esdCount})`} side="bottom">
            <Button
              variant="outline"
              size="sm"
              className={esdFilterOnly ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : ''}
              onClick={onToggleEsdFilter}
              data-testid="button-toggle-esd-filter"
            >
              <Zap className="w-4 h-4 mr-2" />
              ESD{esdCount > 0 && <span className="ml-1 text-[11px] font-mono">({esdCount})</span>}
            </Button>
          </StyledTooltip>
          {/* TODO(plan-10-wave-2): add identical vault info icons on Cost Optimisation + Assembly toggles */}
          <VaultInfoIcon
            topic="electrostatic-discharge-esd-protection-filter-definition"
            testId="esd-vault-info"
            ariaLabel="About ESD filter"
          />
        </div>
        <StyledTooltip content={showAssemblyGroups ? 'Show flat BOM list' : 'Group by assembly category'} side="bottom">
          <Button
            variant="outline"
            size="sm"
            className={showAssemblyGroups ? 'bg-primary/10 border-primary text-primary' : ''}
            onClick={onToggleAssemblyGroups}
            data-testid="button-toggle-assembly-groups"
          >
            <Layers className="w-4 h-4 mr-2" />
            Assembly
          </Button>
        </StyledTooltip>
        <StyledTooltip content="Add new BOM component" side="bottom">
          <Button
            variant="outline"
            size="sm"
            onClick={onAddItem}
            data-testid="button-add-bom-item"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </StyledTooltip>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        <div className="text-right flex-1 md:flex-none">
          <div className="inline-flex items-center justify-end gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            Estimated BOM Cost
            <TrustBadge kind="estimated" />
          </div>
          <div className="text-xl font-mono font-bold text-primary flex items-baseline justify-end gap-1" data-testid="text-total-cost">
            ${totalCost.toFixed(2)}
            <span className="text-xs text-muted-foreground font-sans font-normal">/ unit @ 1k qty</span>
          </div>
        </div>
        <StyledTooltip content={exportTooltip} side="bottom">
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onExportCSV}
            disabled={exportBlocked}
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </StyledTooltip>
      </div>
    </div>
  );
}
