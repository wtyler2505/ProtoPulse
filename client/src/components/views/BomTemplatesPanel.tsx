import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, BookTemplate, CheckCircle2, Download, Loader2, Plus, Trash2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useBomTemplates,
  useBomTemplateDetail,
  useCreateBomTemplate,
  useApplyBomTemplate,
  useDeleteBomTemplate,
} from '@/lib/parts/use-bom-templates';
import type { BomTemplate, BomTemplateItem, BomTemplateWithItems } from '@/lib/parts/use-bom-templates';
import { useArchitecture, useBom, useProjectMeta, type BomItem } from '@/lib/project-context';
import { useComponentParts } from '@/lib/component-editor/hooks';
import { useCircuitDesigns, useCircuitInstances } from '@/lib/circuit-editor/hooks';
import { buildValidationSafetyGateData } from '@/lib/validation-safety-gates';
import { runExportPrecheck, type ExportPrecheck, type PrecheckStatus } from '@/lib/export-precheck';
import type { ProjectExportData } from '@/lib/export-validation';
import { TrustBadge, type TrustBadgeKind } from '@/components/ui/TrustBadge';
import { useToast } from '@/hooks/use-toast';

interface BomTemplatesPanelProps {
  projectId: number;
  bom?: BomItem[];
}

type ApplyDiffAction = 'create' | 'skip';

interface ApplyDiffRow {
  item: BomTemplateItem;
  action: ApplyDiffAction;
  reason: string;
}

interface ApplyDiffSummary {
  rows: ApplyDiffRow[];
  createCount: number;
  skipCount: number;
}

