import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Bell, BellOff, Check, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useSupplyChainAlerts,
  useAcknowledgeAlert,
  useAcknowledgeAllAlerts,
  useTriggerSupplyChainCheck,
} from '@/lib/parts/use-supply-chain';
import type { SupplyChainAlert } from '@/lib/parts/use-supply-chain';

interface SupplyChainAlertsPanelProps {
  projectId: number;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-destructive/50 bg-destructive/10 text-destructive',
  warning: 'border-amber-500/50 bg-amber-500/10 text-amber-400',
  info: 'border-sky-500/50 bg-sky-500/10 text-sky-400',
};

function AlertRow({ alert, onAcknowledge }: { alert: SupplyChainAlert; onAcknowledge: (id: string) => void }) {
  return (
    <div
      data-testid={`supply-chain-alert-${alert.id}`}
      className={cn(
        'flex items-start gap-3 rounded-md border px-3 py-2',
        alert.acknowledged ? 'opacity-50 border-border/30' : SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info,
      )}
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm" data-testid={`supply-chain-alert-message-${alert.id}`}>{alert.message}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-[10px]">{alert.alertType.replace(/_/g, ' ')}</Badge>
          {alert.supplier && <span className="text-[10px] text-muted-foreground">{alert.supplier}</span>}
          <span className="text-[10px] text-muted-foreground">{new Date(alert.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      {!alert.acknowledged && (
        <Button
          variant="ghost"
          size="sm"
          data-testid={`supply-chain-ack-${alert.id}`}
          onClick={() => { onAcknowledge(alert.id); }}
          className="h-7 px-2"
        >
          <Check className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export default function SupplyChainAlertsPanel({ projectId }: SupplyChainAlertsPanelProps) {
  const { data: alerts, isLoading } = useSupplyChainAlerts(projectId);
  const ackMutation = useAcknowledgeAlert();
  const ackAllMutation = useAcknowledgeAllAlerts();
  const checkMutation = useTriggerSupplyChainCheck();

  const unacknowledged = alerts?.filter((a) => !a.acknowledged) ?? [];

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
              <Badge variant="destructive" data-testid="supply-chain-unack-count" className="ml-1">
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
                disabled={ackAllMutation.isPending}
                onClick={() => { ackAllMutation.mutate(projectId); }}
                className="h-7 text-xs gap-1"
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
              className="h-7 text-xs gap-1"
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
