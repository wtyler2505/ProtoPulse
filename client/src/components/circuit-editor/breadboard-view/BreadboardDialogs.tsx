/**
 * BreadboardDialogs — renders whichever breadboard dialog matches the current
 * dialog state kind.  Extracted from BreadboardView (audit #26, #8).
 *
 * Accepts the discriminated-union state from useBreadboardDialogState() plus
 * all content props required by the four dialogs.  Only one dialog is mounted
 * as open at a time, enforced by the state machine.
 */

import BreadboardExactPartRequestDialog from '../BreadboardExactPartRequestDialog';
import BreadboardInventoryDialog from '../BreadboardInventoryDialog';
import BreadboardShoppingList, { type ShoppingListItem } from '../BreadboardShoppingList';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExactPartDraftModal from '@/components/views/component-editor/ExactPartDraftModal';
import type { BreadboardBenchInsight } from '@/lib/breadboard-bench';
import type { ComponentPart } from '@shared/schema';
import type { ExactPartDraftSeed } from '@shared/exact-part-resolver';
import type { UseBreadboardDialogStateResult } from './useBreadboardDialogState';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BreadboardDialogsProps {
  // State machine from useBreadboardDialogState()
  dialogState: UseBreadboardDialogStateResult;

  // Shared
  projectId: number;
  parts: ComponentPart[];
  activeCircuitReady: boolean;

  // Shopping list
  shoppingListItems: ShoppingListItem[];

  // Inventory
  insights: BreadboardBenchInsight[];
  onOpenAiReconcile: () => void;
  onOpenStorageView: () => void;
  onTrackPart: (
    partId: number,
    values: { minimumStock: number; quantityOnHand: number; storageLocation: string | null },
  ) => void;
  onUpdateTrackedPart: (
    bomItemId: string,
    values: { minimumStock: number; quantityOnHand: number; storageLocation: string | null },
  ) => void;

  // Exact-part request dialog
  onCreateExactDraft: (seed: ExactPartDraftSeed) => void;
  onOpenComponentEditor: () => void;
  onPlaceResolvedPart: (part: ComponentPart) => void;

  // Exact-draft modal
  exactDraftSeed: ExactPartDraftSeed | null;
  onExactDraftCreated: (part: ComponentPart) => void;
  onExactDraftOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BreadboardDialogs({
  dialogState,
  projectId,
  parts,
  activeCircuitReady,
  shoppingListItems,
  insights,
  onOpenAiReconcile,
  onOpenStorageView,
  onTrackPart,
  onUpdateTrackedPart,
  onCreateExactDraft,
  onOpenComponentEditor,
  onPlaceResolvedPart,
  exactDraftSeed,
  onExactDraftCreated,
  onExactDraftOpenChange,
}: BreadboardDialogsProps) {
  const { isOpen, close } = dialogState;

  return (
    <>
      <BreadboardExactPartRequestDialog
        activeCircuitReady={activeCircuitReady}
        open={isOpen('exact-part')}
        parts={parts}
        onCreateExactDraft={onCreateExactDraft}
        onOpenChange={(open) => { if (!open) close(); }}
        onOpenComponentEditor={() => {
          close();
          onOpenComponentEditor();
        }}
        onPlaceResolvedPart={onPlaceResolvedPart}
      />

      <ExactPartDraftModal
        open={isOpen('exact-draft')}
        projectId={projectId}
        initialSeed={exactDraftSeed ?? undefined}
        onCreated={onExactDraftCreated}
        onOpenChange={onExactDraftOpenChange}
      />

      <BreadboardInventoryDialog
        insights={insights}
        open={isOpen('inventory')}
        onOpenAiReconcile={onOpenAiReconcile}
        onOpenChange={(open) => { if (!open) close(); }}
        onOpenStorageView={() => {
          close();
          onOpenStorageView();
        }}
        onTrackPart={onTrackPart}
        onUpdateTrackedPart={onUpdateTrackedPart}
      />

      <Dialog open={isOpen('shopping-list')} onOpenChange={(open) => { if (!open) close(); }}>
        <DialogContent data-testid="breadboard-shopping-list-dialog" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Shopping List — Missing Parts</DialogTitle>
            <DialogDescription>
              Consolidated list of parts needed to build your circuit. Export as CSV or use supplier links.
            </DialogDescription>
          </DialogHeader>
          <BreadboardShoppingList missingParts={shoppingListItems} />
        </DialogContent>
      </Dialog>
    </>
  );
}
