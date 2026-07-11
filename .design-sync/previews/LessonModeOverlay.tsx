import type { ReactNode } from "react";
import LessonModeOverlay from "@/components/ui/LessonModeOverlay";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{ padding: 24, position: "relative", minHeight: 220, minWidth: 360 }}
  >
    {children}
  </div>
);

export function Active() {
  return (
    <Surface>
      <div className="rounded-md border border-border bg-card p-4 text-sm">
        <p className="font-medium">Guided lesson: Blink an LED</p>
        <p className="mt-1 text-muted-foreground">
          Only the highlighted controls are interactive while the lesson is
          running.
        </p>
      </div>
      <LessonModeOverlay />
    </Surface>
  );
}

export function StepContext() {
  return (
    <Surface>
      <div className="rounded-md border border-border bg-card p-4 text-sm">
        <p className="font-medium">Step 2 of 5 - Wire pin 13 to the LED</p>
        <p className="mt-1 text-muted-foreground">
          Drag from D13 on the Arduino Uno to the anode of the LED on the
          breadboard.
        </p>
      </div>
      <LessonModeOverlay />
    </Surface>
  );
}
