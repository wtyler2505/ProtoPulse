import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>{children}</div>
);

export function Variants() {
  return (
    <Surface>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Badge>Verified</Badge>
        <Badge variant="secondary">Draft</Badge>
        <Badge variant="destructive">DRC error</Badge>
        <Badge variant="outline">v2.1.0</Badge>
      </div>
    </Surface>
  );
}

export function StatusLabels() {
  return (
    <Surface>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Badge>In stock</Badge>
        <Badge variant="secondary">Through-hole</Badge>
        <Badge variant="destructive">EOL</Badge>
        <Badge variant="outline">SMD 0603</Badge>
        <Badge variant="outline">3.3V</Badge>
      </div>
    </Surface>
  );
}
