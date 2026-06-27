import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, minHeight: 360 }}>
    {children}
  </div>
);

export function ExportGerbers() {
  return (
    <Surface>
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Gerber files</DialogTitle>
            <DialogDescription>
              Generate RS-274X Gerbers and an Excellon drill file for fabrication.
              The 2-layer stackup will be bundled as a single ZIP archive.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label htmlFor="archive">Archive name</Label>
              <Input id="archive" defaultValue="protopulse-v2-rev-c.zip" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label htmlFor="units">Coordinate units</Label>
              <Input id="units" defaultValue="Millimeters (4.6 precision)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline">Cancel</Button>
            <Button>Export ZIP</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Surface>
  );
}

export function NewProject() {
  return (
    <Surface>
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New design</DialogTitle>
            <DialogDescription>
              Start a blank schematic. You can add a board outline and switch to the
              PCB editor at any time.
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Label htmlFor="proj">Project name</Label>
            <Input id="proj" placeholder="e.g. ESP32 Sensor Hub" defaultValue="ATmega Blink Demo" />
          </div>
          <DialogFooter>
            <Button variant="ghost">Cancel</Button>
            <Button>Create design</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Surface>
  );
}
