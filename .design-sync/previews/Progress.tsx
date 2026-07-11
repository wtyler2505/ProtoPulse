import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 420 }}>
    {children}
  </div>
);

export function AutoRouting() {
  return (
    <Surface>
      <div style={{ display: "grid", gap: 8 }}>
        <div className="flex items-center justify-between text-sm">
          <span>Auto-routing nets…</span>
          <span className="text-muted-foreground">72%</span>
        </div>
        <Progress value={72} />
        <p className="text-xs text-muted-foreground">184 of 256 nets routed</p>
      </div>
    </Surface>
  );
}

export function ReleaseReadiness() {
  return (
    <Surface>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div className="flex items-center justify-between text-xs">
            <span>DRC</span>
            <span className="text-muted-foreground">94%</span>
          </div>
          <Progress value={94} />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div className="flex items-center justify-between text-xs">
            <span>BOM completeness</span>
            <span className="text-muted-foreground">68%</span>
          </div>
          <Progress value={68} />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div className="flex items-center justify-between text-xs">
            <span>Manufacturing prep</span>
            <span className="text-muted-foreground">40%</span>
          </div>
          <Progress value={40} />
        </div>
      </div>
    </Surface>
  );
}
