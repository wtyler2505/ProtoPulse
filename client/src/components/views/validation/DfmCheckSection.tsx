import { Factory, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InteractiveCard } from '@/components/ui/interactive-card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { ViewMode } from '@/lib/project-context';
import type { DfmCheckResult } from '@/lib/dfm-checker';
import { mapDfmViolationToHighlight } from '@/lib/dfm-pcb-bridge';

interface DfmCheckSectionProps {
  selectedFab: string;
  setSelectedFab: (fab: string) => void;
  availableFabs: string[];
  dfmResult: DfmCheckResult | null;
  dfmHistory: DfmCheckResult[];
  clearDfmHistory: () => void;
  onRunDfm: () => void;
  onRunDfmFromBom: () => void;
  setActiveView: (view: ViewMode) => void;
}

export function DfmCheckSection({
  selectedFab, setSelectedFab, availableFabs, dfmResult, dfmHistory,
  clearDfmHistory, onRunDfm, onRunDfmFromBom, setActiveView,
}: DfmCheckSectionProps) {
  return (
    <div data-testid="dfm-check-section" className="bg-card/40 border border-border backdrop-blur-xl shadow-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Factory className="w-4 h-4 text-primary" />
          DFM Check
        </h3>
        <div className="flex items-center gap-1">
          <Button data-testid="run-dfm-from-bom" variant="outline" size="sm" className="h-7 text-xs" onClick={onRunDfmFromBom}>
            <Factory className="w-3 h-3 mr-1" />
            Check from BOM
          </Button>
          <Button data-testid="run-dfm-check" variant="outline" size="sm" className="h-7 text-xs" onClick={onRunDfm}>
            <Play className="w-3 h-3 mr-1" />
            Run
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground flex-shrink-0">Fab:</Label>
        <Select value={selectedFab} onValueChange={setSelectedFab}>
          <SelectTrigger data-testid="dfm-fab-select" className="h-7 text-xs flex-1">
            <SelectValue placeholder="Select fab house..." />
          </SelectTrigger>
          <SelectContent>
            {availableFabs.map((fab) => (
              <SelectItem key={fab} value={fab} className="text-xs">{fab}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dfmResult && (
        <div data-testid="dfm-results" className="border-t border-border pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <Badge data-testid="dfm-pass-badge" variant={dfmResult.passed ? 'outline' : 'destructive'} className="text-xs">
              {dfmResult.passed ? 'PASSED' : 'FAILED'}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {dfmResult.summary.errors} error(s), {dfmResult.summary.warnings} warning(s)
            </span>
          </div>
          {dfmResult.violations.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-auto">
              {dfmResult.violations.map((v) => (
                <InteractiveCard
                  key={v.id}
                  data-testid={`dfm-violation-${v.id}`}
                  aria-label={`View DFM violation on PCB: ${v.message}`}
                  onClick={() => {
                    mapDfmViolationToHighlight(v);
                    setActiveView('pcb');
                  }}
                  className="flex items-start gap-2 text-xs py-1 hover:bg-muted/30 rounded px-1 transition-colors"
                >
                  <Badge variant={v.severity === 'error' ? 'destructive' : v.severity === 'warning' ? 'secondary' : 'outline'} className="text-[10px] px-1 py-0 flex-shrink-0">
                    {v.severity}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{v.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      {v.category} | actual: {v.actual}{v.unit} / required: {v.required}{v.unit}
                    </p>
                  </div>
                  <span className="text-[9px] text-primary/60 flex-shrink-0 self-center">View on PCB</span>
                </InteractiveCard>
              ))}
            </div>
          )}
        </div>
      )}

      {dfmHistory.length > 0 && (
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-[10px] text-muted-foreground">{dfmHistory.length} previous check(s)</span>
          <Button data-testid="clear-dfm-history" variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={clearDfmHistory}>
            Clear History
          </Button>
        </div>
      )}
    </div>
  );
}
