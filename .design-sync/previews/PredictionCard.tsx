import type { ReactNode } from "react";
import PredictionCard from "@/components/ui/PredictionCard";
import type { Prediction } from "@/lib/ai-prediction-engine";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 380 }}>
    {children}
  </div>
);

const noop = () => undefined;

const missingDecoupling: Prediction = {
  id: "pred-decap-u3",
  ruleId: "missing-decoupling-cap",
  title: "Add a decoupling capacitor near U3",
  description:
    "The ATmega328P at U3 has no 100 nF decoupling capacitor within 5 mm of its VCC pin. Place a 0.1 µF X7R cap between VCC and GND to suppress switching noise.",
  confidence: 0.92,
  category: "missing_component",
  action: {
    type: "add_component",
    payload: { partNumber: "C0603C104K", value: "100nF", net: "VCC" },
  },
  dismissed: false,
};

const seriesResistor: Prediction = {
  id: "pred-led-resistor",
  ruleId: "led-current-limit",
  title: "Current-limit resistor missing on D1",
  description:
    "LED D1 connects directly between GPIO13 and GND with no series resistor. At 5 V this exceeds the forward current rating. Add a 330 Ω resistor in series.",
  confidence: 0.78,
  category: "safety",
  action: {
    type: "add_component",
    payload: { partNumber: "RC0603FR-07330R", value: "330R" },
  },
  dismissed: false,
};

export function MissingComponent() {
  return (
    <Surface>
      <PredictionCard prediction={missingDecoupling} onAccept={noop} onDismiss={noop} />
    </Surface>
  );
}

export function SafetyWarning() {
  return (
    <Surface>
      <PredictionCard prediction={seriesResistor} onAccept={noop} onDismiss={noop} />
    </Surface>
  );
}
