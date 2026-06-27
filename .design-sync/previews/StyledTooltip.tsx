import type { ReactNode } from "react";
import { StyledTooltip, TOOLTIP_CLASS } from "@/components/ui/styled-tooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{
      padding: 48,
      minHeight: 200,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    {children}
  </div>
);

// StyledTooltip itself exposes no `open` prop, so render the trigger as
// meaningful content; the card is non-empty even when the tooltip is closed.
export function PinTrigger() {
  return (
    <Surface>
      <StyledTooltip content="Pin 13 · SCK (Serial Clock) — net SCK">
        <button className="rounded border border-border bg-card/60 px-3 py-1.5 font-mono text-sm text-primary">
          U1.19 / SCK
        </button>
      </StyledTooltip>
    </Surface>
  );
}

// Open variant using the underlying Tooltip + the shared TOOLTIP_CLASS so the
// popover shows in the card. TooltipProvider is global.
export function NetTooltipOpen() {
  return (
    <Surface>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <button className="rounded border border-border bg-card/60 px-3 py-1.5 font-mono text-sm text-primary">
            +3V3
          </button>
        </TooltipTrigger>
        <TooltipContent className={cn(TOOLTIP_CLASS)} side="top">
          <p>Net +3V3 · 14 pins · sourced from AMS1117-3.3 LDO</p>
        </TooltipContent>
      </Tooltip>
    </Surface>
  );
}
