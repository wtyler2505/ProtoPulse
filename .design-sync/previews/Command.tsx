import type { ReactNode } from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Cpu,
  Search,
  Plus,
  Play,
  FileDown,
  Waypoints,
  Ruler,
  CircuitBoard,
} from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, minHeight: 360 }}>
    {children}
  </div>
);

export function CommandPalette() {
  return (
    <Surface>
      <Command className="rounded-lg border shadow-md" style={{ maxWidth: 460 }}>
        <CommandInput placeholder="Search components, nets, actions..." />
        <CommandList>
          <CommandEmpty>No matching commands.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem>
              <Play />
              <span>Run SPICE Simulation</span>
              <CommandShortcut>⌘R</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Plus />
              <span>Add Component</span>
              <CommandShortcut>⌘K</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <FileDown />
              <span>Export Gerbers</span>
              <CommandShortcut>⌘E</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Components">
            <CommandItem>
              <Cpu />
              <span>ATmega328P-PU</span>
            </CommandItem>
            <CommandItem>
              <CircuitBoard />
              <span>ESP32-WROOM-32E</span>
            </CommandItem>
            <CommandItem>
              <Waypoints />
              <span>LM7805 Voltage Regulator</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Surface>
  );
}

export function NetNavigator() {
  return (
    <Surface>
      <Command className="rounded-lg border shadow-md" style={{ maxWidth: 460 }}>
        <CommandInput placeholder="Jump to net..." />
        <CommandList>
          <CommandEmpty>No nets found.</CommandEmpty>
          <CommandGroup heading="Power Nets">
            <CommandItem>
              <Waypoints />
              <span>+3V3 rail</span>
              <CommandShortcut>14 pins</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Waypoints />
              <span>+5V rail</span>
              <CommandShortcut>9 pins</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Waypoints />
              <span>GND</span>
              <CommandShortcut>38 pins</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Signal Nets">
            <CommandItem>
              <Ruler />
              <span>SPI_SCK</span>
            </CommandItem>
            <CommandItem>
              <Ruler />
              <span>I2C_SDA</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Surface>
  );
}

export function EmptySearch() {
  return (
    <Surface>
      <Command className="rounded-lg border shadow-md" style={{ maxWidth: 460 }}>
        <CommandInput placeholder="Search parts library..." value="xqz-9000" />
        <CommandList>
          <CommandEmpty>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Search className="h-5 w-5 opacity-50" />
              <span>No parts match &ldquo;xqz-9000&rdquo;.</span>
            </div>
          </CommandEmpty>
        </CommandList>
      </Command>
    </Surface>
  );
}
