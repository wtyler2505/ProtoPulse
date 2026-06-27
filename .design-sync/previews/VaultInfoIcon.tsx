import type { ReactNode } from "react";
import { VaultInfoIcon } from "@/components/ui/vault-info-icon";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 460 }}>
    {children}
  </div>
);

export function PinFieldIcon() {
  return (
    <Surface>
      <label className="inline-flex items-center gap-1.5 text-sm font-medium">
        GPIO12
        <VaultInfoIcon
          slug="esp32-gpio12-must-be-low-at-boot-or-module-crashes"
          testId="gpio12-vault-info"
          ariaLabel="About ESP32 GPIO12 strapping pin"
        />
      </label>
    </Surface>
  );
}

export function TopicDrivenIcon() {
  return (
    <Surface>
      <label className="inline-flex items-center gap-1.5 text-sm font-medium">
        Decoupling capacitor
        <VaultInfoIcon
          topic="decoupling-capacitor-placement"
          testId="decoupling-vault-info"
          ariaLabel="About decoupling capacitor placement"
        />
      </label>
    </Surface>
  );
}
