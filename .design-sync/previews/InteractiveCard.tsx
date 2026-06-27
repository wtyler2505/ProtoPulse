import type { ReactNode } from "react";
import { Cpu, CircuitBoard } from "lucide-react";
import { InteractiveCard } from "@/components/ui/interactive-card";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 420 }}>
    {children}
  </div>
);

export function PartTile() {
  return (
    <Surface>
      <InteractiveCard className="rounded-lg border border-border bg-card p-4 hover:border-primary/60">
        <div className="flex items-start gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-muted">
            <Cpu className="size-5 text-primary" />
          </span>
          <div>
            <div className="text-sm font-medium">ESP32-WROOM-32</div>
            <p className="text-xs text-muted-foreground">
              Wi-Fi + BLE module, 38-pin. Click to add to schematic.
            </p>
          </div>
        </div>
      </InteractiveCard>
    </Surface>
  );
}

export function ProjectShelf() {
  return (
    <Surface>
      <div style={{ display: "grid", gap: 10 }}>
        <InteractiveCard className="rounded-lg border border-border bg-card p-4 hover:border-primary/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CircuitBoard className="size-5 text-primary" />
              <span className="text-sm font-medium">Line-follower robot</span>
            </div>
            <span className="text-xs text-muted-foreground">12 parts</span>
          </div>
        </InteractiveCard>
        <InteractiveCard className="rounded-lg border border-border bg-card p-4 hover:border-primary/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CircuitBoard className="size-5 text-primary" />
              <span className="text-sm font-medium">555 LED blinker</span>
            </div>
            <span className="text-xs text-muted-foreground">6 parts</span>
          </div>
        </InteractiveCard>
      </div>
    </Surface>
  );
}
