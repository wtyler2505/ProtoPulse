import type { ReactNode } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Cpu, CircuitBoard } from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>
    {children}
  </div>
);

export function BoardThumbnail() {
  return (
    <Surface>
      <div style={{ width: 320 }}>
        <AspectRatio ratio={16 / 9}>
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted">
            <CircuitBoard className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium">PCB Preview — 2-layer</span>
            <span className="text-xs text-muted-foreground">50.8 &times; 27.9 mm</span>
          </div>
        </AspectRatio>
      </div>
    </Surface>
  );
}

export function FootprintSquare() {
  return (
    <Surface>
      <div style={{ width: 200 }}>
        <AspectRatio ratio={1}>
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-primary/40 bg-card">
            <Cpu className="h-7 w-7 text-muted-foreground" />
            <span className="text-xs font-medium">TQFP-32</span>
            <span className="text-[0.7rem] text-muted-foreground">7 &times; 7 mm</span>
          </div>
        </AspectRatio>
      </div>
    </Surface>
  );
}
