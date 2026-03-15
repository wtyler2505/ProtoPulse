/**
 * DrcSuppressionDialog
 *
 * Modal dialog for suppressing a DRC/ERC/validation violation.
 * Collects reason, expiration option (permanent / timed), and confirms.
 */

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ShieldOff, Clock, AlertTriangle } from 'lucide-react';
import type { SuppressInput } from '@/lib/drc-suppression';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DrcSuppressionTarget {
  /** The rule type being suppressed (e.g. 'clearance', 'unconnected_pin') */
  ruleId: string;
  /** The specific violation instance ID */
  instanceId: string;
  /** Human-readable description of the violation */
  message: string;
  /** Severity of the violation */
  severity: string;
}

interface DrcSuppressionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DrcSuppressionTarget | null;
  onSuppress: (input: Omit<SuppressInput, 'projectId'>) => void;
}

// ---------------------------------------------------------------------------
// Expiration presets
// ---------------------------------------------------------------------------

type ExpirationPreset = '1h' | '24h' | '7d' | '30d' | 'custom';

const EXPIRATION_LABELS: Record<ExpirationPreset, string> = {
  '1h': '1 hour',
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
  'custom': 'Custom date',
};

function presetToMs(preset: ExpirationPreset): number {
  switch (preset) {
    case '1h': return 60 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DrcSuppressionDialog({ open, onOpenChange, target, onSuppress }: DrcSuppressionDialogProps) {
  const [reason, setReason] = useState('');
  const [permanent, setPermanent] = useState(false);
  const [expirationPreset, setExpirationPreset] = useState<ExpirationPreset>('7d');
  const [customDate, setCustomDate] = useState('');

  const resetForm = useCallback(() => {
    setReason('');
    setPermanent(false);
    setExpirationPreset('7d');
    setCustomDate('');
  }, []);

  const handleSuppress = useCallback(() => {
    if (!target || !reason.trim()) {
      return;
    }

    let expiresAt: number | null = null;
    if (!permanent) {
      if (expirationPreset === 'custom') {
        const parsed = new Date(customDate).getTime();
        if (isNaN(parsed) || parsed <= Date.now()) {
          return; // invalid custom date
        }
        expiresAt = parsed;
      } else {
        expiresAt = Date.now() + presetToMs(expirationPreset);
      }
    }

    onSuppress({
      ruleId: target.ruleId,
      instanceId: target.instanceId,
      reason: reason.trim(),
      suppressedBy: 'user',
      expiresAt,
      permanent,
    });

    resetForm();
    onOpenChange(false);
  }, [target, reason, permanent, expirationPreset, customDate, onSuppress, resetForm, onOpenChange]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) {
        resetForm();
      }
      onOpenChange(value);
    },
    [onOpenChange, resetForm],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="drc-suppression-dialog" className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="w-5 h-5 text-yellow-500" />
            Suppress Violation
          </DialogTitle>
          <DialogDescription>
            Suppressed violations will be hidden from the validation list. You can unsuppress them at any time.
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="space-y-4">
            {/* Violation info */}
            <div
              data-testid="suppression-target-info"
              className="p-3 bg-muted/20 border border-border rounded space-y-1"
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant={target.severity === 'error' ? 'destructive' : target.severity === 'warning' ? 'secondary' : 'outline'}
                  className="text-[10px] px-1.5 py-0"
                >
                  {target.severity}
                </Badge>
                <span className="text-[10px] font-mono text-muted-foreground">{target.ruleId}</span>
              </div>
              <p className="text-sm text-foreground">{target.message}</p>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="suppress-reason" className="text-xs">
                Reason for suppression <span className="text-destructive">*</span>
              </Label>
              <Input
                id="suppress-reason"
                data-testid="suppress-reason-input"
                value={reason}
                onChange={(e) => { setReason(e.target.value); }}
                placeholder="e.g., Known spacing for this connector layout"
                className="h-8 text-xs"
                autoFocus
              />
              {reason.trim().length === 0 && (
                <p className="text-[10px] text-muted-foreground">A reason is required to maintain audit trail.</p>
              )}
            </div>

            {/* Permanent toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="suppress-permanent" className="text-xs cursor-pointer">
                  Permanent suppression
                </Label>
              </div>
              <Switch
                id="suppress-permanent"
                data-testid="suppress-permanent-toggle"
                checked={permanent}
                onCheckedChange={setPermanent}
              />
            </div>

            {/* Expiration picker (when not permanent) */}
            {!permanent && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-xs">Expires after</Label>
                </div>
                <Select
                  value={expirationPreset}
                  onValueChange={(v) => { setExpirationPreset(v as ExpirationPreset); }}
                >
                  <SelectTrigger data-testid="suppress-expiration-select" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(EXPIRATION_LABELS) as [ExpirationPreset, string][]).map(([key, label]) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {expirationPreset === 'custom' && (
                  <Input
                    data-testid="suppress-custom-date"
                    type="datetime-local"
                    value={customDate}
                    onChange={(e) => { setCustomDate(e.target.value); }}
                    className="h-8 text-xs"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                )}

                <div className="flex items-start gap-1.5 text-[10px] text-yellow-500/80">
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>After expiration, the violation will reappear in the validation list.</span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            data-testid="suppress-cancel"
            variant="outline"
            size="sm"
            onClick={() => { handleOpenChange(false); }}
          >
            Cancel
          </Button>
          <Button
            data-testid="suppress-confirm"
            size="sm"
            disabled={!reason.trim() || !target}
            onClick={handleSuppress}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            <ShieldOff className="w-3.5 h-3.5 mr-1" />
            Suppress
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
