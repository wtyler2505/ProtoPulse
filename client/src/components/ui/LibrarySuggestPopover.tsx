import { useCallback, useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { suggestFromLibrary } from '@/lib/library-auto-suggest';
import type { LibrarySuggestion } from '@/lib/library-auto-suggest';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LibrarySuggestPopoverProps {
  /** The label of the newly created node. */
  nodeLabel: string;
  /** The type of the newly created node. */
  nodeType: string;
  /** Screen position for the popover anchor (px). */
  anchorPosition: { x: number; y: number } | null;
  /** Callback when the user clicks "Add to BOM" on a suggestion. */
  onAddToBom: (suggestion: LibrarySuggestion) => void;
  /** Callback when the popover is dismissed. */
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LibrarySuggestPopover({
  nodeLabel,
  nodeType,
  anchorPosition,
  onAddToBom,
  onDismiss,
}: LibrarySuggestPopoverProps) {
  const [suggestions, setSuggestions] = useState<LibrarySuggestion[]>([]);

  useEffect(() => {
    if (!anchorPosition || !nodeLabel) {
      setSuggestions([]);
      return;
    }
    const results = suggestFromLibrary(nodeLabel, nodeType);
    setSuggestions(results);
  }, [nodeLabel, nodeType, anchorPosition]);

  const handleAdd = useCallback(
    (suggestion: LibrarySuggestion) => {
      onAddToBom(suggestion);
      onDismiss();
    },
    [onAddToBom, onDismiss],
  );

  // Nothing to show
  if (!anchorPosition || suggestions.length === 0) {
    return null;
  }

  return (
    <Popover open onOpenChange={(open) => { if (!open) { onDismiss(); } }}>
      <PopoverAnchor
        style={{
          position: 'absolute',
          left: anchorPosition.x,
          top: anchorPosition.y,
          width: 1,
          height: 1,
          pointerEvents: 'none',
        }}
      />
      <PopoverContent
        side="right"
        sideOffset={12}
        align="start"
        className="w-72 p-0 bg-card/95 backdrop-blur-xl border-border shadow-xl"
        data-testid="library-suggest-popover"
        onOpenAutoFocus={(e) => { e.preventDefault(); }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground">Matching library parts</span>
          <button
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="library-suggest-dismiss"
            aria-label="Dismiss suggestions"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <ul className="divide-y divide-border" data-testid="library-suggest-list">
          {suggestions.map((suggestion, idx) => {
            const part = suggestion.libraryPart;
            const scorePercent = Math.round(suggestion.matchScore * 100);
            return (
              <li
                key={`${part.title}-${idx}`}
                className="px-3 py-2 hover:bg-muted/50 transition-colors"
                data-testid={`library-suggest-item-${idx}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{part.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{part.description}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{part.category}</Badge>
                      <span className={cn(
                        'text-[10px]',
                        scorePercent >= 80 ? 'text-green-400' : scorePercent >= 50 ? 'text-yellow-400' : 'text-muted-foreground',
                      )}>
                        {scorePercent}% match
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs shrink-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10"
                    onClick={() => { handleAdd(suggestion); }}
                    data-testid={`library-suggest-add-${idx}`}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    BOM
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
