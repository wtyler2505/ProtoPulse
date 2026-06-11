import { useCallback } from 'react';
import { Shield, Play, ToggleLeft, ToggleRight } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getRuleExplanation } from './validation-helpers';
import type { GatewayRule, GatewayViolation } from '@/lib/design-gateway';

interface DesignGatewaySectionProps {
  gatewayRules: GatewayRule[];
  gatewayViolations: GatewayViolation[];
  enableGatewayRule: (ruleId: string) => void;
  disableGatewayRule: (ruleId: string) => void;
  onRun: () => void;
}

export function DesignGatewaySection({ gatewayRules, gatewayViolations, enableGatewayRule, disableGatewayRule, onRun }: DesignGatewaySectionProps) {
  const handleToggle = useCallback((ruleId: string, enabled: boolean) => {
    if (enabled) {
      disableGatewayRule(ruleId);
    } else {
      enableGatewayRule(ruleId);
    }
  }, [enableGatewayRule, disableGatewayRule]);

  return (
    <div data-testid="design-gateway-section" className="bg-card/40 border border-border backdrop-blur-xl shadow-xl p-4.5 flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Design Gateway
        </h3>
        <Button data-testid="run-gateway" variant="outline" size="sm" className="h-8 text-xs px-2.5" onClick={onRun}>
          <Play className="w-3 h-3 mr-1" />
          Run
        </Button>
      </div>

      <div className="space-y-1.5 max-h-52 overflow-auto">
        {gatewayRules.map((rule) => (
          <div key={rule.id} data-testid={`gateway-rule-${rule.id}`} className="flex items-center justify-between py-1.5 px-2.5 hover:bg-muted/20 rounded text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Badge variant={rule.severity === 'error' ? 'destructive' : rule.severity === 'warning' ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
                {rule.category}
              </Badge>
              <StyledTooltip content={getRuleExplanation(rule.category, 'Validation')} side="right">
                <span className="truncate cursor-help">{rule.name}</span>
              </StyledTooltip>
            </div>
            <button
              data-testid={`gateway-toggle-${rule.id}`}
              onClick={() => { handleToggle(rule.id, rule.enabled); }}
              className="ml-2 inline-flex h-7 w-7 items-center justify-center flex-shrink-0 rounded-sm hover:bg-muted/30"
              aria-label={`Toggle ${rule.name}`}
            >
              {rule.enabled ? <ToggleRight className="w-4.5 h-4.5 text-primary" /> : <ToggleLeft className="w-4.5 h-4.5 text-muted-foreground" />}
            </button>
          </div>
        ))}
      </div>

      {gatewayViolations.length > 0 && (
        <div data-testid="gateway-violations" className="border-t border-border pt-2.5 space-y-1.5 max-h-44 overflow-auto">
          <p className="text-[11px] text-muted-foreground font-semibold">
            {gatewayViolations.length} violation(s)
          </p>
          {gatewayViolations.map((v, i) => (
            <div key={`${v.ruleId}-${i}`} data-testid={`gateway-violation-${i}`} className="flex items-start gap-2.5 text-xs py-1.5">
              <Badge variant={v.severity === 'error' ? 'destructive' : v.severity === 'warning' ? 'secondary' : 'outline'} className="text-[10px] px-1 py-0 flex-shrink-0">
                {v.severity}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="truncate">{v.message}</p>
                {v.suggestion && <p className="text-emerald-500/80 text-[11px] mt-0.5">{v.suggestion}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
