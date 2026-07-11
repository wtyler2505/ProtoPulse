import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FileDown, Copy, Trash2, Settings, CircuitBoard } from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, minHeight: 360 }}>
    {children}
  </div>
);

export function DesignActions() {
  return (
    <Surface>
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Design actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>protopulse-v2-rev-c</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Copy />
            Duplicate design
            <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileDown />
              Export
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Gerber + drill (ZIP)</DropdownMenuItem>
              <DropdownMenuItem>BOM (CSV)</DropdownMenuItem>
              <DropdownMenuItem>Netlist (KiCad)</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem>
            <Settings />
            Board settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            <Trash2 />
            Delete design
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Surface>
  );
}

export function ViewToggles() {
  return (
    <Surface>
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <CircuitBoard />
            View
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Overlays</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked>Show ratsnest</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked>Show net labels</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem>Show DRC markers</DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Grid spacing</DropdownMenuLabel>
          <DropdownMenuRadioGroup value="100mil">
            <DropdownMenuRadioItem value="50mil">50 mil</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="100mil">100 mil</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="1mm">1 mm</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </Surface>
  );
}
