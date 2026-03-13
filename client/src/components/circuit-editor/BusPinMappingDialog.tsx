import { useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Cable,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { busPinMapper } from '@/lib/circuit-editor/bus-pin-mapper';
import type { BusDefinition, BusValidation } from '@/lib/circuit-editor/bus-pin-mapper';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BusPinMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Available circuit nets for the net dropdown. */
  nets: { id: string; name: string }[];
  /** Called when user clicks Apply. Receives the current bus definitions snapshot. */
  onApply?: (buses: BusDefinition[]) => void;
}

// ---------------------------------------------------------------------------
// Hook — subscribe to busPinMapper singleton
// ---------------------------------------------------------------------------

function useBusPinMapper(): { buses: BusDefinition[]; version: number } {
  const version = useSyncExternalStore(
    (cb) => busPinMapper.subscribe(cb),
    () => busPinMapper.version,
  );
  const buses = useMemo(() => busPinMapper.getBusDefinitions(), [version]);
  return { buses, version };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BusPinMappingDialog({
  open,
  onOpenChange,
  nets,
  onApply,
}: BusPinMappingDialogProps) {
  const { buses } = useBusPinMapper();

  // --- Create bus form ---
  const [newBusName, setNewBusName] = useState('');
  const [newBusWidth, setNewBusWidth] = useState('8');
  const [createError, setCreateError] = useState<string | null>(null);

  // --- Auto-assign ---
  const [autoPrefix, setAutoPrefix] = useState('');

  // --- Selected bus ---
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);

  const selectedBus = useMemo(
    () => buses.find((b) => b.id === selectedBusId) ?? null,
    [buses, selectedBusId],
  );

  const validation: BusValidation | null = useMemo(() => {
    if (!selectedBusId) {
      return null;
    }
    return busPinMapper.validateBus(selectedBusId);
  }, [selectedBusId, buses]);

  // --- Handlers ---

  const handleCreateBus = useCallback(() => {
    setCreateError(null);
    try {
      const width = parseInt(newBusWidth, 10);
      if (isNaN(width)) {
        setCreateError('Width must be a number.');
        return;
      }
      const bus = busPinMapper.createBus(newBusName, width);
      setNewBusName('');
      setNewBusWidth('8');
      setSelectedBusId(bus.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    }
  }, [newBusName, newBusWidth]);

  const handleDeleteBus = useCallback(
    (busId: string) => {
      busPinMapper.deleteBus(busId);
      if (selectedBusId === busId) {
        setSelectedBusId(null);
      }
    },
    [selectedBusId],
  );

  const handleAssignSignal = useCallback(
    (bitIndex: number, signalName: string) => {
      if (!selectedBusId) {
        return;
      }
      busPinMapper.assignSignal(selectedBusId, bitIndex, signalName);
    },
    [selectedBusId],
  );

  const handleAssignNet = useCallback(
    (bitIndex: number, netId: string) => {
      if (!selectedBusId || !selectedBus) {
        return;
      }
      const signal = selectedBus.signals[bitIndex];
      const netName = nets.find((n) => n.id === netId)?.name ?? signal?.signalName ?? '';
      busPinMapper.assignSignal(selectedBusId, bitIndex, netName, netId);
    },
    [selectedBusId, selectedBus, nets],
  );

  const handleClearSignal = useCallback(
    (bitIndex: number) => {
      if (!selectedBusId) {
        return;
      }
      busPinMapper.unassignSignal(selectedBusId, bitIndex);
    },
    [selectedBusId],
  );

  const handleAutoAssign = useCallback(() => {
    if (!selectedBusId || !autoPrefix.trim()) {
      return;
    }
    busPinMapper.autoAssignByPrefix(selectedBusId, autoPrefix.trim(), nets);
  }, [selectedBusId, autoPrefix, nets]);

  const handleApply = useCallback(() => {
    onApply?.(busPinMapper.getBusDefinitions());
    onOpenChange(false);
  }, [onApply, onOpenChange]);

  // --- Render ---

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[700px] max-h-[90vh] flex flex-col"
        data-testid="bus-pin-mapping-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cable className="w-5 h-5 text-primary" />
            Bus Pin Mapping
          </DialogTitle>
          <DialogDescription>
            Create named buses and assign individual signals to bus pins.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[220px_1fr] gap-4 flex-1 overflow-hidden min-h-0">
          {/* Left column — bus list + create form */}
          <div className="flex flex-col border rounded-md overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b">
              Buses
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1" data-testid="bus-list">
                {buses.map((bus) => {
                  const v = busPinMapper.validateBus(bus.id);
                  return (
                    <div
                      key={bus.id}
                      data-testid={`bus-item-${bus.id}`}
                      onClick={() => setSelectedBusId(bus.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedBusId(bus.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'flex items-center justify-between p-2 rounded cursor-pointer transition-colors hover:bg-muted/50 group',
                        selectedBusId === bus.id ? 'border border-primary bg-primary/5' : 'border border-transparent',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono font-bold truncate">{bus.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {bus.width}-bit
                          {v.valid ? (
                            <CheckCircle2 className="inline w-3 h-3 ml-1 text-emerald-500" />
                          ) : v.conflicts.length > 0 ? (
                            <XCircle className="inline w-3 h-3 ml-1 text-destructive" />
                          ) : (
                            <AlertTriangle className="inline w-3 h-3 ml-1 text-amber-500" />
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`delete-bus-${bus.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBus(bus.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
                {buses.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-[10px] italic">
                    No buses defined
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Create bus form */}
            <div className="border-t p-2 space-y-2">
              <div className="space-y-1">
                <Label htmlFor="bus-name-input" className="text-[10px]">Name</Label>
                <Input
                  id="bus-name-input"
                  data-testid="bus-name-input"
                  placeholder="e.g. data"
                  value={newBusName}
                  onChange={(e) => setNewBusName(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateBus();
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bus-width-input" className="text-[10px]">Width</Label>
                <Input
                  id="bus-width-input"
                  data-testid="bus-width-input"
                  type="number"
                  min={1}
                  max={64}
                  value={newBusWidth}
                  onChange={(e) => setNewBusWidth(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateBus();
                    }
                  }}
                />
              </div>
              {createError && (
                <div className="text-[10px] text-destructive" data-testid="create-bus-error">
                  {createError}
                </div>
              )}
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                data-testid="create-bus-button"
                onClick={handleCreateBus}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create Bus
              </Button>
            </div>
          </div>

          {/* Right column — signal assignment table */}
          <div className="flex flex-col border rounded-md overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b flex items-center justify-between">
              <span>Signal Assignments</span>
              {validation && (
                <Badge
                  variant={validation.valid ? 'default' : 'outline'}
                  className={cn(
                    'text-[9px] h-4 px-1.5',
                    validation.valid
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : validation.conflicts.length > 0
                        ? 'bg-destructive/20 text-destructive border-destructive/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                  )}
                  data-testid="validation-badge"
                >
                  {validation.valid
                    ? 'Valid'
                    : validation.conflicts.length > 0
                      ? `${validation.conflicts.length} conflict(s)`
                      : `${validation.unmappedCount} unmapped`}
                </Badge>
              )}
            </div>

            {!selectedBus ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs italic p-4">
                Select a bus to assign signals
              </div>
            ) : (
              <>
                {/* Auto-assign bar */}
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
                  <Label htmlFor="auto-prefix-input" className="text-[10px] whitespace-nowrap">
                    Auto-assign prefix:
                  </Label>
                  <Input
                    id="auto-prefix-input"
                    data-testid="auto-prefix-input"
                    placeholder="e.g. D"
                    value={autoPrefix}
                    onChange={(e) => setAutoPrefix(e.target.value)}
                    className="h-7 text-xs flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAutoAssign();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    data-testid="auto-assign-button"
                    onClick={handleAutoAssign}
                    disabled={!autoPrefix.trim()}
                  >
                    <Wand2 className="w-3.5 h-3.5 mr-1" />
                    Auto
                  </Button>
                </div>

                {/* Signal table */}
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {/* Header row */}
                    <div className="grid grid-cols-[40px_1fr_1fr_32px] gap-2 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span>Bit</span>
                      <span>Signal</span>
                      <span>Net</span>
                      <span />
                    </div>

                    {selectedBus.signals.map((signal) => {
                      const hasConflict = validation?.conflicts.some(
                        (c) => c.bitIndex === signal.bitIndex,
                      );
                      return (
                        <div
                          key={signal.bitIndex}
                          data-testid={`signal-row-${signal.bitIndex}`}
                          className={cn(
                            'grid grid-cols-[40px_1fr_1fr_32px] gap-2 items-center px-2 py-1 rounded',
                            hasConflict && 'bg-destructive/5 border border-destructive/20',
                          )}
                        >
                          {/* Bit index */}
                          <span className="text-[10px] font-mono text-muted-foreground text-center">
                            [{signal.bitIndex}]
                          </span>

                          {/* Signal name input */}
                          <Input
                            data-testid={`signal-name-${signal.bitIndex}`}
                            placeholder={`Signal ${signal.bitIndex}`}
                            value={signal.signalName ?? ''}
                            onChange={(e) => handleAssignSignal(signal.bitIndex, e.target.value)}
                            className="h-7 text-xs font-mono"
                          />

                          {/* Net dropdown */}
                          <Select
                            value={signal.netId ?? ''}
                            onValueChange={(value) => handleAssignNet(signal.bitIndex, value)}
                          >
                            <SelectTrigger
                              className="h-7 text-xs"
                              data-testid={`net-select-${signal.bitIndex}`}
                            >
                              <SelectValue placeholder="(none)" />
                            </SelectTrigger>
                            <SelectContent>
                              {nets.map((net) => (
                                <SelectItem key={net.id} value={net.id} className="text-xs">
                                  {net.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Clear button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            data-testid={`clear-signal-${signal.bitIndex}`}
                            onClick={() => handleClearSignal(signal.bitIndex)}
                            disabled={signal.signalName === null && signal.netId === null}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="cancel-button">
            Cancel
          </Button>
          <Button onClick={handleApply} data-testid="apply-button">
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
