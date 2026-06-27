import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>
    {children}
  </div>
);

export function DesignSummary() {
  return (
    <Surface>
      <div className="w-72 rounded-md border border-border bg-card/40 p-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold">Blinky Shield v2</div>
          <div className="text-xs text-muted-foreground">
            2-layer board · 1.6 mm FR-4
          </div>
        </div>
        <Separator className="my-3" />
        <div className="flex h-6 items-center gap-3 text-xs text-muted-foreground">
          <span>42 nets</span>
          <Separator orientation="vertical" />
          <span>118 pads</span>
          <Separator orientation="vertical" />
          <span>27 parts</span>
        </div>
      </div>
    </Surface>
  );
}

export function RailDivider() {
  return (
    <Surface>
      <div className="w-64 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-primary">+5V</span>
          <span className="text-muted-foreground">240 mA</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-mono text-primary">+3V3</span>
          <span className="text-muted-foreground">180 mA</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-mono text-primary">GND</span>
          <span className="text-muted-foreground">reference</span>
        </div>
      </div>
    </Surface>
  );
}
