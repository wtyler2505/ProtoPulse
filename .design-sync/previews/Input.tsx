import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 420 }}>
    {children}
  </div>
);

export function Labeled() {
  return (
    <Surface>
      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="part">Part number</Label>
        <Input id="part" defaultValue="ATmega328P-PU" placeholder="e.g. ATmega328P-PU" />
      </div>
    </Surface>
  );
}

export function FieldStates() {
  return (
    <Surface>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <Label htmlFor="ref">Reference designator</Label>
          <Input id="ref" defaultValue="R7" />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <Label htmlFor="ohms">Resistance</Label>
          <Input id="ohms" placeholder="10k" />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <Label htmlFor="locked">Footprint (locked)</Label>
          <Input id="locked" value="0805" disabled readOnly />
        </div>
      </div>
    </Surface>
  );
}

export function NetFilter() {
  return (
    <Surface>
      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="netsearch">Filter nets</Label>
        <Input id="netsearch" type="search" placeholder="GND, +5V, SPI_MOSI..." />
      </div>
    </Surface>
  );
}
