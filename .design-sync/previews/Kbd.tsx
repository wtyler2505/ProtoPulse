import type { ReactNode } from "react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 420 }}>
    {children}
  </div>
);

export function EditorShortcuts() {
  return (
    <Surface>
      <div style={{ display: "grid", gap: 12 }}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Run ERC</span>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>E</Kbd>
          </KbdGroup>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Add wire</span>
          <Kbd>W</Kbd>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Fit to schematic</span>
          <KbdGroup>
            <Kbd>Shift</Kbd>
            <Kbd>F</Kbd>
          </KbdGroup>
        </div>
      </div>
    </Surface>
  );
}

export function CommandHint() {
  return (
    <Surface>
      <p className="text-sm text-muted-foreground">
        Press{" "}
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>{" "}
        to open the part palette.
      </p>
    </Surface>
  );
}
