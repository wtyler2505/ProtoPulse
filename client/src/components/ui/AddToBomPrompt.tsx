/**
 * AddToBomPrompt — toast-like prompt shown when a community component is
 * downloaded that has useful BOM metadata (MPN, manufacturer, etc.).
 * Displays pre-filled fields and Yes/No actions.
 */

import { memo, useCallback, useState } from 'react';
import { Package, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BomItem } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddToBomPromptProps {
  bomPreview: Omit<BomItem, 'id'>;
  componentName: string;
  onConfirm: (item: Omit<BomItem, 'id'>) => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AddToBomPrompt = memo(function AddToBomPrompt({
  bomPreview,
  componentName,
  onConfirm,
  onDismiss,
}: AddToBomPromptProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleConfirm = useCallback(() => {
    setDismissed(true);
    onConfirm(bomPreview);
  }, [bomPreview, onConfirm]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismiss();
  }, [onDismiss]);

  if (dismissed) {
    return null;
  }

  const fields: Array<{ label: string; value: string }> = [];
  if (bomPreview.partNumber) {
    fields.push({ label: 'MPN', value: bomPreview.partNumber });
  }
  if (bomPreview.manufacturer) {
    fields.push({ label: 'Manufacturer', value: bomPreview.manufacturer });
  }
  if (bomPreview.supplier !== 'Unknown') {
    fields.push({ label: 'Supplier', value: bomPreview.supplier });
  }
  if (bomPreview.assemblyCategory) {
    fields.push({ label: 'Assembly', value: bomPreview.assemblyCategory.replace('_', ' ') });
  }

  return (
    <div
      data-testid="add-to-bom-prompt"
      className={cn(
        'fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-primary/30',
        'bg-card/95 backdrop-blur-sm shadow-lg shadow-primary/5',
        'animate-in slide-in-from-bottom-5 fade-in duration-300',
      )}
    >
      <div className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-4 h-4 text-primary flex-shrink-0" />
            <span data-testid="bom-prompt-title" className="text-sm font-medium truncate">
              Add to BOM?
            </span>
          </div>
          <button
            data-testid="bom-prompt-close"
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Component name */}
        <p data-testid="bom-prompt-component" className="text-xs text-muted-foreground truncate">
          {componentName}
        </p>

        {/* Pre-filled fields */}
        {fields.length > 0 && (
          <div data-testid="bom-prompt-fields" className="flex flex-wrap gap-1.5">
            {fields.map((f) => (
              <Badge
                key={f.label}
                variant="secondary"
                className="text-xs px-1.5 py-0"
              >
                {f.label}: {f.value}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            data-testid="bom-prompt-confirm"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={handleConfirm}
          >
            <Check className="w-3 h-3 mr-1" />
            Yes, add
          </Button>
          <Button
            data-testid="bom-prompt-dismiss"
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={handleDismiss}
          >
            No thanks
          </Button>
        </div>
      </div>
    </div>
  );
});

export default AddToBomPrompt;
