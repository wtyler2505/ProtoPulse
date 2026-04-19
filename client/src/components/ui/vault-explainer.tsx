/**
 * VaultExplainer — inline expandable vault-note panel.
 *
 * Sibling to `<VaultHoverCard>` but for surfaces where hover pedagogy is
 * wrong (DRC error rows, Component Editor field help, simulation disabled-
 * reason callouts). Renders collapsed by default, expands to show full body
 * + topic row + cross-links.
 *
 * Audience-tier rendering: if the body contains `### [beginner]` /
 * `[intermediate]` / `[expert]` markers, the explainer renders the section
 * matching the caller's tier (via `tier` prop or falling through to intermediate
 * — `useWorkspaceMode()` wiring is a future task under 17-shell-header-nav).
 *
 * Usage:
 * ```tsx
 * <VaultExplainer
 *   slug="drc-should-flag-direct-gpio-to-inductive-load-connections-and-suggest-driver-plus-flyback-subcircuit"
 *   tier="beginner"
 * >
 *   Why is this wrong?
 * </VaultExplainer>
 * ```
 */
import * as React from 'react';
import { BookOpen, ChevronDown, ChevronRight, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { useVaultQuickFetch } from '@/hooks/useVaultQuickFetch';
import { cn } from '@/lib/utils';

export type VaultAudienceTier = 'beginner' | 'intermediate' | 'expert';

export interface VaultExplainerProps {
  slug?: string;
  topic?: string;
  /** Visible label for the disclosure trigger. Defaults to "Learn more". */
  children?: React.ReactNode;
  /** Which audience tier to render from body markers. Defaults to intermediate. */
  tier?: VaultAudienceTier;
  /** Start expanded. Default false. */
  defaultOpen?: boolean;
  className?: string;
  /** Show/hide the "Suggest a note" CTA on 404. */
  onSuggestNote?: (slug: string) => void;
  /** "Read more in Vault" click handler — omit to hide the link. */
  onOpenInVault?: (slug: string) => void;
}

const AUDIENCE_HEADING_RE = /^#{2,3}\s*\[(beginner|intermediate|expert)\]\s*$/gim;

/**
 * Split body at audience-tier markers. Returns the section matching `tier` if found,
 * or the whole body if no markers exist, or the first section if the requested tier
 * is missing.
 */
function extractTierSection(body: string, tier: VaultAudienceTier): string {
  const matches = Array.from(body.matchAll(AUDIENCE_HEADING_RE));
  if (matches.length === 0) return body;

  type Section = { tier: VaultAudienceTier; start: number; end: number };
  const sections: Section[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const next = matches[i + 1];
    sections.push({
      tier: m[1]!.toLowerCase() as VaultAudienceTier,
      start: m.index! + m[0].length,
      end: next ? next.index! : body.length,
    });
  }

  const wanted = sections.find((s) => s.tier === tier);
  const chosen = wanted ?? sections[0]!;
  return body.slice(chosen.start, chosen.end).trim();
}

function toSlug(input: string | undefined): string | undefined {
  if (!input) return undefined;
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export const VaultExplainer = React.memo(function VaultExplainer({
  slug,
  topic,
  children,
  tier = 'intermediate',
  defaultOpen = false,
  className,
  onSuggestNote,
  onOpenInVault,
}: VaultExplainerProps) {
  const effectiveSlug = slug ?? toSlug(topic);
  const [open, setOpen] = React.useState(defaultOpen);
  const { title, summary, body, topics, loading, notFound, error } = useVaultQuickFetch(
    open && effectiveSlug ? effectiveSlug : undefined,
  );

  if (!effectiveSlug) return null;

  const label = children ?? 'Learn more';
  const sectionBody = body ? extractTierSection(body, tier) : '';

  return (
    <div
      className={cn(
        'rounded-md border border-border/40 bg-muted/20 text-sm',
        className,
      )}
      data-testid="vault-explainer"
      data-slug={effectiveSlug}
      data-tier={tier}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/40 rounded-md transition-colors"
        data-testid="vault-explainer-toggle"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <BookOpen className="w-3.5 h-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span className="text-sm font-medium">{label}</span>
      </button>

      {open && (
        <div className="px-4 pb-3 pt-1 space-y-2 border-t border-border/30">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              <span>Loading {effectiveSlug}…</span>
            </div>
          )}

          {!loading && notFound && (
            <div className="space-y-2 py-2" data-testid="vault-explainer-404">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertCircle className="w-3 h-3" aria-hidden="true" />
                <span>No vault note yet for</span>
                <code className="text-[11px] font-mono break-all">{effectiveSlug}</code>
              </div>
              {onSuggestNote && (
                <button
                  type="button"
                  onClick={() => onSuggestNote(effectiveSlug)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  data-testid="vault-explainer-suggest"
                >
                  <Sparkles className="w-3 h-3" aria-hidden="true" />
                  Suggest this note
                </button>
              )}
            </div>
          )}

          {!loading && !notFound && Boolean(error) && (
            <div className="flex items-start gap-2 text-xs text-destructive py-2">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Failed to load vault note:{' '}
                {error instanceof Error ? error.message : String(error ?? 'unknown')}
              </span>
            </div>
          )}

          {!loading && !notFound && !error && (
            <div className="space-y-2" data-testid="vault-explainer-success">
              <h4 className="text-sm font-medium leading-snug">{title}</h4>

              {summary && (
                <p className="text-xs text-muted-foreground italic leading-relaxed">
                  {summary}
                </p>
              )}

              {sectionBody && (
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground/90 bg-background/60 p-2 rounded border border-border/20 max-h-64 overflow-y-auto">
                  {sectionBody}
                </pre>
              )}

              {topics.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {topics.slice(0, 6).map((t) => (
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
                  data-testid="vault-explainer-open"
                >
                  Read full note in Vault →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

VaultExplainer.displayName = 'VaultExplainer';
