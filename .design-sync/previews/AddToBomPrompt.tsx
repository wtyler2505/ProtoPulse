import type { ReactNode } from "react";
import AddToBomPrompt from "@/components/ui/AddToBomPrompt";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="relative bg-background text-foreground"
    style={{ padding: 24, minHeight: 220 }}
  >
    {children}
  </div>
);

export function FullMetadata() {
  return (
    <Surface>
      <div style={{ position: "relative", width: 320, marginLeft: "auto" }}>
        <AddToBomPrompt
          componentName="LM358 Dual Op-Amp (SOIC-8)"
          bomPreview={{
            partNumber: "LM358DR",
            manufacturer: "Texas Instruments",
            description: "Dual operational amplifier, SOIC-8",
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
            supplier: "Digi-Key",
            stock: 0,
            status: "In Stock",
            assemblyCategory: "smt",
          }}
          onConfirm={() => {}}
          onDismiss={() => {}}
        />
      </div>
    </Surface>
  );
}

export function MinimalFields() {
  return (
    <Surface>
      <div style={{ position: "relative", width: 320, marginLeft: "auto" }}>
        <AddToBomPrompt
          componentName="Generic SMD 0603 Resistor 10k"
          bomPreview={{
            partNumber: "",
            manufacturer: "",
            description: "10k 1% 0603 thick-film resistor",
            quantity: 4,
            unitPrice: 0,
            totalPrice: 0,
            supplier: "Unknown",
            stock: 0,
            status: "Out of Stock",
          }}
          onConfirm={() => {}}
          onDismiss={() => {}}
        />
      </div>
    </Surface>
  );
}
