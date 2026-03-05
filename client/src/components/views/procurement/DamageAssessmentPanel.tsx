import { useMemo } from 'react';
import { CheckCircle2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DamageAssessor } from '@/lib/damage-assessment';
import type { BomItem } from '@/lib/project-context';
import type { DamageReport, DamageObservation, ComponentType } from '@/lib/damage-assessment';

export interface DamageAssessmentPanelProps {
  damageDialogItem: BomItem | null;
  onClose: () => void;
  damageComponentType: ComponentType;
  onComponentTypeChange: (type: ComponentType) => void;
  damageObservations: DamageObservation[];
  onObservationsChange: (observations: DamageObservation[]) => void;
  currentDamageReport: DamageReport | null;
  onRunAssessment: () => void;
}

const COMPONENT_TYPES: readonly ComponentType[] = [
  'generic', 'ic', 'resistor', 'capacitor-electrolytic', 'capacitor-ceramic',
  'capacitor-tantalum', 'connector', 'led', 'transformer', 'diode', 'transistor', 'relay',
] as const;

export function DamageAssessmentPanel({
  damageDialogItem,
  onClose,
  damageComponentType,
  onComponentTypeChange,
  damageObservations,
  onObservationsChange,
  currentDamageReport,
  onRunAssessment,
}: DamageAssessmentPanelProps) {
  const damageIndicators = useMemo(() => {
    const assessor = new DamageAssessor();
    return assessor.getIndicators(damageComponentType);
  }, [damageComponentType]);

  return (
    <Dialog open={damageDialogItem !== null} onOpenChange={(open) => { if (!open) { onClose(); } }}>
      <DialogContent className="bg-card border-border sm:max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-damage-assessment">
        <DialogHeader>
          <DialogTitle>Damage Assessment</DialogTitle>
          <DialogDescription>
            Assess the physical condition of {damageDialogItem?.partNumber ?? 'component'} for salvage/reuse.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="damage-component-type">Component Type</Label>
            <Select value={damageComponentType} onValueChange={(v) => onComponentTypeChange(v as ComponentType)}>
              <SelectTrigger id="damage-component-type" data-testid="select-damage-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPONENT_TYPES.map((ct) => (
                  <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Damage Indicators</Label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto border border-border p-3 bg-muted/10">
              {damageIndicators.map((ind) => (
                <label
                  key={ind.indicator}
                  className="flex items-center gap-2 text-xs cursor-pointer hover:text-foreground transition-colors text-muted-foreground"
                >
                  <input
                    type="checkbox"
                    className="accent-primary w-3.5 h-3.5"
                    checked={damageObservations.some((o) => o.indicator === ind.indicator && o.present)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onObservationsChange([
                          ...damageObservations,
                          { category: ind.category, indicator: ind.indicator, present: true, severity: ind.defaultSeverity },
                        ]);
                      } else {
                        onObservationsChange(damageObservations.filter((o) => o.indicator !== ind.indicator));
                      }
                    }}
                    data-testid={`checkbox-damage-${ind.indicator.replace(/\s+/g, '-')}`}
                  />
                  <span>{ind.indicator}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] ml-auto',
                      ind.defaultSeverity === 'severe' && 'text-destructive border-destructive/30',
                      ind.defaultSeverity === 'moderate' && 'text-yellow-500 border-yellow-500/30',
                      ind.defaultSeverity === 'minor' && 'text-emerald-500 border-emerald-500/30',
                    )}
                  >
                    {ind.defaultSeverity}
                  </Badge>
                </label>
              ))}
            </div>
          </div>

          {currentDamageReport && (
            <div className="space-y-3 border border-border p-4 bg-muted/10" data-testid="damage-report">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">Assessment Result</h4>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-sm font-bold px-3 py-1',
                      currentDamageReport.overallGrade === 'A' && 'text-emerald-500 border-emerald-500/30',
                      currentDamageReport.overallGrade === 'B' && 'text-blue-400 border-blue-400/30',
                      currentDamageReport.overallGrade === 'C' && 'text-yellow-500 border-yellow-500/30',
                      currentDamageReport.overallGrade === 'D' && 'text-orange-500 border-orange-500/30',
                      currentDamageReport.overallGrade === 'F' && 'text-destructive border-destructive/30',
                    )}
                    data-testid="damage-grade"
                  >
                    Grade: {currentDamageReport.overallGrade}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      currentDamageReport.usable ? 'text-emerald-500 border-emerald-500/30' : 'text-destructive border-destructive/30',
                    )}
                    data-testid="damage-usable"
                  >
                    {currentDamageReport.usable ? 'Usable' : 'Not Usable'}
                  </Badge>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Score: <span className="font-mono text-foreground">{currentDamageReport.overallScore}/100</span>
              </div>
              {currentDamageReport.recommendations.length > 0 && (
                <div className="space-y-1">
                  <h5 className="text-xs font-medium text-foreground">Recommendations</h5>
                  <ul className="space-y-1">
                    {currentDamageReport.recommendations.map((rec, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-close-damage">Close</Button>
          <Button onClick={onRunAssessment} data-testid="button-run-assessment">
            <Shield className="w-4 h-4 mr-2" />
            Assess
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
