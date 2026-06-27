import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>
    {children}
  </div>
);

export function LayerVisibility() {
  return (
    <Surface>
      <div className="w-64 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span>Top copper</span>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <span>Bottom copper</span>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <span>Silkscreen</span>
          <Switch />
        </div>
        <div className="flex items-center justify-between">
          <span>Ratsnest</span>
          <Switch defaultChecked />
        </div>
      </div>
    </Surface>
  );
}

export function SimOptions() {
  return (
    <Surface>
      <div className="w-64 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span>Transient analysis</span>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <span>Show probe values</span>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Monte Carlo sweep</span>
          <Switch disabled />
        </div>
      </div>
    </Surface>
  );
}
