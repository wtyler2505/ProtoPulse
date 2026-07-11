import type { ReactNode } from "react";
import { Bar, BarChart, Line, LineChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, width: 420 }}>
    {children}
  </div>
);

const railConfig = {
  voltage: { label: "Rail Voltage (V)", color: "hsl(142 71% 45%)" },
} satisfies ChartConfig;

const railData = [
  { rail: "1V8", voltage: 1.81 },
  { rail: "3V3", voltage: 3.29 },
  { rail: "5V", voltage: 4.98 },
  { rail: "12V", voltage: 12.04 },
];

export function RailVoltages() {
  return (
    <Surface>
      <ChartContainer config={railConfig} className="h-[200px] w-full">
        <BarChart data={railData}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="rail" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="voltage" fill="var(--color-voltage)" radius={4} />
        </BarChart>
      </ChartContainer>
    </Surface>
  );
}

const sweepConfig = {
  gain: { label: "Gain (dB)", color: "hsl(217 91% 60%)" },
  phase: { label: "Phase (°)", color: "hsl(38 92% 50%)" },
} satisfies ChartConfig;

const sweepData = [
  { freq: "10Hz", gain: 0.1, phase: -2 },
  { freq: "100Hz", gain: 0.0, phase: -8 },
  { freq: "1kHz", gain: -3.0, phase: -45 },
  { freq: "10kHz", gain: -20.1, phase: -84 },
  { freq: "100kHz", gain: -40.2, phase: -89 },
];

export function FrequencySweep() {
  return (
    <Surface>
      <ChartContainer config={sweepConfig} className="h-[200px] w-full">
        <LineChart data={sweepData}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="freq" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Line dataKey="gain" stroke="var(--color-gain)" strokeWidth={2} dot={false} />
          <Line dataKey="phase" stroke="var(--color-phase)" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartContainer>
    </Surface>
  );
}
