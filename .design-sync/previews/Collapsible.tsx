import type { ReactNode } from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown } from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 360 }}>
    {children}
  </div>
);

export function NetDetails() {
  return (
    <Surface>
      <Collapsible defaultOpen className="space-y-2 rounded-md border border-border p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Net: 3V3 &middot; 12 nodes</span>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Toggle net details">
              <ChevronsUpDown />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="space-y-1 text-xs text-muted-foreground">
          <div>U1.VCC &rarr; C3.1 &rarr; C4.1</div>
          <div>U2.VDD &rarr; R7.2</div>
          <div>J1.2 (header 3V3 in)</div>
        </CollapsibleContent>
      </Collapsible>
    </Surface>
  );
}

export function AdvancedExportOptions() {
  return (
    <Surface>
      <Collapsible className="space-y-2 rounded-md border border-border p-3">
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            Advanced Gerber options
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 pt-1 text-xs text-muted-foreground">
          <div>Format: RS-274X (extended)</div>
          <div>Units: millimeters, 4.6 precision</div>
          <div>Include: drill map, board outline, paste layers</div>
        </CollapsibleContent>
      </Collapsible>
    </Surface>
  );
}
