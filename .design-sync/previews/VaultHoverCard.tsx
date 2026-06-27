import type { ReactNode } from "react";
import { VaultHoverCard } from "@/components/ui/vault-hover-card";
import { BookOpen } from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{ padding: 48, maxWidth: 460, display: "flex", justifyContent: "center" }}
  >
    {children}
  </div>
);

export function BoardPinHover() {
  return (
    <Surface>
      <VaultHoverCard slug="esp32-gpio12-must-be-low-at-boot-or-module-crashes">
        <button type="button" className="rounded-md border border-input px-3 py-1.5 text-sm">
          GPIO12
        </button>
      </VaultHoverCard>
    </Surface>
  );
}

export function NetLabelHover() {
  return (
    <Surface>
      <VaultHoverCard topic="i2c-pull-up-resistor-sizing">
        <span className="inline-flex cursor-help items-center gap-1 text-sm text-primary">
          <BookOpen className="h-3.5 w-3.5" />
          SDA / SCL pull-ups
        </span>
      </VaultHoverCard>
    </Surface>
  );
}
