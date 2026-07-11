import type { ReactNode } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, minHeight: 420, position: "relative" }}>
    {children}
  </div>
);

export function BomDrawer() {
  return (
    <Surface>
      <Drawer open>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Bill of Materials</DrawerTitle>
            <DrawerDescription>
              18 line items · 42 placements · estimated unit cost $7.84
            </DrawerDescription>
          </DrawerHeader>
          <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }} className="text-sm">
              <span>U1 — ATmega328P-PU</span>
              <span className="text-muted-foreground">DIP-28 · qty 1</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }} className="text-sm">
              <span>C1–C4 — 100nF ceramic</span>
              <span className="text-muted-foreground">0603 · qty 4</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }} className="text-sm">
              <span>R1 — 10kΩ pull-up</span>
              <span className="text-muted-foreground">0603 · qty 1</span>
            </div>
          </div>
          <DrawerFooter>
            <Button>Export CSV</Button>
            <Button variant="outline">Close</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Surface>
  );
}

export function SimulationResults() {
  return (
    <Surface>
      <Drawer open>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Transient analysis</DrawerTitle>
            <DrawerDescription>
              SPICE run completed in 412 ms · 2,048 timesteps · converged
            </DrawerDescription>
          </DrawerHeader>
          <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }} className="text-sm">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>V(out) peak</span>
              <span className="text-muted-foreground">4.97 V</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Rise time (10–90%)</span>
              <span className="text-muted-foreground">1.8 µs</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Quiescent current</span>
              <span className="text-muted-foreground">8.2 mA</span>
            </div>
          </div>
          <DrawerFooter>
            <Button>Open waveform viewer</Button>
            <Button variant="outline">Dismiss</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Surface>
  );
}
