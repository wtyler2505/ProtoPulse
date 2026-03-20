/**
 * SchematicBomSyncPanel — slide-over panel that bridges schematic instances
 * to BOM entries. Shows unmapped components, new entries to add, duplicates
 * to review, and allows syncing schematic component data into the BOM.
 */

import { memo, useMemo, useState, useCallback, useSyncExternalStore } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useCircuitInstances } from '@/lib/circuit-editor/hooks';
import { useComponentParts } from '@/lib/component-editor/hooks';
import {
  schematicBomBridge,
} from '@/lib/circuit-editor/schematic-bom-bridge';
import type {
  SyncPlan,
  SyncAction,
  UnmappedComponent,
  BomEntryDraft,
} from '@/lib/circuit-editor/schematic-bom-bridge';
import type { BomItem } from '@/lib/project-context';
import type { ComponentPart } from '@shared/schema';
import {
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  Package,
  Plus,
  RefreshCw,
  SkipForward,
  PenLine,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SchematicBomSyncPanelProps {
  circuitId: number;
  existingBom: BomItem[];
  onAddBomItem?: (draft: BomEntryDraft) => void;
  onUpdateBomItem?: (bomItemId: string, newQuantity: number) => void;
  onSyncAll?: (plan: SyncPlan) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const ActionBadge = memo(function ActionBadge({ type }: { type: SyncAction['type'] }) {
  switch (type) {
    case 'add':
      return (
        <span
          data-testid="badge-add"
          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400"
        >
          <Plus className="h-3 w-3" /> Add
        </span>
      );
    case 'update_quantity':
      return (
        <span
          data-testid="badge-update"
          className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400"
        >
          <PenLine className="h-3 w-3" /> Update
        </span>
      );
    case 'skip':
      return (
        <span
          data-testid="badge-skip"
          className="inline-flex items-center gap-1 rounded-full bg-zinc-500/20 px-2 py-0.5 text-xs text-zinc-400"
        >
          <SkipForward className="h-3 w-3" /> Skip
        </span>
      );
    default:
      return null;
  }
});

const UnmappedRow = memo(function UnmappedRow({ item }: { item: UnmappedComponent }) {
  return (
    <div
      data-testid={`unmapped-${item.referenceDesignator}`}
      className="flex items-center justify-between rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <span className="font-mono text-sm text-zinc-200">{item.referenceDesignator}</span>
          <span className="ml-2 text-xs text-zinc-400">{item.description}</span>
        </div>
      </div>
      <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{reasonLabel(item.reason)}</span>
    </div>
  );
});

const ActionRow = memo(function ActionRow({
  action,
  onAdd,
  onUpdate,
}: {
  action: SyncAction;
  onAdd?: (draft: BomEntryDraft) => void;
  onUpdate?: (bomItemId: string, newQuantity: number) => void;
}) {
  const draft = action.type === 'add'
    ? action.draft
    : action.type === 'update_quantity'
      ? action.draft
      : action.draft;

  const handleClick = useCallback(() => {
    if (action.type === 'add' && onAdd) {
      onAdd(action.draft);
    } else if (action.type === 'update_quantity' && onUpdate) {
      onUpdate(String(action.existingBomItem.id), action.newQuantity);
    }
  }, [action, onAdd, onUpdate]);

  return (
    <div
      data-testid={`action-${draft.identityKey}`}
      className="flex items-center justify-between rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <ActionBadge type={action.type} />
          <span className="truncate font-mono text-sm text-zinc-200">
            {draft.partNumber || draft.description}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400">
          {draft.manufacturer && <span>{draft.manufacturer}</span>}
          <span>Qty: {draft.quantity}</span>
          {draft.referenceDesignators.length > 0 && (
            <span className="truncate">{draft.referenceDesignators.join(', ')}</span>
          )}
        </div>
        {action.type === 'update_quantity' && (
          <div className="mt-1 text-xs text-amber-400">
            Update quantity to {action.newQuantity}
          </div>
        )}
        {action.type === 'skip' && (
          <div className="mt-1 text-xs text-zinc-400">{action.reason}</div>
        )}
      </div>
      {action.type !== 'skip' && (
        <button
          data-testid={`action-btn-${draft.identityKey}`}
          type="button"
          onClick={handleClick}
          className="ml-2 shrink-0 rounded bg-cyan-600 px-2 py-1 text-xs text-white hover:bg-cyan-500"
        >
          {action.type === 'add' ? 'Add' : 'Update'}
        </button>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reasonLabel(reason: UnmappedComponent['reason']): string {
  switch (reason) {
    case 'no_part': return 'No part linked';
    case 'no_bom_match': return 'No BOM match';
    case 'missing_metadata': return 'Missing metadata';
    default: return reason;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const SchematicBomSyncPanel = memo(function SchematicBomSyncPanel({
  circuitId,
  existingBom,
  onAddBomItem,
  onUpdateBomItem,
  onSyncAll,
}: SchematicBomSyncPanelProps) {
  const projectId = useProjectId();
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: parts } = useComponentParts(projectId);
  const [plan, setPlan] = useState<SyncPlan | null>(null);

  // Subscribe to bridge version changes
  const _version = useSyncExternalStore(
    useCallback((cb: () => void) => schematicBomBridge.subscribe(cb), []),
    useCallback(() => schematicBomBridge.getSnapshot(), []),
  );

  // Build parts map
  const partsById = useMemo(() => {
    const map = new Map<number, ComponentPart>();
    if (parts) {
      for (const p of parts) {
        map.set(p.id, p);
      }
    }
    return map;
  }, [parts]);

  // Convert client BomItem[] to schema-compatible for duplicate detection
  const schemaBom = useMemo(() => {
    return existingBom.map((b) => ({
      id: Number(b.id) || 0,
      projectId,
      partNumber: b.partNumber,
      manufacturer: b.manufacturer,
      description: b.description,
      quantity: b.quantity,
      unitPrice: String(b.unitPrice),
      totalPrice: String(b.totalPrice),
      supplier: b.supplier,
      stock: b.stock,
      status: b.status,
      leadTime: b.leadTime ?? null,
      datasheetUrl: null,
      manufacturerUrl: null,
      storageLocation: null,
      quantityOnHand: null,
      minimumStock: null,
      esdSensitive: b.esdSensitive ?? null,
      assemblyCategory: b.assemblyCategory ?? null,
      tolerance: null,
      version: 1,
      updatedAt: new Date(),
      deletedAt: null,
    }));
  }, [existingBom, projectId]);

  const handleAnalyze = useCallback(() => {
    if (!instances) {
      return;
    }
    const result = schematicBomBridge.generateSyncPlan(instances, partsById, schemaBom);
    setPlan(result);
  }, [instances, partsById, schemaBom]);

  const handleSyncAll = useCallback(() => {
    if (plan && onSyncAll) {
      onSyncAll(plan);
    }
  }, [plan, onSyncAll]);

  const hasData = instances && instances.length > 0;
  const addActions = plan?.actions.filter((a) => a.type === 'add') ?? [];
  const updateActions = plan?.actions.filter((a) => a.type === 'update_quantity') ?? [];
  const skipActions = plan?.actions.filter((a) => a.type === 'skip') ?? [];

  return (
    <div data-testid="schematic-bom-sync-panel" className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Schematic → BOM Sync</h3>
        </div>
        <button
          data-testid="btn-analyze"
          type="button"
          disabled={!hasData}
          onClick={handleAnalyze}
          className={cn(
            'flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium',
            hasData
              ? 'bg-cyan-600 text-white hover:bg-cyan-500'
              : 'cursor-not-allowed bg-zinc-700 text-zinc-400',
          )}
        >
          <RefreshCw className="h-3 w-3" />
          Analyze
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {!plan && !hasData && (
          <div data-testid="empty-state" className="flex flex-col items-center gap-2 py-8 text-center text-zinc-400">
            <Package className="h-8 w-8" />
            <p className="text-sm">No schematic instances found.</p>
            <p className="text-xs">Add components to your schematic to sync them with the BOM.</p>
          </div>
        )}

        {!plan && hasData && (
          <div data-testid="ready-state" className="flex flex-col items-center gap-2 py-8 text-center text-zinc-400">
            <HelpCircle className="h-8 w-8" />
            <p className="text-sm">{instances.length} instance{instances.length !== 1 ? 's' : ''} in schematic.</p>
            <p className="text-xs">Click Analyze to generate a sync plan.</p>
          </div>
        )}

        {plan && (
          <>
            {/* Summary stats */}
            <div data-testid="sync-summary" className="grid grid-cols-4 gap-2">
              <SummaryStat label="Add" value={plan.addCount} color="text-emerald-400" />
              <SummaryStat label="Update" value={plan.updateCount} color="text-amber-400" />
              <SummaryStat label="Skip" value={plan.skipCount} color="text-zinc-400" />
              <SummaryStat label="Unmapped" value={plan.unmapped.length} color="text-red-400" />
            </div>

            {/* Sync All button */}
            {(plan.addCount > 0 || plan.updateCount > 0) && onSyncAll && (
              <button
                data-testid="btn-sync-all"
                type="button"
                onClick={handleSyncAll}
                className="flex w-full items-center justify-center gap-2 rounded bg-cyan-600 py-2 text-sm font-medium text-white hover:bg-cyan-500"
              >
                <CheckCircle2 className="h-4 w-4" />
                Sync All ({plan.addCount + plan.updateCount} items)
              </button>
            )}

            {/* Actions */}
            {addActions.length > 0 && (
              <Section title="New BOM Entries" count={addActions.length}>
                {addActions.map((a) => (
                  <ActionRow
                    key={a.type === 'add' ? a.draft.identityKey : ''}
                    action={a}
                    onAdd={onAddBomItem}
                  />
                ))}
              </Section>
            )}

            {updateActions.length > 0 && (
              <Section title="Quantity Updates" count={updateActions.length}>
                {updateActions.map((a) => (
                  <ActionRow
                    key={a.type === 'update_quantity' ? a.draft.identityKey : ''}
                    action={a}
                    onUpdate={onUpdateBomItem}
                  />
                ))}
              </Section>
            )}

            {skipActions.length > 0 && (
              <Section title="Already Synced" count={skipActions.length}>
                {skipActions.map((a) => (
                  <ActionRow
                    key={a.type === 'skip' ? a.draft.identityKey : ''}
                    action={a}
                  />
                ))}
              </Section>
            )}

            {/* Unmapped */}
            {plan.unmapped.length > 0 && (
              <Section title="Unmapped Components" count={plan.unmapped.length}>
                {plan.unmapped.map((u) => (
                  <UnmappedRow key={u.instanceId} item={u} />
                ))}
              </Section>
            )}

            {plan.actions.length === 0 && plan.unmapped.length === 0 && (
              <div data-testid="all-synced" className="flex flex-col items-center gap-2 py-6 text-center text-zinc-400">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <p className="text-sm">Everything is in sync.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

export default SchematicBomSyncPanel;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div data-testid={`stat-${label.toLowerCase()}`} className="rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-center">
      <div className={cn('text-lg font-bold', color)}>{value}</div>
      <div className="text-xs text-zinc-400">{label}</div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h4>
        <span className="rounded-full bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
