import type { ReactNode } from "react";
import PredictionPanel from "@/components/ui/PredictionPanel";
import type { Prediction } from "@/lib/ai-prediction-engine";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 400 }}>
    {children}
  </div>
);

const noop = () => undefined;

const suggestions: Prediction[] = [
  {
    id: "pred-decap-u3",
    ruleId: "missing-decoupling-cap",
    title: "Add a decoupling capacitor near U3",
    description:
      "The ATmega328P at U3 has no 100 nF cap within 5 mm of its VCC pin. Place a 0.1 µF X7R between VCC and GND.",
    confidence: 0.92,
    category: "missing_component",
    action: { type: "add_component", payload: { value: "100nF", net: "VCC" } },
    dismissed: false,
  },
  {
    id: "pred-pullup-i2c",
    ruleId: "i2c-pullups",
    title: "I²C bus is missing pull-up resistors",
    description:
      "SDA and SCL on the BME280 have no pull-ups. Add 4.7 kΩ resistors to +3V3 for reliable communication at 400 kHz.",
    confidence: 0.84,
    category: "best_practice",
    action: { type: "add_component", payload: { value: "4.7k", count: 2 } },
    dismissed: false,
  },
  {
    id: "pred-star-ground",
    ruleId: "ground-routing",
    title: "Consider a star-ground for the ADC",
    description:
      "Analog and digital grounds share a single trace. A star-ground topology at the ADC reference would lower measurement noise.",
    confidence: 0.61,
    category: "optimization",
    action: { type: "show_info", payload: {} },
    dismissed: false,
  },
];

export function ActiveSuggestions() {
  return (
    <Surface>
      <PredictionPanel
        predictions={suggestions}
        onAccept={noop}
        onDismiss={noop}
        onClearAll={noop}
      />
    </Surface>
  );
}

export function Analyzing() {
  return (
    <Surface>
      <PredictionPanel
        predictions={[]}
        onAccept={noop}
        onDismiss={noop}
        onClearAll={noop}
        isAnalyzing
      />
    </Surface>
  );
}
