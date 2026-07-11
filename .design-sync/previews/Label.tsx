import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 420 }}>
    {children}
  </div>
);

export function FieldLabel() {
  return (
    <Surface>
      <div style={{ display: "grid", gap: 6 }}>
        <Label htmlFor="mpn">Manufacturer part number</Label>
        <Input id="mpn" placeholder="e.g. ESP32-WROOM-32E" />
      </div>
    </Surface>
  );
}

export function CheckboxLabel() {
  return (
    <Surface>
      <div className="flex items-center gap-2">
        <Checkbox id="drc" defaultChecked />
        <Label htmlFor="drc">Run DRC before export</Label>
      </div>
    </Surface>
  );
}
