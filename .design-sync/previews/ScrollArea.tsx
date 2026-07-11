import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>
    {children}
  </div>
);

const PARTS = [
  { ref: "U1", part: "ATmega328P-PU", pkg: "PDIP-28" },
  { ref: "U2", part: "AMS1117-3.3", pkg: "SOT-223" },
  { ref: "U3", part: "MCP23017-E/SP", pkg: "PDIP-28" },
  { ref: "Q1", part: "2N7000", pkg: "TO-92" },
  { ref: "D1", part: "1N4148W", pkg: "SOD-123" },
  { ref: "C1", part: "100nF X7R", pkg: "0603" },
  { ref: "C2", part: "10µF 16V", pkg: "0805" },
  { ref: "R1", part: "10kΩ 1%", pkg: "0402" },
  { ref: "R2", part: "330Ω 1%", pkg: "0402" },
  { ref: "Y1", part: "16 MHz HC-49", pkg: "THT" },
  { ref: "J1", part: "USB-C 16P", pkg: "SMD" },
  { ref: "SW1", part: "Tactile 6mm", pkg: "THT" },
];

export function ComponentList() {
  return (
    <Surface>
      <ScrollArea className="h-64 w-72 rounded-md border border-border bg-card/40">
        <div className="p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Components (12)
          </div>
          {PARTS.map((p, i) => (
            <div key={p.ref}>
              <div className="flex items-center justify-between py-1.5 text-sm">
                <span className="font-mono text-primary">{p.ref}</span>
                <span className="truncate px-2 text-foreground">{p.part}</span>
                <span className="text-xs text-muted-foreground">{p.pkg}</span>
              </div>
              {i < PARTS.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </ScrollArea>
    </Surface>
  );
}

export function NetListPanel() {
  const nets = [
    "+5V",
    "+3V3",
    "GND",
    "VBUS",
    "SCK",
    "MISO",
    "MOSI",
    "SDA",
    "SCL",
    "RX0",
    "TX0",
    "RESET",
    "AREF",
    "XTAL1",
    "XTAL2",
  ];
  return (
    <Surface>
      <ScrollArea className="h-56 w-56 rounded-md border border-border bg-card/40">
        <div className="p-2">
          {nets.map((net) => (
            <div
              key={net}
              className="rounded px-2 py-1 font-mono text-xs text-foreground hover:bg-muted/60"
            >
              {net}
            </div>
          ))}
        </div>
      </ScrollArea>
    </Surface>
  );
}
