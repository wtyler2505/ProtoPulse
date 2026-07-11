import type { ReactNode } from "react";
import RolePresetSelector from "@/components/ui/RolePresetSelector";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>
    {children}
  </div>
);

export function WorkspaceRole() {
  return (
    <Surface>
      <div className="space-y-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Experience level
        </span>
        <RolePresetSelector />
      </div>
    </Surface>
  );
}

export function ToolbarRolePicker() {
  return (
    <Surface>
      <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-card/60 px-3 py-2">
        <span className="text-sm font-medium">SMPS Reference Design</span>
        <RolePresetSelector />
      </div>
    </Surface>
  );
}
