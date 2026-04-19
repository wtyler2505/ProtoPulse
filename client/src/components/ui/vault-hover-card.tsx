/**
 * VaultHoverCard — the canonical way to show vault content on hover.
 *
 * Wraps Radix HoverCard + `useVaultQuickFetch`. Renders states:
 *  - loading:  animated spinner + slug placeholder
 *  - success:  title, topic badges, 140-char summary, "Read more" affordance
 *  - 404:      "No vault note yet" + "Suggest one" CTA (routes through /vault-inbox)
 *  - error:    inline diagnostic (not for production eyes but useful in dev)
 *
 * Per the 16-design-system Phase 8 spec, every per-tab plan that cites a vault
 * slug for hover pedagogy MUST consume this primitive. Direct `useVaultNote`
 * usage outside this file (and `vault-explainer.tsx` + `useVaultQuickFetch.ts`)
 * is enforced by `scripts/ci/check-vault-primitive.sh`.
 *
 * Usage:
 * ```tsx
 * <VaultHoverCard slug="esp32-gpio12-must-be-low-at-boot-or-module-crashes">
 *   <BoardPin data-pin="GPIO12" />
 * </VaultHoverCard>
 * ```
 *
 * Or with topic-indirection (when the slug is derived at render time):
 * ```tsx
 * <VaultHoverCard topic={pin.vaultSlug ?? `pin-${pin.label}`}>...
 * ```
 */
import * as React from 'react';
import { BookOpen, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from './hover-card';
import { useVaultQuickFetch } from '@/hooks/useVaultQuickFetch';
import { cn } from '@/lib/utils';

export interface VaultHoverCardProps {
  /**
   * Exact slug under `knowledge/<slug>.md`. Preferred.
   * Mutually exclusive with `topic`.
   */
  slug?: string;
  /**
   * Topic string that will be slugified / used as-is as the slug.
   * Convenience for topic-driven lookup (e.g., `topic={edge.protocol}`).
   * Mutually exclusive with `slug`.
   */
  topic?: string;
  /** Fallback rendered when the slug 404s and the consumer does not want the Suggest CTA. */
  fallback?: React.ReactNode;
  /** Hoverable element (MUST accept hover events — usually a button / span / icon). */
  children: React.ReactNode;
  /** Tailwind side-channel for consumers that want to nudge positioning. */
  className?: string;
  /** Invoked when the user clicks "Suggest a note" on a 404. Leave undefined to hide the CTA. */
  onSuggestNote?: (slug: string) => void;
  /** Invoked when the user clicks "Read more in Vault". Leave undefined to hide the link. */
  onOpenInVault?: (slug: string) => void;
  /** Disable fetch (e.g., while a parent popover is closed). */
  enabled?: boolean;
}

function toSlug(input: string | undefined): string | undefined {
  if (!input) return undefined;
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export const VaultHoverCard = React.memo(function VaultHoverCard({
  slug,
  topic,
  fallback,
  children,
  className,
  onSuggestNote,
  onOpenInVault,
  enabled = true,
}: VaultHoverCardProps) {
  const effectiveSlug = slug ?? toSlug(topic);
  const [open, setOpen] = React.useState(false);
  const { title, summary, topics, loading, notFound, error } = useVaultQuickFetch(
    enabled && open && effectiveSlug ? effectiveSlug : undefined,
  );

  // No slug at all — render children inert so the tree still mounts.
  if (!effectiveSlug) {
    return <>{children}</>;
  }

  return (
    <HoverCard openDelay={200} closeDelay={100} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        className={cn('w-80 text-sm', className)}
        data-testid="vault-hover-card-content"
        data-state-slug={effectiveSlug}
      >
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            <span>Loading {effectiveSlug}…</span>
          </div>
        )}

        {!loading && notFound && (
          <div className="space-y-2" data-testid="vault-hover-card-404">
            {fallback ?? (
              <>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="w-3 h-3" aria-hidden="true" />
                  <span>No vault note yet</span>
                </div>
                <div className="text-xs text-foreground/80 font-mono break-all">
                  {effectiveSlug}
                </div>
                {onSuggestNote && (
                  <button
                    type="button"
                    onClick={() => onSuggestNote(effectiveSlug)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    data-testid="vault-hover-card-suggest"
                  >
                    <Sparkles className="w-3 h-3" aria-hidden="true" />
                    Suggest a note
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {!loading && !notFound && Boolean(error) && (
          <div className="flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Failed to load vault note:{' '}
              {error instanceof Error ? error.message : String(error ?? 'unknown')}
            </span>
          </div>
        )}

        {!loading && !notFound && !error && (
          <div className="space-y-2" data-testid="vault-hover-card-success">
            <div className="flex items-start gap-2">
              <BookOpen
                className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <h4 className="text-sm font-medium leading-snug">{title}</h4>
            </div>

            {summary && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {summary}
              </p>
            )}

            {topics.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {topics.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {onOpenInVault && (
              <button
                type="button"
                onClick={() => onOpenInVault(effectiveSlug)}
                className="text-xs text-primary hover:underline font-medium"
                data-testid="vault-hover-card-open"
              >
                Read more in Vault →
              </button>
            )}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
});

VaultHoverCard.displayName = 'VaultHoverCard';
