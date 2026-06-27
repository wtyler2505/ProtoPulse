import type { ReactNode } from "react";
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
} from "@/components/ui/toast";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 460 }}>
    {children}
  </div>
);

export function DrcPassed() {
  return (
    <Surface>
      <Toast variant="success" open>
        <div className="grid gap-1">
          <ToastTitle>DRC passed</ToastTitle>
          <ToastDescription>
            0 errors, 0 warnings on a 2-layer board. Ready for fabrication output.
          </ToastDescription>
        </div>
        <ToastClose />
      </Toast>
    </Surface>
  );
}

export function UploadFailed() {
  return (
    <Surface>
      <Toast variant="destructive" open>
        <div className="grid gap-1">
          <ToastTitle>Upload failed</ToastTitle>
          <ToastDescription>
            No board detected on /dev/ttyUSB0. Check the cable and USB driver.
          </ToastDescription>
        </div>
        <ToastAction altText="Retry the upload">Retry</ToastAction>
        <ToastClose />
      </Toast>
    </Surface>
  );
}

export function PartLifecycleWarning() {
  return (
    <Surface>
      <Toast variant="warning" open>
        <div className="grid gap-1">
          <ToastTitle>Component marked NRND</ToastTitle>
          <ToastDescription>
            LM358 (U2) is Not Recommended for New Designs. A drop-in MCP6002 is available.
          </ToastDescription>
        </div>
        <ToastAction altText="View replacement part">View swap</ToastAction>
        <ToastClose />
      </Toast>
    </Surface>
  );
}

export function SimulationQueued() {
  return (
    <Surface>
      <Toast variant="info" open>
        <div className="grid gap-1">
          <ToastTitle>Transient analysis queued</ToastTitle>
          <ToastDescription>
            50 ms window, 1 us step. Results will appear in the waveform viewer.
          </ToastDescription>
        </div>
        <ToastClose />
      </Toast>
    </Surface>
  );
}
