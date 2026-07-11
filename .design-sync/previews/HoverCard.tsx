import type { ReactNode } from "react";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{ padding: 48, minHeight: 220, display: "flex", justifyContent: "center" }}
  >
    {children}
  </div>
);

export function PartDatasheet() {
  return (
    <Surface>
      <HoverCard defaultOpen>
        <HoverCardTrigger asChild>
          <button className="text-sm font-medium underline underline-offset-4 text-primary">
            ATmega328P-PU
          </button>
        </HoverCardTrigger>
        <HoverCardContent align="start">
          <div className="space-y-2">
            <div className="text-sm font-semibold">ATmega328P-PU</div>
            <p className="text-xs text-muted-foreground">
              8-bit AVR MCU, 32 KB flash, 28-pin DIP. The brains of the Arduino
              Uno R3.
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <span className="text-muted-foreground">Package</span>
              <span>PDIP-28</span>
              <span className="text-muted-foreground">VCC</span>
              <span>1.8 - 5.5 V</span>
              <span className="text-muted-foreground">I/O pins</span>
              <span>23 GPIO</span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </Surface>
  );
}

export function NetInspector() {
  return (
    <Surface>
      <HoverCard defaultOpen>
        <HoverCardTrigger asChild>
          <button className="text-sm font-medium text-primary">+3V3</button>
        </HoverCardTrigger>
        <HoverCardContent align="center" className="w-72">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Net: +3V3</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                power
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Regulated 3.3 V rail sourced from the AMS1117-3.3 LDO.
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <span className="text-muted-foreground">Nodes</span>
              <span>14 pins</span>
              <span className="text-muted-foreground">Est. current</span>
              <span>180 mA</span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </Surface>
  );
}
