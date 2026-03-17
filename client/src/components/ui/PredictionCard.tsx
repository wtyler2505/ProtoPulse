/**
 * PredictionCard — displays a single AI prediction suggestion with
 * category icon, confidence badge, and accept/dismiss actions.
 */

import { useState } from 'react';
import {
  Package,
  CheckCircle,
  ShieldAlert,
  Zap,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Prediction, PredictionCategory } from '@/lib/ai-prediction-engine';

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

interface CategoryConfig {
  icon: typeof Package;
  label: string;
  color: string;
  bgColor: string;
}

const CATEGORY_CONFIG: Record<PredictionCategory, CategoryConfig> = {
  missing_component: {
    icon: Package,
    label: 'Missing Component',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
  best_practice: {
    icon: CheckCircle,
    label: 'Best Practice',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
  },
  safety: {
    icon: ShieldAlert,
    label: 'Safety',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
  },
  optimization: {
    icon: Zap,
    label: 'Optimization',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
  },
  learning_tip: {
    icon: GraduationCap,
    label: 'Learning Tip',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
};

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.9) { return 'Very High'; }
  if (confidence >= 0.75) { return 'High'; }
  if (confidence >= 0.5) { return 'Medium'; }
  return 'Low';
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) { return 'text-emerald-400'; }
  if (confidence >= 0.75) { return 'text-cyan-400'; }
  if (confidence >= 0.5) { return 'text-amber-400'; }
  return 'text-zinc-400';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PredictionCardProps {
  prediction: Prediction;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PredictionCard({ prediction, onAccept, onDismiss }: PredictionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const config = CATEGORY_CONFIG[prediction.category];
  const Icon = config.icon;

  return (
    <div
      data-testid={`prediction-card-${prediction.id}`}
      className={cn(
        'group relative rounded-lg border border-zinc-700/50 bg-zinc-900/60 p-3',
        'transition-all duration-200 hover:border-zinc-600/70',
        'animate-in slide-in-from-right-4 fade-in duration-300',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        {/* Category icon */}
        <div
          data-testid={`prediction-icon-${prediction.id}`}
          className={cn('mt-0.5 flex-shrink-0 rounded-md p-1', config.bgColor)}
        >
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>

        {/* Title + category label */}
        <div className="min-w-0 flex-1">
          <h4
            data-testid={`prediction-title-${prediction.id}`}
            className="text-sm font-medium leading-tight text-zinc-100"
          >
            {prediction.title}
          </h4>
          <span
            data-testid={`prediction-category-${prediction.id}`}
            className={cn('text-xs', config.color)}
          >
            {config.label}
          </span>
        </div>

        {/* Confidence badge */}
        <span
          data-testid={`prediction-confidence-${prediction.id}`}
          className={cn(
            'flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            'bg-zinc-800 border border-zinc-700/50',
            getConfidenceColor(prediction.confidence),
          )}
        >
          {Math.round(prediction.confidence * 100)}%
        </span>

        {/* Dismiss button */}
        <button
          data-testid={`prediction-dismiss-${prediction.id}`}
          onClick={() => { onDismiss(prediction.id); }}
          className={cn(
            'flex-shrink-0 rounded p-0.5 text-zinc-400 transition-colors',
            'hover:bg-zinc-700/50 hover:text-zinc-300',
          )}
          aria-label="Dismiss suggestion"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Description (truncated unless expanded) */}
      <p
        data-testid={`prediction-description-${prediction.id}`}
        className={cn(
          'mt-1.5 text-xs leading-relaxed text-zinc-400',
          !expanded && 'line-clamp-2',
        )}
      >
        {prediction.description}
      </p>

      {/* Expand/collapse + action row */}
      <div className="mt-2 flex items-center gap-2">
        <button
          data-testid={`prediction-toggle-${prediction.id}`}
          onClick={() => { setExpanded(!expanded); }}
          className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-300"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              More
            </>
          )}
        </button>

        <div className="flex-1" />

        {prediction.action && (
          <button
            data-testid={`prediction-accept-${prediction.id}`}
            onClick={() => { onAccept(prediction.id); }}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              'bg-[#00F0FF]/10 text-[#00F0FF] hover:bg-[#00F0FF]/20',
            )}
          >
            Apply
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && prediction.action && (
        <div
          data-testid={`prediction-details-${prediction.id}`}
          className="mt-2 rounded-md bg-zinc-800/50 p-2 text-xs text-zinc-400"
        >
          <span className="font-medium text-zinc-300">Action: </span>
          {prediction.action.type.replace(/_/g, ' ')}
          {prediction.action.payload && Object.keys(prediction.action.payload).length > 0 && (
            <span className="ml-1 text-zinc-400">
              ({Object.entries(prediction.action.payload)
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(', ')})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
