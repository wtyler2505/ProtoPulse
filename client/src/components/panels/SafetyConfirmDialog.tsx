import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SafetyClassification, ActionConsequence } from '@/lib/ai-safety-mode';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SafetyConfirmDialogProps {
  open: boolean;
  actionType: string;
  actionLabel: string;
  classification: SafetyClassification;
  explanation: string;
  consequences: ActionConsequence[];
  onConfirm: (dismiss: boolean) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classificationBadge(classification: SafetyClassification) {
  switch (classification) {
    case 'safe':
      return (
        <Badge
          data-testid="safety-badge-safe"
          className="bg-green-600/20 text-green-400 border-green-600/40"
        >
          <ShieldCheck className="mr-1 h-3 w-3" />
          Safe
        </Badge>
      );
    case 'caution':
      return (
        <Badge
          data-testid="safety-badge-caution"
          className="bg-yellow-600/20 text-yellow-400 border-yellow-600/40"
        >
          <AlertTriangle className="mr-1 h-3 w-3" />
          Caution
        </Badge>
      );
    case 'destructive':
      return (
        <Badge
          data-testid="safety-badge-destructive"
          className="bg-red-600/20 text-red-400 border-red-600/40"
        >
          <ShieldAlert className="mr-1 h-3 w-3" />
          Destructive
        </Badge>
      );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SafetyConfirmDialog({
  open,
  actionType,
  actionLabel,
  classification,
  explanation,
  consequences,
  onConfirm,
  onCancel,
}: SafetyConfirmDialogProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleConfirm = () => {
    onConfirm(dontAskAgain);
    setDontAskAgain(false);
  };

  const handleCancel = () => {
    onCancel();
    setDontAskAgain(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { handleCancel(); } }}>
      <DialogContent
        className="bg-card border-border max-w-md"
        data-testid="safety-confirm-dialog"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            {classificationBadge(classification)}
          </div>
          <DialogTitle data-testid="safety-dialog-title">
            {actionLabel}
          </DialogTitle>
          <DialogDescription
            className="text-sm text-muted-foreground mt-2"
            data-testid="safety-dialog-explanation"
          >
            {explanation}
          </DialogDescription>
        </DialogHeader>

        {consequences.length > 0 && (
          <div className="mt-2" data-testid="safety-dialog-consequences">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              What will happen:
            </p>
            <ul className="space-y-1.5">
              {consequences.map((c, i) => (
                <li
                  key={i}
                  className={cn(
                    'flex items-start gap-2 text-sm',
                    classification === 'destructive' ? 'text-red-300' : 'text-yellow-300',
                  )}
                >
                  <span className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full bg-current" />
                  {c.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <Checkbox
            id={`dismiss-${actionType}`}
            checked={dontAskAgain}
            onCheckedChange={(checked) => { setDontAskAgain(checked === true); }}
            data-testid="safety-dismiss-checkbox"
          />
          <Label
            htmlFor={`dismiss-${actionType}`}
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Don&apos;t ask again for this action
          </Label>
        </div>

        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            data-testid="safety-cancel-button"
          >
            Cancel
          </Button>
          <Button
            variant={classification === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            data-testid="safety-proceed-button"
          >
            Proceed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
