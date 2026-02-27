import { useMemo, useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import {
  useCircuitDesign,
  useCircuitInstances,
  useCircuitNets,
} from '@/lib/circuit-editor/hooks';
import { useComponentParts } from '@/lib/component-editor/hooks';
import { runERC, type ERCInput } from '@/lib/circuit-editor/erc-engine';
import type {
  ERCViolation,
  ERCRule,
  ERCRuleType,
  ERCSeverity,
  CircuitSettings,
} from '@shared/circuit-types';
import { DEFAULT_CIRCUIT_SETTINGS, DEFAULT_ERC_RULES } from '@shared/circuit-types';
import type { ComponentPart } from '@shared/schema';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Rule type display labels
// ---------------------------------------------------------------------------

const RULE_LABELS: Record<ERCRuleType, string> = {
  'unconnected-pin': 'Unconnected Pin',
  'shorted-power': 'Shorted Power',
  'floating-input': 'Floating Input',
  'missing-bypass-cap': 'Missing Bypass Cap',
  'driver-conflict': 'Driver Conflict',
  'no-connect-connected': 'No-Connect Connected',
  'power-net-unnamed': 'Power Net Unnamed',
};

// ---------------------------------------------------------------------------
// ERC Panel
// ---------------------------------------------------------------------------

interface ERCPanelProps {
  circuitId: number;
  onHighlightViolation?: (violation: ERCViolation | null) => void;
  onViolationsChange?: (violations: ERCViolation[]) => void;
}

export default function ERCPanel({ circuitId, onHighlightViolation, onViolationsChange }: ERCPanelProps) {
  const projectId = useProjectId();
  const { data: circuitDesign } = useCircuitDesign(projectId, circuitId);
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: nets } = useCircuitNets(circuitId);
  const { data: parts } = useComponentParts(projectId);
  const reactFlow = useReactFlow();

  const [violations, setViolations] = useState<ERCViolation[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [expandedRules, setExpandedRules] = useState<Set<ERCRuleType>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [rules, setRules] = useState<ERCRule[]>(DEFAULT_ERC_RULES);

  // Build parts map
  const partsMap = useMemo(() => {
    const map = new Map<number, ComponentPart>();
    parts?.forEach((p) => map.set(p.id, p));
    return map;
  }, [parts]);

  // Circuit settings
  const settings = useMemo<CircuitSettings>(() => ({
    ...DEFAULT_CIRCUIT_SETTINGS,
    ...(circuitDesign?.settings as Partial<CircuitSettings> | null),
  }), [circuitDesign?.settings]);

  // Run ERC
  const handleRunERC = useCallback(() => {
    if (!instances || !nets) return;

    const input: ERCInput = {
      instances,
      nets,
      partsMap,
      settings,
      rules,
    };

    const result = runERC(input);
    setViolations(result);
    setHasRun(true);
    onViolationsChange?.(result);

    // Auto-expand groups that have violations
    const typesWithViolations = new Set(result.map((v) => v.ruleType));
    setExpandedRules(typesWithViolations);
  }, [instances, nets, partsMap, settings, rules]);

  // Navigate to violation location
  const handleClickViolation = useCallback(
    (violation: ERCViolation) => {
      onHighlightViolation?.(violation);

      // Pan/zoom to violation location
      if (violation.location) {
        reactFlow.setCenter(violation.location.x, violation.location.y, {
          zoom: 1.5,
          duration: 400,
        });
      }
    },
    [reactFlow, onHighlightViolation],
  );

  // Toggle rule group expansion
  const toggleGroup = useCallback((ruleType: ERCRuleType) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleType)) {
        next.delete(ruleType);
      } else {
        next.add(ruleType);
      }
      return next;
    });
  }, []);

  // Toggle rule enabled
  const toggleRule = useCallback((ruleType: ERCRuleType) => {
    setRules((prev) =>
      prev.map((r) => (r.type === ruleType ? { ...r, enabled: !r.enabled } : r)),
    );
  }, []);

  // Toggle rule severity
  const cycleSeverity = useCallback((ruleType: ERCRuleType) => {
    setRules((prev) =>
      prev.map((r) =>
        r.type === ruleType
          ? { ...r, severity: (r.severity === 'error' ? 'warning' : 'error') as ERCSeverity }
          : r,
      ),
    );
  }, []);

  // Group violations by rule type
  const groupedViolations = useMemo(() => {
    const groups = new Map<ERCRuleType, ERCViolation[]>();
    for (const v of violations) {
      const existing = groups.get(v.ruleType) ?? [];
      existing.push(v);
      groups.set(v.ruleType, existing);
    }
    return groups;
  }, [violations]);

  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;

  return (
    <div className="flex flex-col h-full bg-card/40" data-testid="erc-panel">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-medium text-foreground flex-1">ERC</span>
        <button
          data-testid="button-erc-settings"
          onClick={() => setShowSettings((v) => !v)}
          className={cn(
            'p-1 rounded hover:bg-accent/50 transition-colors',
            showSettings && 'bg-accent text-accent-foreground',
          )}
          title="Rule settings"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
        <button
          data-testid="button-run-erc"
          onClick={handleRunERC}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-medium transition-colors"
          title="Run ERC"
        >
          <Play className="w-3 h-3" />
          Run
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="border-b border-border px-3 py-2 space-y-1" data-testid="erc-settings">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
            Rule Configuration
          </span>
          {rules.map((rule) => (
            <div key={rule.type} className="flex items-center gap-2 text-[10px]">
              <button
                data-testid={`erc-rule-toggle-${rule.type}`}
                onClick={() => toggleRule(rule.type)}
                className="p-0.5"
                title={rule.enabled ? 'Disable rule' : 'Enable rule'}
              >
                {rule.enabled ? (
                  <Eye className="w-3 h-3 text-foreground" />
                ) : (
                  <EyeOff className="w-3 h-3 text-muted-foreground/50" />
                )}
              </button>
              <button
                data-testid={`erc-rule-severity-${rule.type}`}
                onClick={() => cycleSeverity(rule.type)}
                className="p-0.5"
                title={`Severity: ${rule.severity} (click to toggle)`}
              >
                {rule.severity === 'error' ? (
                  <XCircle className="w-3 h-3 text-destructive" />
                ) : (
                  <AlertTriangle className="w-3 h-3 text-yellow-500" />
                )}
              </button>
              <span
                className={cn(
                  'flex-1 truncate',
                  rule.enabled ? 'text-foreground' : 'text-muted-foreground/50 line-through',
                )}
              >
                {RULE_LABELS[rule.type]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!hasRun ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 px-4 text-center">
            <AlertTriangle className="w-8 h-8 text-muted-foreground/20" />
            <span className="text-[10px]">Click &quot;Run&quot; to check for electrical rule violations</span>
          </div>
        ) : violations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-emerald-500 gap-2" data-testid="erc-clean">
            <CheckCircle2 className="w-8 h-8" />
            <span className="text-xs font-medium">No violations found</span>
          </div>
        ) : (
          <div className="py-1">
            {/* Summary bar */}
            <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] text-muted-foreground border-b border-border/50">
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="w-3 h-3" />
                  {errorCount} error{errorCount !== 1 ? 's' : ''}
                </span>
              )}
              {warningCount > 0 && (
                <span className="flex items-center gap-1 text-yellow-500">
                  <AlertTriangle className="w-3 h-3" />
                  {warningCount} warning{warningCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Grouped violations */}
            {Array.from(groupedViolations.entries()).map(([ruleType, ruleViolations]) => (
              <div key={ruleType} data-testid={`erc-group-${ruleType}`}>
                <button
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/30 transition-colors text-left"
                  onClick={() => toggleGroup(ruleType)}
                >
                  {expandedRules.has(ruleType) ? (
                    <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                  {ruleViolations[0].severity === 'error' ? (
                    <XCircle className="w-3 h-3 text-destructive shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />
                  )}
                  <span className="text-[10px] font-medium text-foreground flex-1 truncate">
                    {RULE_LABELS[ruleType]}
                  </span>
                  <span className="text-[9px] text-muted-foreground tabular-nums">
                    {ruleViolations.length}
                  </span>
                </button>

                {expandedRules.has(ruleType) && (
                  <div className="ml-5">
                    {ruleViolations.map((violation) => (
                      <button
                        key={violation.id}
                        data-testid={`erc-violation-${violation.id}`}
                        className="w-full flex items-start gap-1.5 px-2 py-1 hover:bg-accent/20 transition-colors text-left rounded-sm"
                        onClick={() => handleClickViolation(violation)}
                      >
                        <span className="text-[10px] text-muted-foreground leading-relaxed">
                          {violation.message}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
