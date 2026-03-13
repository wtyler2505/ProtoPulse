import { memo, useMemo, useState, useCallback, useSyncExternalStore } from 'react';
import {
  EmiEmcChecker,
  type EmcReport,
  type EmcViolation,
  type EmcDesignData,
  type EmcCategory,
} from '@/lib/pcb/emi-emc-checker';
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Play,
  Settings2,
  Eye,
  EyeOff,
  Info,
  Shield,
  Radio,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Category icons & labels
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<EmcCategory, typeof Radio> = {
  radiated: Radio,
  conducted: Zap,
  ESD: Shield,
};

const CATEGORY_LABELS: Record<EmcCategory, string> = {
  radiated: 'Radiated',
  conducted: 'Conducted',
  ESD: 'ESD',
};

// ---------------------------------------------------------------------------
// Score gauge
// ---------------------------------------------------------------------------

function ScoreGauge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-yellow-500' : 'text-destructive';

  return (
    <div className="flex flex-col items-center gap-1" data-testid="emc-score-gauge">
      <span className={cn('text-2xl font-bold tabular-nums', color)}>{score}</span>
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">EMC Score</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case 'error':
      return <XCircle className="w-3 h-3 text-destructive shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />;
    default:
      return <Info className="w-3 h-3 text-blue-400 shrink-0" />;
  }
}

// ---------------------------------------------------------------------------
// EmiEmcPanel
// ---------------------------------------------------------------------------

interface EmiEmcPanelProps {
  /** Called when the panel needs design data to run a check. */
  getDesignData?: () => EmcDesignData;
  /** Called when a violation is clicked, for navigation/highlighting. */
  onHighlightViolation?: (violation: EmcViolation | null) => void;
}

