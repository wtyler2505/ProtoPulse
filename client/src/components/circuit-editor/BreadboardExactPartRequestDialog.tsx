import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Cpu, DraftingCompass, Layers3, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { resolveExactPartRequest } from '@shared/exact-part-resolver';
import type { ExactPartDraftSeed } from '@shared/exact-part-resolver';
import type { ComponentPart } from '@shared/schema';

interface BreadboardExactPartRequestDialogProps {
  activeCircuitReady: boolean;
  onCreateExactDraft: (seed: ExactPartDraftSeed) => void;
  onOpenChange: (open: boolean) => void;
  onOpenComponentEditor: () => void;
  onPlaceResolvedPart: (part: ComponentPart) => void;
  open: boolean;
  parts: ComponentPart[];
}

const EXAMPLE_REQUESTS = [
  'Arduino Mega 2560 R3',
  'RioRand motor controller',
  'Arduino Uno R3',
];

function applyReferenceUrlToDraftSeed(seed: ExactPartDraftSeed, referenceUrl: string): ExactPartDraftSeed {
  const trimmedUrl = referenceUrl.trim();
  if (trimmedUrl.length === 0) {
    return seed;
  }

  try {
    const host = new URL(trimmedUrl).hostname.toLowerCase();
    if (host.includes('amazon.') || host.includes('ebay.') || host.includes('aliexpress.') || host.includes('etsy.') || host.includes('walmart.') || host.includes('newegg.')) {
      return { ...seed, marketplaceSourceUrl: trimmedUrl };
    }
    if (host.includes('fritzing') || host.includes('github.') || host.includes('gitlab.') || host.includes('snapeda.') || host.includes('ultralibrarian.') || host.includes('hackaday.') || host.includes('instructables.')) {
      return { ...seed, communitySourceUrl: trimmedUrl };
    }
  } catch {
    return seed;
  }

  return { ...seed, officialSourceUrl: trimmedUrl };
}

function statusLabel(kind: ReturnType<typeof resolveExactPartRequest>['kind']): string {
  switch (kind) {
    case 'verified-match':
      return 'Verified match';
    case 'candidate-match':
      return 'Candidate match';
    case 'ambiguous-match':
      return 'Needs choice';
    case 'needs-draft':
      return 'Needs draft';
    case 'empty':
    default:
      return 'Awaiting request';
  }
}

function matchButtonLabel(activeCircuitReady: boolean): string {
  return activeCircuitReady ? 'Place on bench' : 'Create canvas + place';
}

