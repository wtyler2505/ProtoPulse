import { memo, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { runExportPrecheck } from '@/lib/export-precheck';
import type { ExportPrecheck, PrecheckStatus } from '@/lib/export-precheck';
import type { ProjectExportData } from '@/lib/export-validation';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExportPrecheckPanelProps {
  /** Export format id (e.g. 'kicad', 'gerber', 'bom-csv'). */
  format: string;
  /** Human-readable format label for the header. */
  formatLabel: string;
  /** Current project data snapshot. */
  projectData: ProjectExportData;
  /** Called when user clicks "Export Anyway" (warnings only, no blockers). */
  onExportAnyway: () => void;
  /** Called when user clicks "Cancel" / "Close". */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Status icon component
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<PrecheckStatus, {
  icon: typeof CheckCircle2;
  className: string;
  label: string;
}> = {
  pass: { icon: CheckCircle2, className: 'text-green-400', label: 'Passed' },
  warn: { icon: AlertTriangle, className: 'text-amber-400', label: 'Warning' },
  fail: { icon: XCircle, className: 'text-destructive', label: 'Failed' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ExportPrecheckPanel({
  format,
  formatLabel,
  projectData,
  onExportAnyway,
  onClose,
}: ExportPrecheckPanelProps) {
  const precheck: ExportPrecheck = useMemo(
    () => runExportPrecheck(format, projectData),
    [format, projectData],
  );

  const passCount = precheck.checks.filter((c) => c.status === 'pass').length;
  const warnCount = precheck.warnings.length;
  const failCount = precheck.blockers.length;

  const canExportAnyway = failCount === 0 && warnCount > 0;
  const allPassed = failCount === 0 && warnCount === 0;

  return (
    <div
      className="border border-border/50 bg-card/40 backdrop-blur p-3 flex flex-col gap-3"
      data-testid="export-precheck-panel"
    >
      {/* Header */}
      <div className="flex items-center gap-2" data-testid="precheck-header">
        {allPassed ? (
          <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
        ) : (
          <ShieldAlert className={cn('w-4 h-4 shrink-0', failCount > 0 ? 'text-destructive' : 'text-amber-400')} />
        )}
        <span className="text-xs font-medium text-foreground flex-1">
          Pre-check: {formatLabel}
        </span>
        <span
          className="text-[10px] font-mono text-muted-foreground tabular-nums"
          data-testid="precheck-summary"
        >
          {passCount}/{precheck.checks.length} passed
        </span>
      </div>

      {/* Checklist */}
      <ul className="flex flex-col gap-1.5" data-testid="precheck-checklist">
        {precheck.checks.map((chk, idx) => {
          const cfg = STATUS_CONFIG[chk.status];
          const Icon = cfg.icon;
          return (
            <li
              key={`${chk.name}-${idx}`}
              className="flex items-start gap-2 text-[11px] leading-tight"
              data-testid={`precheck-item-${chk.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Icon
                className={cn('w-3.5 h-3.5 shrink-0 mt-px', cfg.className)}
                aria-label={cfg.label}
              />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{chk.name}</span>
                <span className="text-muted-foreground ml-1">— {chk.message}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Blocker / warning counts */}
      {(failCount > 0 || warnCount > 0) && (
        <div
          className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/30"
          data-testid="precheck-counts"
        >
          {failCount > 0 && (
            <span className="text-destructive" data-testid="precheck-blocker-count">
              {failCount} blocker{failCount !== 1 ? 's' : ''}
            </span>
          )}
          {warnCount > 0 && (
            <span className="text-amber-400" data-testid="precheck-warning-count">
              {warnCount} warning{warnCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          className="text-[11px] px-3 py-1.5 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-ring"
          onClick={onClose}
          data-testid="precheck-close"
        >
          {allPassed ? 'Close' : 'Cancel'}
        </button>
        {canExportAnyway && (
          <button
            className="text-[11px] px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 transition-colors focus-ring ml-auto"
            onClick={onExportAnyway}
            data-testid="precheck-export-anyway"
          >
            Export Anyway
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(ExportPrecheckPanel);
