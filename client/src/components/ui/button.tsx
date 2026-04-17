import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
" hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
           // @replit: no hover, and add primary border
           "bg-primary text-primary-foreground border border-primary-border",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm border-destructive-border",
        outline:
          // @replit Shows the background color of whatever card / sidebar / accent background it is inside of.
          // Inherits the current text color. Uses shadow-xs. no shadow on active
          // No hover state
          " border [border-color:var(--button-outline)] shadow-xs active:shadow-none ",
        secondary:
          // @replit border, no hover, no shadow, secondary border.
          "border bg-secondary text-secondary-foreground border border-secondary-border ",
        // @replit no hover, transparent border
        ghost: "border border-transparent",
        link: "text-primary underline-offset-4 hover:underline",
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
    // Explicit type prop wins; otherwise default to "button" to prevent
    // accidental form submission from Enter-key / Space activation.
    const resolvedType = asChild ? type : (type ?? "button")
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={resolvedType}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
