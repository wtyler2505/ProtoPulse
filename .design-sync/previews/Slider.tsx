import type { ReactNode } from "react";
import { Slider } from "@/components/ui/slider";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>
    {children}
  </div>
);

export function TraceWidth() {
  return (
    <Surface>
      <div className="w-72 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Trace width</span>
          <span className="font-mono text-muted-foreground">0.25 mm</span>
        </div>
        <Slider defaultValue={[0.25]} min={0.1} max={1} step={0.05} />
      </div>
    </Surface>
  );
}

export function SimVoltageRange() {
  return (
    <Surface>
      <div className="w-72 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>VIN sweep</span>
          <span className="font-mono text-muted-foreground">3.3 – 12 V</span>
        </div>
        <Slider defaultValue={[3.3, 12]} min={0} max={24} step={0.1} />
      </div>
    </Surface>
  );
}

export function PourClearance() {
  return (
    <Surface>
      <div className="w-72 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Copper pour clearance</span>
          <span className="font-mono text-muted-foreground">0.30 mm</span>
        </div>
        <Slider defaultValue={[0.3]} min={0.1} max={0.8} step={0.05} />
      </div>
    </Surface>
  );
}
