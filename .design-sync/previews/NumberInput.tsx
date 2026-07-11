import type { ReactNode } from "react";
import { NumberInput } from "@/components/ui/number-input";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 360 }}>
    {children}
  </div>
);

export function TraceWidth() {
  return (
    <Surface>
      <div style={{ display: "grid", gap: 6 }}>
        <label className="text-xs font-medium text-muted-foreground" htmlFor="tw">
          Trace width (mils)
        </label>
        <NumberInput id="tw" value={12} min={4} max={250} step={0.5} readOnly />
        <p className="text-xs text-muted-foreground">
          Minimum for this fab class is 6 mil.
        </p>
      </div>
    </Surface>
  );
}

export function ComponentValues() {
  return (
    <Surface>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="qty">
            BOM quantity
          </label>
          <NumberInput id="qty" value={48} min={1} max={5000} step={1} readOnly />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="via">
            Via drill (mm)
          </label>
          <NumberInput id="via" value={0.3} min={0.15} max={6.3} step={0.05} readOnly />
        </div>
      </div>
    </Surface>
  );
}
