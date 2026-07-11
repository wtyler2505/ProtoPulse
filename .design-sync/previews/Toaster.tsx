import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 460 }}>
    {children}
  </div>
);

export function ToastRegion() {
  return (
    <Surface>
      <p className="mb-2 text-sm text-muted-foreground">
        Global sonner toast region. Mounted once near the app root; toasts fired
        from anywhere (DRC results, save confirmations, upload status) render
        into this portal.
      </p>
      <Toaster />
    </Surface>
  );
}

export function TopRightPlacement() {
  return (
    <Surface>
      <p className="mb-2 text-sm text-muted-foreground">
        Region pinned to the top-right corner — used while the bottom toolbar
        holds the simulation transport controls.
      </p>
      <Toaster position="top-right" richColors />
    </Surface>
  );
}
