import { useState, useMemo, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, ChevronDown, ChevronRight, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  validateManufacturingPackage,
  summarizeChecks,
} from '@/lib/manufacturing-validator';
import type {
  ManufacturingPackageInput,
  ManufacturingCheck,
  CheckCategory,
  CheckStatus,
  PackageValidationSummary,
} from '@/lib/manufacturing-validator';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ManufacturingValidatorPanelProps {
  packageInput: ManufacturingPackageInput;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<CheckCategory, string> = {
  gerber: 'Gerber Layers',
  drill: 'Drill File',
  bom: 'Bill of Materials',
  placement: 'Pick-and-Place',
  consistency: 'Cross-File Consistency',
};

const CATEGORY_ORDER: readonly CheckCategory[] = [
  'gerber',
  'drill',
  'bom',
  'placement',
  'consistency',
];

const STATUS_ICON: Record<CheckStatus, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
};

const STATUS_COLOR: Record<CheckStatus, string> = {
  pass: 'text-emerald-400',
  warn: 'text-yellow-400',
  fail: 'text-red-400',
};

const STATUS_BG: Record<CheckStatus, string> = {
  pass: 'bg-emerald-500/10 border-emerald-500/30',
  warn: 'bg-yellow-500/10 border-yellow-500/30',
  fail: 'bg-red-500/10 border-red-500/30',
};

const STATUS_BADGE_VARIANT: Record<CheckStatus, string> = {
  pass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  warn: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  fail: 'bg-red-500/20 text-red-400 border-red-500/40',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoryWorstStatus(checks: ManufacturingCheck[]): CheckStatus {
  if (checks.some((c) => c.status === 'fail')) { return 'fail'; }
  if (checks.some((c) => c.status === 'warn')) { return 'warn'; }
  return 'pass';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OverallStatusBanner({ summary }: { summary: PackageValidationSummary }) {
  const Icon = STATUS_ICON[summary.overallStatus];
  const labels: Record<CheckStatus, string> = {
    pass: 'Package Ready',
    warn: 'Warnings Found',
    fail: 'Issues Detected',
  };

  return (
    <div
      className={cn('flex items-center gap-3 px-4 py-3 border', STATUS_BG[summary.overallStatus])}
      data-testid="mfg-validator-banner"
    >
      <Icon className={cn('w-5 h-5 shrink-0', STATUS_COLOR[summary.overallStatus])} />
      <div className="flex-1">
        <div className={cn('text-sm font-medium', STATUS_COLOR[summary.overallStatus])}>
          {labels[summary.overallStatus]}
        </div>
        <div className="text-xs text-muted-foreground">
          {summary.passed} passed, {summary.warnings} warning{summary.warnings !== 1 ? 's' : ''}, {summary.failures} failure{summary.failures !== 1 ? 's' : ''}
        </div>
      </div>
      <Badge className={cn('text-[10px] border', STATUS_BADGE_VARIANT[summary.overallStatus])} data-testid="mfg-validator-overall-badge">
        {summary.passed}/{summary.total}
      </Badge>
    </div>
  );
}

function CheckRow({ check }: { check: ManufacturingCheck }) {
  const Icon = STATUS_ICON[check.status];
  return (
    <div
      className="flex items-start gap-2.5 px-3 py-2 border-b border-border/50 last:border-b-0"
      data-testid={`mfg-check-${check.id}`}
    >
      <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', STATUS_COLOR[check.status])} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground font-medium">{check.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{check.message}</div>
      </div>
      <span className={cn('text-[10px] font-mono uppercase shrink-0', STATUS_COLOR[check.status])}>
        {check.status}
      </span>
    </div>
  );
}

function CategorySection({
  category,
  checks,
  defaultOpen,
}: {
  category: CheckCategory;
  checks: ManufacturingCheck[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const worst = categoryWorstStatus(checks);
  const Icon = STATUS_ICON[worst];
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="border border-border bg-card/60" data-testid={`mfg-category-${category}`}>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/30 transition-colors"
        onClick={() => { setOpen((v) => !v); }}
        data-testid={`mfg-category-toggle-${category}`}
      >
        <Chevron className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <Icon className={cn('w-4 h-4 shrink-0', STATUS_COLOR[worst])} />
        <span className="text-sm font-medium text-foreground flex-1 text-left">
          {CATEGORY_LABELS[category]}
        </span>
        <Badge className={cn('text-[10px] border', STATUS_BADGE_VARIANT[worst])}>
          {checks.filter((c) => c.status === 'pass').length}/{checks.length}
        </Badge>
      </button>
      {open && (
        <div className="border-t border-border/50" data-testid={`mfg-category-checks-${category}`}>
          {checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ManufacturingValidatorPanel({ packageInput }: ManufacturingValidatorPanelProps) {
  const [checks, setChecks] = useState<ManufacturingCheck[] | null>(null);

  const handleRun = useCallback(() => {
    setChecks(validateManufacturingPackage(packageInput));
  }, [packageInput]);

  const summary = useMemo(
    () => (checks ? summarizeChecks(checks) : null),
    [checks],
  );

  const grouped = useMemo(() => {
    if (!checks) { return null; }
    const map = new Map<CheckCategory, ManufacturingCheck[]>();
    for (const cat of CATEGORY_ORDER) {
      map.set(cat, []);
    }
    for (const c of checks) {
      const arr = map.get(c.category);
      if (arr) { arr.push(c); }
    }
    return map;
  }, [checks]);

  return (
    <div className="max-w-3xl mx-auto space-y-4" data-testid="manufacturing-validator-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Manufacturing Package Validator</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRun}
          data-testid="mfg-validator-run"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          {checks ? 'Re-validate' : 'Validate Package'}
        </Button>
      </div>

      {!checks && (
        <div
          className="border border-dashed border-border bg-card/30 px-4 py-8 text-center text-sm text-muted-foreground"
          data-testid="mfg-validator-empty"
        >
          Click "Validate Package" to run 18 cross-file consistency checks on your manufacturing output.
        </div>
      )}

      {summary && <OverallStatusBanner summary={summary} />}

      {grouped && (
        <div className="space-y-2" data-testid="mfg-validator-results">
          {CATEGORY_ORDER.map((cat) => {
            const catChecks = grouped.get(cat) ?? [];
            if (catChecks.length === 0) { return null; }
            // Auto-expand categories that have warnings or failures
            const hasIssues = catChecks.some((c) => c.status !== 'pass');
            return (
              <CategorySection
                key={cat}
                category={cat}
                checks={catChecks}
                defaultOpen={hasIssues}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
