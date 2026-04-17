/**
 * BL-0524: Conflict resolution UI for CRDT merge losses.
 *
 * When the authoritative server drops an operation due to LWW loss or
 * structural merge (insert-superseded / delete-rejected), it emits a
 * `conflict-detected` message to the losing client with the original
 * losing op + the surviving authoritative op. This dialog surfaces
 * those side-by-side and lets the user:
 *   - Accept theirs — discard local edit, state already matches.
 *   - Accept mine  — re-apply the losing op as a fresh state-update;
 *                    the server will re-tag with a newer Lamport clock
 *                    so it wins unless yet another concurrent edit lands.
 *   - Custom merge — submit a hand-edited value as an update.
 *
 * Built on top of shadcn Dialog + Radix primitives to match the rest
 * of ProtoPulse's cyberpunk-adjacent UI language.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Conflict, ConflictKind, CRDTOperation } from '@shared/collaboration';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export interface ConflictResolutionDialogProps {
  conflicts: Conflict[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (conflictId: string, action: 'mine' | 'theirs' | 'merge', customValue?: unknown) => void;
}

const KIND_LABELS: Record<ConflictKind, string> = {
  'lww-update': 'Simultaneous field edit',
  'insert-superseded': 'Duplicate create',
  'delete-rejected': 'Delete vs. recreate',
};

const KIND_DESCRIPTIONS: Record<ConflictKind, string> = {
  'lww-update':
    'You and another collaborator edited the same field at the same time. The server kept their value.',
  'insert-superseded':
    'Another collaborator created an entity with the same id. Their version is now the authoritative one.',
  'delete-rejected':
    'You deleted an entity that another collaborator concurrently re-created. Their creation intent was preserved.',
};

/** Extract a serialisable display value from a CRDT op. */
function opDisplayValue(op: CRDTOperation): string {
  if (op.op === 'delete') {
    return '(deleted)';
  }
  try {
    return JSON.stringify(op.value, null, 2);
  } catch {
    return String(op.value);
  }
}

/** Safe JSON parse for custom merge — falls back to raw string. */
function parseMergedValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) { return ''; }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

export function ConflictResolutionDialog({
  conflicts,
  open,
  onOpenChange,
  onResolve,
}: ConflictResolutionDialogProps): JSX.Element | null {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mergeDraft, setMergeDraft] = useState('');

  // Reset index when the conflict list changes
  useEffect(() => {
    if (activeIndex >= conflicts.length) {
      setActiveIndex(Math.max(0, conflicts.length - 1));
    }
  }, [conflicts.length, activeIndex]);

  const active = conflicts[activeIndex];

  // Seed the merge textarea with the user's own value
  useEffect(() => {
    if (!active) { return; }
    setMergeDraft(opDisplayValue(active.yourOp));
  }, [active]);

  const pathLabel = useMemo(() => {
    if (!active) { return ''; }
    const tail = active.path.join('.') || '(root)';
    return active.key ? `${tail}[${active.key}]` : tail;
  }, [active]);

  if (!active) { return null; }

  const handleAction = (action: 'mine' | 'theirs' | 'merge'): void => {
    if (action === 'merge') {
      onResolve(active.id, 'merge', parseMergedValue(mergeDraft));
    } else {
      onResolve(active.id, action);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl"
        data-testid="conflict-resolution-dialog"
      >
        <DialogHeader>
          <DialogTitle>
            Collaboration conflict — {KIND_LABELS[active.kind]}
          </DialogTitle>
          <DialogDescription>
            {KIND_DESCRIPTIONS[active.kind]}
          </DialogDescription>
        </DialogHeader>

        <div className="text-xs text-muted-foreground">
          <span className="font-mono">{pathLabel}</span>
          {conflicts.length > 1 && (
            <span className="ml-2">
              · Conflict {activeIndex + 1} of {conflicts.length}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <section
            data-testid="conflict-your-version"
            className="border rounded-md p-3 bg-muted/30"
          >
            <h3 className="text-sm font-semibold mb-2">Your version</h3>
            <pre className="text-xs whitespace-pre-wrap break-words font-mono">
              {opDisplayValue(active.yourOp)}
            </pre>
          </section>

          <section
            data-testid="conflict-their-version"
            className="border rounded-md p-3 bg-muted/30"
          >
            <h3 className="text-sm font-semibold mb-2">Their version</h3>
            <pre className="text-xs whitespace-pre-wrap break-words font-mono">
              {opDisplayValue(active.theirOp)}
            </pre>
          </section>
        </div>

        <section className="mt-2">
          <h3 className="text-sm font-semibold mb-2">Merged preview (editable)</h3>
          <Textarea
            data-testid="conflict-merge-draft"
            value={mergeDraft}
            onChange={(e) => { setMergeDraft(e.target.value); }}
            rows={6}
            className="font-mono text-xs"
          />
        </section>

        <DialogFooter className="gap-2">
          {conflicts.length > 1 && (
            <>
              <Button
                variant="ghost"
                disabled={activeIndex === 0}
                onClick={() => { setActiveIndex((i) => Math.max(0, i - 1)); }}
              >
                Prev
              </Button>
              <Button
                variant="ghost"
                disabled={activeIndex >= conflicts.length - 1}
                onClick={() => { setActiveIndex((i) => Math.min(conflicts.length - 1, i + 1)); }}
              >
                Next
              </Button>
            </>
          )}
          <Button
            variant="outline"
            data-testid="conflict-accept-theirs"
            onClick={() => { handleAction('theirs'); }}
          >
            Accept theirs
          </Button>
          <Button
            variant="outline"
            data-testid="conflict-accept-mine"
            onClick={() => { handleAction('mine'); }}
          >
            Accept mine
          </Button>
          <Button
            data-testid="conflict-custom-merge"
            onClick={() => { handleAction('merge'); }}
          >
            Save custom merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConflictResolutionDialog;
