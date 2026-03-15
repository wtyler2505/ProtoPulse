/**
 * ManufacturerRuleCompare (BL-0251)
 *
 * Side-by-side comparison table showing how the user's current DRC rules
 * compare against a manufacturer's published design rules. Color-coded
 * stricter/looser/match indicators help users quickly identify where their
 * design rules may need adjustment for a specific fab house.
 */

import { useState, useMemo, useCallback, memo } from 'react';
import { Factory, ArrowRight, CheckCircle2, AlertTriangle, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import type { DRCRule } from '@shared/component-types';
import {
  getManufacturerIds,
  getManufacturerRuleSet,
  compareWithManufacturer,
  summarizeComparison,
  buildManufacturerRules,
} from '@/lib/manufacturer-rules';
import type { ManufacturerRuleDiff, ComparisonStatus } from '@/lib/manufacturer-rules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManufacturerRuleCompareProps {
  /** The user's current DRC rules to compare against. */
  currentRules: DRCRule[];
  /** Called when the user clicks "Apply manufacturer rules". */
  onApplyRules: (rules: DRCRule[]) => void;
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function statusColor(status: ComparisonStatus): string {
  switch (status) {
    case 'stricter':
      return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
    case 'looser':
      return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    case 'match':
      return 'text-muted-foreground bg-muted/10 border-border/50';
  }
}

function statusLabel(status: ComparisonStatus): string {
  switch (status) {
    case 'stricter':
      return 'Stricter';
    case 'looser':
      return 'Looser';
    case 'match':
      return 'Match';
  }
}

function statusTooltip(status: ComparisonStatus): string {
  switch (status) {
    case 'stricter':
      return 'Your current rule is stricter than the manufacturer requires — your design has extra margin.';
    case 'looser':
      return 'Your current rule is looser than the manufacturer requires — you may want to tighten this.';
    case 'match':
      return 'Your current rule matches the manufacturer\'s recommendation exactly.';
  }
}

// ---------------------------------------------------------------------------
// Diff Row
// ---------------------------------------------------------------------------

const DiffRow = memo(function DiffRow({ diff }: { diff: ManufacturerRuleDiff }) {
  return (
    <div
      data-testid={`mfg-diff-row-${diff.ruleType}-${diff.field}`}
      className="flex items-center gap-2 py-1.5 px-2 border-b border-border/20 last:border-b-0 hover:bg-muted/10 transition-colors text-xs"
    >
      <span className="text-muted-foreground font-medium min-w-[130px] truncate">
        {diff.ruleLabel}
      </span>
      <span className="text-muted-foreground/60 min-w-[90px] truncate font-mono text-[10px]">
        {diff.field}
      </span>
      <span className="min-w-[60px] text-right font-mono">{String(diff.current)}</span>
      <ArrowRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
      <span className="min-w-[60px] font-mono">{String(diff.manufacturer)}</span>
      <StyledTooltip content={statusTooltip(diff.status)} side="left">
        <Badge
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0 cursor-help', statusColor(diff.status))}
          data-testid={`mfg-diff-status-${diff.ruleType}-${diff.field}`}
        >
          {statusLabel(diff.status)}
        </Badge>
      </StyledTooltip>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function ManufacturerRuleCompareInner({ currentRules, onApplyRules }: ManufacturerRuleCompareProps) {
  const [selectedMfg, setSelectedMfg] = useState('');
  const [expanded, setExpanded] = useState(true);

  const manufacturerIds = useMemo(() => getManufacturerIds(), []);

  const selectedRuleSet = useMemo(() => {
    if (!selectedMfg) {
      return null;
    }
    return getManufacturerRuleSet(selectedMfg) ?? null;
  }, [selectedMfg]);

  const diffs = useMemo((): ManufacturerRuleDiff[] => {
    if (!selectedMfg || currentRules.length === 0) {
      return [];
    }
    return compareWithManufacturer(currentRules, selectedMfg);
  }, [currentRules, selectedMfg]);

  const summary = useMemo(() => summarizeComparison(diffs), [diffs]);

  const handleApply = useCallback(() => {
    if (!selectedMfg) {
      return;
    }
    const newRules = buildManufacturerRules(currentRules, selectedMfg);
    if (newRules) {
      onApplyRules(newRules);
    }
  }, [selectedMfg, currentRules, onApplyRules]);

  return (
    <div
      data-testid="manufacturer-rule-compare-section"
      className="bg-card/40 border border-border backdrop-blur-xl shadow-xl p-4 flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Factory className="w-4 h-4 text-primary" />
          Manufacturer Rule Compare
        </h3>
        {selectedMfg && diffs.length > 0 && (
          <StyledTooltip content="Apply this manufacturer's recommended rules to your project" side="left">
            <Button
              data-testid="apply-manufacturer-rules"
              variant="outline"
              size="sm"
              className="h-7 text-xs border-primary text-primary hover:bg-primary/10"
              onClick={handleApply}
            >
              <ArrowDown className="w-3 h-3 mr-1" />
              Apply Rules
            </Button>
          </StyledTooltip>
        )}
      </div>

      {/* Manufacturer Selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex-shrink-0">
          Compare with:
        </span>
        <Select value={selectedMfg} onValueChange={setSelectedMfg}>
          <SelectTrigger data-testid="mfg-select" className="h-7 text-xs flex-1 max-w-[200px]">
            <SelectValue placeholder="Select manufacturer..." />
          </SelectTrigger>
          <SelectContent>
            {manufacturerIds.map((id) => {
              const rs = getManufacturerRuleSet(id);
              return (
                <SelectItem key={id} value={id} className="text-xs" data-testid={`mfg-option-${id}`}>
                  {rs?.name ?? id}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selectedRuleSet && (
          <span className="text-[10px] text-muted-foreground/60 hidden md:inline truncate max-w-[250px]">
            {selectedRuleSet.description}
          </span>
        )}
      </div>

      {/* Summary + Diff Table */}
      {selectedMfg && diffs.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-3 text-[11px]" data-testid="mfg-comparison-summary">
            <div className="flex items-center gap-1 text-emerald-500">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{summary.stricter} stricter</span>
            </div>
            <div className="flex items-center gap-1 text-amber-500">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{summary.looser} looser</span>
            </div>
            {summary.match > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>{summary.match} matching</span>
              </div>
            )}
            <span className="text-muted-foreground/50">({summary.total} total differences)</span>
          </div>

          {/* Toggle expand/collapse */}
          <button
            data-testid="mfg-diff-toggle"
            onClick={() => { setExpanded(!expanded); }}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors self-start"
          >
            {expanded ? 'Collapse details' : 'Expand details'}
          </button>

          {/* Diff table */}
          {expanded && (
            <div className="border border-border/30 max-h-60 overflow-auto" data-testid="mfg-diff-table">
              {/* Table header */}
              <div className="flex items-center gap-2 py-1.5 px-2 bg-muted/10 border-b border-border/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold sticky top-0">
                <span className="min-w-[130px]">Rule</span>
                <span className="min-w-[90px]">Parameter</span>
                <span className="min-w-[60px] text-right">Current</span>
                <span className="w-3" />
                <span className="min-w-[60px]">Mfg</span>
                <span className="min-w-[55px]">Status</span>
              </div>
              {diffs.map((diff) => (
                <DiffRow key={`${diff.ruleType}-${diff.field}`} diff={diff} />
              ))}
            </div>
          )}
        </>
      )}

      {/* No selection state */}
      {!selectedMfg && (
        <p className="text-xs text-muted-foreground">
          Select a manufacturer to compare your current DRC rules against their published design capabilities.
        </p>
      )}

      {/* No differences state */}
      {selectedMfg && diffs.length === 0 && currentRules.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-emerald-500">
          <CheckCircle2 className="w-4 h-4" />
          Your current rules match {selectedRuleSet?.name ?? selectedMfg} exactly — no differences found.
        </div>
      )}
    </div>
  );
}

export const ManufacturerRuleCompare = memo(ManufacturerRuleCompareInner);
