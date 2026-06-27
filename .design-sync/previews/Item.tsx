import type { ReactNode } from "react";
import { Cpu, Zap, Gauge, ChevronRight } from "lucide-react";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
  ItemDescription,
} from "@/components/ui/item";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 460 }}>
    {children}
  </div>
);

export function BomRow() {
  return (
    <Surface>
      <Item variant="outline">
        <ItemMedia variant="icon">
          <Cpu />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            ATmega328P-PU
            <Badge variant="secondary">U1</Badge>
          </ItemTitle>
          <ItemDescription>
            8-bit AVR MCU - PDIP-28 - qty 1 - $2.14
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="ghost" size="icon">
            <ChevronRight />
          </Button>
        </ItemActions>
      </Item>
    </Surface>
  );
}

export function PartList() {
  return (
    <Surface>
      <ItemGroup className="rounded-lg border border-border">
        <Item>
          <ItemMedia variant="icon">
            <Zap />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>AMS1117-3.3</ItemTitle>
            <ItemDescription>LDO regulator - SOT-223 - 1 A</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge variant="outline">R2</Badge>
          </ItemActions>
        </Item>
        <ItemSeparator />
        <Item>
          <ItemMedia variant="icon">
            <Gauge />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>BME280</ItemTitle>
            <ItemDescription>
              Temp / humidity / pressure - I2C - LGA-8
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge variant="outline">U3</Badge>
          </ItemActions>
        </Item>
      </ItemGroup>
    </Surface>
  );
}
