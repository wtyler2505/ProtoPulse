import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{ padding: 24, minHeight: 420, position: "relative" }}
  >
    {children}
  </div>
);

export function PartInspector() {
  return (
    <Surface>
      <Sheet defaultOpen modal={false}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>U1 — ATmega328P-PU</SheetTitle>
            <SheetDescription>
              8-bit AVR microcontroller · PDIP-28
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-y-2">
              <span className="text-muted-foreground">VCC range</span>
              <span>1.8 – 5.5 V</span>
              <span className="text-muted-foreground">Flash</span>
              <span>32 KB</span>
              <span className="text-muted-foreground">GPIO</span>
              <span>23 pins</span>
              <span className="text-muted-foreground">MPN</span>
              <span className="font-mono text-xs">ATMEGA328P-PU</span>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Connected to nets: +5V, GND, XTAL1, XTAL2, RESET.
            </p>
          </div>
          <SheetFooter className="mt-6">
            <Button size="sm">Add to BOM</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Surface>
  );
}

export function DrcResultsDrawer() {
  return (
    <Surface>
      <Sheet defaultOpen modal={false}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Design Rule Check</SheetTitle>
            <SheetDescription>3 violations · 1 warning</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2 text-sm">
            <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs">
              Clearance: trace on +5V too close to GND pour (0.12 mm &lt; 0.20 mm)
            </div>
            <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs">
              Unconnected pin: U3.21 (GPB4) is floating
            </div>
            <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
              Silkscreen overlaps pad on C2
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </Surface>
  );
}
