import { useState, useCallback, useMemo, memo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  groupWarningsBySeverity,
  getWarningSummary,
  getWarningTypeLabel,
} from '@/lib/import-warnings';
import type {
  ImportWarning,
  ImportWarningSeverity,
} from '@/lib/import-warnings';

// ---------------------------------------------------------------------------
// Severity config
// ---------------------------------------------------------------------------

interface SeverityConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  textClass: string;
  bgClass: string;
  borderClass: string;
  badgeVariant: 'destructive' | 'outline' | 'secondary';
}

const SEVERITY_CONFIG: Record<ImportWarningSeverity, SeverityConfig> = {
  error: {
    label: 'Errors',
    icon: AlertCircle,
    textClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/30',
    badgeVariant: 'destructive',
  },
  warning: {
    label: 'Warnings',
    icon: AlertTriangle,
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-400/10',
    borderClass: 'border-amber-400/30',
    badgeVariant: 'outline',
  },
  info: {
    label: 'Info',
    icon: Info,
    textClass: 'text-blue-400',
    bgClass: 'bg-blue-400/10',
    borderClass: 'border-blue-400/30',
    badgeVariant: 'secondary',
  },
};

const SEVERITY_ORDER: ImportWarningSeverity[] = ['error', 'warning', 'info'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportWarningsPanelProps {
  /** The list of warnings generated from an import operation. */
  warnings: ImportWarning[];
  /** Called when the user dismisses the panel. */
  onDismiss: () => void;
  /** The filename that was imported (for display). */
  fileName?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ImportWarningsPanelInner({
  warnings,
  onDismiss,
  fileName,
}: ImportWarningsPanelProps) {
  const [expandedSeverities, setExpandedSeverities] = useState<Record<string, boolean>>({
    error: true,
    warning: true,
    info: false,
  });

  const groups = useMemo(() => groupWarningsBySeverity(warnings), [warnings]);
  const summary = useMemo(() => getWarningSummary(warnings), [warnings]);

  const toggleSeverity = useCallback((severity: string) => {
    setExpandedSeverities((prev) => ({ ...prev, [severity]: !prev[severity] }));
  }, []);

  if (warnings.length === 0) {
    return null;
  }

  return (
    <div
      className="border border-border/50 bg-card/30 backdrop-blur mt-2"
      data-testid="import-warnings-panel"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-foreground">
            Import Warnings
          </span>
          {fileName && (
            <span className="text-[10px] text-muted-foreground ml-1.5">
              ({fileName})
            </span>
          )}
        </div>
        <Badge
          variant="outline"
          className="text-[10px] font-mono text-muted-foreground border-border pointer-events-none select-none"
          data-testid="import-warnings-summary"
        >
          {summary}
        </Badge>
        <button
          className="p-1 text-muted-foreground hover:text-foreground transition-colors focus-ring"
          onClick={onDismiss}
          aria-label="Dismiss import warnings"
          data-testid="import-warnings-dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Severity groups */}
      <div className="divide-y divide-border/20">
        {SEVERITY_ORDER.map((severity) => {
          const items = groups[severity];
          if (items.length === 0) {
            return null;
          }

          const config = SEVERITY_CONFIG[severity];
          const SevIcon = config.icon;
          const isExpanded = expandedSeverities[severity] !== false;

          return (
            <div key={severity} data-testid={`import-warnings-group-${severity}`}>
              <button
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
                  'hover:bg-muted/20 focus-ring',
                )}
                onClick={() => toggleSeverity(severity)}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${config.label}`}
                data-testid={`import-warnings-toggle-${severity}`}
              >
                {isExpanded
                  ? <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
                  : <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
                }
                <SevIcon className={cn('w-3.5 h-3.5 shrink-0', config.textClass)} />
                <span className={cn('font-medium', config.textClass)}>
                  {config.label}
                </span>
                <Badge
                  variant={config.badgeVariant}
                  className="text-[10px] font-mono ml-auto"
                  data-testid={`import-warnings-count-${severity}`}
                >
                  {items.length}
                </Badge>
              </button>

              {isExpanded && (
                <div className="px-3 pb-2 space-y-1">
                  {items.map((warning, index) => (
                    <div
                      key={`${warning.entity}-${String(index)}`}
                      className={cn(
                        'flex items-start gap-2 px-2 py-1.5 rounded-sm text-[11px]',
                        config.bgClass,
                        'border',
                        config.borderClass,
                      )}
                      data-testid={`import-warning-item-${severity}-${String(index)}`}
                    >
                      <Badge
                        variant="outline"
                        className="text-[9px] font-mono shrink-0 mt-0.5"
                        data-testid={`import-warning-type-${severity}-${String(index)}`}
                      >
                        {getWarningTypeLabel(warning.type)}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground">
                          {warning.entity}
                        </span>
                        <span className="text-muted-foreground ml-1">
                          {warning.detail}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ImportWarningsPanel = memo(ImportWarningsPanelInner);

export default ImportWarningsPanel;
