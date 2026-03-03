import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-medium bg-muted border border-border rounded-sm min-w-[1.5rem] text-center">
      {children}
    </kbd>
  );
}

function ShortcutRow({
  keys,
  description,
}: {
  keys: React.ReactNode;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm text-muted-foreground">{description}</span>
      <div className="flex items-center gap-1 shrink-0">{keys}</div>
    </div>
  );
}

function ShortcutGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-2">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function KeyCombo({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((k, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground text-xs">+</span>}
          <Kbd>{k}</Kbd>
        </span>
      ))}
    </span>
  );
}

function AltCombo({ combos }: { combos: string[][] }) {
  return (
    <div className="flex items-center gap-2">
      {combos.map((combo, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground text-xs">/</span>}
          <KeyCombo keys={combo} />
        </span>
      ))}
    </div>
  );
}

export default function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="dialog-keyboard-shortcuts"
        className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle data-testid="dialog-keyboard-shortcuts-title">
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Quick reference for available shortcuts across all views.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ShortcutGroup title="Architecture View">
            <ShortcutRow
              description="Undo"
              keys={<KeyCombo keys={["Ctrl", "Z"]} />}
            />
            <ShortcutRow
              description="Redo"
              keys={<AltCombo combos={[["Ctrl", "Y"], ["Ctrl", "Shift", "Z"]]} />}
            />
            <ShortcutRow
              description="Delete selected"
              keys={<AltCombo combos={[["Delete"], ["Backspace"]]} />}
            />
            <ShortcutRow
              description="Select all nodes"
              keys={<KeyCombo keys={["Ctrl", "A"]} />}
            />
            <ShortcutRow
              description="Paste"
              keys={<KeyCombo keys={["Ctrl", "V"]} />}
            />
            <ShortcutRow description="Fit view" keys={<Kbd>F</Kbd>} />
            <ShortcutRow description="Toggle snap grid" keys={<Kbd>G</Kbd>} />
          </ShortcutGroup>

          <div className="border-t border-border" />

          <ShortcutGroup title="Schematic View">
            <ShortcutRow description="Select tool" keys={<Kbd>V</Kbd>} />
            <ShortcutRow description="Pan tool" keys={<Kbd>H</Kbd>} />
            <ShortcutRow description="Draw net/wire" keys={<Kbd>W</Kbd>} />
            <ShortcutRow description="Toggle snap" keys={<Kbd>G</Kbd>} />
            <ShortcutRow description="Fit view" keys={<Kbd>F</Kbd>} />
            <ShortcutRow description="Cancel / deselect" keys={<Kbd>Esc</Kbd>} />
          </ShortcutGroup>

          <div className="border-t border-border" />

          <ShortcutGroup title="Component Editor">
            <ShortcutRow description="Select" keys={<Kbd>S</Kbd>} />
            <ShortcutRow description="Rectangle" keys={<Kbd>R</Kbd>} />
            <ShortcutRow description="Circle" keys={<Kbd>C</Kbd>} />
            <ShortcutRow description="Text" keys={<Kbd>T</Kbd>} />
            <ShortcutRow description="Line" keys={<Kbd>L</Kbd>} />
            <ShortcutRow description="Pin" keys={<Kbd>P</Kbd>} />
            <ShortcutRow description="Measure" keys={<Kbd>M</Kbd>} />
            <ShortcutRow description="Path" keys={<Kbd>B</Kbd>} />
            <ShortcutRow
              description="Delete selected"
              keys={<AltCombo combos={[["Delete"], ["Backspace"]]} />}
            />
            <ShortcutRow
              description="Copy"
              keys={<KeyCombo keys={["Ctrl", "C"]} />}
            />
            <ShortcutRow
              description="Paste"
              keys={<KeyCombo keys={["Ctrl", "V"]} />}
            />
            <ShortcutRow
              description="Zoom to fit"
              keys={<AltCombo combos={[["Ctrl", "0"], ["Home"]]} />}
            />
            <ShortcutRow
              description="Save"
              keys={<KeyCombo keys={["Ctrl", "S"]} />}
            />
            <ShortcutRow
              description="Undo"
              keys={<KeyCombo keys={["Ctrl", "Z"]} />}
            />
            <ShortcutRow
              description="Redo"
              keys={<AltCombo combos={[["Ctrl", "Y"], ["Ctrl", "Shift", "Z"]]} />}
            />
            <ShortcutRow description="Pan canvas" keys={<Kbd>Space</Kbd>} />
            <ShortcutRow description="Finish path" keys={<Kbd>Enter</Kbd>} />
            <ShortcutRow description="Cancel path" keys={<Kbd>Esc</Kbd>} />
          </ShortcutGroup>

          <div className="border-t border-border" />

          <ShortcutGroup title="Breadboard View">
            <ShortcutRow description="Select tool" keys={<Kbd>1</Kbd>} />
            <ShortcutRow description="Wire tool" keys={<Kbd>2</Kbd>} />
            <ShortcutRow description="Delete tool" keys={<Kbd>3</Kbd>} />
            <ShortcutRow
              description="Delete selected wire"
              keys={<AltCombo combos={[["Delete"], ["Backspace"]]} />}
            />
            <ShortcutRow description="Cancel / deselect" keys={<Kbd>Esc</Kbd>} />
          </ShortcutGroup>

          <div className="border-t border-border" />

          <ShortcutGroup title="PCB Layout View">
            <ShortcutRow description="Select tool" keys={<Kbd>1</Kbd>} />
            <ShortcutRow description="Trace tool" keys={<Kbd>2</Kbd>} />
            <ShortcutRow description="Delete tool" keys={<Kbd>3</Kbd>} />
            <ShortcutRow description="Flip active layer" keys={<Kbd>F</Kbd>} />
            <ShortcutRow
              description="Delete selected wire"
              keys={<AltCombo combos={[["Delete"], ["Backspace"]]} />}
            />
            <ShortcutRow description="Cancel / deselect" keys={<Kbd>Esc</Kbd>} />
          </ShortcutGroup>

          <div className="border-t border-border" />

          <ShortcutGroup title="Chat Panel">
            <ShortcutRow description="Close panel" keys={<Kbd>Esc</Kbd>} />
          </ShortcutGroup>

          <div className="border-t border-border" />

          <ShortcutGroup title="Global">
            <ShortcutRow
              description="Show this shortcuts dialog"
              keys={<Kbd>?</Kbd>}
            />
          </ShortcutGroup>
        </div>
      </DialogContent>
    </Dialog>
  );
}
