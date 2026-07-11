import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 460 }}>
    {children}
  </div>
);

export function EditorViews() {
  return (
    <Surface>
      <Tabs defaultValue="schematic">
        <TabsList>
          <TabsTrigger value="schematic">Schematic</TabsTrigger>
          <TabsTrigger value="pcb">PCB Layout</TabsTrigger>
          <TabsTrigger value="bom">BOM</TabsTrigger>
        </TabsList>
        <TabsContent value="schematic">
          Drag components onto the canvas and draw wires to define your nets.
        </TabsContent>
        <TabsContent value="pcb">
          Place footprints and route copper traces, then run DRC.
        </TabsContent>
        <TabsContent value="bom">
          12 line items across 3 suppliers. 2 parts flagged NRND.
        </TabsContent>
      </Tabs>
    </Surface>
  );
}

export function SimulationModes() {
  return (
    <Surface>
      <Tabs defaultValue="transient">
        <TabsList>
          <TabsTrigger value="dc">DC Sweep</TabsTrigger>
          <TabsTrigger value="ac">AC Analysis</TabsTrigger>
          <TabsTrigger value="transient">Transient</TabsTrigger>
        </TabsList>
        <TabsContent value="dc">
          Step VIN from 0 V to 5 V; plot the regulated 3V3 rail.
        </TabsContent>
        <TabsContent value="ac">
          Bode plot of the RC low-pass filter, 10 Hz to 1 MHz.
        </TabsContent>
        <TabsContent value="transient">
          50 ms window: observe the 555 astable oscillating at 1 kHz.
        </TabsContent>
      </Tabs>
    </Surface>
  );
}

export function DisabledExportTab() {
  return (
    <Surface>
      <Tabs defaultValue="gerber">
        <TabsList>
          <TabsTrigger value="gerber">Gerber</TabsTrigger>
          <TabsTrigger value="kicad">KiCad</TabsTrigger>
          <TabsTrigger value="pickplace" disabled>
            Pick &amp; Place
          </TabsTrigger>
        </TabsList>
        <TabsContent value="gerber">
          RS-274X Gerber set ready: 6 copper layers, mask, silkscreen, drill.
        </TabsContent>
        <TabsContent value="kicad">
          Export a .kicad_sch + .kicad_pcb pair for round-tripping.
        </TabsContent>
      </Tabs>
    </Surface>
  );
}
