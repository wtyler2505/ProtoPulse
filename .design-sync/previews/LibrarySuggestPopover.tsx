import type { ReactNode } from "react";
import { LibrarySuggestPopover } from "@/components/ui/LibrarySuggestPopover";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{ padding: 24, position: "relative", minHeight: 280, minWidth: 360 }}
  >
    {children}
  </div>
);

export function ResistorMatch() {
  return (
    <Surface>
      <LibrarySuggestPopover
        nodeLabel="resistor"
        nodeType="resistor"
        anchorPosition={{ x: 40, y: 40 }}
        onAddToBom={() => undefined}
        onDismiss={() => undefined}
      />
    </Surface>
  );
}

export function LedMatch() {
  return (
    <Surface>
      <LibrarySuggestPopover
        nodeLabel="LED"
        nodeType="led"
        anchorPosition={{ x: 40, y: 40 }}
        onAddToBom={() => undefined}
        onDismiss={() => undefined}
      />
    </Surface>
  );
}
