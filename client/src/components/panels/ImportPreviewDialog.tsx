import { memo, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  AlertCircle,
  Plus,
  Minus,
  RefreshCw,
  FileInput,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  generateImportWarnings,
  groupWarningsByType,
  groupWarningsBySeverity,
  getWarningTypeLabel,
  getWarningTypeDescription,
} from '@/lib/import-warnings';
import type { ImportPreview } from '@/lib/import-preview';
import type { ImportedDesign } from '@/lib/design-import';
import type { ImportWarning, ImportWarningType } from '@/lib/import-warnings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: ImportPreview | null;
  fileName: string;
  onApply: () => void;
  onCancel: () => void;
  /** When provided, mapping warnings are generated and displayed. */
  importedDesign?: ImportedDesign | null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DiffRowProps {
  label: string;
  count: number;
  variant: 'added' | 'modified' | 'removed';
  testId: string;
}

function DiffRow({ label, count, variant, testId }: DiffRowProps) {
  if (count === 0) {
    return null;
  }

  const prefix = variant === 'added' ? '+' : variant === 'modified' ? '~' : '-';
  const Icon = variant === 'added' ? Plus : variant === 'modified' ? RefreshCw : Minus;
  const colorClass =
    variant === 'added'
      ? 'text-green-400 bg-green-400/10 border-green-400/30'
      : variant === 'modified'
        ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
        : 'text-red-400 bg-red-400/10 border-red-400/30';

  return (
    <div
      className="flex items-center justify-between py-1.5"
      data-testid={testId}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn('w-3 h-3', colorClass.split(' ')[0])} />
        <span>{label}</span>
      </div>
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] font-mono tabular-nums px-1.5 py-0',
          colorClass,
        )}
        data-testid={`${testId}-badge`}
      >
        {prefix}{String(count)}
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Warning type color mapping
// ---------------------------------------------------------------------------

const WARNING_TYPE_CONFIG: Record<ImportWarningType, { color: string; badgeColor: string }> = {
  dropped: {
    color: 'text-red-500',
    badgeColor: 'text-red-500 bg-red-500/10 border-red-500/30',
  },
  unsupported: {
    color: 'text-amber-500',
    badgeColor: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  },
  converted: {
    color: 'text-blue-500',
    badgeColor: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  },
  approximated: {
    color: 'text-gray-400',
    badgeColor: 'text-gray-400 bg-gray-400/10 border-gray-400/30',
  },
};

// ---------------------------------------------------------------------------
// Warning group collapsible
// ---------------------------------------------------------------------------

interface WarningGroupProps {
  type: ImportWarningType;
  warnings: ImportWarning[];
}

