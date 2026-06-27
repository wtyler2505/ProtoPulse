import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>
    {children}
  </div>
);

export function States() {
  return (
    <Surface>
      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox defaultChecked />
          In Stock
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox />
          ESD Sensitive
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox disabled />
          Obsolete (locked)
        </label>
      </div>
    </Surface>
  );
}

export function DrcRuleList() {
  return (
    <Surface>
      <div className="space-y-3 text-sm">
        <div className="font-medium">DRC rules to run</div>
        <label className="flex items-center gap-2">
          <Checkbox defaultChecked />
          Minimum trace clearance (6 mil)
        </label>
        <label className="flex items-center gap-2">
          <Checkbox defaultChecked />
          Annular ring &ge; 5 mil
        </label>
        <label className="flex items-center gap-2">
          <Checkbox />
          Copper-to-edge keepout
        </label>
        <label className="flex items-center gap-2">
          <Checkbox defaultChecked />
          Unconnected nets
        </label>
      </div>
    </Surface>
  );
}
