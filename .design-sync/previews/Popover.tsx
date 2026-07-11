import type { ReactNode } from "react";
import { Settings2 } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{ padding: 48, minHeight: 320, display: "flex", justifyContent: "center" }}
  >
    {children}
  </div>
);

export function GridSettings() {
  return (
    <Surface>
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
            <Settings2 className="h-4 w-4" />
            Grid &amp; snap
          </button>
        </PopoverTrigger>
        <PopoverContent align="start">
          <div className="space-y-3">
            <div className="text-sm font-semibold">Grid &amp; snap</div>
            <div className="grid grid-cols-2 items-center gap-2 text-sm">
              <span className="text-muted-foreground">Spacing</span>
              <span>1.27 mm</span>
              <span className="text-muted-foreground">Snap</span>
              <span>Grid + pads</span>
              <span className="text-muted-foreground">Units</span>
              <span>Metric (mm)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Routing will snap to the nearest 0.05 mm increment.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </Surface>
  );
}

export function NetColorPicker() {
  return (
    <Surface>
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <button className="text-sm font-medium text-primary underline underline-offset-4">
            GND net color
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-64">
          <div className="space-y-3">
            <div className="text-sm font-semibold">Highlight color — GND</div>
            <div className="flex gap-2">
              {["#22c55e", "#38bdf8", "#eab308", "#f97316", "#ef4444"].map((c) => (
                <span
                  key={c}
                  className="h-7 w-7 rounded-md border border-border"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Applies to all 42 pins on the GND net.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </Surface>
  );
}
