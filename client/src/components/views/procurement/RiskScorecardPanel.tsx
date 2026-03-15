import { useState, useMemo, useCallback } from 'react';
import { Shield, ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useBom } from '@/lib/contexts/bom-context';
import { useValidation } from '@/lib/contexts/validation-context';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import {
  calculateScorecard,
  readinessColor,
  readinessLabel,
  severityClasses,
  CATEGORY_WEIGHTS,
} from '@/lib/risk-scorecard';
import type {
  ScorecardResult,
  ScorecardCategory,
  ScorecardCategoryId,
  ScorecardItem,
} from '@/lib/risk-scorecard';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<ScorecardCategoryId, string> = {
  drc: 'DRC',
  bom: 'BOM',
  manufacturing: 'Manufacturing',
  documentation: 'Documentation',
  testing: 'Testing',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TrafficLight({ result }: { result: ScorecardResult }) {
  const color = readinessColor(result.readiness);
  const label = readinessLabel(result.readiness);

  return (
    <div className="flex items-center gap-3" data-testid="traffic-light">
      <div
        className="w-5 h-5 rounded-full border-2"
        style={{ backgroundColor: color, borderColor: color, boxShadow: `0 0 8px ${color}40` }}
        data-testid={`traffic-light-${result.readiness}`}
      />
      <div>
        <div className="text-sm font-semibold" style={{ color }}>{label}</div>
        <div className="text-xs text-muted-foreground">
          Overall Score: <span className="font-mono tabular-nums">{result.overallScore}</span>/100
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="h-2 flex-1 rounded-full bg-muted/50 overflow-hidden" data-testid="score-bar">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${String(score)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function CategoryRow({
  category,
  expanded,
  onToggle,
}: {
  category: ScorecardCategory;
  expanded: boolean;
  onToggle: () => void;
}) {
  const passedCount = category.items.filter((i) => i.passed).length;
  const totalCount = category.items.length;
  const barColor = category.score >= 80 ? '#22c55e' : category.score >= 50 ? '#eab308' : '#ef4444';

  return (
    <div
      className="border border-border rounded-lg overflow-hidden"
      data-testid={`category-${category.id}`}
    >
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 bg-card/30 hover:bg-card/50 transition-colors text-left"
        onClick={onToggle}
        aria-expanded={expanded}
        data-testid={`category-toggle-${category.id}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{category.label}</span>
            <Badge variant="outline" className="text-xs tabular-nums">
              {Math.round(category.weight * 100)}%
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <ScoreBar score={category.score} color={barColor} />
            <span className="text-xs font-mono tabular-nums w-8 text-right">{category.score}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {passedCount}/{totalCount}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-border/50" data-testid={`category-items-${category.id}`}>
          {category.items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item }: { item: ScorecardItem }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-2.5 text-sm',
        item.passed ? 'bg-background/30' : 'bg-red-500/5',
      )}
      data-testid={`item-${item.id}`}
    >
      {item.passed ? (
        <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400 flex-shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 mt-0.5 text-red-400 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm', item.passed ? 'text-foreground' : 'text-red-300')}>
            {item.label}
          </span>
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 py-0', severityClasses(item.severity))}
          >
            {item.severity}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RiskScorecardPanel() {
  const { bom } = useBom();
  const { issues } = useValidation();
  const { nodes, edges } = useArchitecture();
  const [expandedId, setExpandedId] = useState<ScorecardCategoryId | null>(null);

  const result = useMemo(() => {
    const scorecardNodes = nodes.map((n) => ({
      id: String(n.id),
      label: typeof n.data?.label === 'string' ? n.data.label : String(n.id),
      type: String(n.type ?? 'default'),
      description: typeof n.data?.description === 'string' ? n.data.description : undefined,
    }));

    const scorecardEdges = edges.map((e) => ({
      id: String(e.id),
      source: e.source,
      target: e.target,
    }));

    return calculateScorecard({
      validationIssues: issues,
      bomItems: bom,
      nodes: scorecardNodes,
      edges: scorecardEdges,
    });
  }, [bom, issues, nodes, edges]);

  const toggleCategory = useCallback((id: ScorecardCategoryId) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const failedCount = result.categories.reduce(
    (acc, cat) => acc + cat.items.filter((i) => !i.passed).length,
    0,
  );

  return (
    <div className="space-y-6 p-4" data-testid="risk-scorecard-panel">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Risk Scorecard
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Release readiness assessment across 5 categories.
          </p>
        </div>
        <TrafficLight result={result} />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3" data-testid="scorecard-summary">
        <div className="rounded-lg border border-border bg-card/30 p-3 text-center">
          <div
            className="text-2xl font-bold tabular-nums"
            style={{ color: readinessColor(result.readiness) }}
            data-testid="overall-score"
          >
            {result.overallScore}
          </div>
          <div className="text-xs text-muted-foreground">Overall Score</div>
        </div>
        <div className="rounded-lg border border-border bg-card/30 p-3 text-center">
          <div className="text-2xl font-bold tabular-nums text-emerald-400" data-testid="checks-passed">
            {result.categories.reduce((acc, cat) => acc + cat.items.filter((i) => i.passed).length, 0)}
          </div>
          <div className="text-xs text-muted-foreground">Checks Passed</div>
        </div>
        <div className="rounded-lg border border-border bg-card/30 p-3 text-center">
          <div
            className={cn('text-2xl font-bold tabular-nums', failedCount > 0 ? 'text-red-400' : 'text-emerald-400')}
            data-testid="checks-failed"
          >
            {failedCount}
          </div>
          <div className="text-xs text-muted-foreground">Issues Found</div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="space-y-2" data-testid="category-list">
        {result.categories.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            expanded={expandedId === category.id}
            onToggle={() => toggleCategory(category.id)}
          />
        ))}
      </div>

      {/* Guidance footer */}
      {failedCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3" data-testid="scorecard-guidance">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-400 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Resolve failed checks to improve your release readiness score.
            Critical items have the highest impact on your overall score.
          </p>
        </div>
      )}
    </div>
  );
}
