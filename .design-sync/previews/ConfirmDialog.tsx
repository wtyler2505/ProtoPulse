import type { ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, minHeight: 160 }}>
    {children}
  </div>
);

// Note: ConfirmDialog wraps Radix AlertDialog and does not expose an `open` prop,
// so these cells render the realistic triggers; the confirmation opens on click.
export function DestructiveActions() {
  return (
    <Surface>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <ConfirmDialog
          variant="destructive"
          title="Delete net &ldquo;GND&rdquo;?"
          description="This removes 38 connections across 4 sheets and rips up all routed copper on this net. ERC will re-run. This cannot be undone."
          confirmLabel="Delete net"
          onConfirm={() => {}}
          trigger={
            <Button variant="destructive">
              <Trash2 />
              Delete GND net
            </Button>
          }
        />
        <ConfirmDialog
          variant="destructive"
          title="Clear PCB layout?"
          description="All 142 placed components and 318 routed traces will be discarded. The schematic is unaffected."
          confirmLabel="Clear layout"
          onConfirm={() => {}}
          trigger={<Button variant="outline">Clear layout</Button>}
        />
      </div>
    </Surface>
  );
}

export function DefaultConfirm() {
  return (
    <Surface>
      <ConfirmDialog
        title="Re-run DRC on all layers?"
        description="Design rule check will validate clearances, trace widths, and via sizes against the 2-layer JLCPCB ruleset. This may take a few seconds."
        confirmLabel="Run DRC"
        onConfirm={() => {}}
        trigger={<Button>Run design rule check</Button>}
      />
    </Surface>
  );
}
