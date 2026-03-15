import { useState, useMemo, useCallback, memo } from 'react';
import { Settings2, ArrowRight, ChevronDown } from 'lucide-react';
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
  DRC_PRESETS,
  applyPreset,
  diffPreset,
  formatRuleType,
} from '@/lib/drc-presets';
import type { DrcPresetId, RuleDiff } from '@/lib/drc-presets';

// ---------------------------------------------------------------------------
// DrcPresetSelector (BL-0250)
//
// Dropdown with preset descriptions, a diff preview of what will change, and
// an apply button that calls back with the resolved DRCRule[] array.
// ---------------------------------------------------------------------------

interface DrcPresetSelectorProps {
  /** Currently active preset (controls the select value). */
  activePreset: DrcPresetId;
  /** Called when the user confirms a preset selection. Receives the resolved rules. */
  onApply: (presetId: DrcPresetId, rules: DRCRule[]) => void;
}

// ---------------------------------------------------------------------------
// Diff Preview Row
// ---------------------------------------------------------------------------

const DiffRow = memo(function DiffRow({ diff }: { diff: RuleDiff }) {
  return (
    <div className="flex items-center gap-2 text-[11px] py-0.5" data-testid={`diff-row-${diff.ruleType}-${diff.field}`}>
      <span className="text-muted-foreground font-medium min-w-[120px] truncate">
        {formatRuleType(diff.ruleType)}
      </span>
      <span className="text-muted-foreground/60 min-w-[60px] truncate">{diff.field}</span>
      <span className="text-muted-foreground/80 line-through">{String(diff.defaultValue)}</span>
      <ArrowRight className="w-3 h-3 text-primary shrink-0" />
      <span className="text-primary font-semibold">{String(diff.presetValue)}</span>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function DrcPresetSelectorInner({ activePreset, onApply }: DrcPresetSelectorProps) {
  const [selectedId, setSelectedId] = useState<DrcPresetId>(activePreset);
  const [diffOpen, setDiffOpen] = useState(false);

  const selectedPreset = useMemo(() => DRC_PRESETS.find((p) => p.id === selectedId), [selectedId]);
  const diffs = useMemo(() => diffPreset(selectedId), [selectedId]);
  const hasChanges = selectedId !== activePreset;

  const handleApply = useCallback(() => {
    const rules = applyPreset(selectedId);
    onApply(selectedId, rules);
  }, [selectedId, onApply]);

  const handleSelect = useCallback((value: string) => {
    setSelectedId(value as DrcPresetId);
    setDiffOpen(true);
  }, []);

  return (
    <div className="flex flex-col gap-2" data-testid="drc-preset-selector">
      <div className="flex items-center gap-2 flex-wrap">
        <Settings2 className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Preset:
        </span>

        <Select value={selectedId} onValueChange={handleSelect}>
          <SelectTrigger
            className="h-7 w-[200px] text-xs"
            data-testid="drc-preset-dropdown"
          >
            <SelectValue placeholder="Select preset..." />
          </SelectTrigger>
          <SelectContent>
            {DRC_PRESETS.map((preset) => (
              <SelectItem
                key={preset.id}
                value={preset.id}
                data-testid={`drc-preset-option-${preset.id}`}
              >
                <div className="flex flex-col">
                  <span>{preset.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <StyledTooltip content="Apply the selected preset rules" side="bottom">
          <Button
            data-testid="drc-preset-apply"
            variant="outline"
            size="sm"
            className={cn(
              'h-7 text-xs',
              hasChanges && 'border-primary text-primary hover:bg-primary/10',
            )}
            onClick={handleApply}
            disabled={!hasChanges}
          >
            Apply
          </Button>
        </StyledTooltip>

        {selectedPreset && (
          <span className="text-[11px] text-muted-foreground/70 hidden md:inline truncate max-w-[300px]">
            {selectedPreset.description}
          </span>
        )}
      </div>

      {/* Example projects for selected preset */}
      {selectedPreset && selectedPreset.examples.length > 0 && (
        <div className="flex items-center gap-1 ml-6 flex-wrap">
          <span className="text-[10px] text-muted-foreground/50">Best for:</span>
          {selectedPreset.examples.map((ex) => (
            <Badge
              key={ex}
              variant="outline"
              className="text-[10px] py-0 px-1.5 border-border/50"
            >
              {ex}
            </Badge>
          ))}
        </div>
      )}

      {/* Diff preview */}
      {diffs.length > 0 && (
        <div className="ml-6">
          <button
            data-testid="drc-preset-diff-toggle"
            onClick={() => { setDiffOpen(!diffOpen); }}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn('w-3 h-3 transition-transform', diffOpen && 'rotate-180')} />
            {diffs.length} rule change{diffs.length !== 1 ? 's' : ''} from defaults
          </button>

          {diffOpen && (
            <div
              className="mt-1 p-2 border border-border/50 bg-muted/10 max-h-[160px] overflow-y-auto"
              data-testid="drc-preset-diff-panel"
            >
              {diffs.map((diff, i) => (
                <DiffRow key={`${diff.ruleType}-${diff.field}-${i}`} diff={diff} />
              ))}
            </div>
          )}
        </div>
      )}

      {diffs.length === 0 && selectedId !== 'general' && (
        <span className="ml-6 text-[10px] text-muted-foreground/50">No changes from defaults.</span>
      )}
    </div>
  );
}

export const DrcPresetSelector = memo(DrcPresetSelectorInner);
