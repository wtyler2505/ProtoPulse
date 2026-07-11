import type { ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { Copy, Trash2, RotateCw, Lock, FlipHorizontal2 } from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, minHeight: 200 }}>
    {children}
  </div>
);

// ContextMenu (Radix) opens on right-click and has no `open`/`defaultOpen` prop,
// so the card shows the canvas trigger; the menu composition appears on right-click.
export function CanvasContextMenu() {
  return (
    <Surface>
      <ContextMenu>
        <ContextMenuTrigger className="flex h-32 w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          Right-click the schematic canvas
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuLabel>Component U3 (ATmega328P)</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem>
            <Copy />
            Duplicate
            <ContextMenuShortcut>⌘D</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <RotateCw />
            Rotate 90°
            <ContextMenuShortcut>R</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <FlipHorizontal2 />
            Mirror
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Assign to net</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              <ContextMenuItem>+3V3 rail</ContextMenuItem>
              <ContextMenuItem>+5V rail</ContextMenuItem>
              <ContextMenuItem>GND</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem className="text-destructive">
            <Trash2 />
            Delete component
            <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </Surface>
  );
}

export function LayerOptionsMenu() {
  return (
    <Surface>
      <ContextMenu>
        <ContextMenuTrigger className="flex h-32 w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          Right-click for layer options
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuLabel>Visible layers</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuCheckboxItem checked>Top copper (F.Cu)</ContextMenuCheckboxItem>
          <ContextMenuCheckboxItem checked>Bottom copper (B.Cu)</ContextMenuCheckboxItem>
          <ContextMenuCheckboxItem>Silkscreen (F.SilkS)</ContextMenuCheckboxItem>
          <ContextMenuSeparator />
          <ContextMenuLabel>Active layer</ContextMenuLabel>
          <ContextMenuRadioGroup value="f-cu">
            <ContextMenuRadioItem value="f-cu">Top copper</ContextMenuRadioItem>
            <ContextMenuRadioItem value="b-cu">Bottom copper</ContextMenuRadioItem>
          </ContextMenuRadioGroup>
          <ContextMenuSeparator />
          <ContextMenuItem>
            <Lock />
            Lock all traces
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </Surface>
  );
}
