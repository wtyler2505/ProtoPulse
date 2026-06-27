import type { ReactNode } from "react";
import MentionBadge from "@/components/ui/MentionBadge";
import { TooltipProvider } from "@/components/ui/tooltip";

const Surface = ({ children }: { children: ReactNode }) => (
  <TooltipProvider>
    <div className="bg-background text-foreground" style={{ padding: 24, display: "flex", justifyContent: "center" }}>
      {children}
    </div>
  </TooltipProvider>
);

export function Toolbar() {
  return (
    <Surface>
      <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-1.5">
        <span className="text-xs text-muted-foreground">Collaboration</span>
        <MentionBadge />
      </div>
    </Surface>
  );
}

export function HeaderSlot() {
  return (
    <Surface>
      <div className="flex w-full items-center justify-between gap-4 rounded-md border border-border bg-card px-3 py-2">
        <span className="text-sm font-medium">line-follower.ppx</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">2 collaborators</span>
          <MentionBadge />
        </div>
      </div>
    </Surface>
  );
}
