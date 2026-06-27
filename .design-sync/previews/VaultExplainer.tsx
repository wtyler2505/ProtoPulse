import type { ReactNode } from "react";
import { VaultExplainer } from "@/components/ui/vault-explainer";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 460 }}>
    {children}
  </div>
);

export function DrcRowExplainer() {
  return (
    <Surface>
      <VaultExplainer
        slug="drc-should-flag-direct-gpio-to-inductive-load-connections-and-suggest-driver-plus-flyback-subcircuit"
        tier="beginner"
        defaultOpen
      >
        Why is this DRC error wrong?
      </VaultExplainer>
    </Surface>
  );
}

export function StrappingPinExplainer() {
  return (
    <Surface>
      <VaultExplainer
        slug="esp32-gpio12-must-be-low-at-boot-or-module-crashes"
        tier="intermediate"
        defaultOpen
      >
        About GPIO12 strapping
      </VaultExplainer>
    </Surface>
  );
}

export function CollapsedFieldHelp() {
  return (
    <Surface>
      <VaultExplainer slug="resistor-divider-output-impedance-affects-adc-sampling-accuracy">
        Learn more about divider impedance
      </VaultExplainer>
    </Surface>
  );
}
