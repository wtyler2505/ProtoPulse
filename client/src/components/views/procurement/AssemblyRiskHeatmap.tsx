import { useState, useMemo, useCallback } from 'react';
import { AlertTriangle, ArrowUpDown, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  calculateAssemblyRisks,
  getRiskColor,
  getRiskLevel,
  getOverallRiskLevel,
  getRiskLevelLabel,
  getRiskLevelBadgeClasses,
  sortRisks,
} from '@/lib/assembly-risk';
import type { BomItem } from '@/lib/project-context';
import type { AssemblyRisk, RiskSortField, SortDirection, RiskLevel } from '@/lib/assembly-risk';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AssemblyRiskHeatmapProps {
  bom: BomItem[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOARD_WIDTH = 600;
const BOARD_HEIGHT = 400;
const BOARD_PADDING = 40;
const COMPONENT_SIZE = 28;

const RISK_LEGEND: { level: RiskLevel; label: string; range: string; color: string }[] = [
  { level: 'low', label: 'Low', range: '0–25', color: '#22c55e' },
  { level: 'medium', label: 'Medium', range: '26–50', color: '#eab308' },
  { level: 'high', label: 'High', range: '51–75', color: '#f97316' },
  { level: 'critical', label: 'Critical', range: '76–100', color: '#ef4444' },
];

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

/** Distribute components across the board in a grid pattern. */
function layoutComponents(count: number): { x: number; y: number }[] {
  if (count === 0) { return []; }

  const usableW = BOARD_WIDTH - BOARD_PADDING * 2;
  const usableH = BOARD_HEIGHT - BOARD_PADDING * 2;
  const cols = Math.ceil(Math.sqrt(count * (usableW / usableH)));
  const rows = Math.ceil(count / cols);
  const cellW = usableW / cols;
  const cellH = usableH / rows;

  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: BOARD_PADDING + col * cellW + cellW / 2,
      y: BOARD_PADDING + row * cellH + cellH / 2,
    });
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RiskLegend() {
  return (
    <div className="flex items-center gap-4 flex-wrap" data-testid="risk-legend">
      {RISK_LEGEND.map((entry) => (
        <div key={entry.level} className="flex items-center gap-1.5 text-xs">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: entry.color }}
            data-testid={`legend-${entry.level}`}
          />
          <span className="text-muted-foreground">
            {entry.label} ({entry.range})
          </span>
        </div>
      ))}
    </div>
  );
}

function OverallRiskBadge({ risks }: { risks: AssemblyRisk[] }) {
  const level = getOverallRiskLevel(risks);
  const label = getRiskLevelLabel(level);
  const badgeClasses = getRiskLevelBadgeClasses(level);

  return (
    <Badge
      variant="outline"
      className={cn('text-sm px-3 py-1', badgeClasses)}
      data-testid="overall-risk-badge"
    >
      <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
      {label}
    </Badge>
  );
}

