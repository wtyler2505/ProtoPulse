import type { ReactNode } from "react";
import RadialMenu from "@/components/ui/RadialMenu";
import { getActionsForContext } from "@/lib/radial-menu-actions";

// RadialMenu renders with `position: fixed` at viewport coordinates and plays a
// mount-time scale/opacity entrance animation, so it escapes this Surface and
// overlays the page. The Surface gives the card a dark backdrop; the menu draws
// itself near the top-left of the viewport.
const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{ position: "relative", width: 480, height: 420 }}
  >
    {children}
  </div>
);

const noop = () => undefined;

export function SchematicActions() {
  const items = getActionsForContext({ view: "schematic", target: "node", targetLabel: "U1" });
  return (
    <Surface>
      <RadialMenu items={items} position={{ x: 240, y: 220 }} onClose={noop} onSelect={noop} />
    </Surface>
  );
}

export function PcbActions() {
  const items = getActionsForContext({ view: "pcb", target: "node", targetLabel: "R7" });
  return (
    <Surface>
      <RadialMenu items={items} position={{ x: 240, y: 220 }} onClose={noop} onSelect={noop} />
    </Surface>
  );
}
