/**
 * AdoptCandidateDialog — Confirmation dialog for adopting a generative design
 * candidate into the current project architecture.
 *
 * Shows a comparison summary (added/removed/changed components and nets) and
 * lets the user confirm or cancel the adoption.
 *
 * @module dialogs/AdoptCandidateDialog
 */

import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { CandidateEntry } from '@/lib/generative-design/generative-engine';
import type { CircuitIR } from '@/lib/circuit-dsl/circuit-ir';
import { compareCandidateWithCurrent, adoptCandidate } from '@/lib/generative-design/generative-adopt';
import type { ComparisonResult, AdoptResult } from '@/lib/generative-design/generative-adopt';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AdoptCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: CandidateEntry | null;
  currentIR: CircuitIR | null;
  onAdopt: (result: AdoptResult) => void;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colorClass =
    status === 'added'
      ? 'bg-green-900/50 text-green-400'
      : status === 'removed'
        ? 'bg-red-900/50 text-red-400'
        : status === 'changed'
          ? 'bg-yellow-900/50 text-yellow-400'
          : 'bg-zinc-800 text-zinc-400';

  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${colorClass}`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdoptCandidateDialog({
  open,
  onOpenChange,
  candidate,
  currentIR,
  onAdopt,
}: AdoptCandidateDialogProps) {
  const comparison: ComparisonResult | null = useMemo(() => {
    if (!candidate) {
      return null;
    }
    return compareCandidateWithCurrent(candidate, currentIR);
  }, [candidate, currentIR]);

  const handleAdopt = () => {
    if (!candidate) {
      return;
    }
    const result = adoptCandidate(candidate);
    onAdopt(result);
    onOpenChange(false);
  };

  if (!candidate || !comparison) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="adopt-candidate-dialog"
        className="bg-zinc-900 border-zinc-700 max-w-xl max-h-[80vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="text-cyan-400">Adopt Candidate</DialogTitle>
          <DialogDescription>
            This will add the candidate's components as architecture nodes in your project.
          </DialogDescription>
        </DialogHeader>

        {/* Fitness score */}
        <div data-testid="adopt-fitness-summary" className="flex items-center gap-3 py-2">
          <span className="text-2xl font-bold text-cyan-400">
            {(comparison.candidateFitness.overall * 100).toFixed(1)}%
          </span>
          <span className="text-sm text-zinc-400">fitness score</span>
        </div>

        {/* Summary line */}
        <div data-testid="adopt-comparison-summary" className="text-sm text-zinc-300 pb-2">
          {comparison.summary}
        </div>

        {/* Component diffs */}
        {comparison.componentDiffs.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Components</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {comparison.componentDiffs.map((diff) => (
                <div
                  key={diff.refdes}
                  data-testid={`component-diff-${diff.refdes}`}
                  className="flex items-center gap-2 text-xs py-0.5"
                >
                  <StatusBadge status={diff.status} />
                  <span className="text-zinc-200 font-mono">{diff.refdes}</span>
                  <span className="text-zinc-400">{diff.partId}</span>
                  {diff.details && <span className="text-zinc-400 italic">{diff.details}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Net diffs */}
        {comparison.netDiffs.filter((d) => d.status !== 'unchanged').length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Nets</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {comparison.netDiffs
                .filter((d) => d.status !== 'unchanged')
                .map((diff) => (
                  <div
                    key={diff.name}
                    data-testid={`net-diff-${diff.name}`}
                    className="flex items-center gap-2 text-xs py-0.5"
                  >
                    <StatusBadge status={diff.status} />
                    <span className="text-zinc-200 font-mono">{diff.name}</span>
                    <span className="text-zinc-400">({diff.type})</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Adopt result preview */}
        <div data-testid="adopt-preview" className="text-xs text-zinc-400 pt-1">
          Will create {candidate.ir.components.length} architecture node{candidate.ir.components.length !== 1 ? 's' : ''} and connect
          them via shared nets.
        </div>

        <DialogFooter>
          <button
            data-testid="adopt-cancel-button"
            onClick={() => { onOpenChange(false); }}
            className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            data-testid="adopt-confirm-button"
            onClick={handleAdopt}
            className="rounded bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Adopt into Project
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
