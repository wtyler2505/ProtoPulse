import type { ReactNode } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 520 }}>{children}</div>
);

export function Standard() {
  return (
    <Surface>
      <Alert>
        <AlertTitle>Simulation complete</AlertTitle>
        <AlertDescription>
          The transient analysis converged in 1,204 steps. Open the waveform viewer to inspect node voltages.
        </AlertDescription>
      </Alert>
    </Surface>
  );
}

export function Destructive() {
  return (
    <Surface>
      <Alert variant="destructive">
        <AlertTitle>DRC failed</AlertTitle>
        <AlertDescription>
          3 clearance violations on the top copper layer. Net GND overlaps VCC at (42.1, 18.7) mm.
        </AlertDescription>
      </Alert>
    </Surface>
  );
}
