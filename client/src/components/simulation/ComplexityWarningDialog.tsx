import { AlertTriangle, AlertCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Complexity Warning Dialog (BL-0514)
// ---------------------------------------------------------------------------

export default function ComplexityWarningDialog({
  warnings,
  estimate,
  onConfirm,
  onCancel,
}: {
  warnings: string[];
  estimate: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      data-testid="complexity-warning-overlay"
    >
      <div
        className="w-full max-w-md mx-4 bg-card border border-border shadow-2xl"
        role="alertdialog"
        aria-labelledby="complexity-warning-title"
        aria-describedby="complexity-warning-desc"
        data-testid="complexity-warning-dialog"
      >
        <div className="flex items-start gap-3 px-6 pt-6 pb-2">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 id="complexity-warning-title" className="text-base font-semibold text-foreground">
              Large Circuit Warning
            </h3>
            <p id="complexity-warning-desc" className="text-xs text-muted-foreground mt-1">
              This simulation may take a while. Estimated runtime: <strong className="text-foreground">{estimate}</strong>
            </p>
          </div>
        </div>
        <div className="px-6 py-3">
          <ul className="space-y-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-400/90">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-4 text-xs font-medium border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            data-testid="complexity-warning-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-8 px-4 text-xs font-medium bg-amber-600 text-white hover:bg-amber-500 transition-colors"
            data-testid="complexity-warning-confirm"
          >
            Run Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
