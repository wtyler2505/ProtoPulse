import { useState } from 'react';
import { ChevronUp, X } from 'lucide-react';
import type { V3ArchitectureReadiness } from '@/lib/v3-architecture-live';
import type { V3ArchitectureCompileReport } from '@/lib/v3-architecture-compiler';
import type { V3ExecutionReadiness } from '@/lib/v3-execution-readiness';
import type { V3ResolvedHardwareFact } from '@/lib/v3-verified-fact-enrichment';
import { cn } from '@/lib/utils';

interface V3ArchitectureReadinessPanelProps {
  readiness: V3ArchitectureReadiness;
  compileReport?: V3ArchitectureCompileReport;
  executionReadiness?: V3ExecutionReadiness;
  resolvedFacts?: V3ResolvedHardwareFact[];
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
  factSaveState?: 'idle' | 'saving' | 'saved' | 'error';
  swarmSaveState?: 'idle' | 'saving' | 'saved' | 'error';
  assetManagerOpen?: boolean;
  onSaveCompileRun?: () => void;
  onSaveVerifiedFacts?: () => void;
  onSaveSwarmTasks?: () => void;
  onClose: () => void;
}

export function V3ArchitectureReadinessPanel({
  readiness,
  compileReport,
  executionReadiness,
  resolvedFacts = [],
  saveState = 'idle',
  factSaveState = 'idle',
  swarmSaveState = 'idle',
  assetManagerOpen = false,
  onSaveCompileRun,
  onSaveVerifiedFacts,
  onSaveSwarmTasks,
  onClose,
}: V3ArchitectureReadinessPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const ready = readiness.status === 'ready';
  const compileReady = compileReport?.status === 'ready';
  const executionReady = executionReadiness?.status === 'ready';
  const contentId = 'v3-architecture-readiness-content';

  return (
    <aside
      data-testid="v3-architecture-readiness-panel"
      data-collapsed={collapsed ? 'true' : 'false'}
      className={cn(
        'absolute z-40 flex-col overflow-hidden border border-border bg-card/95 shadow-2xl backdrop-blur-xl',
        collapsed ? 'min-h-0 resize-none' : 'min-h-64 resize',
        assetManagerOpen
          ? collapsed
            ? 'hidden md:bottom-4 md:left-[432px] md:right-auto md:top-auto md:flex md:w-[min(360px,calc(100%-444px))]'
            : 'hidden md:bottom-4 md:left-[432px] md:right-auto md:top-[4.25rem] md:flex md:w-[min(420px,calc(100%-444px))]'
          : collapsed
            ? 'inset-x-3 bottom-3 top-auto flex md:inset-x-auto md:bottom-16 md:right-3 md:w-[min(320px,calc(100%-1.5rem))]'
            : 'inset-x-3 bottom-3 top-16 flex md:inset-x-auto md:top-auto md:bottom-16 md:right-3 md:max-h-[calc(100%-5rem)] md:w-[min(380px,calc(100%-1.5rem))]',
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 px-3 py-2',
          !collapsed && 'border-b border-border',
        )}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">v3 Architecture Gate</div>
          <div className="truncate text-[11px] text-muted-foreground">Live xyflow to tldraw migration preview</div>
          {collapsed && (
            <div
              data-testid="v3-architecture-gate-summary"
              className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground"
            >
              <span
                className={cn(
                  'rounded-sm border px-1.5 py-0.5 font-semibold',
                  ready
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-400/40 bg-amber-500/10 text-amber-200',
                )}
              >
                {readiness.status}
              </span>
              <span className="rounded-sm border border-border/50 bg-muted/20 px-1.5 py-0.5">
                {readiness.nodeCount} nodes
              </span>
              <span className="rounded-sm border border-border/50 bg-muted/20 px-1.5 py-0.5">
                {readiness.edgeCount} edges
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-testid="v3-architecture-gate-collapse"
            aria-controls={contentId}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand v3 architecture gate' : 'Collapse v3 architecture gate'}
            className="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setCollapsed((value) => !value)}
          >
            <ChevronUp className={cn('h-3.5 w-3.5 transition-transform', collapsed && 'rotate-180')} />
          </button>
          <button
            type="button"
            aria-label="Close v3 architecture gate"
            className="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {!collapsed && (
        <div id={contentId} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 pr-2">
          <div className="grid grid-cols-4 gap-2">
            <Metric label="Status" value={readiness.status} tone={ready ? 'ready' : 'blocked'} />
            <Metric label="Nodes" value={readiness.nodeCount} />
            <Metric label="Edges" value={readiness.edgeCount} />
            <Metric label="Shapes" value={readiness.tldrawShapeCount} />
          </div>

          <div className="rounded-sm border border-cyan-400/25 bg-cyan-500/10 p-2" data-testid="v3-boundary-objects">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold text-cyan-200">Boundary objects</div>
                <div className="text-[10px] text-muted-foreground">Extracted from tldraw shape metadata</div>
              </div>
              <span className="rounded-sm border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-200">
                {readiness.boundaryObjectCount}
              </span>
            </div>
            {readiness.boundaryObjects.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {readiness.boundaryObjects.slice(0, 5).map((boundary) => (
                  <span
                    key={`${boundary.shapeId}:${boundary.id}`}
                    className="rounded-sm border border-border/50 bg-background/45 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {boundary.kind}: {boundary.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Add architecture nodes to extract typed v3 boundaries.
              </p>
            )}
          </div>

          <div className="rounded-sm border border-border/60 bg-muted/10 p-2">
            <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Metadata rules</div>
            <div className="flex flex-wrap gap-1">
              {readiness.metadataRules.map((rule) => (
                <span
                  key={rule.kind}
                  title={`${rule.detail} Required: ${rule.requiredFields.join(', ')}`}
                  className={cn(
                    'rounded-sm border px-1.5 py-0.5 text-[10px]',
                    rule.status === 'satisfied' && 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
                    rule.status === 'incomplete' && 'border-amber-400/40 bg-amber-500/10 text-amber-200',
                    rule.status === 'missing' && 'border-border/60 bg-background/40 text-muted-foreground',
                  )}
                >
                  {rule.kind}: {rule.status}
                </span>
              ))}
            </div>
            <div className="mt-2 space-y-1">
              {readiness.metadataRules
                .filter((rule) => rule.status !== 'satisfied')
                .slice(0, 3)
                .map((rule) => (
                  <div key={`${rule.kind}:detail`} className="text-[10px] leading-relaxed text-muted-foreground">
                    {rule.kind}: {rule.detail}
                  </div>
                ))}
            </div>
            {readiness.missingBoundaryKinds.length > 0 && (
              <div className="mt-1 text-[10px] text-muted-foreground">
                Missing metadata: {readiness.missingBoundaryKinds.join(', ')}
              </div>
            )}
          </div>

          <div className="rounded-sm border border-border/60 bg-background/40 p-2" data-testid="v3-migration-plan">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground">Migration plan</div>
                <div className="text-[10px] text-muted-foreground">
                  {readiness.migrationPlan.source} to {readiness.migrationPlan.target}
                </div>
              </div>
              <span className="rounded-sm border border-border/50 bg-muted/20 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {readiness.migrationPlan.steps.filter((step) => step.status === 'done').length}/
                {readiness.migrationPlan.steps.length}
              </span>
            </div>
            <div className="space-y-1">
              {readiness.migrationPlan.steps.map((step) => (
                <div key={step.id} className="rounded-sm border border-border/40 bg-muted/10 px-2 py-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-foreground">{step.label}</span>
                    <span
                      className={cn(
                        'rounded-sm border px-1.5 py-0.5 text-[10px]',
                        step.status === 'done' && 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
                        step.status === 'blocked' && 'border-amber-400/40 bg-amber-500/10 text-amber-200',
                        step.status === 'pending' && 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200',
                      )}
                    >
                      {step.status}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{step.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-sm border border-border/60 bg-muted/10 p-2">
            <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
              {ready ? 'Ready for v3 feature flag' : 'Blocked reasons'}
            </div>
            {readiness.blockedReasons.length > 0 ? (
              <ul className="space-y-1 text-[11px] leading-relaxed text-amber-200">
                {readiness.blockedReasons.map((reason) => (
                  <li key={reason}>- {reason}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] leading-relaxed text-emerald-200">
                Migration shape is ready. Keep xyflow live while v3 opens behind a feature flag.
              </p>
            )}
          </div>

          <div className="rounded-sm border border-primary/25 bg-primary/10 p-2" data-testid="v3-live-adoption-status">
            <div className="mb-1 text-[11px] font-semibold text-primary">Live app adoption</div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              v3 is now wired into the live Architecture view. The current xyflow canvas stays active while v3 compiles
              and verifies behind this gate.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <AdoptionStep label="Live app" value="active" tone="ready" />
              <AdoptionStep label="xyflow" value="coexists" />
              <AdoptionStep label="docs/v3" value="reference" />
            </div>
          </div>

          <div className="rounded-sm border border-border/60 bg-background/40 p-2" data-testid="v3-launch-checklist">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground">Launch checklist</div>
                <div className="text-[10px] text-muted-foreground">
                  What must be true before v3 becomes the main Architecture path
                </div>
              </div>
              <span
                className={cn(
                  'rounded-sm border px-1.5 py-0.5 text-[10px]',
                  ready && compileReady && executionReady
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-400/40 bg-amber-500/10 text-amber-200',
                )}
              >
                {ready && compileReady && executionReady ? 'ready' : 'blocked'}
              </span>
            </div>
            <div className="space-y-1">
              <LaunchChecklistItem label="Live panel wired" state="ok" />
              <LaunchChecklistItem label="Metadata gate" state={ready ? 'ok' : 'blocked'} />
              <LaunchChecklistItem label="Compile proof" state={compileReady ? 'ok' : 'blocked'} />
              <LaunchChecklistItem label="Swarm dispatch gate" state={executionReady ? 'ok' : 'blocked'} />
              <LaunchChecklistItem label="Tyler UI verification" state="pending" />
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">{readiness.nextStep}</p>

          <div
            className="rounded-sm border border-border/60 bg-background/40 p-2"
            data-testid="v3-verified-source-facts"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground">Verified sources</div>
                <div className="text-[10px] text-muted-foreground">Resolved from the ProtoPulse board source pack</div>
              </div>
              <span className="rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                {resolvedFacts.length}
              </span>
            </div>
            {resolvedFacts.length > 0 ? (
              <ul className="space-y-1 text-[11px] leading-relaxed text-emerald-200">
                {resolvedFacts.slice(0, 3).map((fact) => (
                  <li key={`${fact.sourceRef}:${fact.factType}`}>
                    - {fact.subject}: {fact.factType}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                No verified board-pack facts matched yet. Use exact part names like Arduino Mega 2560 R3.
              </p>
            )}
            {onSaveVerifiedFacts && (
              <button
                type="button"
                data-testid="v3-save-verified-facts"
                className="mt-2 w-full rounded-sm border border-emerald-400/30 bg-emerald-500/10 px-2 py-1.5 text-[11px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={factSaveState === 'saving' || resolvedFacts.length === 0}
                onClick={onSaveVerifiedFacts}
              >
                {factSaveState === 'saving'
                  ? 'Saving verified facts...'
                  : factSaveState === 'saved'
                    ? 'Verified facts saved'
                    : factSaveState === 'error'
                      ? 'Save facts failed, retry'
                      : 'Save verified facts'}
              </button>
            )}
          </div>

          {compileReport && (
            <div className="rounded-sm border border-border/60 bg-background/40 p-2" data-testid="v3-compile-report">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold text-muted-foreground">Live tscircuit compile</div>
                <span
                  className={cn(
                    'rounded-sm border px-1.5 py-0.5 text-[10px]',
                    compileReady
                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-amber-400/40 bg-amber-500/10 text-amber-200',
                  )}
                >
                  {compileReport.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Metric
                  label="Board"
                  value={`${compileReport.summary.boardWidth} x ${compileReport.summary.boardHeight}`}
                />
                <Metric
                  label="Parts"
                  value={
                    compileReport.summary.chips + compileReport.summary.connectors + compileReport.summary.passives
                  }
                />
                <Metric label="Traces" value={compileReport.summary.traces} />
              </div>
              {compileReport.blockedTasks.length > 0 ? (
                <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-amber-200">
                  {compileReport.blockedTasks.slice(0, 3).map((task, index) => (
                    <li key={`${task}:${String(index)}`}>- {task}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 text-[11px] leading-relaxed text-emerald-200">
                  Ready to emit TSX from verified architecture facts.
                </div>
              )}
              {compileReport.emittedTsx && (
                <pre className="mt-2 max-h-24 overflow-auto rounded-sm border border-border/50 bg-black/30 p-2 text-[10px] leading-relaxed text-muted-foreground">
                  {compileReport.emittedTsx}
                </pre>
              )}
              {onSaveCompileRun && (
                <button
                  type="button"
                  data-testid="v3-save-compile-run"
                  className="mt-2 w-full rounded-sm border border-primary/30 bg-primary/10 px-2 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saveState === 'saving'}
                  onClick={onSaveCompileRun}
                >
                  {saveState === 'saving'
                    ? 'Saving compile run...'
                    : saveState === 'saved'
                      ? 'Compile run saved'
                      : saveState === 'error'
                        ? 'Save failed, retry'
                        : 'Save compile run'}
                </button>
              )}
            </div>
          )}

          {executionReadiness && (
            <div
              className="rounded-sm border border-border/60 bg-background/40 p-2"
              data-testid="v3-execution-readiness"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground">Execution swarm</div>
                  <div className="text-[10px] text-muted-foreground">OpenAI Agents and Codex command gate</div>
                </div>
                <span
                  className={cn(
                    'rounded-sm border px-1.5 py-0.5 text-[10px]',
                    executionReady
                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-amber-400/40 bg-amber-500/10 text-amber-200',
                  )}
                >
                  {executionReadiness.status}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <Metric
                  label="Swarm"
                  value={`${executionReadiness.summary.workers}/6`}
                  tone={executionReadiness.swarmPlan.status === 'ready' ? 'ready' : 'blocked'}
                />
                <Metric
                  label="Agents"
                  value={executionReadiness.summary.openAIDispatches}
                  tone={executionReadiness.openAIDispatch.status === 'ready' ? 'ready' : 'blocked'}
                />
                <Metric
                  label="Codex"
                  value={executionReadiness.summary.codexCommands}
                  tone={executionReadiness.codexTemplates.status === 'ready' ? 'ready' : 'blocked'}
                />
                <Metric
                  label="Pins"
                  value={executionReadiness.summary.ownedPins}
                  tone={executionReadiness.pinGate.status === 'ready' ? 'ready' : 'blocked'}
                />
              </div>
              <div className="mt-2 rounded-sm border border-border/50 bg-muted/10 p-2">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Task storage
                </div>
                <div className="flex flex-wrap gap-1">
                  {executionReadiness.swarmPlan.tasks.map((task) => (
                    <span
                      key={task.id}
                      className="rounded-sm border border-border/50 bg-background/45 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {task.role}
                    </span>
                  ))}
                </div>
              </div>
              {executionReadiness.blockedReasons.length > 0 ? (
                <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-amber-200">
                  {executionReadiness.blockedReasons.slice(0, 4).map((reason) => (
                    <li key={reason}>- {reason}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 text-[11px] leading-relaxed text-emerald-200">
                  Ready for dry-run agent dispatch. Execute only after Tyler verifies the visible UI.
                </div>
              )}
              {onSaveSwarmTasks && (
                <button
                  type="button"
                  data-testid="v3-save-swarm-tasks"
                  className="mt-2 w-full rounded-sm border border-cyan-400/30 bg-cyan-500/10 px-2 py-1.5 text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={swarmSaveState === 'saving' || executionReadiness.swarmPlan.tasks.length === 0}
                  onClick={onSaveSwarmTasks}
                >
                  {swarmSaveState === 'saving'
                    ? 'Saving swarm tasks...'
                    : swarmSaveState === 'saved'
                      ? 'Swarm tasks saved'
                      : swarmSaveState === 'error'
                        ? 'Save swarm failed, retry'
                        : 'Save swarm plan'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: 'ready' | 'blocked' }) {
  return (
    <div className="rounded-sm border border-border/60 bg-background/50 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-0.5 truncate text-sm font-semibold',
          tone === 'ready' && 'text-emerald-300',
          tone === 'blocked' && 'text-amber-200',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function AdoptionStep({ label, value, tone }: { label: string; value: string; tone?: 'ready' }) {
  return (
    <div className="rounded-sm border border-border/50 bg-background/45 px-1.5 py-1">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-0.5 truncate text-[11px] font-semibold',
          tone === 'ready' ? 'text-emerald-300' : 'text-foreground',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function LaunchChecklistItem({ label, state }: { label: string; state: 'ok' | 'blocked' | 'pending' }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-sm border border-border/40 bg-muted/10 px-2 py-1 text-[10px]">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'rounded-sm border px-1.5 py-0.5 font-semibold',
          state === 'ok' && 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
          state === 'blocked' && 'border-amber-400/40 bg-amber-500/10 text-amber-200',
          state === 'pending' && 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200',
        )}
      >
        {state}
      </span>
    </div>
  );
}