const EmiEmcPanel = memo(function EmiEmcPanel({
  getDesignData,
  onHighlightViolation,
}: EmiEmcPanelProps) {
  const checker = useMemo(() => EmiEmcChecker.getInstance(), []);

  // Subscribe to checker state
  const rules = useSyncExternalStore(
    useCallback((cb: () => void) => checker.subscribe(cb), [checker]),
    () => checker.getRuleSet(),
  );

  const [report, setReport] = useState<EmcReport | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<EmcCategory>>(new Set());

  // Run check
  const handleRunCheck = useCallback(() => {
    if (!getDesignData) {
      return;
    }
    const design = getDesignData();
    const result = checker.runCheck(design);
    setReport(result);
    setHasRun(true);

    // Auto-expand categories with violations
    const categories = new Set<EmcCategory>();
    for (const v of result.violations) {
      const rule = rules.find((r) => r.id === v.ruleId);
      if (rule) {
        categories.add(rule.category);
      }
    }
    setExpandedCategories(categories);
  }, [getDesignData, checker, rules]);

  // Toggle rule
  const toggleRule = useCallback(
    (ruleId: string) => {
      const rule = rules.find((r) => r.id === ruleId);
      if (rule) {
        checker.setRuleEnabled(ruleId, !rule.enabled);
      }
    },
    [checker, rules],
  );

  // Toggle category expansion
  const toggleCategory = useCallback((category: EmcCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Click violation
  const handleClickViolation = useCallback(
    (violation: EmcViolation) => {
      onHighlightViolation?.(violation);
    },
    [onHighlightViolation],
  );

  // Group violations by category
  const groupedByCategory = useMemo(() => {
    if (!report) {
      return new Map<EmcCategory, EmcViolation[]>();
    }
    const groups = new Map<EmcCategory, EmcViolation[]>();
    for (const v of report.violations) {
      const rule = rules.find((r) => r.id === v.ruleId);
      const category = rule?.category ?? 'radiated';
      const existing = groups.get(category) ?? [];
      existing.push(v);
      groups.set(category, existing);
    }
    return groups;
  }, [report, rules]);

  const errorCount = report?.violations.filter((v) => v.severity === 'error').length ?? 0;
  const warningCount = report?.violations.filter((v) => v.severity === 'warning').length ?? 0;
  const infoCount = report?.violations.filter((v) => v.severity === 'info').length ?? 0;

  return (
    <div className="flex flex-col h-full bg-card/40" data-testid="emi-emc-panel">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-medium text-foreground flex-1">EMI/EMC Check</span>
        <button
          data-testid="button-emc-settings"
          onClick={() => { setShowSettings((v) => !v); }}
          className={cn(
            'p-1 rounded hover:bg-accent/50 transition-colors',
            showSettings && 'bg-accent text-accent-foreground',
          )}
          title="Rule settings"
          aria-label="EMC settings"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
        <button
          data-testid="button-run-emc"
          onClick={handleRunCheck}
          disabled={!getDesignData}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-medium transition-colors disabled:opacity-40"
          title="Run EMC check"
          aria-label="Run EMC check"
        >
          <Play className="w-3 h-3" />
          Run
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="border-b border-border px-3 py-2 space-y-1" data-testid="emc-settings">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
            Rule Configuration
          </span>
          {rules.map((rule) => {
            const CategoryIcon = CATEGORY_ICONS[rule.category];
            return (
              <div key={rule.id} className="flex items-center gap-2 text-[10px]">
                <button
                  data-testid={`emc-rule-toggle-${rule.id}`}
                  onClick={() => { toggleRule(rule.id); }}
                  className="p-0.5"
                  title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                  aria-label={`Toggle ${rule.name}`}
                >
                  {rule.enabled ? (
                    <Eye className="w-3 h-3 text-foreground" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-muted-foreground/50" />
                  )}
                </button>
                <CategoryIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                <span
                  className={cn(
                    'flex-1 truncate',
                    rule.enabled ? 'text-foreground' : 'text-muted-foreground/50 line-through',
                  )}
                >
                  {rule.name}
                </span>
                <SeverityBadge severity={rule.severity} />
              </div>
            );
          })}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!hasRun ? (
          <div
            className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 px-4 text-center"
            data-testid="emc-empty-state"
          >
            <Shield className="w-8 h-8 text-muted-foreground/20" />
            <span className="text-[10px]">
              Click &quot;Run&quot; to check your design for EMI/EMC compliance
            </span>
          </div>
        ) : !report ? null : report.violations.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full text-emerald-500 gap-2"
            data-testid="emc-clean"
          >
            <CheckCircle2 className="w-8 h-8" />
            <span className="text-xs font-medium">All EMC checks passed</span>
          </div>
        ) : (
          <div className="py-1">
            {/* Score gauge + summary */}
            <div className="flex items-center gap-4 px-3 py-2 border-b border-border/50">
              <ScoreGauge score={report.score} />
              <div className="flex flex-col gap-0.5 text-[10px]">
                <span className="text-muted-foreground">
                  {String(report.passCount)} passed / {String(report.failCount)} failed
                </span>
                {errorCount > 0 && (
                  <span className="flex items-center gap-1 text-destructive" data-testid="emc-error-count">
                    <XCircle className="w-3 h-3" />
                    {errorCount} error{errorCount !== 1 ? 's' : ''}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="flex items-center gap-1 text-yellow-500" data-testid="emc-warning-count">
                    <AlertTriangle className="w-3 h-3" />
                    {warningCount} warning{warningCount !== 1 ? 's' : ''}
                  </span>
                )}
                {infoCount > 0 && (
                  <span className="flex items-center gap-1 text-blue-400" data-testid="emc-info-count">
                    <Info className="w-3 h-3" />
                    {infoCount} info
                  </span>
                )}
              </div>
            </div>

            {/* Grouped by category */}
            {Array.from(groupedByCategory.entries()).map(([category, violations]) => {
              const CategoryIcon = CATEGORY_ICONS[category];
              return (
                <div key={category} data-testid={`emc-group-${category}`}>
                  <button
                    data-testid={`emc-group-toggle-${category}`}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/30 transition-colors text-left"
                    onClick={() => { toggleCategory(category); }}
                  >
                    {expandedCategories.has(category) ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    )}
                    <CategoryIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] font-medium text-foreground flex-1 truncate">
                      {CATEGORY_LABELS[category]}
                    </span>
                    <span className="text-[9px] text-muted-foreground tabular-nums">
                      {violations.length}
                    </span>
                  </button>

                  {expandedCategories.has(category) && (
                    <div className="ml-5">
                      {violations.map((violation, idx) => (
                        <button
                          key={`${violation.ruleId}-${String(idx)}`}
                          data-testid={`emc-violation-${violation.ruleId}-${String(idx)}`}
                          className="w-full flex items-start gap-1.5 px-2 py-1.5 hover:bg-accent/20 transition-colors text-left rounded-sm"
                          onClick={() => { handleClickViolation(violation); }}
                        >
                          <SeverityBadge severity={violation.severity} />
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-[10px] text-foreground leading-relaxed">
                              {violation.message}
                            </span>
                            <span className="text-[9px] text-muted-foreground/70 leading-relaxed">
                              {violation.recommendation}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

export default EmiEmcPanel;
