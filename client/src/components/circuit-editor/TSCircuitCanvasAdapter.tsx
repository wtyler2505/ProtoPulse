import { Cpu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCircuitDesign, useCircuitInstances, useCircuitNets, useRunCircuitPinVerification, useCircuitPinVerificationHistory } from '@/lib/circuit-editor/hooks';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { isUnverified } from '@/types/TrustBoundaries';
import { probeTSCircuitRuntime, type TSCircuitRuntimeStatus } from '@/lib/tscircuit-runtime';
import { createTSCircuitScene, type TSCircuitSceneHandle } from '@/lib/tscircuit-render-bridge';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { parsePinVerificationIssues } from '@/lib/pin-verification';
import TensionTriagePanel from '@/components/circuit-editor/TensionTriagePanel';
import TldrawOverlayPanel from '@/components/circuit-editor/overlays/TldrawOverlayPanel';
import ThreeOverlayPanel from '@/components/circuit-editor/overlays/ThreeOverlayPanel';
import type { TensionConflict } from '@/lib/tension-triage';
import type { SchematicCanvasProps } from './schematic/canvas-contract';

interface PinVerificationRunSummary {
  flaggedInstances: number;
  unverifiedGuessCount: number;
  conflictCount: number;
  topAuthoritativeSourceLabel: string;
  orchestrationMode?: string;
}

interface PinVerificationOrchestrationStage {
  role: 'drafter' | 'auditor' | 'judge';
  source: string;
  action: string;
}

