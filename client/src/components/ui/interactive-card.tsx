import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * InteractiveCard — shared primitive that replaces the legacy
 * `<div role="button" tabIndex={0} onClick={...} onKeyDown={...}>` pattern
 * with a real `<button type="button">`. Browsers give us Enter/Space
 * activation, correct screen-reader announcement, and disabled semantics
 * for free.
 *
 * Plan 03 Phase 3 (E2E-018, E2E-068, E2E-261, E2E-267). See
 * `docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md`.
 *
 * Design notes:
 * - Renders a real `<button>` — no `role="button"` on a div.
 * - Resets button chrome (`appearance-none`, transparent bg, no padding/border,
 *   `text-left`) so existing card Tailwind classes keep the same visual output.
 * - Adds a `focus-visible` ring so keyboard users can see focus. Callers can
 *   override via `className`; the ring tokens match the rest of shadcn/ui.
 * - Supports `onAction` as a semantic alias for `onClick` — either is valid
 *   and both fire on click / Enter / Space.
 */
export interface InteractiveCardProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Semantic alias for `onClick` — fires on click, Enter, and Space. */
  onAction?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export const InteractiveCard = React.forwardRef<
  HTMLButtonElement,
  InteractiveCardProps
>(
  (
    { className, type = 'button', onClick, onAction, children, ...rest },
    ref,
  ) => {
    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          onAction?.(event);
        }
      },
      [onClick, onAction],
    );

    return (
      <button
        ref={ref}
        type={type}
        onClick={handleClick}
        className={cn(
          // Reset native button chrome so card layout classes stay authoritative
          'group relative w-full appearance-none bg-transparent p-0 m-0 border-0 text-left cursor-pointer',
          // Focus ring — shadcn/ui token set, 2px w/ offset so it pops against surface
          'focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          // Disabled semantics
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
InteractiveCard.displayName = 'InteractiveCard';
