import { useCallback } from 'react';
import { Play, Square, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { SimulationTypeResult, AnalysisType } from '@/lib/simulation/auto-detect';

/** Labels for the simulation type badge. */
const SIM_TYPE_LABELS: Record<SimulationTypeResult['type'], string> = {
  dc: 'DC',
  ac: 'AC',
  transient: 'Transient',
  mixed: 'Mixed',
};

/** Maps SimulationType to the corresponding AnalysisType for the simulation engine. */
const SIM_TYPE_TO_ANALYSIS: Record<SimulationTypeResult['type'], AnalysisType> = {
  dc: 'dcop',
  ac: 'ac',
  transient: 'transient',
  mixed: 'dcop',
};

/** All analysis types available in the dropdown. */
const ANALYSIS_OPTIONS: Array<{ id: AnalysisType; label: string }> = [
  { id: 'dcop', label: 'DC Operating Point' },
  { id: 'ac', label: 'AC Analysis' },
  { id: 'transient', label: 'Transient Analysis' },
  { id: 'dcsweep', label: 'DC Sweep' },
];

/** Confidence threshold below which the dropdown is shown instead of auto-start. */
const CONFIDENCE_THRESHOLD = 0.7;

export interface SimPlayButtonProps {
  /** Whether a simulation is currently running. */
  isRunning: boolean;
  /** Whether the simulation is in the process of stopping. */
  isStopping: boolean;
  /** Whether the control should be disabled. */
  disabled?: boolean;
  /** Detected simulation type result (from detectSimulationType). */
  detection: SimulationTypeResult | null;
  /** Called to start a simulation with a specific analysis type. */
  onStart: (analysisType: AnalysisType) => void;
  /** Called to stop the current simulation. */
  onStop: () => void;
}

export default function SimPlayButton({
  isRunning,
  isStopping,
  disabled = false,
  detection,
  onStart,
  onStop,
}: SimPlayButtonProps) {
  const isHighConfidence = detection !== null && detection.confidence >= CONFIDENCE_THRESHOLD && detection.type !== 'mixed';

  const handlePlayClick = useCallback(() => {
    if (isRunning) {
      onStop();
      return;
    }

    if (isHighConfidence && detection) {
      onStart(SIM_TYPE_TO_ANALYSIS[detection.type]);
    }
    // Low confidence / mixed: dropdown handles the selection via onStart
  }, [isRunning, isHighConfidence, detection, onStart, onStop]);

  // Stop button state
  if (isRunning) {
    return (
      <Button
        data-testid="sim-stop-button"
        onClick={handlePlayClick}
        disabled={isStopping}
        className={cn(
          'h-11 px-6 gap-2 text-sm font-semibold transition-all',
          isStopping
            ? 'bg-muted text-muted-foreground cursor-wait'
            : 'bg-red-600 text-white hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] border-red-700',
        )}
      >
        {isStopping ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Stopping...
          </>
        ) : (
          <>
            <Square className="w-4 h-4 fill-current" />
            Stop
          </>
        )}
      </Button>
    );
  }

  // High confidence: single play button with type badge
  if (isHighConfidence && detection) {
    return (
      <div className="flex items-center gap-2">
        <Button
          data-testid="sim-play-button"
          onClick={handlePlayClick}
          disabled={disabled}
          className={cn(
            'h-11 px-6 gap-2 text-sm font-semibold transition-all',
            'bg-emerald-600 text-white hover:bg-emerald-500',
            'shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.45)]',
            'border-emerald-700',
          )}
        >
          <Play className="w-4 h-4 fill-current" />
          Start Simulation
        </Button>
        <Badge
          data-testid="sim-type-badge"
          variant="outline"
          className="text-[10px] px-2 py-0.5 border-primary/40 text-primary cursor-default"
          title={detection.reason}
        >
          {SIM_TYPE_LABELS[detection.type]}
        </Badge>
      </div>
    );
  }

  // Low confidence / mixed / no detection: dropdown with type options
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            data-testid="sim-play-button"
            disabled={disabled}
            className={cn(
              'h-11 px-6 gap-2 text-sm font-semibold transition-all',
              'bg-emerald-600 text-white hover:bg-emerald-500',
              'shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.45)]',
              'border-emerald-700',
            )}
          >
            <Play className="w-4 h-4 fill-current" />
            Start Simulation
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px]">
          <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Choose Analysis Type
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ANALYSIS_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.id}
              data-testid={`sim-play-option-${opt.id}`}
              onClick={() => onStart(opt.id)}
              className="cursor-pointer"
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {detection && (
        <Badge
          data-testid="sim-type-badge"
          variant="outline"
          className="text-[10px] px-2 py-0.5 border-amber-500/40 text-amber-400 cursor-default"
          title={detection.reason}
        >
          {SIM_TYPE_LABELS[detection.type]}
        </Badge>
      )}
    </div>
  );
}
