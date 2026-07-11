import type { ReactNode } from "react";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{ padding: 24, minHeight: 280, display: "flex", justifyContent: "center" }}
  >
    {children}
  </div>
);

export function EditorViews() {
  return (
    <Surface>
      <NavigationMenu defaultValue="design">
        <NavigationMenuList>
          <NavigationMenuItem value="design">
            <NavigationMenuTrigger>Design</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[420px] gap-1 p-3 md:grid-cols-2">
                <li>
                  <NavigationMenuLink className="block rounded-md p-2 text-sm hover:bg-accent">
                    <div className="font-medium">Schematic</div>
                    <p className="text-xs text-muted-foreground">
                      Capture nets, symbols, and reference designators.
                    </p>
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink className="block rounded-md p-2 text-sm hover:bg-accent">
                    <div className="font-medium">PCB Layout</div>
                    <p className="text-xs text-muted-foreground">
                      Place footprints and route copper across layers.
                    </p>
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink className="block rounded-md p-2 text-sm hover:bg-accent">
                    <div className="font-medium">Breadboard</div>
                    <p className="text-xs text-muted-foreground">
                      Prototype on a virtual bench before fabrication.
                    </p>
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink className="block rounded-md p-2 text-sm hover:bg-accent">
                    <div className="font-medium">3D Viewer</div>
                    <p className="text-xs text-muted-foreground">
                      Inspect the populated board in photoreal FR4.
                    </p>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Manufacture</NavigationMenuTrigger>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>
              Simulate
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </Surface>
  );
}

export function ExportMenu() {
  return (
    <Surface>
      <NavigationMenu defaultValue="export">
        <NavigationMenuList>
          <NavigationMenuItem value="export">
            <NavigationMenuTrigger>Export</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[300px] gap-1 p-3">
                <li>
                  <NavigationMenuLink className="block rounded-md p-2 text-sm hover:bg-accent">
                    <div className="font-medium">Gerber + Drill (.zip)</div>
                    <p className="text-xs text-muted-foreground">
                      RS-274X with Excellon drill files.
                    </p>
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink className="block rounded-md p-2 text-sm hover:bg-accent">
                    <div className="font-medium">Bill of Materials (.csv)</div>
                    <p className="text-xs text-muted-foreground">
                      Grouped by MPN with stock and pricing.
                    </p>
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink className="block rounded-md p-2 text-sm hover:bg-accent">
                    <div className="font-medium">Pick &amp; Place (.pos)</div>
                    <p className="text-xs text-muted-foreground">
                      Centroid data for automated assembly.
                    </p>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </Surface>
  );
}
