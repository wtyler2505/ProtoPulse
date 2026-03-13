/**
 * PartFamilySwapPanel — Panel for swapping a selected circuit instance
 * with another component from the same family, preserving all wire connections.
 */

import { useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRightLeft, CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  partFamilyRegistry,
  PART_FAMILIES,
} from '@/lib/circuit-editor/part-family';
import type { ComponentSwapCandidate, SwapResult } from '@/lib/circuit-editor/part-family';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PartFamilySwapPanelProps {
  /** The selected instance info. */
  selectedInstance: {
    id: string;
    componentType: string;
    value?: string;
    pinCount: number;
    referenceDesignator?: string;
  } | null;
  /** Called when the user confirms a swap. */
  onSwap: (result: SwapResult) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PartFamilySwapPanel({
  selectedInstance,
  onSwap,
}: PartFamilySwapPanelProps) {
  // Subscribe to registry changes
  const version = useSyncExternalStore(
    useCallback((cb: () => void) => partFamilyRegistry.subscribe(cb), []),
    useCallback(() => partFamilyRegistry.version, []),
  );

  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);

  // Detect the current component's family
  const detectedFamily = useMemo(() => {
    if (!selectedInstance) {
      return null;
    }
    return partFamilyRegistry.getFamily(selectedInstance.componentType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInstance?.componentType, version]);

  // Use explicitly selected family or auto-detected one
  const activeFamily = selectedFamily ?? detectedFamily;

  // Get swap candidates
  const candidates = useMemo(() => {
    if (!selectedInstance || !activeFamily) {
      return [];
    }
    if (activeFamily === detectedFamily) {
      return partFamilyRegistry.getSwapCandidates({
        type: selectedInstance.componentType,
        value: selectedInstance.value,
      });
    }
    return partFamilyRegistry.getFamilyMembers(activeFamily);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInstance?.componentType, selectedInstance?.value, activeFamily, detectedFamily, version]);

  // Compute swap result for preview
  const swapPreview = useMemo((): SwapResult | null => {
    if (!selectedInstance || !selectedCandidate) {
      return null;
    }
    return partFamilyRegistry.performSwap(
      selectedInstance.id,
      selectedCandidate,
      selectedInstance.componentType,
      selectedInstance.pinCount,
    );
  }, [selectedInstance, selectedCandidate]);

  const handleSwap = useCallback(() => {
    if (swapPreview?.feasible) {
      onSwap(swapPreview);
      setSelectedCandidate(null);
    }
  }, [swapPreview, onSwap]);

  const handleCandidateSelect = useCallback((candidateType: string) => {
    setSelectedCandidate(candidateType);
  }, []);

  const handleFamilyChange = useCallback((family: string) => {
    setSelectedFamily(family === '__auto__' ? null : family);
    setSelectedCandidate(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!selectedInstance) {
    return (
      <Card data-testid="part-family-swap-panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Part Family Swap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="text-xs text-muted-foreground text-center py-6"
            data-testid="part-family-swap-empty"
          >
            <Info className="w-6 h-6 mx-auto mb-2 opacity-40" />
            Select a component instance to see swap options.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="part-family-swap-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4" />
          Part Family Swap
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current component info */}
        <div className="space-y-1" data-testid="part-family-swap-current">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Current Component
          </div>
          <div className="text-xs font-medium">{selectedInstance.componentType}</div>
          {selectedInstance.referenceDesignator && (
            <Badge variant="outline" className="text-[9px] h-4">
              {selectedInstance.referenceDesignator}
            </Badge>
          )}
          {detectedFamily && (
            <Badge variant="secondary" className="text-[9px] h-4 ml-1">
              {detectedFamily}
            </Badge>
          )}
        </div>

        {/* Family selector */}
        <div className="space-y-1" data-testid="part-family-swap-family-selector">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Family
          </div>
          <Select
            value={selectedFamily ?? '__auto__'}
            onValueChange={handleFamilyChange}
          >
            <SelectTrigger
              className="h-8 text-xs"
              data-testid="part-family-swap-family-trigger"
            >
              <SelectValue placeholder="Auto-detect" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__" data-testid="part-family-swap-family-auto">
                Auto-detect{detectedFamily ? ` (${detectedFamily})` : ''}
              </SelectItem>
              {PART_FAMILIES.map((f) => (
                <SelectItem
                  key={f.name}
                  value={f.name}
                  data-testid={`part-family-swap-family-${f.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Candidates list */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Swap Candidates ({candidates.length})
          </div>
          {candidates.length === 0 ? (
            <div
              className="text-xs text-muted-foreground text-center py-4 italic"
              data-testid="part-family-swap-no-candidates"
            >
              {activeFamily
                ? 'No other components in this family.'
                : 'Could not determine component family.'}
            </div>
          ) : (
            <ScrollArea className="max-h-48">
              <div className="space-y-1 pr-2" data-testid="part-family-swap-candidates">
                {candidates.map((candidate) => (
                  <CandidateRow
                    key={candidate.componentType}
                    candidate={candidate}
                    isSelected={selectedCandidate === candidate.componentType}
                    currentPinCount={selectedInstance.pinCount}
                    onSelect={handleCandidateSelect}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Swap preview */}
        {swapPreview && (
          <div
            className="rounded-md border p-3 space-y-2"
            data-testid="part-family-swap-preview"
          >
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Swap Preview
            </div>
            <div className="flex items-center gap-2">
              {swapPreview.feasible ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-destructive shrink-0" />
              )}
              <span className="text-xs">
                {swapPreview.feasible
                  ? 'Drop-in replacement — all connections preserved.'
                  : swapPreview.reason}
              </span>
            </div>
            {swapPreview.feasible && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span>{swapPreview.previousType}</span>
                <ArrowRightLeft className="w-3 h-3" />
                <span className="text-foreground font-medium">{swapPreview.newType}</span>
              </div>
            )}
          </div>
        )}

        {/* Swap button */}
        <Button
          className="w-full"
          size="sm"
          disabled={!swapPreview?.feasible}
          onClick={handleSwap}
          data-testid="part-family-swap-confirm"
        >
          <ArrowRightLeft className="w-4 h-4 mr-2" />
          Swap Component
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CandidateRow sub-component
// ---------------------------------------------------------------------------

interface CandidateRowProps {
  candidate: ComponentSwapCandidate;
  isSelected: boolean;
  currentPinCount: number;
  onSelect: (type: string) => void;
}

function CandidateRow({ candidate, isSelected, currentPinCount, onSelect }: CandidateRowProps) {
  const pinMatch = candidate.pinCount === currentPinCount;

  return (
    <button
      type="button"
      onClick={() => { onSelect(candidate.componentType); }}
      className={cn(
        'w-full text-left px-2 py-1.5 rounded-sm text-xs transition-colors',
        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        isSelected && 'bg-primary/10 border border-primary/30',
      )}
      data-testid={`part-family-swap-candidate-${candidate.componentType.toLowerCase().replace(/[\s/]+/g, '-')}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium truncate">{candidate.title}</span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {candidate.displayValue && (
            <Badge variant="outline" className="text-[8px] h-3.5 px-1">
              {candidate.displayValue}
            </Badge>
          )}
          {!pinMatch && (
            <Badge variant="destructive" className="text-[8px] h-3.5 px-1">
              {candidate.pinCount}pin
            </Badge>
          )}
        </div>
      </div>
      {(candidate.manufacturer || candidate.packageType) && (
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {[candidate.manufacturer, candidate.packageType].filter(Boolean).join(' / ')}
        </div>
      )}
    </button>
  );
}
