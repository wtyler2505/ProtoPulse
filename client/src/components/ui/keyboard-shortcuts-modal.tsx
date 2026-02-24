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

export function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="dialog-keyboard-shortcuts"
        className="bg-card border-border max-w-md"
      >
        <DialogHeader>
          <DialogTitle data-testid="dialog-keyboard-shortcuts-title">
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Quick reference for available shortcuts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ShortcutGroup title="Architecture View">
            <ShortcutRow
              description="Undo"
              keys={
                <>
                  <Kbd>Ctrl</Kbd>
                  <span className="text-muted-foreground text-xs">+</span>
                  <Kbd>Z</Kbd>
                </>
              }
            />
            <ShortcutRow
              description="Redo"
              keys={
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <Kbd>Ctrl</Kbd>
                    <span className="text-muted-foreground text-xs">+</span>
                    <Kbd>Y</Kbd>
                  </span>
                  <span className="text-muted-foreground text-xs">/</span>
                  <span className="flex items-center gap-1">
                    <Kbd>Ctrl</Kbd>
                    <span className="text-muted-foreground text-xs">+</span>
                    <Kbd>Shift</Kbd>
                    <span className="text-muted-foreground text-xs">+</span>
                    <Kbd>Z</Kbd>
                  </span>
                </div>
              }
            />
            <ShortcutRow
              description="Delete selected"
              keys={
                <div className="flex items-center gap-2">
                  <Kbd>Delete</Kbd>
                  <span className="text-muted-foreground text-xs">/</span>
                  <Kbd>Backspace</Kbd>
                </div>
              }
            />
            <ShortcutRow
              description="Select all nodes"
              keys={
                <>
                  <Kbd>Ctrl</Kbd>
                  <span className="text-muted-foreground text-xs">+</span>
                  <Kbd>A</Kbd>
                </>
              }
            />
            <ShortcutRow
              description="Paste"
              keys={
                <>
                  <Kbd>Ctrl</Kbd>
                  <span className="text-muted-foreground text-xs">+</span>
                  <Kbd>V</Kbd>
                </>
              }
            />
            <ShortcutRow description="Fit view" keys={<Kbd>F</Kbd>} />
            <ShortcutRow description="Toggle snap grid" keys={<Kbd>G</Kbd>} />
          </ShortcutGroup>

          <div className="border-t border-border" />

          <ShortcutGroup title="Navigation">
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
