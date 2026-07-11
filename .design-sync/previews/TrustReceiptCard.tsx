import type { ReactNode } from "react";
import TrustReceiptCard from "@/components/ui/TrustReceiptCard";
import type { TrustReceipt } from "@/lib/feature-maturity";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 460 }}>
    {children}
  </div>
);

export function ExportReady() {
  const receipt: TrustReceipt = {
    title: "Gerber export",
    status: "ready",
    summary: "Fabrication output is verified against the current PCB layout.",
    facts: [
      { label: "Layers", value: "2 (F.Cu / B.Cu)" },
      { label: "Format", value: "RS-274X + Excellon" },
      { label: "DRC", value: "0 errors" },
      { label: "Board", value: "50 × 30 mm" },
    ],
    nextStep: "Download the zipped Gerber set and send it to your fab house.",
  };
  return (
    <Surface>
      <TrustReceiptCard receipt={receipt} />
    </Surface>
  );
}

export function ArduinoSetupRequired() {
  const receipt: TrustReceipt = {
    title: "Arduino verify & upload",
    status: "setup_required",
    label: "Tooling",
    summary: "Verify and upload stay disabled until the toolchain is configured.",
    warnings: [
      "Arduino CLI is not installed on this machine.",
      "No board profile selected for the ESP32-S3 target.",
    ],
    nextStep: "Install Arduino CLI and pick a board profile in Settings.",
  };
  return (
    <Surface>
      <TrustReceiptCard receipt={receipt} />
    </Surface>
  );
}

export function OrderingCaution() {
  const receipt: TrustReceipt = {
    title: "DFM & quote estimate",
    status: "caution",
    summary: "Treat quotes and DFM hints as planning guidance until the layout is final.",
    facts: [
      { label: "Est. unit cost", value: "$4.18 @ qty 10" },
      { label: "Lead time", value: "~12 business days" },
    ],
    warnings: ["Board outline not yet locked — pricing may shift."],
  };
  return (
    <Surface>
      <TrustReceiptCard receipt={receipt} />
    </Surface>
  );
}

export function GenerativeExperimental() {
  const receipt: TrustReceipt = {
    title: "AI-generated schematic",
    status: "experimental",
    label: "Beta",
    summary: "The Draftsman produced this draft circuit — review every net before trusting it.",
    warnings: [
      "Component values are suggestions, not verified against datasheets.",
      "No ERC has been run on the generated netlist.",
    ],
    nextStep: "Run ERC and confirm part footprints before exporting.",
  };
  return (
    <Surface>
      <TrustReceiptCard receipt={receipt} />
    </Surface>
  );
}
