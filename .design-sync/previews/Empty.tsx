import type { ReactNode } from "react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { PackageOpen, CircuitBoard, Plus } from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, minHeight: 320 }}>
    {children}
  </div>
);

export function EmptyBom() {
  return (
    <Surface>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageOpen />
          </EmptyMedia>
          <EmptyTitle>No components yet</EmptyTitle>
          <EmptyDescription>
            Your bill of materials is empty. Place parts on the schematic and they
            will be collected here automatically.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button>
            <Plus />
            Add component
          </Button>
        </EmptyContent>
      </Empty>
    </Surface>
  );
}

export function NoBoardOutline() {
  return (
    <Surface>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircuitBoard />
          </EmptyMedia>
          <EmptyTitle>No board outline defined</EmptyTitle>
          <EmptyDescription>
            Draw a board edge or import a DXF to start placing components on the PCB.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline">Draw outline</Button>
          <Button variant="ghost">Import DXF</Button>
        </EmptyContent>
      </Empty>
    </Surface>
  );
}
