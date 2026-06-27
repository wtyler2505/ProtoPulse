import type { ReactNode } from "react";
import SmartHintToast from "@/components/ui/SmartHintToast";
import { SmartHintManager } from "@/lib/smart-hints";

// Seed the singleton manager so the toast has an active hint to render.
// "circuit-no-ground" has threshold 2 -> two tracks activate the warning hint.
if (typeof window !== "undefined") {
  const manager = SmartHintManager.getInstance();
  manager.clearAll();
  manager.trackMistake("circuit-no-ground");
  manager.trackMistake("circuit-no-ground");
}

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{ padding: 24, minHeight: 220, position: "relative" }}
  >
    {children}
  </div>
);

export function GroundWarning() {
  return (
    <Surface>
      <p className="text-xs text-muted-foreground">
        Contextual hint surfaced after repeated mistakes:
      </p>
      <SmartHintToast />
    </Surface>
  );
}

export function HintInContext() {
  return (
    <Surface>
      <div className="w-72 rounded-md border border-border bg-card/40 p-4 text-sm">
        <div className="font-semibold">Schematic · 9V Regulator</div>
        <div className="mt-1 text-xs text-muted-foreground">
          12 nodes · no GND net detected
        </div>
      </div>
      <SmartHintToast />
    </Surface>
  );
}
