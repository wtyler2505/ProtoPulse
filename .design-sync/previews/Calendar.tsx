import type { ReactNode } from "react";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>
    {children}
  </div>
);

export function FabRunDate() {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 5, 18));
  return (
    <Surface>
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        defaultMonth={new Date(2026, 5, 1)}
        className="rounded-md border"
      />
    </Surface>
  );
}

export function ProductionWindow() {
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({
    from: new Date(2026, 5, 10),
    to: new Date(2026, 5, 24),
  });
  return (
    <Surface>
      <Calendar
        mode="range"
        selected={range}
        onSelect={setRange}
        defaultMonth={new Date(2026, 5, 1)}
        numberOfMonths={1}
        className="rounded-md border"
      />
    </Surface>
  );
}
