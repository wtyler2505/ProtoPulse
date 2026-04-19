/**
 * BaudRateSelector — Dropdown + quick-pick + auto-detect + mismatch warning
 * for serial monitor baud rate selection.
 *
 * Uses BaudRateManager singleton with useSyncExternalStore for reactive state.
 */

import { useState, useCallback, useSyncExternalStore } from 'react';
import { getBaudRateManager, STANDARD_BAUD_RATES } from '@/lib/serial/baud-rate-manager';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  BookOpen,
  Loader2,
  Search,
  Zap,
} from 'lucide-react';
import { VaultHoverCard } from '@/components/ui/vault-hover-card';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BaudRateSelectorProps {
  /** Called when the user selects or changes the baud rate. */
  onRateChange?: (rate: number) => void;
  /** Optional sample bytes for auto-detect (pass latest received data). */
  sampleBytes?: Uint8Array;
  /** Additional className for the root container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BaudRateSelector({
  onRateChange,
  sampleBytes,
  className,
}: BaudRateSelectorProps) {
  const manager = getBaudRateManager();

  const state = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
  );

  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleRateSelect = useCallback(
    (value: string) => {
      if (value === '__custom__') {
        setShowCustomInput(true);
        return;
      }
      const rate = Number(value);
      if (Number.isFinite(rate) && rate > 0) {
        manager.setRate(rate);
        onRateChange?.(rate);
        setShowCustomInput(false);
      }
    },
    [manager, onRateChange],
  );

  const handleQuickPick = useCallback(
    (rate: number) => {
      manager.setRate(rate);
      onRateChange?.(rate);
      setShowCustomInput(false);
    },
    [manager, onRateChange],
  );

  const handleCustomSubmit = useCallback(() => {
    const rate = Number(customValue);
    if (Number.isFinite(rate) && rate > 0) {
      manager.setRate(rate);
      onRateChange?.(rate);
      setShowCustomInput(false);
      setCustomValue('');
    }
  }, [customValue, manager, onRateChange]);

  const handleCustomKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCustomSubmit();
      }
      if (e.key === 'Escape') {
        setShowCustomInput(false);
        setCustomValue('');
      }
    },
    [handleCustomSubmit],
  );

  const handleAutoDetect = useCallback(() => {
    if (!sampleBytes || sampleBytes.length === 0) {
      return;
    }
    const result = manager.autoDetect(sampleBytes);
    if (result.confidence >= 0.4) {
      manager.setRate(result.rate);
      onRateChange?.(result.rate);
    }
  }, [manager, sampleBytes, onRateChange]);

  const handleTryAutoDetect = useCallback(() => {
    if (sampleBytes && sampleBytes.length > 0) {
      handleAutoDetect();
    }
  }, [handleAutoDetect, sampleBytes]);

  // -----------------------------------------------------------------------
  // Quick-pick rates (top 3)
  // -----------------------------------------------------------------------

  const quickRates = manager.getCommonRates().slice(0, 3);

  // Confidence label
  const confidenceLabel = state.confidence >= 0.7
    ? 'High'
    : state.confidence >= 0.4
      ? 'Medium'
      : 'Low';

  const confidenceVariant = state.confidence >= 0.7
    ? 'default'
    : state.confidence >= 0.4
      ? 'secondary'
      : 'destructive';

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div
      data-testid="baud-rate-selector"
      className={cn('flex flex-col gap-2', className)}
    >
      {/* Main row: select + quick-picks + auto-detect */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Baud rate dropdown */}
        <Select
          value={String(state.selectedRate)}
          onValueChange={handleRateSelect}
        >
          <SelectTrigger
            data-testid="baud-rate-select"
            className="h-7 w-[120px] text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STANDARD_BAUD_RATES.map((rate) => (
              <SelectItem key={rate} value={String(rate)}>
                {rate.toLocaleString()} baud
              </SelectItem>
            ))}
            <SelectItem value="__custom__">
              Custom...
            </SelectItem>
          </SelectContent>
        </Select>

        <VaultHoverCard topic="serial-baud-rates-standard-values-and-arduino-default-115200">
          <span
            data-testid="baud-rate-vault-info"
            aria-label="About serial baud rates"
            className="inline-flex items-center cursor-help opacity-60 hover:opacity-100 transition-opacity"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </span>
        </VaultHoverCard>

        {/* Quick-pick buttons */}
        {quickRates.map((rate) => (
          <Button
            key={rate}
            data-testid={`baud-rate-quick-${String(rate)}`}
            variant={state.selectedRate === rate ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'h-6 text-[10px] px-2',
              state.selectedRate === rate && 'bg-[var(--color-editor-accent)]/15 text-[var(--color-editor-accent)] border-[var(--color-editor-accent)]/30',
            )}
            onClick={() => handleQuickPick(rate)}
          >
            {manager.formatRate(rate)}
          </Button>
        ))}

        {/* Auto-detect button */}
        <Button
          data-testid="baud-rate-auto-detect"
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] px-2 gap-1"
          onClick={handleAutoDetect}
          disabled={state.isAutoDetecting || !sampleBytes || sampleBytes.length === 0}
        >
          {state.isAutoDetecting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Search className="w-3 h-3" />
          )}
          Auto-detect
        </Button>

        {/* Detected rate + confidence badge */}
        {state.detectedRate !== null && state.confidence > 0 && (
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-[var(--color-editor-accent)]" />
            <span className="text-[10px] text-muted-foreground">
              {manager.formatRate(state.detectedRate)}
            </span>
            <Badge
              data-testid="baud-rate-confidence"
              variant={confidenceVariant}
              className="h-4 text-[9px] px-1.5"
            >
              {confidenceLabel}
            </Badge>
          </div>
        )}
      </div>

      {/* Custom rate input */}
      {showCustomInput && (
        <div className="flex items-center gap-2">
          <Input
            data-testid="baud-rate-custom-input"
            type="number"
            min={1}
            step={1}
            placeholder="Custom baud rate..."
            aria-label="Custom baud rate"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={handleCustomKeyDown}
            className="h-7 w-[140px] text-xs"
            autoFocus
          />
          <Button
            data-testid="baud-rate-custom-apply"
            variant="default"
            size="sm"
            className="h-7 text-xs"
            onClick={handleCustomSubmit}
            disabled={!customValue || Number(customValue) <= 0}
          >
            Apply
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setShowCustomInput(false);
              setCustomValue('');
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Last-used rate suggestion */}
      {state.lastUsedRate !== state.selectedRate && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>Last used:</span>
          <button
            data-testid="baud-rate-last-used"
            type="button"
            className="text-[var(--color-editor-accent)] hover:underline cursor-pointer"
            onClick={() => handleQuickPick(state.lastUsedRate)}
          >
            {manager.formatRate(state.lastUsedRate)}
          </button>
        </div>
      )}

      {/* Mismatch warning banner */}
      {state.mismatchWarning && (
        <div
          data-testid="baud-rate-mismatch-warning"
          className="flex items-center gap-2 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1.5"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
          <span className="text-yellow-200">
            Data looks garbled — wrong baud rate?
          </span>
          <button
            data-testid="baud-rate-try-auto-detect"
            type="button"
            className="text-[var(--color-editor-accent)] hover:underline cursor-pointer ml-1"
            onClick={handleTryAutoDetect}
          >
            Try auto-detect
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground ml-auto cursor-pointer"
            onClick={() => manager.dismissMismatchWarning()}
            aria-label="Dismiss warning"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
