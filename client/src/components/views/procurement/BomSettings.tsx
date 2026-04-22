/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { OPTIMIZATION_GOALS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export interface BomSettingsProps {
  bomSettings: { batchSize: number; maxCost: number; inStockOnly: boolean };
  onBomSettingsChange: (settings: { batchSize: number; maxCost: number; inStockOnly: boolean }) => void;
  optimizationGoal: string;
  onOptimizationGoalChange: (goal: string) => void;
  preferredSuppliers: Record<string, boolean>;
  onPreferredSuppliersChange: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  showSupplierEdit: boolean;
  onToggleSupplierEdit: () => void;
}

export function BomSettings({
  bomSettings,
  onBomSettingsChange,
  optimizationGoal,
  onOptimizationGoalChange,
  preferredSuppliers,
  onPreferredSuppliersChange,
  showSupplierEdit,
  onToggleSupplierEdit,
}: BomSettingsProps) {
  return (
    <div className="bg-muted/10 backdrop-blur-xl border-b border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 animate-in slide-in-from-top-2" data-testid="panel-settings">
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground">Production Batch Size</h4>
        <div className="flex items-center gap-4">
          <Slider
            value={[bomSettings.batchSize]}
            max={10000}
            step={100}
            className="flex-1"
            onValueChange={([v]) => onBomSettingsChange({ ...bomSettings, batchSize: v })}
            data-testid="slider-batch-size"
          />
          <span className="font-mono text-sm w-16 text-right" data-testid="text-batch-size">{bomSettings.batchSize}</span>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground">Max BOM Cost Target</h4>
        <div className="flex items-center gap-4">
          <Slider
            value={[bomSettings.maxCost]}
            max={100}
            step={1}
            className="flex-1"
            onValueChange={([v]) => onBomSettingsChange({ ...bomSettings, maxCost: v })}
            data-testid="slider-max-cost"
          />
          <span className="font-mono text-sm w-16 text-right" data-testid="text-max-cost">${bomSettings.maxCost}</span>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground">Sourcing Constraints</h4>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">In Stock Only</span>
          <Switch checked={bomSettings.inStockOnly} onCheckedChange={(v) => onBomSettingsChange({ ...bomSettings, inStockOnly: v })} data-testid="switch-in-stock-only" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Preferred Suppliers</span>
          <StyledTooltip content="Edit preferred supplier list" side="top">
            <span
              className="text-xs text-primary cursor-pointer hover:underline"
              data-testid="link-edit-suppliers"
              onClick={onToggleSupplierEdit}
            >Edit List</span>
          </StyledTooltip>
        </div>
        {showSupplierEdit && (
          <div className="mt-2 space-y-1.5 pl-1 animate-in slide-in-from-top-1" data-testid="panel-supplier-edit">
            {Object.entries(preferredSuppliers).map(([supplier, checked]) => (
              <label key={supplier} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onPreferredSuppliersChange(prev => ({ ...prev, [supplier]: e.target.checked }))}
                  className="accent-primary w-3.5 h-3.5"
                  data-testid={`checkbox-supplier-${supplier.toLowerCase().replace(/[^a-z]/g, '-')}`}
                />
                {supplier}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground">Optimization Goal</h4>
        <div className="flex gap-2">
          {['Cost', 'Power', 'Size', 'Avail'].map(goal => (
            <StyledTooltip key={goal} content={OPTIMIZATION_GOALS[goal]} side="bottom">
              <button
                onClick={() => onOptimizationGoalChange(goal)}
                data-testid={`button-goal-${goal.toLowerCase()}`}
                className={cn(
                  'px-3 py-1 border border-border text-xs hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors',
                  optimizationGoal === goal && 'bg-primary/10 border-primary text-primary',
                )}
              >
                {goal}
              </button>
            </StyledTooltip>
          ))}
        </div>
      </div>
    </div>
  );
}
