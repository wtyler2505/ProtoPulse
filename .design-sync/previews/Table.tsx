import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>
    {children}
  </div>
);

export function BomTable() {
  const rows = [
    { ref: "U1", part: "ATmega328P-PU", value: "MCU", pkg: "PDIP-28", qty: 1 },
    { ref: "U2", part: "AMS1117-3.3", value: "LDO 3.3V", pkg: "SOT-223", qty: 1 },
    { ref: "C1–C4", part: "Ceramic", value: "100nF X7R", pkg: "0603", qty: 4 },
    { ref: "C5", part: "Electrolytic", value: "10µF 16V", pkg: "0805", qty: 1 },
    { ref: "R1", part: "Thick film", value: "10kΩ 1%", pkg: "0402", qty: 1 },
    { ref: "Y1", part: "Crystal", value: "16 MHz", pkg: "HC-49", qty: 1 },
  ];
  return (
    <Surface>
      <Table>
        <TableCaption>Bill of Materials — Blinky Shield v2</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Ref</TableHead>
            <TableHead>Part</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Footprint</TableHead>
            <TableHead className="text-right">Qty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.ref}>
              <TableCell className="font-mono text-primary">{r.ref}</TableCell>
              <TableCell>{r.part}</TableCell>
              <TableCell>{r.value}</TableCell>
              <TableCell className="text-muted-foreground">{r.pkg}</TableCell>
              <TableCell className="text-right">{r.qty}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4}>Total line items</TableCell>
            <TableCell className="text-right">9</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Surface>
  );
}

export function NetlistTable() {
  const nets = [
    { net: "+5V", nodes: "U1.7, U2.3, C1.1, J1.1", cls: "power" },
    { net: "+3V3", nodes: "U2.2, U3.9, C3.1", cls: "power" },
    { net: "GND", nodes: "U1.8, U1.22, U2.1, C1.2…", cls: "power" },
    { net: "SDA", nodes: "U1.27, U3.13", cls: "signal" },
    { net: "SCL", nodes: "U1.28, U3.12", cls: "signal" },
  ];
  return (
    <Surface>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Net</TableHead>
            <TableHead>Connected pins</TableHead>
            <TableHead className="text-right">Class</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {nets.map((n) => (
            <TableRow key={n.net}>
              <TableCell className="font-mono text-primary">{n.net}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {n.nodes}
              </TableCell>
              <TableCell className="text-right">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {n.cls}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Surface>
  );
}
