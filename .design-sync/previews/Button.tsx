import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Rocket, Trash2, Plus, Download } from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>{children}</div>
);

export function Variants() {
  return (
    <Surface>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Button>Run Simulation</Button>
        <Button variant="secondary">Add Component</Button>
        <Button variant="destructive">Delete Net</Button>
        <Button variant="outline">Export BOM</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="link">View datasheet</Button>
      </div>
    </Surface>
  );
}

export function Sizes() {
  return (
    <Surface>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" aria-label="Add"><Plus /></Button>
      </div>
    </Surface>
  );
}

export function WithIcons() {
  return (
    <Surface>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Button><Rocket /> Deploy firmware</Button>
        <Button variant="outline"><Download /> Export Gerber</Button>
        <Button variant="destructive"><Trash2 /> Remove part</Button>
      </div>
    </Surface>
  );
}

export function States() {
  return (
    <Surface>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Button>Enabled</Button>
        <Button disabled>Disabled</Button>
        <Button variant="secondary" disabled>Disabled</Button>
      </div>
    </Surface>
  );
}
