import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Bell, BellOff, Check, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useCircuitDesigns, useCircuitInstances } from '@/lib/circuit-editor/hooks';
import { useComponentParts } from '@/lib/component-editor/hooks';
import { useBomShortfalls } from '@/lib/parts/use-bom-shortfalls';
import { buildValidationSafetyGateData } from '@/lib/validation-safety-gates';
import { runExportPrecheck, type ExportPrecheck } from '@/lib/export-precheck';
import {
  useSupplyChainAlerts,
  useAcknowledgeAlert,
  useAcknowledgeAllAlerts,
  useTriggerSupplyChainCheck,
} from '@/lib/parts/use-supply-chain';
import type { ProjectExportData } from '@/lib/export-validation';
import type { SupplyChainAlert } from '@/lib/parts/use-supply-chain';
import type { CircuitInstanceRow } from '@shared/schema';

interface SupplyChainAlertsPanelProps {
  projectId: number;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-destructive/50 bg-destructive/10 text-red-200',
  warning: 'border-amber-500/50 bg-amber-500/10 text-amber-400',
  info: 'border-sky-500/50 bg-sky-500/10 text-sky-400',
};

const SESSION_KEY = 'protopulse-session-id';

function readHasSession(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage.getItem(SESSION_KEY));
}

function readInstanceProperties(instance: CircuitInstanceRow): Record<string, unknown> {
  return instance.properties && typeof instance.properties === 'object'
    ? instance.properties as Record<string, unknown>
    : {};
}

function isCircuitSourceInstance(instance: CircuitInstanceRow): boolean {
  const props = readInstanceProperties(instance);
  const componentType = String(props.componentType ?? '');
  return /^[VI]/i.test(instance.referenceDesignator)
    || /voltage.source|current.source|dc.source|ac.source|signal.source|function.generator/i.test(componentType);
}

function hasPcbPlacement(instance: CircuitInstanceRow): boolean {
  return instance.pcbX != null && instance.pcbY != null;
}

interface SupplyChainTrustGateProps {
  precheck: ExportPrecheck;
}

