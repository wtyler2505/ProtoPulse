import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ComponentValidationIssue } from '@shared/component-types';
import { AlertCircle, AlertTriangle, Info, CheckCircle, ArrowRight } from 'lucide-react';

interface ValidationModalProps {
  open: boolean;
  onClose: () => void;
  issues: ComponentValidationIssue[];
  onNavigate?: (issue: ComponentValidationIssue) => void;
}

const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };

const severityConfig = {
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10', label: 'errors' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'warnings' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'info' },
} as const;

export default function ValidationModal({ open, onClose, issues, onNavigate }: ValidationModalProps) {
  const sorted = [...issues].sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg bg-card border-border" data-testid="validation-modal">
        <DialogHeader>
          <DialogTitle className="text-foreground">Validation Results</DialogTitle>
          <DialogDescription className="sr-only">Component validation errors, warnings, and information</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 text-sm py-2">
          {errorCount > 0 && (
            <span className="text-red-400 font-medium">{errorCount} {errorCount === 1 ? 'error' : 'errors'}</span>
          )}
          {warningCount > 0 && (
            <span className="text-amber-400 font-medium">{warningCount} {warningCount === 1 ? 'warning' : 'warnings'}</span>
          )}
          {infoCount > 0 && (
            <span className="text-blue-400 font-medium">{infoCount} info</span>
          )}
        </div>

        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <CheckCircle className="w-12 h-12 text-green-400" />
            <p className="text-green-400 font-medium text-lg">All checks passed!</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {sorted.map((issue) => {
              const config = severityConfig[issue.severity];
              const Icon = config.icon;
              const isClickable = !!(onNavigate && (issue.view || issue.elementId || /title|description/i.test(issue.message)));
              return (
                {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions -- Phase 3 InteractiveCard migration (Plan 03-a11y-systemic) */}
                <div
                  key={issue.id}
                  data-testid={`validation-issue-${issue.id}`}
                  className={`flex items-start gap-3 p-3 rounded-md ${config.bg} ${isClickable ? 'cursor-pointer hover:ring-1 hover:ring-foreground/20 transition-shadow' : ''}`}
                  onClick={isClickable ? () => onNavigate!(issue) : undefined}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                >
                  <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${config.color}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{issue.message}</p>
                    {issue.suggestion && (
                      <p className="text-xs text-muted-foreground mt-1">{issue.suggestion}</p>
                    )}
                  </div>
                  {isClickable && (
                    <ArrowRight className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="button-close-validation">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
