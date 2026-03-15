import { useState, useCallback, memo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  Plus,
  Trash2,
  RotateCcw,
  Search,
  Star,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAvl, AVL_TIER_LABELS } from '@/lib/approved-vendor-list';
import type { AvlTier, BomComplianceItem } from '@/lib/approved-vendor-list';
import type { BomItem } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AvlCompliancePanelProps {
  bom: BomItem[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const TIER_ICONS: Record<AvlTier | 'unlisted', React.ReactNode> = {
  preferred: <Star className="w-3.5 h-3.5" />,
  approved: <ShieldCheck className="w-3.5 h-3.5" />,
  restricted: <ShieldAlert className="w-3.5 h-3.5" />,
  blocked: <ShieldX className="w-3.5 h-3.5" />,
  unlisted: <ShieldQuestion className="w-3.5 h-3.5" />,
};

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="flex items-center gap-2" data-testid="avl-score-gauge">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
          <circle
            cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
            strokeDasharray={`${score * 0.942} 100`}
            strokeLinecap="round"
            className={color}
          />
        </svg>
        <span className={cn('absolute inset-0 flex items-center justify-center text-sm font-bold', color)}>
          {score}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        AVL<br />Score
      </div>
    </div>
  );
}

function ComplianceSummary({ compliance }: { compliance: ReturnType<typeof useAvl>['compliance'] }) {
  const { summary, overallCompliant } = compliance;
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="avl-compliance-summary">
      <ScoreGauge score={compliance.score} />
      <div className="flex flex-wrap gap-2">
        {summary.preferred > 0 && (
          <Badge variant="outline" className={AVL_TIER_LABELS.preferred.color} data-testid="avl-badge-preferred">
            {TIER_ICONS.preferred} {summary.preferred} Preferred
          </Badge>
        )}
        {summary.approved > 0 && (
          <Badge variant="outline" className={AVL_TIER_LABELS.approved.color} data-testid="avl-badge-approved">
            {TIER_ICONS.approved} {summary.approved} Approved
          </Badge>
        )}
        {summary.restricted > 0 && (
          <Badge variant="outline" className={AVL_TIER_LABELS.restricted.color} data-testid="avl-badge-restricted">
            {TIER_ICONS.restricted} {summary.restricted} Restricted
          </Badge>
        )}
        {summary.blocked > 0 && (
          <Badge variant="outline" className={AVL_TIER_LABELS.blocked.color} data-testid="avl-badge-blocked">
            {TIER_ICONS.blocked} {summary.blocked} Blocked
          </Badge>
        )}
        {summary.unlisted > 0 && (
          <Badge variant="outline" className={AVL_TIER_LABELS.unlisted.color} data-testid="avl-badge-unlisted">
            {TIER_ICONS.unlisted} {summary.unlisted} Unlisted
          </Badge>
        )}
      </div>
      <Badge
        variant="outline"
        className={overallCompliant ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-red-400 border-red-400/30 bg-red-400/10'}
        data-testid="avl-overall-status"
      >
        {overallCompliant ? 'Compliant' : 'Non-Compliant'}
      </Badge>
    </div>
  );
}

