import type { ReactNode } from "react";
import ConfidenceBadge from "@/components/ui/ConfidenceBadge";
import { TooltipProvider } from "@/components/ui/tooltip";

const Surface = ({ children }: { children: ReactNode }) => (
  <TooltipProvider>
    <div className="bg-background text-foreground" style={{ padding: 24 }}>
      {children}
    </div>
  </TooltipProvider>
);

export function Tiers() {
  return (
    <Surface>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <ConfidenceBadge
          confidence={{
            score: 92,
            explanation: "Exact MPN match against the Microchip datasheet with verified pinout.",
            factors: ["MPN ATmega328P-PU matched", "28-pin DIP footprint confirmed", "2 datasheet citations"],
          }}
        />
        <ConfidenceBadge
          confidence={{
            score: 64,
            explanation: "Footprint inferred from package family; pin 1 orientation unverified.",
            factors: ["SOIC-8 package assumed", "No exact MPN in library"],
          }}
        />
        <ConfidenceBadge
          confidence={{
            score: 38,
            explanation: "Generic resistor placeholder; tolerance and power rating estimated.",
            factors: ["SMD 0603 guessed from neighbors", "Value 10kΩ unverified"],
          }}
        />
        <ConfidenceBadge
          confidence={{
            score: 12,
            explanation: "AI could not resolve this symbol to a known part.",
            factors: ["No matching footprint", "Net labels ambiguous"],
          }}
        />
      </div>
    </Surface>
  );
}

export function InlineWithLabels() {
  return (
    <Surface>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 380 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="text-sm">U1 — ESP32-WROOM-32E</span>
          <ConfidenceBadge
            confidence={{
              score: 88,
              explanation: "Module matched to Espressif reference; antenna keepout applied.",
              factors: ["38-pin castellated module", "Datasheet rev 1.6"],
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="text-sm">R7 — 4.7kΩ pull-up</span>
          <ConfidenceBadge
            confidence={{
              score: 55,
              explanation: "Value read from silkscreen; tolerance not specified in source.",
              factors: ["0603 SMD", "I2C_SDA pull-up context"],
            }}
          />
        </div>
      </div>
    </Surface>
  );
}
