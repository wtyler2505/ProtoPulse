import type { ReactNode } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 480 }}>
    {children}
  </div>
);

export function ComponentProperties() {
  return (
    <Surface>
      <Accordion type="single" collapsible defaultValue="footprint" className="w-full">
        <AccordionItem value="electrical">
          <AccordionTrigger>Electrical Characteristics</AccordionTrigger>
          <AccordionContent>
            ATmega328P — operating voltage 1.8V–5.5V, 20 MHz max clock, 32 KB flash,
            2 KB SRAM. Absolute max VCC 6.0V.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="footprint">
          <AccordionTrigger>Footprint & Package</AccordionTrigger>
          <AccordionContent>
            TQFP-32 (7&times;7 mm), 0.8 mm pitch. Land pattern IPC-7351B nominal.
            Recommended SMD 0603 decoupling on each VCC/AVCC pin.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="pinout">
          <AccordionTrigger>Pinout</AccordionTrigger>
          <AccordionContent>
            32 pins: 23 GPIO, 6 ADC channels, dedicated AREF, dual VCC/GND, and the
            XTAL1/XTAL2 oscillator pair on pins 7 and 8.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Surface>
  );
}

export function DesignChecks() {
  return (
    <Surface>
      <Accordion type="multiple" defaultValue={["drc", "erc"]} className="w-full">
        <AccordionItem value="drc">
          <AccordionTrigger>DRC — 2 errors</AccordionTrigger>
          <AccordionContent>
            Trace-to-trace clearance 4.8 mil &lt; 6 mil rule on net 3V3. Silkscreen
            overlaps pad on U2.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="erc">
          <AccordionTrigger>ERC — 1 warning</AccordionTrigger>
          <AccordionContent>
            Net GND connected to a single pin — possible unrouted return path. Verify
            star-ground topology before fabrication.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="bom">
          <AccordionTrigger>BOM — all matched</AccordionTrigger>
          <AccordionContent>
            14 line items, 0 unmatched MPNs. Lowest stock: LCSC C25804 (10k 0603), 4,200 units.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Surface>
  );
}
