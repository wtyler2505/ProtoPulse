import type { ReactNode } from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Info, TriangleAlert } from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{ padding: 48, maxWidth: 460, display: "flex", justifyContent: "center" }}
  >
    {children}
  </div>
);

export function PinHint() {
  return (
    <Surface>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <button type="button" className="rounded-md border border-input px-3 py-1.5 text-sm">
            GPIO12
          </button>
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
          <span className="inline-flex items-center gap-1 text-sm text-amber-300">
            <TriangleAlert className="h-4 w-4" />
            Clearance
          </span>
        </TooltipTrigger>
        <TooltipContent>Minimum copper-to-copper clearance is 6 mil for this stackup.</TooltipContent>
      </Tooltip>
    </Surface>
  );
}

export function FieldHelp() {
  return (
    <Surface>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-sm">
            Tolerance
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent>Resistor tolerance affects the BOM cost and divider accuracy.</TooltipContent>
      </Tooltip>
    </Surface>
  );
}
