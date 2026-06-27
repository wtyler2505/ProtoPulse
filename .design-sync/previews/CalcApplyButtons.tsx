import type { ReactNode } from "react";
import { CalcApplyButtons } from "@/components/ui/CalcApplyButtons";
import type { CalcResult } from "@/lib/calculator-apply";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 320 }}>
    {children}
  </div>
);

const ledResistor: CalcResult = {
  calculatorName: "led-resistor",
  resultName: "Nearest E24",
  value: 330,
  unit: "Ω",
  componentType: "resistor",
};

const voltageDivider: CalcResult = {
  calculatorName: "voltage-divider",
  resultName: "Output Voltage",
  value: 3.3,
  unit: "V",
};

export function LedResistorResult() {
  return (
    <Surface>
      <div className="space-y-1">
        <div className="text-sm font-medium">LED Current-Limit Resistor</div>
        <div className="text-xs text-muted-foreground">Nearest E24: 330 Ω &middot; 1/4 W</div>
        <CalcApplyButtons result={ledResistor} />
      </div>
    </Surface>
  );
}

export function VoltageDividerResult() {
  return (
    <Surface>
      <div className="space-y-1">
        <div className="text-sm font-medium">Voltage Divider Output</div>
        <div className="text-xs text-muted-foreground">Vout = 3.3 V from 5 V rail</div>
        <CalcApplyButtons result={voltageDivider} />
      </div>
    </Surface>
  );
}
