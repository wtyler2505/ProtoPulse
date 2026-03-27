/**
 * PredictionPanel — container for AI prediction suggestion cards.
 *
 * Collapsible panel with a header badge showing count, a "Clear All" action,
 * and a friendly empty state.
 */

import { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, Trash2, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import PredictionCard from '@/components/ui/PredictionCard';
import type { Prediction } from '@/lib/ai-prediction-engine';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PredictionPanelProps {
  predictions: Prediction[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  isAnalyzing?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PredictionPanel({
  predictions,
  onAccept,
  onDismiss,
  onClearAll,
  isAnalyzing = false,
}: PredictionPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const count = predictions.length;

  if (!isAnalyzing && count === 0) {
    return null;
  }

  return (
    <div
      data-testid="prediction-panel"
      className="rounded-lg border border-zinc-700/50 bg-zinc-900/40"
    >
      {/* Header */}
      <div
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2',
          !collapsed && 'border-b border-zinc-700/30',
        )}
      >
        <button
          data-testid="prediction-panel-toggle"
          onClick={() => { setCollapsed(!collapsed); }}
          className={cn(
            'flex flex-1 items-center gap-2 text-left',
            'transition-colors hover:opacity-80',
          )}
        >
          <Brain className="h-4 w-4 text-[#00F0FF]" />
          <span className="text-sm font-medium text-zinc-200">Design Suggestions</span>

          {count > 0 && (
            <span
              data-testid="prediction-panel-count"
              className="rounded-full bg-[#00F0FF]/15 px-1.5 py-0.5 text-xs font-medium text-[#00F0FF]"
            >
              {count}
            </span>
          )}

          {isAnalyzing && (
            <Loader2
              data-testid="prediction-panel-loading"
              className="h-3.5 w-3.5 animate-spin text-zinc-400"
            />
          )}

          <div className="flex-1" />

          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          )}
        </button>

        {count > 0 && !collapsed && (
          <button
            data-testid="prediction-panel-clear-all"
            onClick={onClearAll}
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700/50 hover:text-zinc-300"
            aria-label="Clear all suggestions"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div data-testid="prediction-panel-body" className="p-2">
          {count === 0 ? (
            <p
              data-testid="prediction-panel-analyzing"
              className="py-4 text-center text-xs text-zinc-400"
            >
              Analyzing your design for next-step suggestions...
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {predictions.map((pred) => (
                <PredictionCard
                  key={pred.id}
                  prediction={pred}
                  onAccept={onAccept}
                  onDismiss={onDismiss}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
