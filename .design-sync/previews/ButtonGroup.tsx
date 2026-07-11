import type { ReactNode } from "react";
import {
  ButtonGroup,
  ButtonGroupText,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize, Grid3x3, Ruler } from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>
    {children}
  </div>
);

export function CanvasToolbar() {
  return (
    <Surface>
      <ButtonGroup>
        <Button variant="outline" size="icon" aria-label="Zoom in">
          <ZoomIn />
        </Button>
        <Button variant="outline" size="icon" aria-label="Zoom out">
          <ZoomOut />
        </Button>
        <Button variant="outline" size="icon" aria-label="Fit to screen">
          <Maximize />
        </Button>
        <ButtonGroupSeparator />
        <Button variant="outline" size="icon" aria-label="Toggle grid">
          <Grid3x3 />
        </Button>
      </ButtonGroup>
    </Surface>
  );
}

export function LayerSelector() {
  return (
    <Surface>
      <ButtonGroup>
        <ButtonGroupText>
          <Ruler />
          Layer
        </ButtonGroupText>
        <Button variant="outline">Top Copper</Button>
        <Button variant="outline">Bottom Copper</Button>
        <Button variant="secondary">Silkscreen</Button>
      </ButtonGroup>
    </Surface>
  );
}

export function Vertical() {
  return (
    <Surface>
      <ButtonGroup orientation="vertical">
        <Button variant="outline">Route Trace</Button>
        <Button variant="outline">Place Via</Button>
        <Button variant="outline">Add Net Label</Button>
      </ButtonGroup>
    </Surface>
  );
}
