import type { ReactNode } from "react";
import { Toast, ToastTitle, ToastDescription, ToastAction, ToastClose, ToastProvider, ToastViewport } from "@/components/ui/toast";

const Surface = ({ children }: { children: ReactNode }) => (
  <ToastProvider duration={1000000}>
    <div className="bg-background text-foreground" style={{ position: "relative", padding: 24, minHeight: 140, maxWidth: 460 }}>
      {children}
      <ToastViewport style={{ position: "absolute", bottom: 12, right: 12, top: "auto", display: "flex", flexDirection: "column", gap: 8, width: 380, maxWidth: "100%", margin: 0, listStyle: "none", padding: 0 }} />
    </div>
  </ToastProvider>
);

export function DrcPassed() {
  return (
    <Surface>
      <Toast variant="success" open>
        <div className="grid gap-1"><ToastTitle>DRC passed</ToastTitle><ToastDescription>0 errors, 0 warnings on a 2-layer board. Ready for fabrication output.</ToastDescription></div>
        <ToastClose />
      </Toast>
    </Surface>
  );
}

export function UploadFailed() {
  return (
    <Surface>
      <Toast variant="destructive" open>
        <div className="grid gap-1"><ToastTitle>Upload failed</ToastTitle><ToastDescription>No board detected on /dev/ttyUSB0. Check the cable and USB driver.</ToastDescription></div>
        <ToastAction altText="Retry the upload">Retry</ToastAction><ToastClose />
      </Toast>
    </Surface>
  );
}

export function PartLifecycleWarning() {
  return (
    <Surface>
      <Toast variant="warning" open>
        <div className="grid gap-1"><ToastTitle>Component marked NRND</ToastTitle><ToastDescription>LM358 (U2) is Not Recommended for New Designs. A drop-in MCP6002 is available.</ToastDescription></div>
        <ToastAction altText="View replacement part">View swap</ToastAction><ToastClose />
      </Toast>
    </Surface>
  );
}
