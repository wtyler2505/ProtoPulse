import { ArrowRight, Bot, CircuitBoard, Cpu, Globe2, HeartPulse, PenTool, Search, Sparkles, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import ComponentPlacer from '@/components/circuit-editor/ComponentPlacer';
import BreadboardStarterShelf from '@/components/circuit-editor/BreadboardStarterShelf';
import BreadboardBoardAuditPanel from '@/components/circuit-editor/BreadboardBoardAuditPanel';
import BreadboardQuickIntake from '@/components/circuit-editor/BreadboardQuickIntake';
import type { QuickIntakeItem } from '@/components/circuit-editor/BreadboardQuickIntake';
import type {
  BreadboardBenchInsight,
  BreadboardBenchSummary,
} from '@/lib/breadboard-bench';
import type { BoardAuditSummary } from '@/lib/breadboard-board-audit';
import type { PreflightResult } from '@/lib/breadboard-preflight';
import type {
  BreadboardChatActionId,
  BreadboardPlannerActionId,
} from '@/lib/breadboard-ai-prompts';
import type { BoardAuditIssue } from '@/lib/breadboard-board-audit';

interface BreadboardWorkbenchSidebarProps {
  benchInsights: Record<number, BreadboardBenchInsight>;
  benchSummary: BreadboardBenchSummary;
  boardAudit?: BoardAuditSummary | null;
  createPending: boolean;
  expandPending: boolean;
  hasCircuits: boolean;
  placedInstanceCount: number;
  wireCount: number;
  projectPartCount: number;
  onCreateCircuit: () => void;
  onOpenInventory: () => void;
  onOpenBenchChat: (actionId: BreadboardChatActionId) => void;
  onOpenBenchPlanner: (actionId: BreadboardPlannerActionId) => void;
  onOpenExactPartRequest: () => void;
  onExpandArchitecture: () => void;
  onOpenComponentEditor: () => void;
  onOpenCommunity: () => void;
  onOpenSchematic: () => void;
  onQuickAdd?: (item: QuickIntakeItem) => void;
  onFocusBoardIssue?: (issue: BoardAuditIssue) => void;
  onRunBoardAudit?: () => void;
  onRunPreflight?: () => void;
  preflightResult?: PreflightResult | null;
  onShopMissing?: () => void;
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function BreadboardWorkbenchSidebar({
  benchInsights,
  benchSummary,
  boardAudit,
  createPending,
  expandPending,
  hasCircuits,
  placedInstanceCount,
  wireCount,
  projectPartCount,
  onCreateCircuit,
  onOpenInventory,
  onOpenBenchChat,
  onOpenBenchPlanner,
  onOpenExactPartRequest,
  onExpandArchitecture,
  onOpenComponentEditor,
  onOpenCommunity,
  onOpenSchematic,
  onQuickAdd,
  onFocusBoardIssue,
  onRunBoardAudit,
  onRunPreflight,
  preflightResult,
  onShopMissing,
}: BreadboardWorkbenchSidebarProps) {
  return (
    <aside
      data-testid="breadboard-workbench"
      className="hidden w-[340px] shrink-0 border-r border-border/70 bg-[linear-gradient(180deg,rgba(10,14,20,0.95),rgba(8,10,16,0.92))] lg:flex lg:flex-col"
    >
      <div className="border-b border-border/60 p-4">
        <div className="rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),rgba(15,23,42,0.65)_55%,rgba(15,23,42,0.94))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/90">Breadboard Lab</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Build like a real bench session</h2>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-background/40 text-primary">
              <CircuitBoard className="h-5 w-5" />
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Drop starter parts for fast experiments, then pull in project-linked components when you need exact pin counts, metadata, and traceable design intent.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatChip label="Project Parts" value={String(projectPartCount)} />
            <StatChip label="Tracked" value={String(benchSummary.totals.trackedCount)} />
            <StatChip label="Owned" value={String(benchSummary.totals.ownedCount)} />
            <StatChip label="Placed" value={String(placedInstanceCount)} />
            <StatChip label="Bench-ready" value={String(benchSummary.totals.readyCount)} />
            <StatChip label="Low Stock" value={String(benchSummary.totals.lowStockCount)} />
            <StatChip label="Missing" value={String(benchSummary.totals.missingCount)} />
            <StatChip label="Verified" value={String(benchSummary.totals.verifiedCount)} />
            <StatChip label="Starter-safe" value={String(benchSummary.totals.starterFriendlyCount)} />
          </div>

          <div className="mt-4 space-y-2">
            {!hasCircuits && (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3">
                <p className="text-xs font-semibold text-foreground">No wiring canvas yet</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Spin up a circuit here and stay in Breadboard instead of bouncing back to Schematic just to get started.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    data-testid="button-create-workbench-circuit"
                    onClick={onCreateCircuit}
                    disabled={createPending}
                    className="gap-2"
                  >
                    <Cpu className="h-3.5 w-3.5" />
                    {createPending ? 'Creating…' : 'Create wiring canvas'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="button-expand-architecture-from-workbench"
                    onClick={onExpandArchitecture}
                    disabled={expandPending}
                    className="gap-2"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {expandPending ? 'Expanding…' : 'Expand architecture'}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                data-testid="button-open-breadboard-stash"
                onClick={onOpenInventory}
                className="gap-2"
              >
                <CircuitBoard className="h-3.5 w-3.5" />
                Manage stash
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                data-testid="button-open-schematic-from-breadboard"
                onClick={onOpenSchematic}
                className="gap-2"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Open schematic
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="button-open-component-editor-from-breadboard"
                onClick={onOpenComponentEditor}
                className="gap-2"
              >
                <PenTool className="h-3.5 w-3.5" />
                Component editor
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="button-open-community-from-breadboard"
                onClick={onOpenCommunity}
                className="gap-2"
              >
                <Globe2 className="h-3.5 w-3.5" />
                Community
              </Button>
              <div className="inline-flex items-center rounded-full border border-border/70 bg-background/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {String(wireCount)} live wires
              </div>
            </div>

            {onQuickAdd && (
              <div className="rounded-xl border border-border/60 bg-background/40 p-3" data-testid="breadboard-quick-intake-section">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quick Intake</p>
                <BreadboardQuickIntake onAdd={onQuickAdd} />
              </div>
            )}

            <div className="rounded-xl border border-primary/20 bg-background/40 p-3" data-testid="breadboard-bench-ai-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85">Bench AI</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Inventory-aware breadboard help, plus Gemini ER-style bench planning for real physical layouts.
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  data-testid="button-breadboard-exact-part-request"
                  onClick={onOpenExactPartRequest}
                  className="justify-start gap-2"
                >
                  <Search className="h-3.5 w-3.5" />
                  Resolve exact part request
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  data-testid="button-breadboard-ai-explain"
                  onClick={() => onOpenBenchChat('explain_breadboard')}
                  className="justify-start gap-2"
                >
                  <Bot className="h-3.5 w-3.5" />
                  Explain this breadboard
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  data-testid="button-breadboard-ai-diagnose"
                  onClick={() => onOpenBenchChat('diagnose_wiring')}
                  className="justify-start gap-2"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Diagnose likely wiring issues
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  data-testid="button-breadboard-ai-substitutes"
                  onClick={() => onOpenBenchChat('suggest_substitutes')}
                  className="justify-start gap-2"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Find stash substitutes
                </Button>
                <Button
                  type="button"
                  size="sm"
                  data-testid="button-breadboard-ai-stash-planner"
                  onClick={() => onOpenBenchPlanner('build_from_stash')}
                  className="justify-start gap-2"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Gemini ER: build from my stash
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="button-breadboard-ai-layout-planner"
                  onClick={() => onOpenBenchPlanner('plan_cleaner_layout')}
                  className="justify-start gap-2"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Gemini ER: cleaner layout plan
                </Button>
              </div>
            </div>
          </div>

          {/* Board Health audit card */}
          {onRunBoardAudit && (
            <div className="rounded-xl border border-primary/20 bg-background/40 p-3" data-testid="breadboard-board-health-card">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <HeartPulse className="h-3.5 w-3.5" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/85">Board Health</p>
              </div>
              <BreadboardBoardAuditPanel
                audit={boardAudit ?? null}
                onFocusIssue={onFocusBoardIssue}
                onRunAudit={onRunBoardAudit}
                onRunPreflight={onRunPreflight}
                preflightResult={preflightResult}
                benchInsights={Object.values(benchInsights)}
                onShopMissing={onShopMissing}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4 pt-3">
        <div className="flex h-full flex-col gap-3">
          <BreadboardStarterShelf />
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-card/55 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
            <ComponentPlacer
              benchInsights={benchInsights}
              breadboardMode
              title="Bench Shelf"
              subtitle="Inventory-aware project parts with fit guidance, trust labels, and storage hints."
              footerHint="Drag a project part onto the board for pin-aware placement. Use filters to stay inside your real stash."
              emptyMessage="No project parts yet. Use Starter Shelf now, or open Component Editor / Community to build your bench."
              className="h-full border-0 bg-transparent"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
