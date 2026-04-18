import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ArrowRightLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlternateParts, AlternatePartsEngine } from '@/lib/alternate-parts';
import type { AlternatePart, PartReference } from '@/lib/alternate-parts';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';
import type { PartMeta, Connector } from '@shared/component-types';

interface ComponentReplacementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: CircuitInstanceRow;
  originalPart: ComponentPart | null;
  onReplace: (newPartId: number) => void;
}

/**
 * Extended meta shape carried in ComponentPart.meta jsonb for replacement lookups.
 * Mirrors PartMeta but also accepts legacy keys (partNumber, category, footprint,
 * parameters) that older parts wrote under the same jsonb column.
 */
type ReplacementPartMeta = Partial<PartMeta> & {
  partNumber?: string;
  category?: string;
  parameters?: Record<string, unknown>;
  footprint?: string;
  package?: string;
};

export default function ComponentReplacementDialog({
  open,
  onOpenChange,
  instance,
  originalPart,
  onReplace,
}: ComponentReplacementDialogProps) {
  const { findAlternates, parts } = useAlternateParts();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<AlternatePart[]>([]);
  const [selectedAlt, setSelectedAlt] = useState<AlternatePart | null>(null);

  // Convert DB part to AlternateParts engine format for comparison
  const originalPartRef: PartReference | null = useMemo(() => {
    if (!originalPart) return null;
    const meta = (originalPart.meta ?? {}) as ReplacementPartMeta;
    const connectors = (Array.isArray(originalPart.connectors) ? originalPart.connectors : []) as Connector[];
    return {
      id: String(originalPart.id),
      partNumber: String(meta.mpn || meta.partNumber || originalPart.id),
      manufacturer: String(meta.manufacturer || 'Unknown'),
      description: String(meta.description || ''),
      category: String(meta.category || 'generic'),
      parameters: (meta.parameters ?? {}) as Record<string, string | number>,
      package: String(meta.footprint || meta.package || 'Unknown'),
      pinCount: connectors.length,
      pinout: connectors.map(c => c.name),
      status: 'active',
    };
  }, [originalPart]);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    // Simulate API/search delay
    setTimeout(() => {
      const searchResult = findAlternates(searchQuery.trim());
      setResults(searchResult.alternates);
      setIsSearching(false);
    }, 400);
  }, [searchQuery, findAlternates]);

  const handleSelect = (alt: AlternatePart) => {
    setSelectedAlt(alt);
  };

  const confirmReplacement = () => {
    if (selectedAlt) {
      onReplace(Number(selectedAlt.part.id));
      onOpenChange(false);
    }
  };

  // Live pin compatibility check
  const compatibility = useMemo(() => {
    if (!originalPartRef || !selectedAlt) return null;
    // NOTE: previously read from `window.AlternatePartsEngine` which is never
    // set anywhere in the codebase — that branch always returned null. Import
    // the class directly so the compatibility preview actually renders.
    const engine = AlternatePartsEngine.getInstance();
    return engine.checkPinCompatibility(originalPartRef, selectedAlt.part);
  }, [originalPartRef, selectedAlt]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Replace Component: {instance.referenceDesignator}
          </DialogTitle>
          <DialogDescription>
            Search for a compatible replacement part. Live pin-compatibility checks are performed against your current design.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 my-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by part number, manufacturer, or specs..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
          {/* Candidates List */}
          <div className="flex flex-col border rounded-md overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b">
              Search Results
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {results.map((alt, i) => (
                  <div
                    key={i}
                    onClick={() => handleSelect(alt)}
                    className={cn(
                      "p-2 rounded border cursor-pointer transition-colors hover:bg-muted/50",
                      selectedAlt?.part.id === alt.part.id ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-mono font-bold text-foreground truncate">{alt.part.partNumber}</span>
                      <Badge variant="outline" className="text-[9px] h-4 scale-90 origin-right px-1">
                        {alt.equivalenceLevel}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{alt.part.manufacturer}</div>
                  </div>
                ))}
                {results.length === 0 && !isSearching && (
                  <div className="text-center py-8 text-muted-foreground text-xs italic">
                    {searchQuery ? 'No matches found' : 'Enter a part number to begin'}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Compatibility Preview */}
          <div className="flex flex-col border rounded-md overflow-hidden bg-muted/10">
            <div className="bg-muted/50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b">
              Compatibility Preview
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              {!selectedAlt ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                  <Info className="w-8 h-8 mb-2" />
                  <p className="text-xs">Select a part to see pin-compatibility details</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                      {compatibility?.level === 'exact' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : compatibility?.level === 'partial' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-destructive" />
                      )}
                      {compatibility?.level === 'exact' ? 'Pin-for-Pin Compatible' :
                       compatibility?.level === 'partial' ? 'Partially Compatible' : 'Incompatible Pinout'}
                    </h4>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {compatibility?.level === 'exact'
                        ? "This part is a drop-in replacement. All pins match and functions are identical."
                        : compatibility?.level === 'partial'
                        ? "Most pins match, but some connections may require manual verification."
                        : "Warning: This part has a different pinout and cannot be directly swapped."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Matched Pins:</span>
                      <span className="font-mono text-emerald-500 font-bold">{compatibility?.matches.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Missing Pins:</span>
                      <span className={cn("font-mono font-bold", compatibility?.missing.length ? "text-destructive" : "text-muted-foreground")}>
                        {compatibility?.missing.length || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Extra Pins:</span>
                      <span className="font-mono text-amber-500 font-bold">{compatibility?.extra.length || 0}</span>
                    </div>
                  </div>

                  {compatibility?.missing.length ? (
                    <div className="pt-2">
                      <div className="text-[9px] uppercase font-bold text-destructive/80 mb-1.5 tracking-tight">Missing from Replacement</div>
                      <div className="flex flex-wrap gap-1">
                        {compatibility.missing.map((p: string) => (
                          <Badge key={p} variant="outline" className="text-[8px] bg-destructive/5 text-destructive border-destructive/20 px-1 py-0 h-3.5">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={confirmReplacement} disabled={!selectedAlt || compatibility?.level === 'incompatible'}>
            Replace Component
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
