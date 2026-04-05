import { useEffect, useMemo, useState } from 'react';
import { Boxes, MapPin, PackageCheck, PackagePlus, Search, ShoppingCart, Wand2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BreadboardBenchInsight } from '@/lib/breadboard-bench';
import { cn } from '@/lib/utils';

type InventoryFilter = 'all' | 'untracked' | 'owned' | 'low_stock' | 'missing';

interface InventoryDraft {
  minimumStock: string;
  quantityOnHand: string;
  storageLocation: string;
}

interface BreadboardInventoryDialogProps {
  insights: BreadboardBenchInsight[];
  onOpenAiReconcile: () => void;
  onOpenChange: (open: boolean) => void;
  onOpenStorageView: () => void;
  onTrackPart: (partId: number, values: { minimumStock: number; quantityOnHand: number; storageLocation: string | null }) => void;
  onUpdateTrackedPart: (
    bomItemId: string,
    values: { minimumStock: number; quantityOnHand: number; storageLocation: string | null },
  ) => void;
  open: boolean;
}

function createDraft(insight: BreadboardBenchInsight): InventoryDraft {
  return {
    minimumStock: String(Math.max(insight.requiredQuantity, 1)),
    quantityOnHand: insight.ownedQuantity > 0 ? String(insight.ownedQuantity) : String(Math.max(insight.requiredQuantity, 1)),
    storageLocation: insight.storageLocation ?? '',
  };
}

function sanitizeInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function getVisibleInsights(
  insights: BreadboardBenchInsight[],
  filter: InventoryFilter,
  search: string,
): BreadboardBenchInsight[] {
  const lowerSearch = search.trim().toLowerCase();
  return insights.filter((insight) => {
    if (filter === 'untracked' && insight.isTracked) {
      return false;
    }
    if (filter === 'owned' && !insight.isOwned) {
      return false;
    }
    if (filter === 'low_stock' && !insight.lowStock) {
      return false;
    }
    if (filter === 'missing' && insight.missingQuantity === 0) {
      return false;
    }

    if (!lowerSearch) {
      return true;
    }

    return [
      insight.title,
      insight.family,
      insight.benchCategory,
      insight.manufacturer ?? '',
      insight.mpn ?? '',
      insight.storageLocation ?? '',
    ].some((value) => value.toLowerCase().includes(lowerSearch));
  });
}

function FitBadge({ insight }: { insight: BreadboardBenchInsight }) {
  const className =
    insight.fit === 'native'
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
      : insight.fit === 'requires_jumpers'
        ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
        : 'border-amber-400/30 bg-amber-400/10 text-amber-200';

  const label =
    insight.fit === 'native'
      ? 'Native fit'
      : insight.fit === 'requires_jumpers'
        ? 'Needs jumpers'
        : insight.fit === 'breakout_required'
          ? 'Breakout required'
          : 'Bench-hostile';

  return (
    <Badge variant="outline" className={cn('text-[10px] uppercase tracking-[0.12em]', className)}>
      {label}
    </Badge>
  );
}

