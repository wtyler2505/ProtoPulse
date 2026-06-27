import type { ReactNode } from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const Surface = ({ children }: { children: ReactNode }) => (
  <TooltipProvider>
    <div className="bg-background text-foreground" style={{ padding: 48, maxWidth: 460, display: "flex", justifyContent: "center" }}>
      {children}
    </div>
  </TooltipProvider>
);

export function PinHint() {
  return (
    <Surface>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <button type="button" className="rounded-md border border-input px-3 py-1.5 text-sm">GPIO12</button>
        </TooltipTrigger>
        <TooltipContent>Strapping pin — must be LOW at boot or the module crashes.</TooltipContent>
      </Tooltip>
    </Surface>
  );
}

export function DrcRuleHint() {
  return (
    <Surface>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-sm text-warning">Clearance rule</span>
        </TooltipTrigger>
        <TooltipContent>Minimum copper-to-copper clearance is 6 mil for this stackup.</TooltipContent>
      </Tooltip>
    </Surface>
  );
}