const SupplyChainTrustGate = memo(function SupplyChainTrustGate({ precheck }: SupplyChainTrustGateProps) {
  const blockers = precheck.checks.filter((check) => check.status === 'fail');
  const warnings = precheck.checks.filter((check) => check.status === 'warn');
  const passes = precheck.checks.length - blockers.length - warnings.length;
  const statusLabel = blockers.length > 0 ? 'Blocked' : warnings.length > 0 ? 'Review' : 'Ready';

  return (
    <section
      data-testid="supply-chain-trust-gate"
      aria-labelledby="supply-chain-trust-gate-title"
      className={cn(
        'mb-3 rounded-md border p-3 text-sm',
        blockers.length > 0
          ? 'border-destructive/40 bg-destructive/10'
          : warnings.length > 0
            ? 'border-amber-500/40 bg-amber-500/10'
            : 'border-emerald-500/30 bg-emerald-500/10',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id="supply-chain-trust-gate-title" className="text-sm font-semibold">Source Confidence Gate</h3>
          <p data-testid="supply-chain-source-confidence" className="text-xs text-muted-foreground">
            {passes} passed, {warnings.length} warning{warnings.length === 1 ? '' : 's'}, {blockers.length} blocker{blockers.length === 1 ? '' : 's'}
          </p>
        </div>
        <Badge
          variant="outline"
          data-testid="supply-chain-trust-status"
          className={cn(
            blockers.length > 0 && 'border-destructive/50 bg-destructive/10 text-red-200',
            warnings.length > 0 && blockers.length === 0 && 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
            blockers.length === 0 && warnings.length === 0 && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          )}
        >
          {statusLabel}
        </Badge>
      </div>

      {blockers.length > 0 && (
        <ul className="mt-2 space-y-1" data-testid="supply-chain-trust-blockers">
          {blockers.slice(0, 3).map((check) => (
            <li key={`${check.name}-${check.message}`} className="text-xs text-red-200" data-testid="supply-chain-trust-blocker">
              <span className="font-semibold text-red-100">{check.name}:</span> {check.message}
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul className="mt-2 space-y-1" data-testid="supply-chain-trust-warnings">
          {warnings.slice(0, 3).map((check) => (
            <li key={`${check.name}-${check.message}`} className="text-xs text-amber-700 dark:text-amber-300" data-testid="supply-chain-trust-warning">
              <span className="font-medium">{check.name}:</span> {check.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});

function AlertRow({ alert, onAcknowledge }: { alert: SupplyChainAlert; onAcknowledge: (id: string) => void }) {
  return (
    <div
      data-testid={`supply-chain-alert-${alert.id}`}
      className={cn(
        'flex items-start gap-3 rounded-md border px-3 py-2.5',
        alert.acknowledged ? 'opacity-50 border-border/30' : SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info,
      )}
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm" data-testid={`supply-chain-alert-message-${alert.id}`}>{alert.message}</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="outline" className="text-[11px]">{alert.alertType.replace(/_/g, ' ')}</Badge>
          {alert.supplier && <span className="text-[11px] text-muted-foreground">{alert.supplier}</span>}
          <span className="text-[11px] text-muted-foreground">{new Date(alert.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      {!alert.acknowledged && (
        <Button
          variant="ghost"
          size="sm"
          data-testid={`supply-chain-ack-${alert.id}`}
          onClick={() => { onAcknowledge(alert.id); }}
          className="h-7 px-2"
          aria-label={`Acknowledge supply chain alert: ${alert.message}`}
        >
          <Check className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export default function SupplyChainAlertsPanel({ projectId }: SupplyChainAlertsPanelProps) {
  const { projectName } = useProjectMeta();
  const { nodes } = useArchitecture();
  const { bom } = useBom();
  const { data: componentParts = [] } = useComponentParts(projectId);
  const { data: circuitDesigns = [] } = useCircuitDesigns(projectId);
  const activeCircuitId = circuitDesigns[0]?.id ?? 0;
  const { data: activeCircuitInstances = [] } = useCircuitInstances(activeCircuitId);
  const { data: shortfallsResp } = useBomShortfalls(projectId);
  const { data: alerts, isLoading } = useSupplyChainAlerts(projectId);
  const ackMutation = useAcknowledgeAlert();
  const ackAllMutation = useAcknowledgeAllAlerts();
  const checkMutation = useTriggerSupplyChainCheck();

  const unacknowledged = alerts?.filter((a) => !a.acknowledged) ?? [];
  const supplyChainSafetyData = useMemo(
    () =>
      buildValidationSafetyGateData({
        circuitInstances: activeCircuitInstances,
        componentParts,
        bomItems: bom,
      }),
    [activeCircuitInstances, bom, componentParts],
  );
  const hasCircuitInstances = activeCircuitInstances.length > 0;
  const hasPcbLayout = activeCircuitInstances.some(hasPcbPlacement);
  const hasCircuitSource = activeCircuitInstances.some(isCircuitSourceInstance);
  const hasCircuitComponent = activeCircuitInstances.some((instance) => !isCircuitSourceInstance(instance));
  const supplyChainExportData = useMemo<ProjectExportData>(() => ({
    projectName,
    hasSession: readHasSession(),
    architectureNodeCount: nodes.length,
    hasCircuitInstances,
    hasPcbLayout,
    bomItemCount: bom.length,
    bomItemsWithPartNumber: bom.filter((item) => item.partNumber.trim().length > 0).length,
    hasCircuitSource,
    hasCircuitComponent,
    hasBoardProfile: true,
    bomItemsWithFailureData: 0,
    ...supplyChainSafetyData,
    bomShortfallUnits: shortfallsResp?.totalShortfallUnits,
    bomShortfallLineCount: shortfallsResp?.total,
  }), [
    bom,
    hasCircuitComponent,
    hasCircuitInstances,
    hasCircuitSource,
    hasPcbLayout,
    nodes.length,
    projectName,
    shortfallsResp?.total,
    shortfallsResp?.totalShortfallUnits,
    supplyChainSafetyData,
  ]);
  const supplyChainPrecheck = useMemo(
    () => runExportPrecheck('procurement-package', supplyChainExportData),
    [supplyChainExportData],
  );
  const hasTrustBlockers = supplyChainPrecheck.blockers.length > 0;

  if (isLoading) {
    return (
      <Card data-testid="supply-chain-panel">
        <CardContent className="flex items-center justify-center py-6" data-testid="supply-chain-loading">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading alerts...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="supply-chain-panel">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Supply Chain Alerts
            {unacknowledged.length > 0 && (
              <Badge
                variant="outline"
                data-testid="supply-chain-unack-count"
                className="ml-1 border-destructive/50 bg-destructive/10 text-red-200"
              >
                {unacknowledged.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {unacknowledged.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                data-testid="supply-chain-ack-all"
                disabled={ackAllMutation.isPending || hasTrustBlockers}
                onClick={() => { ackAllMutation.mutate(projectId); }}
                className="h-7 gap-1 text-[11px]"
                aria-describedby={hasTrustBlockers ? 'supply-chain-trust-gate-title' : undefined}
                title={hasTrustBlockers ? 'Resolve source-confidence blockers before bulk-dismissing alerts.' : undefined}
              >
                <BellOff className="h-3 w-3" />
                Dismiss All
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              data-testid="supply-chain-check"
              disabled={checkMutation.isPending}
              onClick={() => { checkMutation.mutate(projectId); }}
              className="h-7 gap-1 text-[11px]"
            >
              {checkMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Check Now
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <SupplyChainTrustGate precheck={supplyChainPrecheck} />
        {(!alerts || alerts.length === 0) ? (
          <p data-testid="supply-chain-empty" className="text-sm text-muted-foreground py-4 text-center">
            No supply chain alerts. Run a check to scan your BOM.
          </p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2" data-testid="supply-chain-list">
              {alerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={(id) => { ackMutation.mutate(id); }}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
