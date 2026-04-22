/**
 * VaultInfoIcon — the canonical `BookOpen` hover trigger for vault pedagogy.
 *
 * Extracted 2026-04-19 after 12 consumers shipped the same 5-prop trigger
 * span verbatim (BL-0861). This component is the one-line form.
 *
 * Usage:
 * ```tsx
 * <VaultInfoIcon
 *   slug="esp32-gpio12-must-be-low-at-boot-or-module-crashes"
 *   testId="gpio12-vault-info"
 *   ariaLabel="About ESP32 GPIO12 strapping pin"
 * />
 * ```
 *
 * Or with topic-driven lookup:
 * ```tsx
 * <VaultInfoIcon topic={edge.protocol} testId={`edge-vault-${edge.id}`} ariaLabel="About edge protocol" />
 * ```
 *
 * Rendering contract:
 * - Tiny (`w-3 h-3`) `BookOpen` icon
 * - `opacity-60 hover:opacity-100 transition-opacity` — subtle but discoverable
 * - `cursor-help` — signals hover affordance
 * - `inline-flex items-center` — composes with surrounding label/button content
 *
 * For non-tooltip surfaces (inline expandable panels for DRC rows, component
 * field help), use `<VaultExplainer>` directly — this icon is hover-tooltip only.
 */
import * as React from 'react';
import { BookOpen } from 'lucide-react';
import { VaultHoverCard } from './vault-hover-card';
import { cn } from '@/lib/utils';

export interface VaultInfoIconProps {
  /**
   * Exact slug under `knowledge/<slug>.md`. Preferred when you have a canonical one.
   * Mutually exclusive with `topic`.
   */
  slug?: string;
  /**
   * Topic string that will be slugified. Convenience for topic-driven lookup
   * (e.g. `topic={edge.protocol}`). Mutually exclusive with `slug`.
   */
  topic?: string;
  /** data-testid for the trigger span. Required for test hooks. */
  testId: string;
  /** Accessible label for screen readers. Required. */
  ariaLabel: string;
  /** Icon size — defaults to `w-3 h-3`. Override for dense contexts. */
  sizeClass?: string;
  /** Extra classes appended to the trigger span. */
  className?: string;
  /** Invoked when the user clicks "Read more in Vault". Leave undefined to hide the link. */
  onOpenInVault?: (slug: string) => void;
  /** Invoked when the user clicks "Suggest a note" on a 404. Leave undefined to hide the CTA. */
  onSuggestNote?: (slug: string) => void;
}

export const VaultInfoIcon = React.memo(function VaultInfoIcon({
  slug,
  topic,
  testId,
  ariaLabel,
  sizeClass = 'w-3 h-3',
  className,
  onOpenInVault,
  onSuggestNote,
}: VaultInfoIconProps) {
  return (
    <VaultHoverCard
      slug={slug}
      topic={topic}
      onOpenInVault={onOpenInVault}
      onSuggestNote={onSuggestNote}
    >
      <span
        data-testid={testId}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex items-center cursor-help opacity-60 hover:opacity-100 transition-opacity',
          className,
        )}
      >
        <BookOpen className={sizeClass} />
      </span>
    </VaultHoverCard>
  );
});

VaultInfoIcon.displayName = 'VaultInfoIcon';
