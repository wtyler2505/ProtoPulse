/**
 * FailureInjectionPanel — UI for injecting faults into circuit simulation.
 *
 * Shows active faults with type badges and severity, provides a form to add
 * new faults, and displays a summary report. Used for FMEA and reliability testing.
 */

import { useState, useMemo, useSyncExternalStore, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, X, Zap, AlertTriangle, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { failureInjectionManager } from '@/lib/simulation/failure-injection';
import type { FaultType, FaultDefinition, CreateFaultData } from '@/lib/simulation/failure-injection';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FAULT_TYPE_LABELS: Record<FaultType, string> = {
  open: 'Open Circuit',
  short: 'Short Circuit',
  noise: 'Noisy Sensor',
  drift: 'Value Drift',
  intermittent: 'Intermittent',
};

const FAULT_TYPE_COLORS: Record<FaultType, string> = {
  open: 'bg-red-500/20 text-red-400 border-red-500/30',
  short: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  noise: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  drift: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  intermittent: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const FAULT_TYPE_OPTIONS: FaultType[] = ['open', 'short', 'noise', 'drift', 'intermittent'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FailureInjectionPanelProps {
  /** Optional class name for the root element. */
  className?: string;
  /** Available components to inject faults into (id -> name). */
  components?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Add fault form
// ---------------------------------------------------------------------------

interface AddFaultFormProps {
  components: Record<string, string>;
  onSubmit: (data: CreateFaultData) => void;
  onCancel: () => void;
}

function AddFaultForm({ components, onSubmit, onCancel }: AddFaultFormProps) {
  const componentEntries = useMemo(() => Object.entries(components), [components]);
  const [componentId, setComponentId] = useState(componentEntries[0]?.[0] ?? '');
  const [faultType, setFaultType] = useState<FaultType>('open');
  const [severity, setSeverity] = useState(0.5);
  const [noiseAmplitude, setNoiseAmplitude] = useState('');
  const [driftPercent, setDriftPercent] = useState('');
  const [seed, setSeed] = useState('');

  const handleSubmit = useCallback(() => {
    if (!componentId) {
      return;
    }

    const data: CreateFaultData = {
      componentId,
      componentName: components[componentId] ?? componentId,
      faultType,
      severity,
    };

    if (faultType === 'noise' && noiseAmplitude.trim()) {
      data.noiseAmplitude = parseFloat(noiseAmplitude);
    }
    if (faultType === 'drift' && driftPercent.trim()) {
      data.driftPercent = parseFloat(driftPercent) / 100; // Convert from percentage input
    }
    if ((faultType === 'noise' || faultType === 'intermittent') && seed.trim()) {
      data.seed = parseInt(seed, 10);
    }

    onSubmit(data);
  }, [componentId, faultType, severity, noiseAmplitude, driftPercent, seed, components, onSubmit]);

  return (
    <div
      className="flex flex-col gap-2 p-2 border border-[#00F0FF]/30 rounded-md bg-[#00F0FF]/5"
      data-testid="fault-add-form"
    >
      {/* Component selector */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Component</Label>
        {componentEntries.length > 0 ? (
          <Select value={componentId} onValueChange={setComponentId}>
            <SelectTrigger className="h-7 text-xs" data-testid="fault-form-component">
              <SelectValue placeholder="Select component" />
            </SelectTrigger>
            <SelectContent>
              {componentEntries.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={componentId}
            onChange={(e) => { setComponentId(e.target.value); }}
            placeholder="Component ID"
            className="h-7 text-xs"
            data-testid="fault-form-component-input"
          />
        )}
      </div>

      {/* Fault type */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Fault Type</Label>
        <Select value={faultType} onValueChange={(v) => { setFaultType(v as FaultType); }}>
          <SelectTrigger className="h-7 text-xs" data-testid="fault-form-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FAULT_TYPE_OPTIONS.map((ft) => (
              <SelectItem key={ft} value={ft}>
                {FAULT_TYPE_LABELS[ft]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Severity slider */}
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground">Severity</Label>
          <span className="text-[10px] font-mono text-muted-foreground" data-testid="fault-form-severity-value">
            {Math.round(severity * 100)}%
          </span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[severity]}
          onValueChange={([v]) => {
            if (v !== undefined) {
              setSeverity(v);
            }
          }}
          className="[&_[data-slot=range]]:bg-[#00F0FF] [&_[data-slot=thumb]]:border-[#00F0FF]/50"
          aria-label="Fault severity"
          data-testid="fault-form-severity"
        />
      </div>

      {/* Type-specific fields */}
      {faultType === 'noise' && (
        <Input
          value={noiseAmplitude}
          onChange={(e) => { setNoiseAmplitude(e.target.value); }}
          placeholder="Noise amplitude (optional)"
          type="number"
          className="h-7 text-xs"
          data-testid="fault-form-noise-amplitude"
        />
      )}

      {faultType === 'drift' && (
        <Input
          value={driftPercent}
          onChange={(e) => { setDriftPercent(e.target.value); }}
          placeholder="Drift % (optional, e.g. 20)"
          type="number"
          className="h-7 text-xs"
          data-testid="fault-form-drift-percent"
        />
      )}

      {(faultType === 'noise' || faultType === 'intermittent') && (
        <Input
          value={seed}
          onChange={(e) => { setSeed(e.target.value); }}
          placeholder="PRNG seed (optional)"
          type="number"
          className="h-7 text-xs"
          data-testid="fault-form-seed"
        />
      )}

      {/* Actions */}
      <div className="flex gap-1">
        <Button
          variant="default"
          size="sm"
          className="flex-1 h-6 text-[10px]"
          onClick={handleSubmit}
          disabled={!componentId}
          data-testid="fault-form-submit"
        >
          Inject Fault
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px]"
          onClick={onCancel}
          data-testid="fault-form-cancel"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fault row
// ---------------------------------------------------------------------------

interface FaultRowProps {
  fault: FaultDefinition;
  onRemove: (id: string) => void;
}

function FaultRow({ fault, onRemove }: FaultRowProps) {
  return (
    <div
      className="flex flex-col gap-1 px-2 py-1.5 rounded border border-transparent hover:bg-muted/40 transition-colors"
      data-testid={`fault-row-${fault.id}`}
    >
      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn('h-4 px-1 text-[9px] font-medium shrink-0', FAULT_TYPE_COLORS[fault.faultType])}
          data-testid={`fault-type-badge-${fault.id}`}
        >
          {FAULT_TYPE_LABELS[fault.faultType]}
        </Badge>

        <span
          className="flex-1 text-xs text-foreground truncate"
          title={fault.componentName}
          data-testid={`fault-component-${fault.id}`}
        >
          {fault.componentName}
        </span>

        <Badge
          variant="secondary"
          className="h-4 px-1 text-[9px] font-mono"
          data-testid={`fault-severity-${fault.id}`}
        >
          {Math.round(fault.severity * 100)}%
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/70">
          {fault.faultType === 'noise' && fault.noiseAmplitude !== undefined && `amp: ${fault.noiseAmplitude}`}
          {fault.faultType === 'drift' && fault.driftPercent !== undefined && `drift: ${Math.round(fault.driftPercent * 100)}%`}
          {(fault.faultType === 'noise' || fault.faultType === 'intermittent') && fault.seed !== undefined && ` seed: ${fault.seed}`}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
          onClick={() => { onRemove(fault.id); }}
          aria-label={`Remove fault on ${fault.componentName}`}
          data-testid={`fault-remove-${fault.id}`}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function FailureInjectionPanel({ className, components = {} }: FailureInjectionPanelProps) {
  const [showForm, setShowForm] = useState(false);

  // Subscribe to failure injection manager state
  useSyncExternalStore(
    (cb) => failureInjectionManager.subscribe(cb),
    () => failureInjectionManager.version,
  );

  const faults = failureInjectionManager.listFaults();
  const report = failureInjectionManager.getFaultReport();

  const handleInject = useCallback((data: CreateFaultData) => {
    failureInjectionManager.injectFault(data);
    setShowForm(false);
  }, []);

  const handleRemove = useCallback((id: string) => {
    failureInjectionManager.removeFault(id);
  }, []);

  const handleClearAll = useCallback(() => {
    failureInjectionManager.clearAllFaults();
  }, []);

  return (
    <Card
      className={cn('border-border/50 bg-background/95 backdrop-blur', className)}
      data-testid="failure-injection-panel"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-[#00F0FF]" />
          Failure Injection
          {faults.length > 0 && (
            <Badge
              variant="secondary"
              className="h-4 px-1 text-[9px] font-mono ml-1"
              data-testid="fault-count-badge"
            >
              {faults.length}
            </Badge>
          )}
        </CardTitle>

        <div className="flex items-center gap-1">
          {faults.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10"
              onClick={handleClearAll}
              data-testid="fault-clear-all"
              aria-label="Clear all faults"
            >
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        {/* Add fault button / form */}
        {showForm ? (
          <AddFaultForm
            components={components}
            onSubmit={handleInject}
            onCancel={() => { setShowForm(false); }}
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs gap-1 border-dashed border-[#00F0FF]/30 text-[#00F0FF] hover:bg-[#00F0FF]/10"
            onClick={() => { setShowForm(true); }}
            data-testid="fault-add-button"
          >
            <Plus className="w-3 h-3" />
            Add Fault
          </Button>
        )}

        {/* Fault list */}
        {faults.length > 0 ? (
          <ScrollArea className="max-h-56">
            <div className="flex flex-col gap-1" data-testid="fault-list">
              {faults.map((fault) => (
                <FaultRow key={fault.id} fault={fault} onRemove={handleRemove} />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2" data-testid="fault-list-empty">
            No faults injected. Add faults to simulate component failures.
          </p>
        )}

        {/* Fault report summary */}
        {faults.length > 0 && (
          <div
            className="rounded-md border border-[#00F0FF]/20 bg-[#00F0FF]/5 p-3 space-y-2"
            data-testid="fault-report"
          >
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-[#00F0FF]" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Fault Report
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-[10px] text-muted-foreground">Total Faults</span>
              <span className="text-[10px] font-mono text-foreground text-right" data-testid="fault-report-total">
                {report.totalFaults}
              </span>

              <span className="text-[10px] text-muted-foreground">Components</span>
              <span className="text-[10px] font-mono text-foreground text-right" data-testid="fault-report-components">
                {report.affectedComponents.length}
              </span>
            </div>

            {/* Type breakdown */}
            <div className="flex flex-wrap gap-1 pt-1">
              {FAULT_TYPE_OPTIONS.filter((ft) => report.byType[ft] > 0).map((ft) => (
                <Badge
                  key={ft}
                  variant="outline"
                  className={cn('h-4 px-1.5 text-[9px]', FAULT_TYPE_COLORS[ft])}
                  data-testid={`fault-report-type-${ft}`}
                >
                  {FAULT_TYPE_LABELS[ft]}: {report.byType[ft]}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
