import type { ReactNode } from "react";
import ViewOnboardingHint from "@/components/ui/ViewOnboardingHint";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 520 }}>
    {children}
  </div>
);

export function SchematicHint() {
  return (
    <Surface>
      <ViewOnboardingHint viewName="schematic" />
    </Surface>
  );
}

export function PcbHint() {
  return (
    <Surface>
      <ViewOnboardingHint viewName="pcb" />
    </Surface>
  );
}

export function SimulationHint() {
  return (
    <Surface>
      <ViewOnboardingHint viewName="simulation" />
    </Surface>
  );
}

export function BreadboardHint() {
  return (
    <Surface>
      <ViewOnboardingHint viewName="breadboard" />
    </Surface>
  );
}