function ComplianceItemRow({ item }: { item: BomComplianceItem }) {
  const tierInfo = AVL_TIER_LABELS[item.tier];
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md border text-sm',
        item.compliant ? 'border-border/50 bg-card/30' : 'border-red-400/20 bg-red-400/5',
      )}
      data-testid={`avl-compliance-item-${item.bomItem.id}`}
    >
      <span className={tierInfo.color}>{TIER_ICONS[item.tier]}</span>
      <span className="font-mono text-xs min-w-[100px]">{item.bomItem.partNumber}</span>
      <span className="text-muted-foreground truncate flex-1">{item.bomItem.manufacturer}</span>
      <Badge variant="outline" className={cn('text-xs', tierInfo.color)}>
        {tierInfo.label}
      </Badge>
      {!item.compliant && (
        <span className="text-xs text-red-400 max-w-[200px] truncate">{item.reason}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AVL Editor Section
// ---------------------------------------------------------------------------

const TIER_OPTIONS: AvlTier[] = ['preferred', 'approved', 'restricted', 'blocked'];

function AvlEditor({
  entries,
  filteredEntries,
  searchTerm,
  setSearchTerm,
  tierFilter,
  setTierFilter,
  addEntry,
  removeEntry,
  updateEntry,
  resetToDefaults,
}: ReturnType<typeof useAvl>) {
  const [newManufacturer, setNewManufacturer] = useState('');
  const [newTier, setNewTier] = useState<AvlTier>('approved');
  const [newNotes, setNewNotes] = useState('');

  const handleAdd = useCallback(() => {
    if (!newManufacturer.trim()) { return; }
    addEntry({ manufacturer: newManufacturer.trim(), tier: newTier, notes: newNotes.trim() || undefined });
    setNewManufacturer('');
    setNewNotes('');
  }, [newManufacturer, newTier, newNotes, addEntry]);

  const handleAddKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  }, [handleAdd]);

  return (
    <div className="space-y-3" data-testid="avl-editor">
      {/* Search + filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 text-sm"
            data-testid="avl-search"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as AvlTier | 'all')}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          data-testid="avl-tier-filter"
          aria-label="Filter by tier"
        >
          <option value="all">All Tiers</option>
          {TIER_OPTIONS.map((t) => (
            <option key={t} value={t}>{AVL_TIER_LABELS[t].label}</option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetToDefaults}
          className="text-xs text-muted-foreground hover:text-foreground"
          data-testid="avl-reset-defaults"
          aria-label="Reset to defaults"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />Reset
        </Button>
      </div>

      {/* Add new entry */}
      <div className="flex items-center gap-2 p-2 rounded-md border border-dashed border-border/50 bg-card/20">
        <Input
          placeholder="Manufacturer name"
          value={newManufacturer}
          onChange={(e) => setNewManufacturer(e.target.value)}
          onKeyDown={handleAddKeyDown}
          className="h-7 text-sm flex-1"
          data-testid="avl-new-manufacturer"
        />
        <select
          value={newTier}
          onChange={(e) => setNewTier(e.target.value as AvlTier)}
          className="h-7 rounded-md border border-border bg-background px-2 text-xs"
          data-testid="avl-new-tier"
          aria-label="New entry tier"
        >
          {TIER_OPTIONS.map((t) => (
            <option key={t} value={t}>{AVL_TIER_LABELS[t].label}</option>
          ))}
        </select>
        <Input
          placeholder="Notes (optional)"
          value={newNotes}
          onChange={(e) => setNewNotes(e.target.value)}
          onKeyDown={handleAddKeyDown}
          className="h-7 text-sm w-48"
          data-testid="avl-new-notes"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!newManufacturer.trim()}
          className="h-7 text-xs"
          data-testid="avl-add-entry"
          aria-label="Add vendor"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />Add
        </Button>
      </div>

      {/* Entry list */}
      <div className="max-h-[300px] overflow-auto space-y-1" data-testid="avl-entry-list">
        {filteredEntries.map((entry) => {
          const tierInfo = AVL_TIER_LABELS[entry.tier];
          return (
            <div
              key={entry.manufacturer}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border/30 bg-card/20 text-sm group"
              data-testid={`avl-entry-${entry.manufacturer.replace(/\s+/g, '-').toLowerCase()}`}
            >
              <span className={tierInfo.color}>{TIER_ICONS[entry.tier]}</span>
              <span className="font-medium flex-1 truncate">{entry.manufacturer}</span>
              {entry.notes && (
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">{entry.notes}</span>
              )}
              <select
                value={entry.tier}
                onChange={(e) => updateEntry(entry.manufacturer, { tier: e.target.value as AvlTier })}
                className="h-6 rounded border border-border bg-background px-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Change tier for ${entry.manufacturer}`}
              >
                {TIER_OPTIONS.map((t) => (
                  <option key={t} value={t}>{AVL_TIER_LABELS[t].label}</option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeEntry(entry.manufacturer)}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400"
                data-testid={`avl-remove-${entry.manufacturer.replace(/\s+/g, '-').toLowerCase()}`}
                aria-label={`Remove ${entry.manufacturer}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })}
        {filteredEntries.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-6">
            No vendors match the current filter.
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {entries.length} vendor{entries.length !== 1 ? 's' : ''} in AVL
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function AvlCompliancePanel({ bom }: AvlCompliancePanelProps) {
  const avl = useAvl(bom);
  const { compliance } = avl;

  const [showEditor, setShowEditor] = useState(false);
  const [showResults, setShowResults] = useState(true);

  // Group compliance items by tier for collapsible sections
  const nonCompliantItems = compliance.items.filter((i) => !i.compliant);
  const compliantItems = compliance.items.filter((i) => i.compliant);

  return (
    <div className="space-y-4 p-4" data-testid="avl-compliance-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">AVL Compliance</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Check your BOM against the Approved Vendor List.
          </p>
        </div>
      </div>

      {/* Summary */}
      {bom.length > 0 ? (
        <ComplianceSummary compliance={compliance} />
      ) : (
        <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border/50 rounded-md" data-testid="avl-empty-bom">
          Add items to your BOM to check AVL compliance.
        </div>
      )}

      {/* Compliance Results */}
      {bom.length > 0 && (
        <div>
          <button
            onClick={() => setShowResults(!showResults)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
            data-testid="avl-toggle-results"
            type="button"
          >
            {showResults ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Compliance Check ({compliance.items.length} items)
          </button>
          {showResults && (
            <div className="space-y-1">
              {nonCompliantItems.length > 0 && (
                <div className="space-y-1 mb-2">
                  <div className="text-xs font-medium text-red-400 px-1">
                    Issues ({nonCompliantItems.length})
                  </div>
                  {nonCompliantItems.map((item) => (
                    <ComplianceItemRow key={item.bomItem.id} item={item} />
                  ))}
                </div>
              )}
              {compliantItems.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-emerald-400 px-1">
                    Compliant ({compliantItems.length})
                  </div>
                  {compliantItems.map((item) => (
                    <ComplianceItemRow key={item.bomItem.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AVL Editor */}
      <div>
        <button
          onClick={() => setShowEditor(!showEditor)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
          data-testid="avl-toggle-editor"
          type="button"
        >
          {showEditor ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Manage Vendor List ({avl.entries.length} vendors)
        </button>
        {showEditor && <AvlEditor {...avl} />}
      </div>
    </div>
  );
}

export default memo(AvlCompliancePanel);
