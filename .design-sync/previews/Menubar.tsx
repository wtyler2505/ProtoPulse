import type { ReactNode } from "react";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from "@/components/ui/menubar";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{ padding: 24, minHeight: 320, minWidth: 480 }}
  >
    {children}
  </div>
);

export function FileMenu() {
  return (
    <Surface>
      <Menubar defaultValue="file">
        <MenubarMenu value="file">
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>
              New design <MenubarShortcut>Ctrl+N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem>
              Open .ppx... <MenubarShortcut>Ctrl+O</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarSub>
              <MenubarSubTrigger>Export</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem>Gerber (RS-274X)</MenubarItem>
                <MenubarItem>BOM (CSV)</MenubarItem>
                <MenubarItem>Netlist (KiCad)</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
            <MenubarSeparator />
            <MenubarItem>
              Save <MenubarShortcut>Ctrl+S</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu value="edit">
          <MenubarTrigger>Edit</MenubarTrigger>
        </MenubarMenu>
        <MenubarMenu value="view">
          <MenubarTrigger>View</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    </Surface>
  );
}

export function ViewMenu() {
  return (
    <Surface>
      <Menubar defaultValue="view">
        <MenubarMenu value="file">
          <MenubarTrigger>File</MenubarTrigger>
        </MenubarMenu>
        <MenubarMenu value="view">
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarCheckboxItem checked>Show ratsnest</MenubarCheckboxItem>
            <MenubarCheckboxItem>Show DRC overlay</MenubarCheckboxItem>
            <MenubarCheckboxItem checked>Snap to grid</MenubarCheckboxItem>
            <MenubarSeparator />
            <MenubarItem>
              Fit schematic <MenubarShortcut>Shift+F</MenubarShortcut>
            </MenubarItem>
            <MenubarItem>
              Zoom to selection <MenubarShortcut>Z</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </Surface>
  );
}
