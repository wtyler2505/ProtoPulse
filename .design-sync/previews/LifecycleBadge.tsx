import type { ReactNode } from "react";
import { LifecycleBadge } from "@/components/ui/LifecycleBadge";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 420 }}>
    {children}
  </div>
);

export function StatusBadges() {
  return (
    <Surface>
      <div style={{ display: "grid", gap: 12 }}>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono">NE555P</span>
          <LifecycleBadge partNumber="NE555P" status="nrnd" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono">UA741CP</span>
          <LifecycleBadge partNumber="UA741CP" status="obsolete" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono">ATmega16-16PU</span>
          <LifecycleBadge partNumber="ATmega16-16PU" status="eol" />
        </div>
      </div>
    </Surface>
  );
}

export function PreliminaryPart() {
  return (
    <Surface>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-mono">RP2350-QFN80</span>
        <LifecycleBadge partNumber="RP2350-QFN80" status="preliminary" />
      </div>
    </Surface>
  );
}