function WarningGroup({ type, warnings }: WarningGroupProps) {
  const [open, setOpen] = useState(false);
  const config = WARNING_TYPE_CONFIG[type];
  const label = getWarningTypeLabel(type);
  const description = getWarningTypeDescription(type);

  if (warnings.length === 0) {
    return null;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid={`import-warning-${type}`}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-1.5 text-xs hover:bg-muted/50 rounded px-1.5 -mx-1.5 transition-colors">
        <div className="flex items-center gap-1.5">
          <ChevronRight
            className={cn('w-3 h-3 transition-transform', open && 'rotate-90')}
          />
          <span className={cn('font-medium', config.color)}>{label}</span>
        </div>
        <Badge
          variant="outline"
          className={cn('text-[10px] font-mono tabular-nums px-1.5 py-0', config.badgeColor)}
          data-testid={`import-warning-count-${type}`}
        >
          {String(warnings.length)}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="text-[10px] text-muted-foreground mb-1 pl-[18px]">{description}</p>
        <ul className="space-y-0.5 pl-[18px]">
          {warnings.map((w, i) => (
            <li
              key={i}
              className="text-[10px] leading-tight"
              data-testid={`import-warning-${type}-${String(i)}`}
            >
              <span className={cn('font-medium', config.color)}>{w.entity}</span>
              <span className="text-muted-foreground"> — {w.detail}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Mapping warnings section
// ---------------------------------------------------------------------------

interface MappingWarningsSectionProps {
  importedDesign: ImportedDesign;
}

function MappingWarningsSection({ importedDesign }: MappingWarningsSectionProps) {
  const [sectionOpen, setSectionOpen] = useState(true);

  const warnings = useMemo(
    () => generateImportWarnings(importedDesign, importedDesign.format),
    [importedDesign],
  );

  const byType = useMemo(() => groupWarningsByType(warnings), [warnings]);
  const bySeverity = useMemo(() => groupWarningsBySeverity(warnings), [warnings]);

  const errorCount = bySeverity.error.length;
  const hasErrors = errorCount > 0;
  const typeOrder: ImportWarningType[] = ['dropped', 'unsupported', 'converted', 'approximated'];

  if (warnings.length === 0) {
    return (
      <div
        className="flex items-center gap-1.5 border border-green-500/30 bg-green-500/5 rounded-md px-3 py-2"
        data-testid="import-warning-none"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
        <span className="text-xs text-green-400">No mapping issues detected</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Error banner */}
      {hasErrors && (
        <div
          className="flex items-center gap-1.5 border border-red-500/30 bg-red-500/5 rounded-md px-3 py-2"
          data-testid="import-warning-banner"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span className="text-xs text-red-400 font-medium">
            {String(errorCount)} item{errorCount > 1 ? 's' : ''} could not be imported
          </span>
        </div>
      )}

      {/* Collapsible warning groups */}
      <Collapsible open={sectionOpen} onOpenChange={setSectionOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <div className="flex items-center gap-1.5">
            <ChevronRight
              className={cn('w-3 h-3 transition-transform', sectionOpen && 'rotate-90')}
            />
            Mapping Warnings
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-mono tabular-nums px-1.5 py-0"
            data-testid="import-warning-count"
          >
            {String(warnings.length)}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-0.5 border border-border/50 rounded-md px-3 py-2 mt-1">
            {typeOrder.map((type) => (
              <WarningGroup key={type} type={type} warnings={byType[type]} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function ImportPreviewDialogInner({
  open,
  onOpenChange,
  preview,
  fileName,
  onApply,
  onCancel,
  importedDesign,
}: ImportPreviewDialogProps) {
  if (!preview) {
    return null;
  }

  const hasChanges =
    preview.addedNodes > 0 ||
    preview.modifiedNodes > 0 ||
    preview.addedEdges > 0 ||
    preview.addedComponents > 0 ||
    preview.addedNets > 0 ||
    preview.addedWires > 0;

  const hasWarnings = preview.warnings.length > 0;
  const hasConflicts = preview.conflicts.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md max-h-[85vh] overflow-y-auto"
        data-testid="import-preview-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileInput className="w-4 h-4 text-primary" />
            Import Preview
          </DialogTitle>
          <DialogDescription className="text-xs" data-testid="import-preview-filename">
            Review changes from <span className="font-mono text-foreground">{fileName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Diff summary */}
        <div
          className="space-y-0.5 border border-border/50 rounded-md px-3 py-2"
          data-testid="import-preview-diff"
        >
          <DiffRow
            label="Nodes"
            count={preview.addedNodes}
            variant="added"
            testId="import-diff-added-nodes"
          />
          <DiffRow
            label="Nodes (modified)"
            count={preview.modifiedNodes}
            variant="modified"
            testId="import-diff-modified-nodes"
          />
          <DiffRow
            label="Nodes (orphaned)"
            count={preview.removedNodes}
            variant="removed"
            testId="import-diff-removed-nodes"
          />
          <DiffRow
            label="Edges"
            count={preview.addedEdges}
            variant="added"
            testId="import-diff-added-edges"
          />
          <DiffRow
            label="BOM items"
            count={preview.addedComponents}
            variant="added"
            testId="import-diff-added-components"
          />
          <DiffRow
            label="Nets"
            count={preview.addedNets}
            variant="added"
            testId="import-diff-added-nets"
          />
          <DiffRow
            label="Wires"
            count={preview.addedWires}
            variant="added"
            testId="import-diff-added-wires"
          />

          {!hasChanges && (
            <p
              className="text-xs text-muted-foreground py-2 text-center"
              data-testid="import-no-changes"
            >
              No changes detected.
            </p>
          )}
        </div>

        {/* Mapping warnings (from import-warnings engine) */}
        {importedDesign && (
          <MappingWarningsSection importedDesign={importedDesign} />
        )}

        {/* Warnings */}
        {hasWarnings && (
          <div
            className="space-y-1 border border-amber-400/30 bg-amber-400/5 rounded-md px-3 py-2"
            data-testid="import-preview-warnings"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              Warnings ({String(preview.warnings.length)})
            </div>
            <ul className="space-y-0.5">
              {preview.warnings.map((w, i) => (
                <li
                  key={i}
                  className="text-[10px] text-amber-300/80 leading-tight pl-4"
                  data-testid={`import-warning-${String(i)}`}
                >
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Conflicts */}
        {hasConflicts && (
          <div
            className="space-y-1 border border-red-400/30 bg-red-400/5 rounded-md px-3 py-2"
            data-testid="import-preview-conflicts"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-red-400">
              <AlertCircle className="w-3 h-3" />
              Conflicts ({String(preview.conflicts.length)})
            </div>
            <ul className="space-y-0.5">
              {preview.conflicts.map((c, i) => (
                <li
                  key={i}
                  className="text-[10px] text-red-300/80 leading-tight pl-4"
                  data-testid={`import-conflict-${String(i)}`}
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            data-testid="import-preview-cancel"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onApply}
            disabled={!hasChanges}
            data-testid="import-preview-apply"
          >
            Apply Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ImportPreviewDialog = memo(ImportPreviewDialogInner);
export default ImportPreviewDialog;
