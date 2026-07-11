import type { ReactNode } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Grid3x3, Magnet, Eye, Ruler } from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 460 }}>
    {children}
  </div>
);

export function SnapToGrid() {
  return (
    <Surface>
      <Toggle aria-label="Snap to grid" defaultPressed>
        <Magnet />
        Snap to grid
      </Toggle>
    </Surface>
  );
}

export function CanvasOverlays() {
  return (
    <Surface>
      <div className="flex items-center gap-2">
        <Toggle variant="outline" aria-label="Show grid" defaultPressed>
          <Grid3x3 />
          Grid
        </Toggle>
        <Toggle variant="outline" aria-label="Show ratsnest">
          <Eye />
          Ratsnest
        </Toggle>
        <Toggle variant="outline" aria-label="Show dimensions">
          <Ruler />
          Dimensions
        </Toggle>
      </div>
    </Surface>
  );
}

export function Sizes() {
  return (
    <Surface>
      <div className="flex items-center gap-2">
        <Toggle size="sm" variant="outline" aria-label="Small">
          mil
        </Toggle>
        <Toggle size="default" variant="outline" aria-label="Default" defaultPressed>
          mm
        </Toggle>
        <Toggle size="lg" variant="outline" aria-label="Large">
          inch
        </Toggle>
      </div>
    </Surface>
  );
}
