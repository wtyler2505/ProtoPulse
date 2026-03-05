import * as React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * App-wide tooltip styling constant.
 * Previously copy-pasted 30+ times across components (audit item #113).
 */
export const TOOLTIP_CLASS = "bg-card/90 backdrop-blur border-border text-xs text-foreground";

interface StyledTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  asChild?: boolean;
}

/**
 * Wrapper around shadcn/ui Tooltip with consistent ProtoPulse styling.
 * Use this instead of manually composing Tooltip + TooltipTrigger + TooltipContent.
 */
export function StyledTooltip({ children, content, side = "bottom", className, asChild = true }: StyledTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild={asChild}>
        {children}
      </TooltipTrigger>
      <TooltipContent className={cn(TOOLTIP_CLASS, className)} side={side}>
        {typeof content === "string" ? <p>{content}</p> : content}
      </TooltipContent>
    </Tooltip>
  );
}
