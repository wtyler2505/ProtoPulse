import { memo, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getCategoryLabel,
  getCategoryDescription,
  formatRepairSummary,
} from '@/lib/import-repair';
import type {
  RepairResult,
  RepairAction,
  RepairCategory,
  RepairSeverity,
} from '@/lib/import-repair';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportRepairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repairResult: RepairResult | null;
  fileName: string;
  onApplyRepaired: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Severity config
// ---------------------------------------------------------------------------

interface SeverityStyle {
  icon: React.ComponentType<{ className?: string }>;
  textClass: string;
  bgClass: string;
}

const SEVERITY_STYLES: Record<RepairSeverity, SeverityStyle> = {
  error: {
    icon: AlertCircle,
    textClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
  },
  warning: {
    icon: AlertTriangle,
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-400/10',
  },
  info: {
    icon: Info,
    textClass: 'text-blue-400',
    bgClass: 'bg-blue-400/10',
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RepairActionRowProps {
  action: RepairAction;
}

function RepairActionRow({ action }: RepairActionRowProps) {
  const style = SEVERITY_STYLES[action.severity];
  const Icon = style.icon;

  return (
    <div
      className={cn('flex items-start gap-2 px-2 py-1.5 text-[11px]', style.bgClass)}
      data-testid={`repair-action-${action.category}`}
    >
      <Icon className={cn('w-3 h-3 mt-0.5 shrink-0', style.textClass)} />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground">{action.entity}</span>
        <span className="text-muted-foreground"> — {action.problem}</span>
        <div className="text-green-400/80 mt-0.5">Fix: {action.fix}</div>
      </div>
    </div>
  );
}

interface CategoryGroupProps {
  category: RepairCategory;
  actions: RepairAction[];
}

function CategoryGroup({ category, actions }: CategoryGroupProps) {
  return (
    <div className="border border-border/30 rounded-sm overflow-hidden" data-testid={`repair-category-${category}`}>
      <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Wrench className="w-3.5 h-3.5 text-primary/70" />
          <span className="text-xs font-medium text-foreground">{getCategoryLabel(category)}</span>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono">
          {actions.length}
        </Badge>
      </div>
      <p className="text-[10px] text-muted-foreground/70 px-3 py-1.5 border-b border-border/10">
        {getCategoryDescription(category)}
      </p>
      <div className="divide-y divide-border/10 max-h-40 overflow-auto">
        {actions.map((action, idx) => (
          <RepairActionRow key={`${action.entity}-${String(idx)}`} action={action} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

function ImportRepairDialog({
  open,
  onOpenChange,
  repairResult,
  fileName,
  onApplyRepaired,
  onCancel,
}: ImportRepairDialogProps) {
  const groupedActions = useMemo(() => {
    if (!repairResult) {
      return new Map<RepairCategory, RepairAction[]>();
    }
    const map = new Map<RepairCategory, RepairAction[]>();
    for (const action of repairResult.actions) {
      const list = map.get(action.category) ?? [];
      list.push(action);
      map.set(action.category, list);
    }
    return map;
  }, [repairResult]);

  const summaryText = useMemo(() => {
    if (!repairResult) {
      return '';
    }
    return formatRepairSummary(repairResult);
  }, [repairResult]);

  const handleApply = useCallback(() => {
    onApplyRepaired();
  }, [onApplyRepaired]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  if (!repairResult) {
    return null;
  }

  const categories = Array.from(groupedActions.entries());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-auto" data-testid="import-repair-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Wrench className="w-4 h-4 text-primary" />
            Import Repair Assistant
          </DialogTitle>
          <DialogDescription className="text-xs">
            Issues were found in <span className="font-medium text-foreground">{fileName}</span> and
            can be auto-repaired.
          </DialogDescription>
        </DialogHeader>

        {/* Summary bar */}
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-sm border text-xs',
            repairResult.success
              ? 'bg-green-400/10 border-green-400/30 text-green-400'
              : 'bg-destructive/10 border-destructive/30 text-destructive',
          )}
          data-testid="repair-summary"
        >
          {repairResult.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{summaryText}</span>
        </div>

        {/* Grouped actions */}
        <div className="flex flex-col gap-2 mt-1" data-testid="repair-actions-list">
          {categories.map(([category, actions]) => (
            <CategoryGroup key={category} category={category} actions={actions} />
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={handleCancel} data-testid="repair-cancel-button">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!repairResult.success}
            data-testid="repair-apply-button"
          >
            <Wrench className="w-3.5 h-3.5 mr-1.5" />
            Apply Repairs & Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default memo(ImportRepairDialog);
