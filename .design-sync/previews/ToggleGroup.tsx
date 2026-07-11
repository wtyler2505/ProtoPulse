import type { ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AlignStartVertical, AlignCenterVertical, AlignEndVertical } from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 460 }}>
    {children}
  </div>
);

export function LayerSelect() {
  return (
    <Surface>
      <label className="mb-2 block text-sm font-medium">Active copper layer</label>
      <ToggleGroup type="single" defaultValue="top" variant="outline">
        <ToggleGroupItem value="top">F.Cu</ToggleGroupItem>
        <ToggleGroupItem value="in1">In1.Cu</ToggleGroupItem>
        <ToggleGroupItem value="in2">In2.Cu</ToggleGroupItem>
        <ToggleGroupItem value="bottom">B.Cu</ToggleGroupItem>
      </ToggleGroup>
    </Surface>
  );
}

export function VisibilityLayers() {
  return (
    <Surface>
      <label className="mb-2 block text-sm font-medium">Visible layers</label>
      <ToggleGroup type="multiple" defaultValue={["copper", "silk"]} variant="outline">
        <ToggleGroupItem value="copper">Copper</ToggleGroupItem>
        <ToggleGroupItem value="silk">Silkscreen</ToggleGroupItem>
        <ToggleGroupItem value="mask">Soldermask</ToggleGroupItem>
        <ToggleGroupItem value="drill">Drill</ToggleGroupItem>
      </ToggleGroup>
    </Surface>
  );
}

export function SymbolAlign() {
  return (
    <Surface>
      <label className="mb-2 block text-sm font-medium">Align selected pins</label>
      <ToggleGroup type="single" defaultValue="center">
        <ToggleGroupItem value="left" aria-label="Align left">
          <AlignStartVertical />
        </ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="Align center">
          <AlignCenterVertical />
        </ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="Align right">
          <AlignEndVertical />
        </ToggleGroupItem>
      </ToggleGroup>
    </Surface>
  );
}
