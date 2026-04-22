/**
 * Context-Aware Shortcuts Overlay (BL-0236)
 *
 * Floating overlay that shows keyboard shortcuts relevant to the current view.
 * Semi-transparent dark backdrop, keyboard key badges, grouped by category.
 * Press ? or Escape to dismiss.
 */

import { useEffect, useCallback } from 'react';
import { getShortcutsForView, getCategories, groupByCategory } from '@/lib/shortcuts-panel';
import type { ViewMode } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      data-testid="shortcuts-kbd"
      className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-mono font-semibold bg-muted/80 border border-border rounded min-w-[1.75rem] text-center shadow-sm"
    >
      {children}
    </kbd>
  );
}

function ShortcutRow({ entry }: { entry: { key: string; description: string } }) {
  const keyParts = entry.key.split('+');
  return (
    <div
      data-testid="shortcuts-row"
      className="flex items-center justify-between gap-4 py-1.5"
    >
      <span className="text-sm text-muted-foreground">{entry.description}</span>
      <div className="flex items-center gap-1 shrink-0">
        {keyParts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground text-xs">+</span>}
            <Kbd>{part}</Kbd>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
  activeView: ViewMode;
}

export default function ShortcutsOverlay({ open, onClose, activeView }: ShortcutsOverlayProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, handleKeyDown]);

  if (!open) {
    return null;
  }

  const entries = getShortcutsForView(activeView);
  const categories = getCategories(entries);
  const grouped = groupByCategory(entries);

  return (
    <div
      data-testid="shortcuts-overlay-backdrop"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Keyboard shortcuts"
      aria-modal="true"
    >
      <div
        data-testid="shortcuts-overlay-panel"
        className="bg-card border border-border rounded-lg shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            data-testid="shortcuts-overlay-title"
            className="text-lg font-semibold text-foreground"
          >
            Keyboard Shortcuts
          </h2>
          <span className="text-xs text-muted-foreground">
            Press <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close
          </span>
        </div>

        <div className="space-y-5" data-testid="shortcuts-overlay-groups">
          {categories.map((category, ci) => {
            const group = grouped.get(category);
            if (!group || group.length === 0) {
              return null;
            }
            return (
              <div key={category}>
                {ci > 0 && <div className="border-t border-border mb-4" />}
                <h3
                  data-testid={`shortcuts-group-${category.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-xs font-semibold uppercase tracking-wider text-primary mb-2"
                >
                  {category}
                </h3>
                <div className="space-y-0.5">
                  {group.map((entry) => (
                    <ShortcutRow key={`${entry.category}-${entry.key}`} entry={entry} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
