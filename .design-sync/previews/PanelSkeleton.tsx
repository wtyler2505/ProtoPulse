import type { ReactNode } from "react";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{ padding: 16, width: 380, height: 320 }}
  >
    {children}
  </div>
);

export function BomPanelLoading() {
  return (
    <Surface>
      <PanelSkeleton rows={5} />
    </Surface>
  );
}

export function PartsListLoading() {
  return (
    <Surface>
      <PanelSkeleton rows={3} />
    </Surface>
  );
}
