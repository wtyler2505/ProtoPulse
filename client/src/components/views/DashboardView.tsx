/* eslint-disable jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
import { useMemo, useState } from 'react';
import {
  LayoutGrid,
  GitBranch,
  Package,
  DollarSign,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  User,
  Bot,
  Boxes,
  TrendingUp,
  CircuitBoard,
} from 'lucide-react';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useValidation } from '@/lib/contexts/validation-context';
import { useHistory } from '@/lib/contexts/history-context';
import { useProjectMeta } from '@/lib/project-context';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { VaultHoverCard } from '@/components/ui/vault-hover-card';
import { cn } from '@/lib/utils';
import WelcomeOverlay, { isOnboardingDismissed, dismissOnboarding } from './WelcomeOverlay';
import type { ViewMode } from '@/lib/project-context';

/** Format a currency value in USD. */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format a relative time string from an ISO timestamp. */
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return 'just now';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr}h ago`;
  }
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/** Stat pill used in the quick stats bar. */
function StatPill({
  icon: Icon,
  label,
  value,
  testId,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  testId: string;
  accent?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex items-center gap-2 px-3 py-2 bg-card/60 border border-border rounded-lg"
    >
      <Icon className={cn('w-4 h-4', accent ?? 'text-primary')} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

export default function DashboardView() {
  const { nodes, edges } = useArchitecture();
  const { bom } = useBom();
  const { issues } = useValidation();
  const { history } = useHistory();
  const { projectName, projectDescription, setActiveView } = useProjectMeta();

  // --- Architecture stats ---
  const archStats = useMemo(() => {
    const typeMap: Record<string, number> = {};
    for (const node of nodes) {
      const nodeType = (node.data as Record<string, unknown>)?.type as string | undefined ?? 'unknown';
      typeMap[nodeType] = (typeMap[nodeType] ?? 0) + 1;
    }
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    // Connection density = edges / max possible edges (n*(n-1)/2)
    const maxEdges = nodeCount > 1 ? (nodeCount * (nodeCount - 1)) / 2 : 1;
    const density = nodeCount > 1 ? edgeCount / maxEdges : 0;

    return { nodeCount, edgeCount, typeMap, density };
  }, [nodes, edges]);

  // --- BOM stats ---
  const bomStats = useMemo(() => {
    const totalParts = bom.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueParts = bom.length;
    const totalCost = bom.reduce((sum, item) => sum + item.totalPrice, 0);
    const statusBreakdown = {
      'In Stock': 0,
      'Low Stock': 0,
      'Out of Stock': 0,
      'On Order': 0,
    };
    for (const item of bom) {
      statusBreakdown[item.status] += 1;
    }
    return { totalParts, uniqueParts, totalCost, statusBreakdown };
  }, [bom]);

  // --- Validation stats ---
  // E2E-015: "All Checks Passing" must NOT show on an empty project. Empty designs
  // aren't "passing" — there's nothing to validate. Derive `hasDesign` from
  // architecture nodes + BOM items; when absent, show a neutral "no design" state
  // instead of a green pass indicator.
  const validationStats = useMemo(() => {
    const breakdown = { error: 0, warning: 0, info: 0 };
    for (const issue of issues) {
      if (issue.severity in breakdown) {
        breakdown[issue.severity as keyof typeof breakdown] += 1;
      }
    }
    const hasDesign = nodes.length > 0 || bom.length > 0;
    const noDesign = !hasDesign;
    const allPassing = hasDesign && issues.length === 0;
    const hasErrors = breakdown.error > 0;
    return { total: issues.length, breakdown, allPassing, hasErrors, noDesign };
  }, [issues, nodes, bom]);

  // --- Recent history (last 5) ---
  const recentHistory = useMemo(() => {
    return [...history]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [history]);

  const handleNavigate = (view: ViewMode) => {
    setActiveView(view);
  };

  // UI-01: Show onboarding when project is empty and user hasn't dismissed
  const isProjectEmpty = archStats.nodeCount === 0 && bomStats.uniqueParts === 0 && recentHistory.length === 0;
  const [onboardingDismissed, setOnboardingDismissed] = useState(isOnboardingDismissed);

  const showOnboarding = isProjectEmpty && !onboardingDismissed;

  const handleDismissOnboarding = () => {
    dismissOnboarding();
    setOnboardingDismissed(true);
  };

  if (showOnboarding) {
    return (
      <WelcomeOverlay
        onNavigate={handleNavigate}
        onDismiss={handleDismissOnboarding}
      />
    );
  }

  return (
    <div
      data-testid="dashboard-view"
      className="h-full overflow-auto bg-background/50 p-4 md:p-6"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Project header */}
        <div data-testid="dashboard-header">
          <h2 className="text-xl md:text-2xl font-display font-bold text-foreground">
            {projectName}
          </h2>
          {projectDescription && (
            <p className="text-sm text-muted-foreground mt-1">{projectDescription}</p>
          )}
        </div>

        {/* Quick stats bar */}
        <div
          data-testid="dashboard-quick-stats"
          className="flex flex-wrap gap-2"
        >
          <StatPill
            icon={LayoutGrid}
            label="Components"
            value={archStats.nodeCount}
            testId="stat-components"
          />
          <StatPill
            icon={GitBranch}
            label="Connections"
            value={archStats.edgeCount}
            testId="stat-connections"
          />
          <StatPill
            icon={Package}
            label="BOM Items"
            value={bomStats.uniqueParts}
            testId="stat-bom-items"
          />
          <StatPill
            icon={DollarSign}
            label="Est. Cost"
            value={formatCurrency(bomStats.totalCost)}
            testId="stat-total-cost"
          />
          <StatPill
            icon={AlertTriangle}
            label="Issues"
            value={validationStats.total}
            testId="stat-issues"
            accent={validationStats.hasErrors ? 'text-destructive' : validationStats.total > 0 ? 'text-yellow-500' : 'text-emerald-500'}
          />
        </div>

        {/* Main cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Architecture Summary Card */}
          <Card
            data-testid="dashboard-card-architecture"
            className="bg-card/60 backdrop-blur-xl border-border hover:border-primary/30 transition-colors cursor-pointer"
            onClick={() => handleNavigate('architecture')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNavigate('architecture');
              }
            }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <LayoutGrid className="w-4 h-4 text-primary" />
                Architecture
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div data-testid="arch-stat-nodes" className="text-center">
                  <div className="text-2xl font-bold text-foreground">{archStats.nodeCount}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nodes</div>
                </div>
                <div data-testid="arch-stat-edges" className="text-center">
                  <div className="text-2xl font-bold text-foreground">{archStats.edgeCount}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Edges</div>
                </div>
                <div data-testid="arch-stat-density" className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {(archStats.density * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Density</div>
                </div>
              </div>

              {Object.keys(archStats.typeMap).length > 0 && (
                <div data-testid="arch-type-distribution" className="space-y-1.5 pt-2 border-t border-border/50">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Node Types
                  </div>
                  {/* TODO(plan-04-wave-3): map arch node types to canonical vault MOC slugs (microcontroller → moc-microcontrollers, sensor → moc-sensors, etc.) instead of relying on primitive's slugifier. Requires a type→slug registry in a shared constants file. */}
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(archStats.typeMap)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <VaultHoverCard key={type} topic={type}>
                          <span
                            data-testid={`arch-type-${type}`}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 rounded cursor-help"
                          >
                            {type}
                            <span className="text-muted-foreground">{count}</span>
                          </span>
                        </VaultHoverCard>
                      ))}
                  </div>
                </div>
              )}

              {archStats.nodeCount === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No architecture nodes yet. Start designing!
                </p>
              )}
            </CardContent>
          </Card>

          {/* BOM Summary Card */}
          <Card
            data-testid="dashboard-card-bom"
            className="bg-card/60 backdrop-blur-xl border-border hover:border-primary/30 transition-colors cursor-pointer"
            onClick={() => handleNavigate('procurement')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNavigate('procurement');
              }
            }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Boxes className="w-4 h-4 text-primary" />
                Bill of Materials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div data-testid="bom-stat-total" className="text-center">
                  <div className="text-2xl font-bold text-foreground">{bomStats.totalParts}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Qty</div>
                </div>
                <div data-testid="bom-stat-unique" className="text-center">
                  <div className="text-2xl font-bold text-foreground">{bomStats.uniqueParts}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unique</div>
                </div>
                <div data-testid="bom-stat-cost" className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {formatCurrency(bomStats.totalCost)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. Cost</div>
                </div>
              </div>

              {bomStats.uniqueParts > 0 && (
                <div data-testid="bom-status-breakdown" className="space-y-1.5 pt-2 border-t border-border/50">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Stock Status
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.entries(bomStats.statusBreakdown) as Array<[string, number]>).map(
                      ([status, count]) => (
                        <div
                          key={status}
                          data-testid={`bom-status-${status.toLowerCase().replace(/\s/g, '-')}`}
                          className="flex items-center justify-between px-2 py-1 text-[10px] font-mono bg-muted/30 rounded"
                        >
                          <span
                            className={cn(
                              status === 'In Stock' && 'text-emerald-500',
                              status === 'Low Stock' && 'text-yellow-500',
                              status === 'Out of Stock' && 'text-destructive',
                              status === 'On Order' && 'text-primary',
                            )}
                          >
                            {status}
                          </span>
                          <span className="text-foreground font-semibold">{count}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {bomStats.uniqueParts === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No BOM items yet. Add parts in Procurement.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Validation Summary Card */}
          <Card
            data-testid="dashboard-card-validation"
            className="bg-card/60 backdrop-blur-xl border-border hover:border-primary/30 transition-colors cursor-pointer"
            onClick={() => handleNavigate('validation')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNavigate('validation');
              }
            }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="w-4 h-4 text-primary" />
                Validation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Pass/Fail indicator */}
              <div data-testid="validation-status-indicator" className="flex items-center gap-3">
                {validationStats.noDesign ? (
                  <>
                    <CircuitBoard className="w-8 h-8 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-semibold text-muted-foreground">No design to validate yet</div>
                      <div className="text-[10px] text-muted-foreground">Add components to begin</div>
                    </div>
                  </>
                ) : validationStats.allPassing ? (
                  <>
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <div>
                      <div className="text-sm font-semibold text-emerald-500">All Checks Passing</div>
                      <div className="text-[10px] text-muted-foreground">No issues detected</div>
                    </div>
                  </>
                ) : validationStats.hasErrors ? (
                  <>
                    <XCircle className="w-8 h-8 text-destructive" />
                    <div>
                      <div className="text-sm font-semibold text-destructive">Issues Found</div>
                      <div className="text-[10px] text-muted-foreground">
                        {validationStats.total} issue{validationStats.total !== 1 ? 's' : ''} require attention
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-8 h-8 text-yellow-500" />
                    <div>
                      <div className="text-sm font-semibold text-yellow-500">Warnings Present</div>
                      <div className="text-[10px] text-muted-foreground">
                        {validationStats.total} issue{validationStats.total !== 1 ? 's' : ''} to review
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Severity breakdown */}
              {validationStats.total > 0 && (
                <div data-testid="validation-severity-breakdown" className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                  <div
                    data-testid="validation-errors"
                    className="flex items-center gap-1.5 px-2 py-1.5 bg-destructive/10 rounded text-center"
                  >
                    <XCircle className="w-3.5 h-3.5 text-destructive" />
                    <span className="text-xs text-destructive font-semibold">{validationStats.breakdown.error}</span>
                    <span className="text-[10px] text-muted-foreground">errors</span>
                  </div>
                  <div
                    data-testid="validation-warnings"
                    className="flex items-center gap-1.5 px-2 py-1.5 bg-yellow-500/10 rounded text-center"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                    <span className="text-xs text-yellow-500 font-semibold">{validationStats.breakdown.warning}</span>
                    <span className="text-[10px] text-muted-foreground">warnings</span>
                  </div>
                  <div
                    data-testid="validation-infos"
                    className="flex items-center gap-1.5 px-2 py-1.5 bg-primary/10 rounded text-center"
                  >
                    <Info className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs text-primary font-semibold">{validationStats.breakdown.info}</span>
                    <span className="text-[10px] text-muted-foreground">info</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Card */}
          <Card
            data-testid="dashboard-card-activity"
            className="bg-card/60 backdrop-blur-xl border-border"
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="w-4 h-4 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentHistory.length > 0 ? (
                <div className="space-y-2">
                  {recentHistory.map((item) => (
                    <div
                      key={item.id}
                      data-testid={`activity-item-${item.id}`}
                      className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-b-0"
                    >
                      <div className="mt-0.5">
                        {item.user === 'AI' ? (
                          <Bot className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate">{item.action}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(item.timestamp)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0',
                          item.user === 'AI'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted/50 text-muted-foreground',
                        )}
                      >
                        {item.user}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No activity recorded yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
