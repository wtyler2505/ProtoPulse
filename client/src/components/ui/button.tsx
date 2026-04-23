import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // E2E-1013 (Plan 03 Phase 9): focus-visible now references the palette-
  //   independent `--color-focus-ring` token (white/near-black) instead of
  //   the brand `--color-ring` cyan, plus a 2px ring offset so the indicator
  //   reads against any surface. Ring width bumped 1 -> 2 for visibility.
  // E2E-1014 (Plan 03 Phase 9): `active:scale-[0.98]` gives tactile click
  //   feedback uniformly. Subtle (2% shrink) so it doesn't disrupt dense
  //   toolbars. `motion-reduce:active:scale-100` respects prefers-reduced-
  //   motion. `transition` governs both color and transform.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] motion-reduce:active:scale-100" +
" hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
           // @replit: no hover, and add primary border
           // E2E-1014: `active:brightness-90` adds tactile press feedback.
           "bg-primary text-primary-foreground border border-primary-border active:brightness-90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm border-destructive-border active:brightness-90",
        outline:
          // @replit Shows the background color of whatever card / sidebar / accent background it is inside of.
          // Inherits the current text color. Uses shadow-xs. no shadow on active
          // No hover state
          // E2E-1014: keep the shadow-drop active cue plus a subtle bg tint.
          " border [border-color:var(--button-outline)] shadow-xs active:shadow-none active:bg-muted/60 ",
        secondary:
          // @replit border, no hover, no shadow, secondary border.
          "border bg-secondary text-secondary-foreground border border-secondary-border active:brightness-90",
        // @replit no hover, transparent border
        ghost: "border border-transparent active:bg-muted/60",
        link: "text-primary underline-offset-4 hover:underline active:opacity-70",
      },
      size: {
        // @replit changed sizes
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

/**
 * Shadcn Button wrapper.
 *
 * IMPORTANT — default `type="button"` (audit #61 fix, 2026-04-17):
 * HTML's `<button>` defaults to `type="submit"` when rendered inside a
 * `<form>` — this silently submits the form on Enter or Space. React 19
 * does NOT fix that default. Consumers almost never want submit behavior
 * from shadcn Buttons (they're used for menus, dialogs, toolbars, etc.),
 * and the 4 legitimate submit callsites (AuthPage.tsx, BreadboardQuickIntake,
 * WorstCaseAnalysisPanel, ExactPartDraftModal) all set `type="submit"`
 * explicitly. Defaulting to `"button"` here eliminates 500+ accidental
 * submission vectors across the app with zero regressions.
 *
 * When `asChild` is true, the Slot primitive renders whatever child
 * element is given — the type default is harmless because Slot's child
 * (often an `<a>`) ignores the `type` prop.
 *
 * Consumers that need a submit button MUST pass `type="submit"` explicitly.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    if (asChild) {
      // Slot renders the child element directly — often <a>, <Link>, etc.
      // Passing a `type` attribute to an <a> is semantically wrong (on <a>,
      // `type` means MIME type). So when asChild, we forward NOTHING for
      // type: any explicit type set by the consumer flows through via
      // `...props` if it was in ...rest, but we don't force our default.
      // (In this component we extracted `type` out of props, so it's
      // intentionally dropped when asChild=true.)
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        />
      )
    }
    // Non-asChild path: force safe type default. Explicit type wins.
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={type ?? "button"}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