export default function TSCircuitCanvasAdapter({ circuitId, ercViolations }: SchematicCanvasProps) {
  const projectId = useProjectId();
  const { data: circuitDesign } = useCircuitDesign(projectId, circuitId);
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: nets } = useCircuitNets(circuitId);
  const hasUnverifiedPrice = instances?.some((instance) => {
    const properties = (instance.properties as Record<string, unknown> | null) ?? null;
    return isUnverified(properties?.pricingTrust);
  }) ?? false;
  const pinVerificationIssues = parsePinVerificationIssues(instances ?? []);
  const hasUnverifiedPinGuesses = pinVerificationIssues.some((issue) => issue.status === 'unverified_ai_guess' && issue.trust.verified === false);
  const hasPinConflicts = pinVerificationIssues.some((issue) => issue.status === 'conflict' && issue.trust.verified === false);

  const ercCount = ercViolations?.length ?? 0;
  const instanceCount = instances?.length ?? 0;
  const netCount = nets?.length ?? 0;
  const [runtimeStatus, setRuntimeStatus] = useState<TSCircuitRuntimeStatus>('loading');
  const [runtimeSource, setRuntimeSource] = useState<string>('tscircuit');
  const [runtimeReason, setRuntimeReason] = useState<string | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [overlayMode, setOverlayMode] = useState<'none' | 'tldraw' | 'three'>('none');
  const [lastRunSummary, setLastRunSummary] = useState<PinVerificationRunSummary | null>(null);
  const [lastOrchestrationStages, setLastOrchestrationStages] = useState<PinVerificationOrchestrationStage[]>([]);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runPinVerification = useRunCircuitPinVerification();
  const { data: verificationHistory, refetch: refetchVerificationHistory } = useCircuitPinVerificationHistory(circuitId);
  const tensionConflicts: TensionConflict[] = pinVerificationIssues.map((issue) => ({
    id: `pv-${issue.instanceId}-${issue.pinLabel}`,
    title: `${issue.referenceDesignator}.${issue.pinLabel}`,
    details: issue.note,
    sourceType: 'pin_verification',
    severity: issue.status === 'conflict' ? 'error' : 'warning',
  }));

  useEffect(() => {
    let active = true;
    void probeTSCircuitRuntime().then((result) => {
      if (!active) {
        return;
      }
      setRuntimeStatus(result.status);
      setRuntimeSource(result.source);
      setRuntimeReason(result.reason ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (runtimeStatus !== 'ready' || !hostRef.current) {
      return;
    }
    let handle: TSCircuitSceneHandle | null = null;
    try {
      handle = createTSCircuitScene(hostRef.current, {
        circuitId,
        circuitName: circuitDesign?.name ?? 'Unnamed circuit',
        instanceCount,
        netCount,
        ercCount,
        ercViolations: ercViolations ?? [],
        overlayMode,
      });
      setSceneError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown scene initialization error';
      setSceneError(message);
    }

    return () => {
      handle?.dispose();
    };
  }, [runtimeStatus, circuitId, circuitDesign?.name, instanceCount, netCount, ercCount, ercViolations, overlayMode]);

  return (
    <div
      className="h-full w-full bg-background/80 flex items-center justify-center p-6"
      data-testid="tscircuit-canvas-adapter"
    >
      <div className="max-w-xl w-full border border-border rounded-md bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">TSCircuit Canvas Adapter</h3>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Scaffold
          </Badge>
          <Badge variant="outline" className="text-[10px]" data-testid="tscircuit-runtime-badge">
            {runtimeStatus === 'ready' ? 'Runtime Ready' : runtimeStatus === 'loading' ? 'Runtime Loading' : 'Runtime Fallback'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="tscircuit-adapter-summary">
          ProtoPulse v3 adapter path is enabled for circuit {String(circuitId)} ({circuitDesign?.name ?? 'Unnamed circuit'}). ReactFlow remains available in legacy mode while this adapter gains rendering and edit capabilities.
        </p>
        <p className="text-xs text-muted-foreground/90" data-testid="tscircuit-runtime-source">
          Runtime source: {runtimeSource}
          {runtimeStatus === 'unavailable' && runtimeReason ? ` (fallback reason: ${runtimeReason})` : ''}
        </p>
        <div className="flex items-center gap-2" data-testid="tscircuit-overlay-toggle">
          <span className="text-[11px] text-muted-foreground">Overlay</span>
          <Button
            type="button"
            size="sm"
            variant={overlayMode === 'none' ? 'default' : 'outline'}
            className="h-6 px-2 text-[11px]"
            data-testid="tscircuit-overlay-none"
            onClick={() => setOverlayMode('none')}
          >
            none
          </Button>
          <Button
            type="button"
            size="sm"
            variant={overlayMode === 'tldraw' ? 'default' : 'outline'}
            className="h-6 px-2 text-[11px]"
            data-testid="tscircuit-overlay-tldraw"
            onClick={() => setOverlayMode('tldraw')}
          >
            tldraw
          </Button>
          <Button
            type="button"
            size="sm"
            variant={overlayMode === 'three' ? 'default' : 'outline'}
            className="h-6 px-2 text-[11px]"
            data-testid="tscircuit-overlay-three"
            onClick={() => setOverlayMode('three')}
          >
            three
          </Button>
        </div>
        {pinVerificationIssues.length > 0 ? (
          <div
            className="rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2 space-y-2"
            data-testid="tscircuit-pin-verification-panel"
          >
            <div className="flex items-center gap-2 flex-wrap">
              {hasUnverifiedPinGuesses ? <TrustBadge kind="unverified" label="UNVERIFIED_AI_GUESS" /> : null}
              {hasPinConflicts ? <TrustBadge kind="estimated" label="PIN_CONFLICT" /> : null}
              <span className="text-[11px] text-muted-foreground" data-testid="tscircuit-pin-verification-count">
                {String(pinVerificationIssues.length)} pin verification issue{pinVerificationIssues.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="text-[11px] text-muted-foreground space-y-1" data-testid="tscircuit-pin-verification-list">
              {pinVerificationIssues.slice(0, 4).map((issue) => (
                <li key={`${issue.instanceId}:${issue.pinLabel}:${issue.status}`}>
                  {issue.referenceDesignator}.{issue.pinLabel}: {issue.status === 'unverified_ai_guess' ? 'unverified AI guess' : 'datasheet conflict'}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex items-center justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            data-testid="tscircuit-run-pin-verification"
            disabled={runPinVerification.isPending}
            onClick={async () => {
              const result = await runPinVerification.mutateAsync({ circuitId, dryRun: false });
              const topAuthoritativeSourceLabel = result.results[0]?.authoritativeSourceLabel ?? result.results[0]?.authoritativeSource ?? 'none';
              setLastRunSummary({
                flaggedInstances: result.flaggedInstances,
                unverifiedGuessCount: result.unverifiedGuessCount,
                conflictCount: result.conflictCount,
                topAuthoritativeSourceLabel,
                orchestrationMode: result.orchestration?.mode,
              });
              setLastOrchestrationStages(result.orchestration?.stages ?? []);
              void refetchVerificationHistory();
            }}
          >
            {runPinVerification.isPending ? 'Verifying…' : 'Run Auditor/Judge'}
          </Button>
        </div>
        {lastRunSummary ? (
          <p className="text-[11px] text-muted-foreground" data-testid="tscircuit-last-verification-summary">
            Last run: {String(lastRunSummary.flaggedInstances)} flagged, {String(lastRunSummary.unverifiedGuessCount)} unverified guesses, {String(lastRunSummary.conflictCount)} conflicts, source {lastRunSummary.topAuthoritativeSourceLabel}{lastRunSummary.orchestrationMode ? `, ${lastRunSummary.orchestrationMode}` : ''}
          </p>
        ) : null}
        {lastOrchestrationStages.length > 0 ? (
          <div className="rounded border border-border/70 bg-muted/20 px-3 py-2 space-y-1" data-testid="tscircuit-swarm-trace">
            <p className="text-[11px] text-muted-foreground">Swarm trace</p>
            <ul className="text-[11px] text-muted-foreground space-y-1">
              {lastOrchestrationStages.map((stage, idx) => (
                <li key={`${stage.role}-${idx}`} data-testid={`tscircuit-swarm-stage-${stage.role}`}>
                  {idx + 1}. {stage.role}: {stage.action} ({stage.source})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {verificationHistory && verificationHistory.length > 0 ? (
          <div className="rounded border border-border/70 bg-muted/20 px-3 py-2 space-y-1" data-testid="tscircuit-verification-history">
            <p className="text-[11px] text-muted-foreground">Verification history (latest 3)</p>
            <ul className="text-[11px] text-muted-foreground space-y-1">
              {verificationHistory.slice(0, 3).map((run) => (
                <li key={run.runId} data-testid={`tscircuit-history-${run.runId}`}>
                  {run.runId}: {run.flaggedInstances} flagged, {run.conflictCount} conflicts, source {run.topAuthoritativeSourceLabel}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <TensionTriagePanel conflicts={tensionConflicts} />
        {sceneError ? (
          <p className="text-xs text-amber-200/90" data-testid="tscircuit-scene-error">
            Scene fallback reason: {sceneError}
          </p>
        ) : null}
        <div
          ref={hostRef}
          className="h-24 w-full rounded border border-border/60 bg-background/40"
          data-testid="tscircuit-scene-host"
        />
        {overlayMode === 'tldraw' ? <TldrawOverlayPanel /> : null}
        {overlayMode === 'three' ? <ThreeOverlayPanel /> : null}
        <dl className="grid grid-cols-2 gap-2 text-xs" data-testid="tscircuit-adapter-stats">
          <div className="rounded border border-border/70 bg-muted/20 px-2 py-1.5">
            <dt className="text-muted-foreground">Instances</dt>
            <dd className="font-medium text-foreground" data-testid="tscircuit-stat-instances">{String(instanceCount)}</dd>
          </div>
          <div className="rounded border border-border/70 bg-muted/20 px-2 py-1.5">
            <dt className="text-muted-foreground">Nets</dt>
            <dd className="font-medium text-foreground" data-testid="tscircuit-stat-nets">{String(netCount)}</dd>
          </div>
          <div className="rounded border border-border/70 bg-muted/20 px-2 py-1.5">
            <dt className="text-muted-foreground">ERC Issues</dt>
            <dd className="font-medium text-foreground" data-testid="tscircuit-stat-erc">{String(ercCount)}</dd>
          </div>
          <div className="rounded border border-border/70 bg-muted/20 px-2 py-1.5">
            <dt className="text-muted-foreground">Trust</dt>
            <dd className="font-medium text-foreground" data-testid="tscircuit-stat-trust">
              {hasUnverifiedPrice ? 'Estimated data present' : 'No estimated pricing flags'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
