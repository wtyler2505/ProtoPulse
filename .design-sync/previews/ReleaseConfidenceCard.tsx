import type { ReactNode } from "react";
import ReleaseConfidenceCard from "@/components/ui/ReleaseConfidenceCard";
import { calculateScorecard } from "@/lib/risk-scorecard";
import type { ScorecardInput } from "@/lib/risk-scorecard";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 640 }}>
    {children}
  </div>
);

// A mid-maturity design: clean DRC but a few BOM and manufacturing gaps.
const guidedInput: ScorecardInput = {
  validationIssues: [
    { severity: "warning", message: "Silkscreen overlaps pad on R7" },
    { severity: "info", message: "Net +5V has only one decoupling cap" },
  ],
  bomItems: [
    {
      partNumber: "ATMEGA328P-AU",
      manufacturer: "Microchip",
      description: "8-bit AVR MCU, TQFP-32",
      quantity: 1,
      unitPrice: 2.18,
      totalPrice: 2.18,
      stock: 4200,
      status: "In Stock",
      assemblyCategory: "smt",
    },
    {
      partNumber: "",
      manufacturer: "Unknown",
      description: "0.1uF decoupling capacitor",
      quantity: 6,
      unitPrice: 0,
      totalPrice: 0,
      stock: 0,
      status: "Out of Stock",
      assemblyCategory: null,
    },
  ],
  nodes: [
    { id: "u1", label: "MCU", type: "ic", description: "Main microcontroller" },
    { id: "j1", label: "USB-C", type: "connector" },
  ],
  edges: [{ id: "e1", source: "u1", target: "j1" }],
};

// A near-ready design: clean DRC, full BOM, in stock.
const reviewInput: ScorecardInput = {
  validationIssues: [{ severity: "info", message: "Courtyard clearance is tight on Y1" }],
  bomItems: [
    {
      partNumber: "ESP32-S3-WROOM-1",
      manufacturer: "Espressif",
      description: "Wi-Fi/BLE module",
      quantity: 1,
      unitPrice: 3.05,
      totalPrice: 3.05,
      stock: 9800,
      status: "In Stock",
      assemblyCategory: "smt",
    },
    {
      partNumber: "AMS1117-3.3",
      manufacturer: "AdvancedMonolithic",
      description: "3.3V LDO regulator, SOT-223",
      quantity: 1,
      unitPrice: 0.18,
      totalPrice: 0.18,
      stock: 52000,
      status: "In Stock",
      assemblyCategory: "smt",
    },
  ],
  nodes: [
    { id: "u1", label: "ESP32-S3", type: "module", description: "Wireless SoC" },
    { id: "u2", label: "LDO", type: "regulator", description: "3.3V rail" },
  ],
  edges: [{ id: "e1", source: "u2", target: "u1" }],
};

export function GuidedBuild() {
  return (
    <Surface>
      <ReleaseConfidenceCard result={calculateScorecard(guidedInput)} />
    </Surface>
  );
}

export function ReviewReady() {
  return (
    <Surface>
      <ReleaseConfidenceCard
        result={calculateScorecard(reviewInput)}
        title="Release Confidence — Rev B"
      />
    </Surface>
  );
}
