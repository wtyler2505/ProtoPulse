import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>
    {children}
  </div>
);

export function CompilingFirmware() {
  return (
    <Surface>
      <div className="flex items-center gap-2 text-sm">
        <Spinner />
        <span>Compiling firmware for ESP32-S3…</span>
      </div>
    </Surface>
  );
}

export function RunningDrc() {
  return (
    <Surface>
      <div className="flex items-center gap-3 rounded-md border border-border bg-card/40 px-4 py-3">
        <Spinner className="size-5 text-primary" />
        <div className="text-sm">
          <div className="font-medium">Running Design Rule Check</div>
          <div className="text-xs text-muted-foreground">
            Checking clearance &amp; connectivity…
          </div>
        </div>
      </div>
    </Surface>
  );
}

export function Sizes() {
  return (
    <Surface>
      <div className="flex items-center gap-6">
        <Spinner className="size-4" />
        <Spinner className="size-6 text-primary" />
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    </Surface>
  );
}
