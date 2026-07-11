import type { ReactNode } from "react";
import FeatureMaturityBadge from "@/components/ui/FeatureMaturityBadge";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>
    {children}
  </div>
);

export function AllStages() {
  return (
    <Surface>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <FeatureMaturityBadge maturity="ready" />
        <FeatureMaturityBadge maturity="setup_required" />
        <FeatureMaturityBadge maturity="experimental" />
        <FeatureMaturityBadge maturity="advanced" />
      </div>
    </Surface>
  );
}

export function OnFeatureRows() {
  return (
    <Surface>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="text-sm">Schematic editor</span>
          <FeatureMaturityBadge maturity="ready" />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="text-sm">SPICE co-simulation</span>
          <FeatureMaturityBadge maturity="setup_required" />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="text-sm">ESP32-S3 emulator</span>
          <FeatureMaturityBadge maturity="experimental" />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="text-sm">Autorouter</span>
          <FeatureMaturityBadge maturity="advanced" label="Pro" />
        </div>
      </div>
    </Surface>
  );
}
