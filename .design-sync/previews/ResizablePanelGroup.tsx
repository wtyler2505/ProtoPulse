import type { ReactNode } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground overflow-hidden rounded-md border border-border"
    style={{ width: 720, height: 360 }}
  >
    {children}
  </div>
);

export function EditorLayout() {
  return (
    <Surface>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={22}>
          <div className="flex h-full flex-col gap-2 p-3 text-xs">
            <div className="font-semibold">Components</div>
            <div className="text-muted-foreground">U1 · ESP32-S3</div>
            <div className="text-muted-foreground">U2 · AMS1117</div>
            <div className="text-muted-foreground">J1 · USB-C</div>
            <div className="text-muted-foreground">Y1 · 40 MHz xtal</div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={53}>
          <div className="flex h-full items-center justify-center p-3 text-sm text-muted-foreground">
            Schematic canvas
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={25}>
          <div className="flex h-full flex-col gap-2 p-3 text-xs">
            <div className="font-semibold">Inspector</div>
            <div className="text-muted-foreground">Ref: U1</div>
            <div className="text-muted-foreground">Footprint: QFN-56</div>
            <div className="text-muted-foreground">Net: +3V3</div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </Surface>
  );
}

export function CanvasAndConsole() {
  return (
    <Surface>
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel defaultSize={68}>
          <div className="flex h-full items-center justify-center p-3 text-sm text-muted-foreground">
            PCB layout — 4 layers
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={32}>
          <div className="flex h-full flex-col gap-1 p-3 font-mono text-xs">
            <div className="font-semibold">DRC console</div>
            <div className="text-amber-400">warning: silkscreen over pad R7</div>
            <div className="text-muted-foreground">info: 256 nets, 184 routed</div>
            <div className="text-emerald-400">0 unrouted on power nets</div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </Surface>
  );
}
