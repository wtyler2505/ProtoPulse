import type { ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 380 }}>{children}</div>
);

export function PartCard() {
  return (
    <Surface>
      <Card>
        <CardHeader>
          <CardTitle>ATmega328P</CardTitle>
          <CardDescription>8-bit AVR microcontroller · 28-pin DIP</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge>In stock</Badge>
            <Badge variant="outline">5V</Badge>
            <Badge variant="secondary">32 KB flash</Badge>
          </div>
        </CardContent>
        <CardFooter style={{ display: "flex", gap: 8 }}>
          <Button size="sm">Add to BOM</Button>
          <Button size="sm" variant="outline">Datasheet</Button>
        </CardFooter>
      </Card>
    </Surface>
  );
}

export function Simple() {
  return (
    <Surface>
      <Card>
        <CardHeader>
          <CardTitle>Project budget</CardTitle>
          <CardDescription>Estimated BOM cost across 3 vendors</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ fontSize: 32, fontWeight: 600 }} className="font-display">$48.20</div>
        </CardContent>
      </Card>
    </Surface>
  );
}
