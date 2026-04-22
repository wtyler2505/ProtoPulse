/* eslint-disable jsx-a11y/no-noninteractive-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
import { useState, useSyncExternalStore, useCallback, memo } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ReviewResolutionManager,
  RESOLUTION_LABELS,
  RESOLUTION_COLORS,
  ALL_STATUSES,
} from '@/lib/review-resolution';
import type { ResolutionStatus } from '@/lib/review-resolution';

// ---------------------------------------------------------------------------
// Shared manager instance
// ---------------------------------------------------------------------------

const manager = ReviewResolutionManager.getInstance();

// ---------------------------------------------------------------------------
// Hook: useReviewResolution
// ---------------------------------------------------------------------------

function subscribeToManager(listener: () => void): () => void {
  return manager.subscribe(listener);
}

function getManagerSnapshot() {
  return manager.getSnapshot();
}

export function useReviewResolution() {
  const snapshot = useSyncExternalStore(subscribeToManager, getManagerSnapshot);
  return {
    getStatus: useCallback((id: string) => manager.getStatus(id), []),
    getNote: useCallback((id: string) => manager.getNote(id), []),
    setStatus: useCallback((id: string, status: ResolutionStatus) => { manager.setStatus(id, status); }, []),
    setNote: useCallback((id: string, note: string) => { manager.setNote(id, note); }, []),
    getCountByStatus: useCallback(() => manager.getCountByStatus(), []),
    snapshot,
  };
}

// ---------------------------------------------------------------------------
// ReviewResolutionControls — inline per-issue controls
// ---------------------------------------------------------------------------

interface ReviewResolutionControlsProps {
  issueId: string;
}

export const ReviewResolutionControls = memo(function ReviewResolutionControls({
  issueId,
}: ReviewResolutionControlsProps) {
  const { getStatus, getNote, setStatus, setNote } = useReviewResolution();
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState('');

  const currentStatus = getStatus(issueId);
  const currentNote = getNote(issueId);

  const handleStatusChange = useCallback(
    (value: string) => {
      setStatus(issueId, value as ResolutionStatus);
    },
    [issueId, setStatus],
  );

  const handleNoteClick = useCallback(() => {
    setNoteValue(currentNote);
    setIsEditingNote(true);
  }, [currentNote]);

  const handleNoteBlur = useCallback(() => {
    setNote(issueId, noteValue);
    setIsEditingNote(false);
  }, [issueId, noteValue, setNote]);

  const handleNoteKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        setNote(issueId, noteValue);
        setIsEditingNote(false);
      } else if (e.key === 'Escape') {
        setIsEditingNote(false);
      }
    },
    [issueId, noteValue, setNote],
  );

  return (
    <div
      data-testid={`review-resolution-${issueId}`}
      className="flex items-center gap-2 mt-1.5"
      onClick={(e) => { e.stopPropagation(); }}
      onKeyDown={(e) => { e.stopPropagation(); }}
      role="group"
      aria-label={`Resolution controls for issue ${issueId}`}
    >
      <Select value={currentStatus} onValueChange={handleStatusChange}>
        <SelectTrigger
          data-testid={`resolution-status-${issueId}`}
          className="h-6 w-[110px] text-[11px] px-2 py-0 border-border/50 bg-background/50"
          aria-label="Resolution status"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALL_STATUSES.map((status) => (
            <SelectItem key={status} value={status} data-testid={`resolution-option-${status}`}>
              <span className={cn('text-xs', RESOLUTION_COLORS[status])}>
                {RESOLUTION_LABELS[status]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isEditingNote ? (
        <Input
          data-testid={`resolution-note-input-${issueId}`}
          value={noteValue}
          onChange={(e) => { setNoteValue(e.target.value); }}
          onBlur={handleNoteBlur}
          onKeyDown={handleNoteKeyDown}
          placeholder="Add a note..."
          className="h-6 text-[11px] flex-1 max-w-[200px] px-2 py-0 border-border/50 bg-background/50"
          autoFocus
          aria-label="Resolution note"
        />
      ) : (
        <button
          data-testid={`resolution-note-btn-${issueId}`}
          onClick={handleNoteClick}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors truncate max-w-[200px]"
          aria-label={currentNote ? 'Edit resolution note' : 'Add resolution note'}
        >
          {currentNote || '+ Add note'}
        </button>
      )}

      {currentStatus !== 'open' && (
        <Badge
          data-testid={`resolution-badge-${issueId}`}
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0 h-5', RESOLUTION_COLORS[currentStatus])}
        >
          {RESOLUTION_LABELS[currentStatus]}
        </Badge>
      )}
    </div>
  );
});
