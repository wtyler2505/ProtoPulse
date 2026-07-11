import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{ padding: 24, minHeight: 320 }}
  >
    {children}
  </div>
);

export function FootprintSelect() {
  return (
    <Surface>
      <Select defaultValue="0603" defaultOpen>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Select footprint" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>SMD Chip (imperial)</SelectLabel>
            <SelectItem value="0402">0402 (1.0 × 0.5 mm)</SelectItem>
            <SelectItem value="0603">0603 (1.6 × 0.8 mm)</SelectItem>
            <SelectItem value="0805">0805 (2.0 × 1.25 mm)</SelectItem>
            <SelectItem value="1206">1206 (3.2 × 1.6 mm)</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Through-hole</SelectLabel>
            <SelectItem value="tht-5mm">Radial 5.0 mm</SelectItem>
            <SelectItem value="axial-0.4">Axial 0.4"</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </Surface>
  );
}

export function McuBoardSelect() {
  return (
    <Surface>
      <Select defaultValue="uno" defaultOpen>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Target board" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>AVR</SelectLabel>
            <SelectItem value="uno">Arduino Uno R3</SelectItem>
            <SelectItem value="nano">Arduino Nano</SelectItem>
            <SelectItem value="mega">Arduino Mega 2560</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>ESP / RP</SelectLabel>
            <SelectItem value="esp32s3">ESP32-S3 DevKitC</SelectItem>
            <SelectItem value="pico">Raspberry Pi Pico</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </Surface>
  );
}