function TemplateRow({
  template,
  onApply,
  onDelete,
  isApplying,
  isDeleting,
  applyBlocked,
  applyBlockerCount,
  applyWarningCount,
}: {
  template: BomTemplate;
  onApply: (template: BomTemplate) => void;
  onDelete: (templateId: string) => void;
  isApplying: boolean;
  isDeleting: boolean;
  applyBlocked: boolean;
  applyBlockerCount: number;
  applyWarningCount: number;
}) {
  const applyLabel = applyBlocked ? 'Blocked' : applyWarningCount > 0 ? 'Review' : 'Apply';

  return (
    <div
      data-testid={`template-row-${template.id}`}
      className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/30 px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <span data-testid={`template-name-${template.id}`} className="text-sm font-medium text-foreground truncate block">
          {template.name}
        </span>
        {template.description && (
          <span className="text-xs text-muted-foreground truncate block">{template.description}</span>
        )}
        {template.tags && template.tags.length > 0 && (
          <div className="flex gap-1 mt-1">
            {template.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="outline"
          size="sm"
          data-testid={`template-apply-${template.id}`}
          disabled={isApplying || applyBlocked}
          onClick={() => { onApply(template); }}
          className="h-7 text-xs gap-1"
        >
          {isApplying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          {applyLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          data-testid={`template-delete-${template.id}`}
          aria-label={`Delete template ${template.name}`}
          disabled={isDeleting}
          onClick={() => { onDelete(template.id); }}
          className="h-7 px-2 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {(applyBlocked || applyWarningCount > 0) && (
        <span className="sr-only" data-testid={`template-safety-state-${template.id}`}>
          {applyBlocked
            ? `${applyBlockerCount} blocker${applyBlockerCount === 1 ? '' : 's'} must be resolved before applying this template.`
            : `${applyWarningCount} warning${applyWarningCount === 1 ? '' : 's'} will be reviewed before applying this template.`}
        </span>
      )}
    </div>
  );
}

function readHasSession(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean(window.localStorage.getItem('protopulse-session-id'));
}

function safetyGateId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function safetyGateKind(status: PrecheckStatus): TrustBadgeKind {
  if (status === 'pass') {
    return 'verified';
  }
  if (status === 'fail') {
    return 'unverified';
  }
  return 'estimated';
}

function safetyGateLabel(status: PrecheckStatus): string {
  if (status === 'pass') {
    return 'PASS';
  }
  if (status === 'fail') {
    return 'BLOCKED';
  }
  return 'WARN';
}

function SafetyGateIcon({ status }: { status: PrecheckStatus }) {
  if (status === 'pass') {
    return <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />;
  }
  if (status === 'fail') {
    return <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />;
  }
  return <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />;
}

function formatCurrency(value: string | null): string {
  if (value == null) {
    return 'No unit price';
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toFixed(2)}` : value;
}

function buildApplyDiff(templateDetail: BomTemplateWithItems, currentBom: readonly BomItem[]): ApplyDiffSummary {
  const existingPartIds = new Set(currentBom.map((item) => String(item.id)));
  const rows = templateDetail.items.map((item): ApplyDiffRow => {
    if (existingPartIds.has(String(item.partId))) {
      return {
        item,
        action: 'skip',
        reason: 'Already present in this project stock list.',
      };
    }

    return {
      item,
      action: 'create',
      reason: 'Will create a new stock line for this project.',
    };
  });

  return {
    rows,
    createCount: rows.filter((row) => row.action === 'create').length,
    skipCount: rows.filter((row) => row.action === 'skip').length,
  };
}

function BomTemplateSafetyGate({ precheck }: { precheck: ExportPrecheck }) {
  const blockerCount = precheck.blockers.length;
  const warningCount = precheck.warnings.length;
  const summaryKind: TrustBadgeKind = blockerCount > 0 ? 'unverified' : warningCount > 0 ? 'estimated' : 'verified';
  const summaryLabel = blockerCount > 0 ? 'BLOCKED' : warningCount > 0 ? 'REVIEW' : 'CLEAR';
  const summaryText = blockerCount > 0
    ? `${blockerCount} template action blocker${blockerCount === 1 ? '' : 's'} must be resolved before saving or applying BOM templates.`
    : warningCount > 0
      ? `${warningCount} trust warning${warningCount === 1 ? '' : 's'} will be shown before template apply.`
      : 'Template save and apply actions have no visible trust blockers.';

  return (
    <div
      data-testid="bom-template-safety-gate"
      className="rounded-md border border-border/60 bg-background/40 px-3 py-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Template Safety Gate</span>
          <TrustBadge kind={summaryKind} label={summaryLabel} />
        </div>
        <span className="text-[11px] text-muted-foreground" data-testid="bom-template-safety-summary">
          {summaryText}
        </span>
      </div>
      {(blockerCount > 0 || warningCount > 0) && (
        <div className="mt-2 grid gap-1.5">
          {precheck.checks
            .filter((check) => check.status !== 'pass')
            .map((check) => (
              <div
                key={check.name}
                data-testid={`bom-template-safety-${safetyGateId(check.name)}`}
                className="flex min-w-0 items-start gap-2 rounded border border-border/50 bg-muted/20 px-2 py-1.5"
              >
                <SafetyGateIcon status={check.status} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-foreground">{check.name}</span>
                    <TrustBadge kind={safetyGateKind(check.status)} label={safetyGateLabel(check.status)} />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{check.message}</p>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ApplyPreview({
  template,
  templateDetail,
  currentBom,
  precheck,
  isApplying,
  isDetailLoading,
  isDetailError,
  onCancel,
  onConfirm,
}: {
  template: BomTemplate;
  templateDetail: BomTemplateWithItems | undefined;
  currentBom: readonly BomItem[];
  precheck: ExportPrecheck;
  isApplying: boolean;
  isDetailLoading: boolean;
  isDetailError: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const diff = useMemo(
    () => templateDetail ? buildApplyDiff(templateDetail, currentBom) : null,
    [currentBom, templateDetail],
  );
  const canConfirm = precheck.blockers.length === 0 && Boolean(diff) && !isApplying && !isDetailLoading && !isDetailError;

  return (
    <div
      data-testid="bom-template-apply-preview"
      className="rounded-md border border-primary/30 bg-primary/5 p-3"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Preview template apply</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground" data-testid="bom-template-apply-preview-summary">
            Applying {template.name} will add missing template stock lines to this project and skip rows that already exist.
          </p>
          {isDetailLoading && (
            <p className="mt-2 text-xs text-muted-foreground" data-testid="bom-template-apply-preview-loading">
              Loading template item diff...
            </p>
          )}
          {isDetailError && (
            <p className="mt-2 text-xs text-destructive" data-testid="bom-template-apply-preview-error">
              Could not load template details. Review cannot continue until the item diff is available.
            </p>
          )}
          {diff && (
            <div className="mt-2 space-y-2" data-testid="bom-template-apply-preview-diff">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <Badge
                  variant="outline"
                  className="border-emerald-500/50 bg-emerald-500/10 text-foreground"
                  data-testid="bom-template-apply-preview-create-count"
                >
                  {diff.createCount} create
                </Badge>
                <Badge
                  variant="outline"
                  className="border-muted-foreground/40 bg-muted/30 text-foreground"
                  data-testid="bom-template-apply-preview-skip-count"
                >
                  {diff.skipCount} skip
                </Badge>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border border-border/60 bg-background/60">
                {diff.rows.map((row) => (
                  <div
                    key={row.item.id}
                    data-testid={`bom-template-apply-preview-row-${row.item.id}`}
                    className="grid gap-1 border-b border-border/40 px-2.5 py-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] uppercase',
                            row.action === 'create'
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-foreground'
                              : 'border-muted-foreground/40 bg-muted/30 text-foreground',
                          )}
                          data-testid={`bom-template-apply-preview-action-${row.item.id}`}
                        >
                          {row.action}
                        </Badge>
                        <span className="truncate text-xs font-medium text-foreground">{row.item.partTitle}</span>
                        {row.item.partMpn && <span className="text-[11px] text-muted-foreground">{row.item.partMpn}</span>}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{row.reason}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground sm:justify-end">
                      <span data-testid={`bom-template-apply-preview-qty-${row.item.id}`}>Qty {row.item.quantityNeeded}</span>
                      <span>{formatCurrency(row.item.unitPrice)}</span>
                      <span>{row.item.supplier ?? 'No supplier'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {precheck.warnings.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-muted-foreground" data-testid="bom-template-apply-preview-warnings">
              {precheck.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={isApplying}
            onClick={onCancel}
            data-testid="bom-template-apply-preview-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={!canConfirm}
            onClick={onConfirm}
            data-testid="bom-template-apply-preview-confirm"
          >
            {isApplying && <Loader2 className="h-3 w-3 animate-spin" />}
            Confirm apply
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BomTemplatesPanel({ projectId, bom }: BomTemplatesPanelProps) {
  const { data: templates, isLoading } = useBomTemplates();
  const createMutation = useCreateBomTemplate();
  const applyMutation = useApplyBomTemplate();
  const deleteMutation = useDeleteBomTemplate();
  const { bom: contextBom } = useBom();
  const { projectName } = useProjectMeta();
  const { nodes } = useArchitecture();
  const { data: componentParts } = useComponentParts(projectId);
  const { data: circuitDesigns } = useCircuitDesigns(projectId);
  const firstCircuitId = circuitDesigns?.[0]?.id ?? 0;
  const { data: circuitInstances } = useCircuitInstances(firstCircuitId);
  const { toast } = useToast();
  const [newTemplateName, setNewTemplateName] = useState('');
  const [pendingApplyTemplate, setPendingApplyTemplate] = useState<BomTemplate | null>(null);
  const currentBom = bom ?? contextBom;
  const {
    data: pendingApplyTemplateDetail,
    isLoading: isTemplateDetailLoading,
    isError: isTemplateDetailError,
  } = useBomTemplateDetail(pendingApplyTemplate?.id ?? null);

  const templatePrecheck = useMemo(() => {
    const safetyData = buildValidationSafetyGateData({
      circuitInstances: circuitInstances ?? [],
      componentParts: componentParts ?? [],
      bomItems: currentBom ?? [],
    });
    const projectData: ProjectExportData = {
      projectName,
      hasSession: readHasSession(),
      architectureNodeCount: nodes.length,
      hasCircuitInstances: (circuitInstances?.length ?? 0) > 0,
      hasPcbLayout: (circuitInstances ?? []).some((instance) => instance.pcbX != null && instance.pcbY != null),
      bomItemCount: currentBom?.length ?? 0,
      bomItemsWithPartNumber: (currentBom ?? []).filter((item) => item.partNumber.trim().length > 0).length,
      hasCircuitSource: (circuitInstances ?? []).some((instance) => /^[VI]/i.test(instance.referenceDesignator)),
      hasCircuitComponent: (circuitInstances?.length ?? 0) > 0,
      hasBoardProfile: true,
      bomItemsWithFailureData: 0,
      ...safetyData,
    };
    return runExportPrecheck('bom-template-apply', projectData);
  }, [circuitInstances, componentParts, currentBom, nodes.length, projectName]);

  const hasTemplateBlockers = templatePrecheck.blockers.length > 0;
  const templateWarningCount = templatePrecheck.warnings.length;

  const handleSaveAsTemplate = () => {
    if (hasTemplateBlockers) {
      toast({
        title: 'Template blocked',
        description: templatePrecheck.blockers[0],
        variant: 'destructive',
      });
      return;
    }

    if (!newTemplateName.trim() || !currentBom || currentBom.length === 0) { return; }

    createMutation.mutate(
      {
        name: newTemplateName.trim(),
        items: currentBom.map((item) => ({
          partId: item.id,
          quantityNeeded: item.quantity,
          unitPrice: item.unitPrice,
          supplier: item.supplier !== 'Unknown' ? item.supplier : null,
        })),
      },
      {
        onSuccess: (result) => {
          toast({ title: 'Template saved', description: `"${result.name}" with ${result.itemCount} items` });
          setNewTemplateName('');
        },
        onError: () => {
          toast({ title: 'Failed to save template', variant: 'destructive' });
        },
      },
    );
  };

  const handleApply = (template: BomTemplate) => {
    if (hasTemplateBlockers) {
      toast({
        title: 'Template apply blocked',
        description: templatePrecheck.blockers[0],
        variant: 'destructive',
      });
      return;
    }

    setPendingApplyTemplate(template);
  };

  const handleConfirmApply = () => {
    if (!pendingApplyTemplate) {
      return;
    }

    applyMutation.mutate(
      { templateId: pendingApplyTemplate.id, projectId },
      {
        onSuccess: (result) => {
          setPendingApplyTemplate(null);
          toast({ title: 'Template applied', description: result.message });
        },
        onError: () => {
          toast({ title: 'Failed to apply template', variant: 'destructive' });
        },
      },
    );
  };

  const handleDelete = (templateId: string) => {
    deleteMutation.mutate(templateId, {
      onSuccess: () => {
        toast({ title: 'Template deleted' });
      },
    });
  };

  if (isLoading) {
    return (
      <Card data-testid="bom-templates-panel">
        <CardContent className="flex items-center justify-center py-6" data-testid="bom-templates-loading">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading templates...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="bom-templates-panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookTemplate className="h-4 w-4" />
          BOM Templates
          {templates && templates.length > 0 && (
            <Badge variant="secondary" data-testid="bom-templates-count">
              {templates.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <BomTemplateSafetyGate precheck={templatePrecheck} />

        {/* Save current BOM as template */}
        <div className="flex items-center gap-2" data-testid="bom-templates-save-form">
          <Input
            data-testid="bom-templates-name-input"
            placeholder="Template name..."
            value={newTemplateName}
            onChange={(e) => { setNewTemplateName(e.target.value); }}
            className="h-8 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') { handleSaveAsTemplate(); } }}
          />
          <Button
            variant="default"
            size="sm"
            data-testid="bom-templates-save-btn"
            disabled={hasTemplateBlockers || !newTemplateName.trim() || !currentBom || currentBom.length === 0 || createMutation.isPending}
            onClick={handleSaveAsTemplate}
            className="h-8 text-xs gap-1 shrink-0"
          >
            {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Save BOM as Template
          </Button>
        </div>

        {pendingApplyTemplate && (
          <ApplyPreview
            template={pendingApplyTemplate}
            templateDetail={pendingApplyTemplateDetail}
            currentBom={currentBom ?? []}
            precheck={templatePrecheck}
            isApplying={applyMutation.isPending}
            isDetailLoading={isTemplateDetailLoading}
            isDetailError={isTemplateDetailError}
            onCancel={() => { setPendingApplyTemplate(null); }}
            onConfirm={handleConfirmApply}
          />
        )}

        {/* Template list */}
        {(!templates || templates.length === 0) ? (
          <p data-testid="bom-templates-empty" className="text-sm text-muted-foreground py-2 text-center">
            No templates saved yet. Save your current BOM as a template above.
          </p>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2" data-testid="bom-templates-list">
              {templates.map((template) => (
                <TemplateRow
                  key={template.id}
                  template={template}
                  onApply={handleApply}
                  onDelete={handleDelete}
                  isApplying={applyMutation.isPending}
                  isDeleting={deleteMutation.isPending}
                  applyBlocked={hasTemplateBlockers}
                  applyBlockerCount={templatePrecheck.blockers.length}
                  applyWarningCount={templateWarningCount}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
