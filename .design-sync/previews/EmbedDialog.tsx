import type { ReactNode } from "react";
import EmbedDialog from "@/components/ui/EmbedDialog";
import type { EmbedCircuitData } from "@/lib/embed-viewer";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, minHeight: 480, position: "relative" }}>
    {children}
  </div>
);

const blinkCircuit: EmbedCircuitData = {
  nodes: [
    { id: "U1", type: "mcu", label: "ATmega328P-PU", x: 120000, y: 80000, rotation: 0 },
    { id: "R1", type: "resistor", label: "220Ω", x: 240000, y: 80000 },
    { id: "D1", type: "led", label: "LED (red)", x: 320000, y: 80000 },
  ],
  wires: [
    { id: 1, netId: 1, points: [], color: "#22c55e" },
    { id: 2, netId: 2, points: [], color: "#ef4444" },
  ],
  nets: [
    { id: 1, name: "PB5/D13", netType: "signal" },
    { id: 2, name: "GND", netType: "power", voltage: "0V" },
  ],
  metadata: {
    name: "ATmega Blink Demo",
    description: "Classic LED blink on digital pin 13 with a 220Ω series resistor.",
    version: 2,
  },
};

// EmbedDialog encodes circuit data via EmbedManager on open and reads the
// clipboard API — likely floor-cards (needs EmbedManager.encode runtime + clipboard).
export function ShareSchematic() {
  return (
    <Surface>
      <EmbedDialog open circuitData={blinkCircuit} onOpenChange={() => {}} />
    </Surface>
  );
}

export function ShareLargeBoard() {
  return (
    <Surface>
      <EmbedDialog
        open
        circuitData={{
          ...blinkCircuit,
          metadata: {
            name: "ESP32 Sensor Hub",
            description: "Multi-sensor board with I2C bus and 3V3 LDO regulator.",
            version: 5,
          },
        }}
        onOpenChange={() => {}}
      />
    </Surface>
  );
}