function QualityBadge({ insight }: { insight: BreadboardBenchInsight }) {
  const className =
    insight.modelQuality === 'verified'
      ? 'border-violet-400/30 bg-violet-400/10 text-violet-200'
      : insight.modelQuality === 'basic'
        ? 'border-sky-400/30 bg-sky-400/10 text-sky-200'
        : 'border-border/70 bg-background/60 text-muted-foreground';

  const label =
    insight.modelQuality === 'verified'
      ? 'Verified'
      : insight.modelQuality === 'basic'
        ? 'Pin-mapped'
        : insight.modelQuality === 'community'
          ? 'Community'
          : 'Draft';

  return (
    <Badge variant="outline" className={cn('text-[10px] uppercase tracking-[0.12em]', className)}>
      {label}
    </Badge>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function BreadboardInventoryDialog({
  insights,
  onOpenAiReconcile,
  onOpenChange,
  onOpenStorageView,
  onTrackPart,
  onUpdateTrackedPart,
  open,
}: BreadboardInventoryDialogProps) {
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<number, InventoryDraft>>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    setDrafts(
      Object.fromEntries(
        insights.map((insight) => [insight.partId, createDraft(insight)]),
      ),
    );
  }, [insights, open]);

  const visibleInsights = useMemo(
    () => getVisibleInsights(insights, filter, search),
    [filter, insights, search],
  );

  const trackedCount = insights.filter((insight) => insight.isTracked).length;
  const missingCount = insights.filter((insight) => insight.missingQuantity > 0).length;
  const lowStockCount = insights.filter((insight) => insight.lowStock).length;

  const setDraftValue = (partId: number, field: keyof InventoryDraft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [partId]: {
        ...current[partId],
        [field]: value,
      },
    }));
  };

  const commitDraft = (insight: BreadboardBenchInsight, forceReady: boolean) => {
    const draft = drafts[insight.partId] ?? createDraft(insight);
    const minimumStock = Math.max(1, sanitizeInteger(draft.minimumStock, Math.max(insight.requiredQuantity, 1)));
    const rawQuantity = sanitizeInteger(draft.quantityOnHand, insight.ownedQuantity);
    const quantityOnHand = forceReady ? Math.max(rawQuantity, insight.requiredQuantity) : rawQuantity;
    const storageLocation = draft.storageLocation.trim();
    const payload = {
      minimumStock,
      quantityOnHand,
      storageLocation: storageLocation.length > 0 ? storageLocation : null,
    };

    setDrafts((current) => ({
      ...current,
      [insight.partId]: {
        minimumStock: String(payload.minimumStock),
        quantityOnHand: String(payload.quantityOnHand),
        storageLocation,
      },
    }));

    if (insight.bomItemId) {
      onUpdateTrackedPart(insight.bomItemId, payload);
      return;
    }

    onTrackPart(insight.partId, payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl border-border/70 bg-[linear-gradient(180deg,rgba(9,11,16,0.98),rgba(6,8,12,0.98))] p-0 shadow-[0_32px_120px_rgba(0,0,0,0.45)]"
        data-testid="breadboard-inventory-dialog"
      >
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Boxes className="h-5 w-5 text-primary" />
                Bench Stash Manager
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-3xl text-sm leading-relaxed">
                Track what you actually own, set build-ready quantities, and keep Breadboard Lab honest about
                whether this project can be wired right now.
              </DialogDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="button-open-storage-view-from-breadboard"
                onClick={onOpenStorageView}
                className="gap-2"
              >
                <MapPin className="h-3.5 w-3.5" />
                Open storage view
              </Button>
              <Button
                type="button"
                size="sm"
                data-testid="button-breadboard-ai-reconcile-inventory"
                onClick={onOpenAiReconcile}
                className="gap-2"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Gemini ER: reconcile stash
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryChip label="Project parts" value={String(insights.length)} />
            <SummaryChip label="Tracked" value={String(trackedCount)} />
            <SummaryChip label="Owned" value={String(insights.filter((item) => item.isOwned).length)} />
            <SummaryChip label="Missing" value={String(missingCount)} />
            <SummaryChip label="Low stock" value={String(lowStockCount)} />
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                data-testid="breadboard-inventory-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by part, family, MPN, or storage bin..."
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {([
                ['all', 'All'],
                ['untracked', 'Needs tracking'],
                ['owned', 'Owned'],
                ['low_stock', 'Low stock'],
                ['missing', 'Missing'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  data-testid={`breadboard-inventory-filter-${value}`}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors',
                    filter === value
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border/70 bg-background/50 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[min(68vh,820px)]">
          <div className="space-y-3 px-6 py-5">
            {visibleInsights.length === 0 ? (
              <div
                className="rounded-2xl border border-dashed border-border/60 bg-background/40 px-6 py-10 text-center"
                data-testid="breadboard-inventory-empty"
              >
                <p className="text-sm font-medium text-foreground">No bench parts match this filter yet</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Try a different filter, or ask Gemini ER to reconcile the stash against the current breadboard build.
                </p>
              </div>
            ) : (
              visibleInsights.map((insight) => {
                const draft = drafts[insight.partId] ?? createDraft(insight);
                return (
                  <div
                    key={insight.partId}
                    className="rounded-2xl border border-border/60 bg-card/50 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.18)]"
                    data-testid={`breadboard-inventory-row-${insight.partId}`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{insight.title}</h3>
                          <FitBadge insight={insight} />
                          <QualityBadge insight={insight} />
                          {insight.lowStock && (
                            <Badge variant="outline" className="border-yellow-500/30 bg-yellow-500/10 text-yellow-300">
                              Low stock
                            </Badge>
                          )}
                          {!insight.isOwned && (
                            <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 text-amber-200">
                              Need to buy
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {insight.family} in {insight.benchCategory}. Required for this build: {String(insight.requiredQuantity)}.
                          {insight.storageLocation ? ` Last known bin: ${insight.storageLocation}.` : ' No storage bin assigned yet.'}
                        </p>
                        {(insight.manufacturer || insight.mpn) && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {[insight.manufacturer, insight.mpn].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>

                      <div className="grid w-full max-w-xl gap-2 sm:grid-cols-3">
                        <div>
                          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            On hand
                          </p>
                          <Input
                            data-testid={`breadboard-inventory-quantity-${insight.partId}`}
                            inputMode="numeric"
                            value={draft.quantityOnHand}
                            onChange={(event) => setDraftValue(insight.partId, 'quantityOnHand', event.target.value)}
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Build floor
                          </p>
                          <Input
                            data-testid={`breadboard-inventory-minimum-${insight.partId}`}
                            inputMode="numeric"
                            value={draft.minimumStock}
                            onChange={(event) => setDraftValue(insight.partId, 'minimumStock', event.target.value)}
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Storage bin
                          </p>
                          <Input
                            data-testid={`breadboard-inventory-location-${insight.partId}`}
                            value={draft.storageLocation}
                            onChange={(event) => setDraftValue(insight.partId, 'storageLocation', event.target.value)}
                            placeholder="Drawer A1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        data-testid={`button-breadboard-inventory-save-${insight.partId}`}
                        onClick={() => commitDraft(insight, false)}
                        className="gap-2"
                      >
                        {insight.isTracked ? <PackageCheck className="h-3.5 w-3.5" /> : <PackagePlus className="h-3.5 w-3.5" />}
                        {insight.isTracked ? 'Save stash details' : 'Track in stash'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-testid={`button-breadboard-inventory-mark-ready-${insight.partId}`}
                        onClick={() => commitDraft(insight, true)}
                        className="gap-2"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Mark build-ready
                      </Button>
                      <span className="text-[11px] text-muted-foreground">
                        {insight.missingQuantity > 0
                          ? `${String(insight.missingQuantity)} more needed to match this build.`
                          : 'Current stash can already satisfy this build quantity.'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