export default function BreadboardExactPartRequestDialog({
  activeCircuitReady,
  onCreateExactDraft,
  onOpenChange,
  onOpenComponentEditor,
  onPlaceResolvedPart,
  open,
  parts,
}: BreadboardExactPartRequestDialogProps) {
  const [query, setQuery] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      setReferenceUrl('');
    }
  }, [open]);

  const resolution = useMemo(
    () => resolveExactPartRequest(query, parts),
    [parts, query],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl border-border/70 bg-[linear-gradient(180deg,rgba(9,11,16,0.98),rgba(6,8,12,0.98))] p-0 shadow-[0_32px_120px_rgba(0,0,0,0.45)]"
        data-testid="breadboard-exact-part-dialog"
      >
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Layers3 className="h-5 w-5 text-primary" />
                Exact Part Resolver
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-2xl text-sm leading-relaxed">
                Tell ProtoPulse the exact board or module you want on the bench. Verified parts can be placed right away.
                Missing parts drop straight into the exact-draft workflow instead of forcing you back out of Breadboard Lab.
              </DialogDescription>
            </div>
            <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/90">
              {statusLabel(resolution.kind)}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <label
              htmlFor="breadboard-exact-part-request"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85"
            >
              Exact bench request
            </label>
            <Input
              id="breadboard-exact-part-request"
              data-testid="input-breadboard-exact-part-request"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Arduino Mega 2560 R3"
              className="border-border bg-background/70"
            />
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_REQUESTS.map((example) => (
                <Button
                  key={example}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setQuery(example)}
                  data-testid={`button-breadboard-exact-example-${example.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  className="h-7 rounded-full px-3 text-[10px] uppercase tracking-[0.14em]"
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="breadboard-exact-part-reference-url"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70"
            >
              Reference URL
            </label>
            <Input
              id="breadboard-exact-part-reference-url"
              data-testid="input-breadboard-exact-part-reference-url"
              value={referenceUrl}
              onChange={(event) => setReferenceUrl(event.target.value)}
              placeholder="Paste a datasheet, product page, or marketplace listing"
              className="border-border bg-background/70"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              ProtoPulse will carry this into the exact draft as official, community, or marketplace evidence depending
              on the link.
            </p>
          </div>

          <div
            className="rounded-2xl border border-primary/15 bg-background/40 p-4"
            data-testid="breadboard-exact-part-resolution-message"
          >
            <p className="text-sm leading-relaxed text-foreground">{resolution.message}</p>
            {resolution.kind === 'candidate-match' && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Candidate exact parts can still be placed visually on the breadboard, but exact hookup guidance should
                stay provisional until the verification workbench is complete.
              </p>
            )}
          </div>

          {resolution.kind === 'empty' ? (
            <div className="rounded-2xl border border-border/60 bg-card/50 p-4 text-sm leading-relaxed text-muted-foreground">
              Start with the real thing you want to wire, not a generic family. The exact-part lane is meant for
              boards and modules that should visually look like the real hardware on the bench.
            </div>
          ) : null}

          {resolution.matches.length > 0 ? (
            <div className="space-y-3">
              {resolution.matches.map((match) => (
                <div
                  key={match.part.id}
                  className="rounded-2xl border border-border/60 bg-card/55 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]"
                  data-testid={`breadboard-exact-part-match-${match.part.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{match.title}</p>
                        <span
                          className={
                            match.status === 'verified'
                              ? 'rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200'
                              : 'rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100'
                          }
                        >
                          {match.status === 'verified' ? 'Verified exact' : 'Candidate exact'}
                        </span>
                        <span className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {match.family}
                        </span>
                        <span className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {match.level.replace('-', ' ')}
                        </span>
                      </div>

                      {(match.manufacturer || match.mpn) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[match.manufacturer, match.mpn].filter(Boolean).join(' · ')}
                        </p>
                      )}

                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {match.matchReasons.join(' • ')}
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onPlaceResolvedPart(match.part)}
                      data-testid={`button-breadboard-exact-place-${match.part.id}`}
                      className="gap-2"
                    >
                      <Cpu className="h-3.5 w-3.5" />
                      {matchButtonLabel(activeCircuitReady)}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {resolution.kind !== 'empty' && (
            <div
              className="rounded-2xl border border-cyan-400/20 bg-cyan-400/8 p-4"
              data-testid="breadboard-exact-part-playbook"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-background/40 text-cyan-200">
                  {resolution.playbook ? <BadgeCheck className="h-4 w-4" /> : <DraftingCompass className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {resolution.playbook ? `${resolution.playbook.title} playbook` : 'Exact draft handoff'}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {resolution.recommendedDraftDescription}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {resolution.evidenceChecklist.map((item, index) => (
                      <p key={`${item}-${index}`} className="text-xs leading-relaxed text-cyan-50/85">
                        {index + 1}. {item}
                      </p>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onCreateExactDraft(applyReferenceUrlToDraftSeed(resolution.draftSeed, referenceUrl))}
                      data-testid="button-breadboard-exact-create-draft"
                      className="gap-2"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Create exact draft
                    </Button>
                    {resolution.draftSeed.officialSourceUrl || resolution.draftSeed.communitySourceUrl || resolution.draftSeed.marketplaceSourceUrl ? (
                      <span className="rounded-full border border-cyan-400/20 bg-background/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-100/85">
                        Source seed attached
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={onOpenComponentEditor}
                      data-testid="button-breadboard-exact-open-component-editor"
                      className="gap-2"
                    >
                      <Layers3 className="h-3.5 w-3.5" />
                      Open component editor
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-close-breadboard-exact-dialog">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
