import type { ReactNode } from "react";
import { ProjectLoadingSkeleton } from "@/components/ui/ProjectLoadingSkeleton";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground overflow-hidden"
    style={{ width: 960, height: 540 }}
  >
    {children}
  </div>
);

export function FullEditorBoot() {
  return (
    <Surface>
      <ProjectLoadingSkeleton />
    </Surface>
  );
}
