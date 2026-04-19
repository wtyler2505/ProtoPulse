import { useMemo, useState } from 'react';
import { AlertTriangle, XCircle, PlayCircle, Eye, EyeOff, Shield, ChevronDown, ChevronRight, Download } from 'lucide-react';
import type { DRCViolation, DRCRule } from '@shared/component-types';
import { VaultExplainer } from '@/components/ui/vault-explainer';

interface DRCPanelProps {
  violations: DRCViolation[];
  onRunDRC: () => void;
  showOverlays: boolean;
  onToggleOverlays: () => void;
  onHighlight: (shapeIds: string[]) => void;
  rules: DRCRule[];
  onUpdateRule: (index: number, updates: Partial<DRCRule>) => void;
}

function formatRuleType(type: string): string {
  return type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatParamKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

function downloadJSON(violations: DRCViolation[], filename: string) {
  const report = {
    generatedAt: new Date().toISOString(),
    totalViolations: violations.length,
    errors: violations.filter(v => v.severity === 'error').length,
    warnings: violations.filter(v => v.severity === 'warning').length,
    violations: violations.map(v => ({
      id: v.id,
      ruleType: v.ruleType,
      severity: v.severity,
      message: v.message,
      view: v.view,
      location: v.location,
      actual: v.actual,
      required: v.required,
    })),
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(violations: DRCViolation[], filename: string) {
  const header = 'Rule Type,Severity,Message,View,Location X,Location Y,Actual,Required\n';
  const rows = violations.map(v =>
    `"${v.ruleType}","${v.severity}","${v.message.replace(/"/g, '""')}","${v.view}",${v.location.x.toFixed(1)},${v.location.y.toFixed(1)},${v.actual ?? ''},${v.required ?? ''}`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DRCPanel({ violations, onRunDRC, showOverlays, onToggleOverlays, onHighlight, rules, onUpdateRule }: DRCPanelProps) {
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const grouped = useMemo(() => {
    const errors = violations.filter(v => v.severity === 'error');
    const warnings = violations.filter(v => v.severity === 'warning');
    return { errors, warnings };
  }, [violations]);

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (grouped.errors.length > 0) parts.push(`${grouped.errors.length} error${grouped.errors.length !== 1 ? 's' : ''}`);
    if (grouped.warnings.length > 0) parts.push(`${grouped.warnings.length} warning${grouped.warnings.length !== 1 ? 's' : ''}`);
    return parts.join(', ');
  }, [grouped]);

  const sortedViolations = useMemo(() => [...grouped.errors, ...grouped.warnings], [grouped]);

  return (
    <div
      className="w-60 border-l border-border bg-background flex flex-col"
      data-testid="drc-panel"
    >
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">DRC</span>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border flex flex-col gap-2">
        <button
          data-testid="button-run-drc"
          onClick={onRunDRC}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-editor-accent/10 text-editor-accent hover:bg-editor-accent/20 transition-colors w-full justify-center"
        >
          <PlayCircle className="w-3.5 h-3.5" />
          Run DRC
        </button>
        <button
          data-testid="button-toggle-drc-overlays"
          onClick={onToggleOverlays}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors w-full"
        >
          {showOverlays ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          Show overlays on canvas
        </button>
        {violations.length > 0 && (
          <div className="flex gap-1.5 mt-1.5">
            <button
              data-testid="button-export-drc-json"
              onClick={() => downloadJSON(violations, 'drc-report.json')}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Download className="w-3 h-3" />
              JSON
            </button>
            <button
              data-testid="button-export-drc-csv"
              onClick={() => downloadCSV(violations, 'drc-report.csv')}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Download className="w-3 h-3" />
              CSV
            </button>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-b border-border">
        <button
          onClick={() => setRulesExpanded(v => !v)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full"
          data-testid="button-toggle-drc-rules"
        >
          {rulesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Rules ({rules.filter(r => r.enabled).length}/{rules.length})
        </button>
        {rulesExpanded && (
          <div className="mt-2 flex flex-col gap-2">
            {rules.map((rule, idx) => (
              <div key={rule.type} className="flex flex-col gap-1" data-testid={`drc-rule-${rule.type}`}>
                <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => onUpdateRule(idx, { enabled: e.target.checked })}
                    className="w-3 h-3 accent-editor-accent"
                    data-testid={`checkbox-rule-${rule.type}`}
                  />
                  <span className={rule.enabled ? 'text-foreground' : 'text-muted-foreground line-through'}>
                    {formatRuleType(rule.type)}
                  </span>
                  <span className={`ml-auto text-[9px] px-1 rounded ${rule.severity === 'error' ? 'bg-red-400/10 text-red-400' : 'bg-amber-400/10 text-amber-400'}`}>
                    {rule.severity}
                  </span>
                </label>
                {rule.enabled && Object.keys(rule.params).length > 0 && (
                  <div className="ml-5 flex flex-wrap gap-1.5">
                    {Object.entries(rule.params).map(([key, value]) => (
                      <label key={key} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <span>{formatParamKey(key)}</span>
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            onUpdateRule(idx, { params: { ...rule.params, [key]: val } });
                          }}
                          className="w-12 h-4 text-[9px] bg-card border border-border rounded px-1 text-foreground"
                          data-testid={`input-rule-${rule.type}-${key}`}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {summary && (
        <div
          className="px-3 py-1.5 border-b border-border"
          data-testid="drc-summary"
        >
          <span className="text-[10px] text-muted-foreground">{summary}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {sortedViolations.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No DRC violations found
          </div>
        ) : (
          <div className="py-1">
            {sortedViolations.map(v => (
              <div
                key={v.id}
                data-testid={`drc-violation-${v.id}`}
                className="px-3 py-1.5 flex flex-col gap-1.5"
              >
                <button
                  type="button"
                  onClick={() => onHighlight(v.shapeIds)}
                  className="w-full text-left flex items-start gap-2 cursor-pointer rounded hover:bg-muted/50 transition-colors"
                  data-testid={`drc-violation-${v.id}-highlight`}
                >
                  {v.severity === 'error' ? (
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <span className="text-[11px] text-foreground/80 leading-tight">{v.message}</span>
                </button>
                {/* TODO(plan-11-validation-simulation): swap `topic={v.ruleType}` for `slug={v.vaultSlug}` once DRCViolation type ships a vaultSlug field (DRC rule registry). Until then the primitive's toSlug() slugifies ruleType — close enough for graceful 404 fallback. */}
                <VaultExplainer
                  topic={v.ruleType}
                  className="ml-5"
                >
                  Why is this wrong?
                </VaultExplainer>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
