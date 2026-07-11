import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Cpu, Search, TriangleAlert } from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, minHeight: 280 }}>
    {children}
  </div>
);

export function NoParts() {
  return (
    <Surface>
      <EmptyState
        icon={Cpu}
        title="No parts in your library"
        description="Import a KiCad library or search the catalog to add microcontrollers, sensors, and passives to your project."
        actionLabel="Browse catalog"
        onAction={() => {}}
      />
    </Surface>
  );
}

export function NoSearchResults() {
  return (
    <Surface>
      <EmptyState
        icon={Search}
        title="No matching footprints"
        description="No SMD 0603 resistors matched your filters. Try widening the tolerance range or clearing the manufacturer filter."
      />
    </Surface>
  );
}

export function NoErcViolations() {
  return (
    <Surface>
      <EmptyState
        icon={TriangleAlert}
        title="No ERC violations"
        description="The electrical rule check passed cleanly. All nets are driven, no pins are left floating, and power flags are satisfied."
        actionLabel="Re-run ERC"
        onAction={() => {}}
      />
    </Surface>
  );
}
