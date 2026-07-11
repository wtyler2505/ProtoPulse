import type { ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 460 }}>
    {children}
  </div>
);

export function DesignNotes() {
  return (
    <Surface>
      <label className="mb-2 block text-sm font-medium">Design notes</label>
      <Textarea
        rows={4}
        defaultValue={"Bypass each ESP32-S3 VDD pin with 100 nF.\nBulk 10 uF near the 3V3 regulator output.\nKeep the antenna keep-out clear of copper pour."}
      />
    </Surface>
  );
}

export function SpiceDirectives() {
  return (
    <Surface>
      <label className="mb-2 block text-sm font-medium">SPICE directives</label>
      <Textarea
        rows={5}
        className="font-mono"
        defaultValue={".tran 10u 50m\n.ic V(out)=0\n.model NMOS_SW SW(Ron=0.1 Roff=1Meg Vt=2.5)\n.options reltol=1e-4"}
      />
    </Surface>
  );
}

export function PromptPlaceholder() {
  return (
    <Surface>
      <label className="mb-2 block text-sm font-medium">Ask the Draftsman</label>
      <Textarea placeholder="Describe the circuit to generate — e.g. 'a 5V to 3.3V buck regulator feeding an ESP32-C3'" />
    </Surface>
  );
}

export function DisabledReadback() {
  return (
    <Surface>
      <label className="mb-2 block text-sm font-medium">Last ERC report (read-only)</label>
      <Textarea
        disabled
        rows={3}
        defaultValue={"ERC passed: 0 errors, 2 warnings.\nWARN: net VBUS has only one driver.\nWARN: U3 pin 7 (NC) left unconnected."}
      />
    </Surface>
  );
}