function BoardSvg({
  risks,
  selectedRefDes,
  onSelect,
}: {
  risks: AssemblyRisk[];
  selectedRefDes: string | null;
  onSelect: (refDes: string | null) => void;
}) {
  const positions = useMemo(() => layoutComponents(risks.length), [risks.length]);

  return (
    <svg
      viewBox={`0 0 ${String(BOARD_WIDTH)} ${String(BOARD_HEIGHT)}`}
      className="w-full max-w-[640px] bg-card/50 rounded-lg border border-border"
      data-testid="risk-board-svg"
    >
      {/* Board outline */}
      <rect
        x={8}
        y={8}
        width={BOARD_WIDTH - 16}
        height={BOARD_HEIGHT - 16}
        rx={8}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth={2}
        strokeDasharray="6 3"
      />

      {/* Mounting holes */}
      {[
        { cx: 24, cy: 24 },
        { cx: BOARD_WIDTH - 24, cy: 24 },
        { cx: 24, cy: BOARD_HEIGHT - 24 },
        { cx: BOARD_WIDTH - 24, cy: BOARD_HEIGHT - 24 },
      ].map((hole, i) => (
        <circle
          key={i}
          cx={hole.cx}
          cy={hole.cy}
          r={6}
          fill="none"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1}
          opacity={0.3}
        />
      ))}

      {/* Component rectangles */}
      {risks.map((risk, i) => {
        const pos = positions[i];
        if (!pos) { return null; }
        const color = getRiskColor(risk.riskScore);
        const isSelected = selectedRefDes === risk.refDes;
        const half = COMPONENT_SIZE / 2;

        return (
          <g
            key={risk.refDes}
            className="cursor-pointer"
            onClick={() => onSelect(isSelected ? null : risk.refDes)}
            data-testid={`board-component-${risk.refDes}`}
          >
            <rect
              x={pos.x - half}
              y={pos.y - half}
              width={COMPONENT_SIZE}
              height={COMPONENT_SIZE}
              rx={3}
              fill={color}
              opacity={risk.riskScore === 0 ? 0.3 : 0.8}
              stroke={isSelected ? 'var(--color-editor-accent)' : 'none'}
              strokeWidth={isSelected ? 2.5 : 0}
            />
            <text
              x={pos.x}
              y={pos.y + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={8}
              fontWeight={600}
              style={{ pointerEvents: 'none' }}
            >
              {risk.refDes}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Risk table
// ---------------------------------------------------------------------------

function RiskTable({
  risks,
  selectedRefDes,
  onSelect,
}: {
  risks: AssemblyRisk[];
  selectedRefDes: string | null;
  onSelect: (refDes: string | null) => void;
}) {
  const [sortField, setSortField] = useState<RiskSortField>('riskScore');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [expandedRefDes, setExpandedRefDes] = useState<string | null>(null);

  const handleSort = useCallback((field: RiskSortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }, [sortField]);

  const sorted = useMemo(() => sortRisks(risks, sortField, sortDir), [risks, sortField, sortDir]);

  const SortHeader = ({ field, label }: { field: RiskSortField; label: string }) => (
    <button
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      {label}
      {sortField === field ? (
        sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );

  return (
    <div className="border border-border rounded-lg overflow-hidden" data-testid="risk-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-card/50 border-b border-border">
            <th className="px-3 py-2 text-left"><SortHeader field="refDes" label="Ref" /></th>
            <th className="px-3 py-2 text-left"><SortHeader field="partNumber" label="Part Number" /></th>
            <th className="px-3 py-2 text-left hidden sm:table-cell">Description</th>
            <th className="px-3 py-2 text-right"><SortHeader field="riskScore" label="Score" /></th>
            <th className="px-3 py-2 text-center"><SortHeader field="factors" label="Factors" /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((risk) => {
            const level = getRiskLevel(risk.riskScore);
            const isSelected = selectedRefDes === risk.refDes;
            const isExpanded = expandedRefDes === risk.refDes;

            return (
              <tr
                key={risk.refDes}
                className={cn(
                  'border-b border-border/50 cursor-pointer transition-colors hover:bg-card/30',
                  isSelected && 'bg-[var(--color-editor-accent)]/5 border-[var(--color-editor-accent)]/20',
                )}
                onClick={() => onSelect(isSelected ? null : risk.refDes)}
                data-testid={`risk-row-${risk.refDes}`}
              >
                <td className="px-3 py-2 font-mono text-xs">{risk.refDes}</td>
                <td className="px-3 py-2 font-mono text-xs">{risk.partNumber}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px] hidden sm:table-cell">
                  {risk.description}
                </td>
                <td className="px-3 py-2 text-right">
                  <Badge
                    variant="outline"
                    className={cn('text-xs tabular-nums', getRiskLevelBadgeClasses(level))}
                    data-testid={`score-badge-${risk.refDes}`}
                  >
                    {risk.riskScore}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-center">
                  {risk.factors.length > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedRefDes(isExpanded ? null : risk.refDes);
                      }}
                      data-testid={`expand-factors-${risk.refDes}`}
                    >
                      {risk.factors.length}
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3 ml-1" />
                      ) : (
                        <ChevronDown className="h-3 w-3 ml-1" />
                      )}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">0</span>
                  )}
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground text-sm">
                No BOM items to assess.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Expanded factor details */}
      {expandedRefDes && (() => {
        const risk = sorted.find((r) => r.refDes === expandedRefDes);
        if (!risk || risk.factors.length === 0) { return null; }
        return (
          <div
            className="bg-card/30 border-t border-border px-4 py-3 space-y-2"
            data-testid={`factors-detail-${expandedRefDes}`}
          >
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Risk factors for {expandedRefDes}:
            </div>
            {risk.factors.map((factor) => (
              <div key={factor.name} className="flex items-start gap-2">
                <div
                  className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                  style={{ backgroundColor: getRiskColor(factor.score * 100) }}
                />
                <div className="text-xs">
                  <span className="font-medium">{factor.name}</span>
                  <span className="text-muted-foreground ml-1">
                    (weight: {factor.weight}, score: {factor.score.toFixed(2)})
                  </span>
                  <p className="text-muted-foreground mt-0.5">{factor.description}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AssemblyRiskHeatmap({ bom }: AssemblyRiskHeatmapProps) {
  const [selectedRefDes, setSelectedRefDes] = useState<string | null>(null);

  const risks = useMemo(() => calculateAssemblyRisks(bom), [bom]);

  const riskStats = useMemo(() => {
    let low = 0;
    let medium = 0;
    let high = 0;
    let critical = 0;
    for (const r of risks) {
      const level = getRiskLevel(r.riskScore);
      if (level === 'low') { low++; }
      else if (level === 'medium') { medium++; }
      else if (level === 'high') { high++; }
      else { critical++; }
    }
    return { low, medium, high, critical };
  }, [risks]);

  if (bom.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground" data-testid="risk-empty">
        <AlertTriangle className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">Add BOM items to see assembly risk analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4" data-testid="assembly-risk-heatmap">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold">Assembly Risk Heatmap</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visual assessment of assembly difficulty for each component.
          </p>
        </div>
        <OverallRiskBadge risks={risks} />
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="risk-stats">
        {([
          { level: 'low' as const, count: riskStats.low, color: '#22c55e' },
          { level: 'medium' as const, count: riskStats.medium, color: '#eab308' },
          { level: 'high' as const, count: riskStats.high, color: '#f97316' },
          { level: 'critical' as const, count: riskStats.critical, color: '#ef4444' },
        ]).map((stat) => (
          <div
            key={stat.level}
            className="rounded-lg border border-border bg-card/30 p-3 text-center"
            data-testid={`risk-stat-${stat.level}`}
          >
            <div className="text-2xl font-bold tabular-nums" style={{ color: stat.color }}>
              {stat.count}
            </div>
            <div className="text-xs text-muted-foreground capitalize">{stat.level} Risk</div>
          </div>
        ))}
      </div>

      {/* Board visualization */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            Click a component to highlight it in the table.
          </div>
          <RiskLegend />
        </div>
        <BoardSvg risks={risks} selectedRefDes={selectedRefDes} onSelect={setSelectedRefDes} />
      </div>

      {/* Risk table */}
      <RiskTable risks={risks} selectedRefDes={selectedRefDes} onSelect={setSelectedRefDes} />
    </div>
  );
}
