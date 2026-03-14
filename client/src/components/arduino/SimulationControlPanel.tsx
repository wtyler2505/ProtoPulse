/**
 * SimulationControlPanel — UI for firmware simulation controls.
 *
 * Provides start/stop/reset controls, status indicator, MCU info,
 * cycle count + uptime metrics, serial output terminal, and pin monitor
 * for simavr-backed firmware simulation.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Play,
  Square,
  RefreshCw,
  Activity,
  Terminal,
  Cpu,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SimulationStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error';

interface SimulationEvent {
  type: 'uart' | 'pin' | 'cycle' | 'error' | 'info';
  timestamp: number;
  data: string;
}

interface PinState {
  pin: string;
  value: 'HIGH' | 'LOW';
}

export interface SimulationControlPanelProps {
  projectId: number;
  firmwarePath?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIGITAL_PINS = Array.from({ length: 14 }, (_, i) => `D${i}`);
const ANALOG_PINS = Array.from({ length: 6 }, (_, i) => `A${i}`);

const STATUS_CONFIG: Record<SimulationStatus, { color: string; dotColor: string; label: string }> = {
  idle: { color: 'text-muted-foreground', dotColor: 'bg-zinc-500', label: 'Idle' },
  starting: { color: 'text-amber-400', dotColor: 'bg-amber-500 animate-pulse', label: 'Starting...' },
  running: { color: 'text-emerald-400', dotColor: 'bg-emerald-500 animate-pulse', label: 'Running' },
  stopping: { color: 'text-amber-400', dotColor: 'bg-amber-500 animate-pulse', label: 'Stopping...' },
  error: { color: 'text-red-400', dotColor: 'bg-red-500', label: 'Error' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatCycleCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(2)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return String(count);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SimulationControlPanel({
  projectId,
  firmwarePath,
  className,
}: SimulationControlPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<SimulationStatus>('idle');
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cycleCount, setCycleCount] = useState(0);
  const [uptime, setUptime] = useState(0);
  const [pinStates, setPinStates] = useState<Map<string, 'HIGH' | 'LOW'>>(new Map());

  const eventSourceRef = useRef<EventSource | null>(null);
  const uptimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const serialEndRef = useRef<HTMLDivElement>(null);

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      if (uptimeIntervalRef.current !== null) {
        clearInterval(uptimeIntervalRef.current);
      }
    };
  }, []);

  // ── Auto-scroll serial output ─────────────────────────────────────────
  useEffect(() => {
    serialEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  // ── SSE event stream ──────────────────────────────────────────────────
  const connectEventStream = useCallback((simSessionId: string) => {
    eventSourceRef.current?.close();

    const es = new EventSource(
      `/api/projects/${projectId}/firmware/simulate/${simSessionId}/events`,
    );
    eventSourceRef.current = es;

    es.addEventListener('uart', (e: MessageEvent) => {
      const event: SimulationEvent = {
        type: 'uart',
        timestamp: Date.now(),
        data: String(e.data),
      };
      setEvents((prev) => [...prev, event]);
    });

    es.addEventListener('pin', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(String(e.data)) as PinState;
        setPinStates((prev) => {
          const next = new Map(prev);
          next.set(parsed.pin, parsed.value);
          return next;
        });
        const event: SimulationEvent = {
          type: 'pin',
          timestamp: Date.now(),
          data: `${parsed.pin} = ${parsed.value}`,
        };
        setEvents((prev) => [...prev, event]);
      } catch {
        // Ignore malformed pin events
      }
    });

    es.addEventListener('cycle', (e: MessageEvent) => {
      const count = parseInt(String(e.data), 10);
      if (!isNaN(count)) {
        setCycleCount(count);
      }
    });

    es.addEventListener('error', (e: Event) => {
      const msgEvent = e as MessageEvent;
      if (msgEvent.data) {
        setErrorMessage(String(msgEvent.data));
        setStatus('error');
      }
    });

    es.addEventListener('stopped', () => {
      setStatus('idle');
      stopUptime();
      es.close();
    });
  }, [projectId]);

  // ── Uptime tracking ───────────────────────────────────────────────────
  const startUptime = useCallback(() => {
    startTimeRef.current = Date.now();
    setUptime(0);
    if (uptimeIntervalRef.current !== null) {
      clearInterval(uptimeIntervalRef.current);
    }
    uptimeIntervalRef.current = setInterval(() => {
      if (startTimeRef.current !== null) {
        setUptime(Date.now() - startTimeRef.current);
      }
    }, 1000);
  }, []);

  const stopUptime = useCallback(() => {
    if (uptimeIntervalRef.current !== null) {
      clearInterval(uptimeIntervalRef.current);
      uptimeIntervalRef.current = null;
    }
    startTimeRef.current = null;
  }, []);

  // ── Start simulation ──────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (status === 'running' || status === 'starting') {
      return;
    }

    setStatus('starting');
    setErrorMessage(null);
    setEvents([]);
    setCycleCount(0);
    setUptime(0);
    setPinStates(new Map());

    try {
      const res = await fetch(`/api/projects/${projectId}/firmware/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmwarePath }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
        throw new Error(body.error ?? `Simulation failed (${res.status})`);
      }

      const result = await res.json() as { sessionId: string };
      setSessionId(result.sessionId);
      setStatus('running');
      startUptime();
      connectEventStream(result.sessionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start simulation';
      setErrorMessage(message);
      setStatus('error');
    }
  }, [projectId, firmwarePath, status, startUptime, connectEventStream]);

  // ── Stop simulation ───────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    if (status !== 'running' || !sessionId) {
      return;
    }

    setStatus('stopping');

    try {
      await fetch(`/api/projects/${projectId}/firmware/simulate/${sessionId}/stop`, {
        method: 'POST',
      });
      setStatus('idle');
      stopUptime();
      eventSourceRef.current?.close();
    } catch {
      setStatus('error');
      setErrorMessage('Failed to stop simulation');
    }
  }, [projectId, sessionId, status, stopUptime]);

  // ── Reset simulation ──────────────────────────────────────────────────
  const handleReset = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    try {
      eventSourceRef.current?.close();
      stopUptime();

      await fetch(`/api/projects/${projectId}/firmware/simulate/${sessionId}/reset`, {
        method: 'POST',
      });

      setStatus('idle');
      setEvents([]);
      setCycleCount(0);
      setUptime(0);
      setPinStates(new Map());
      setErrorMessage(null);
      setSessionId(null);
    } catch {
      setErrorMessage('Failed to reset simulation');
      setStatus('error');
    }
  }, [projectId, sessionId, stopUptime]);

  // ── Derived state ─────────────────────────────────────────────────────
  const statusCfg = STATUS_CONFIG[status];
  const isIdle = status === 'idle';
  const isRunning = status === 'running';
  const isError = status === 'error';
  const isBusy = status === 'starting' || status === 'stopping';
  const serialEvents = events.filter((e) => e.type === 'uart');

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <Card
      className={cn('border-border/50 bg-card/30', className)}
      data-testid="simulation-control-panel"
    >
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-primary" />
            Firmware Simulation
          </CardTitle>
          <Badge
            variant="outline"
            className={cn('text-[8px] h-4 px-1.5 gap-1', statusCfg.color)}
            data-testid="sim-status-badge"
          >
            <span
              className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusCfg.dotColor)}
              data-testid="sim-status-dot"
            />
            {statusCfg.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-3">
        {/* ── Controls bar ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2" data-testid="sim-controls-bar">
          <Button
            size="sm"
            variant={isRunning ? 'secondary' : 'default'}
            className="h-7 gap-1.5 text-[10px]"
            disabled={isRunning || isBusy}
            onClick={() => void handleStart()}
            data-testid="button-sim-start"
          >
            <Play className="w-3 h-3" />
            Start
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 gap-1.5 text-[10px]"
            disabled={!isRunning}
            onClick={() => void handleStop()}
            data-testid="button-sim-stop"
          >
            <Square className="w-3 h-3" />
            Stop
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-[10px]"
            disabled={isBusy || isIdle}
            onClick={() => void handleReset()}
            data-testid="button-sim-reset"
          >
            <RefreshCw className="w-3 h-3" />
            Reset
          </Button>
        </div>

        {/* ── MCU info ──────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-2 text-[10px] text-muted-foreground"
          data-testid="sim-mcu-info"
        >
          <Cpu className="w-3 h-3 shrink-0" />
          <span>ATmega328P @ 16 MHz</span>
          {firmwarePath && (
            <>
              <span className="text-border">|</span>
              <span className="truncate max-w-[180px]" title={firmwarePath}>
                {firmwarePath.split('/').pop()}
              </span>
            </>
          )}
        </div>

        {/* ── Metrics ───────────────────────────────────────────────── */}
        <div
          className="grid grid-cols-2 gap-2"
          data-testid="sim-metrics"
        >
          <div className="rounded border border-border/50 bg-background/30 px-2 py-1.5">
            <div className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
              Cycles
            </div>
            <div
              className="text-sm font-mono font-bold text-foreground tabular-nums"
              data-testid="sim-cycle-count"
            >
              {formatCycleCount(cycleCount)}
            </div>
          </div>
          <div className="rounded border border-border/50 bg-background/30 px-2 py-1.5">
            <div className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
              Uptime
            </div>
            <div
              className="text-sm font-mono font-bold text-foreground tabular-nums"
              data-testid="sim-uptime"
            >
              {formatUptime(uptime)}
            </div>
          </div>
        </div>

        {/* ── Serial output ─────────────────────────────────────────── */}
        <div data-testid="sim-serial-output">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Terminal className="w-3 h-3 text-primary/70" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Serial Output
            </span>
            <Badge variant="outline" className="ml-auto text-[7px] h-3 px-1">
              {serialEvents.length}
            </Badge>
          </div>
          <ScrollArea className="h-28 rounded border border-border/50 bg-black/40">
            <div className="p-2 font-mono text-[10px] leading-relaxed text-zinc-300 whitespace-pre-wrap">
              {serialEvents.length === 0 ? (
                <span className="text-muted-foreground opacity-40 italic">
                  {isRunning ? 'Waiting for serial data...' : 'No serial output yet'}
                </span>
              ) : (
                serialEvents.map((evt, i) => (
                  <div key={i} data-testid={`sim-serial-line-${i}`}>
                    {evt.data}
                  </div>
                ))
              )}
              <div ref={serialEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* ── Pin monitor ───────────────────────────────────────────── */}
        <div data-testid="sim-pin-monitor">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Cpu className="w-3 h-3 text-primary/70" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pin Monitor
            </span>
          </div>

          {/* Digital pins */}
          <div className="mb-1.5">
            <div className="text-[8px] text-muted-foreground mb-1">Digital</div>
            <div className="flex flex-wrap gap-1" data-testid="sim-digital-pins">
              {DIGITAL_PINS.map((pin) => {
                const val = pinStates.get(pin) ?? 'LOW';
                return (
                  <div
                    key={pin}
                    className="flex flex-col items-center gap-0.5"
                    title={`${pin}: ${val}`}
                    data-testid={`sim-pin-${pin}`}
                  >
                    <div
                      className={cn(
                        'w-3 h-3 rounded-full border transition-colors',
                        val === 'HIGH'
                          ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.5)]'
                          : 'bg-zinc-700 border-zinc-600',
                      )}
                      data-testid={`sim-pin-dot-${pin}`}
                    />
                    <span className="text-[7px] text-muted-foreground font-mono">
                      {pin.replace('D', '')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Analog pins */}
          <div>
            <div className="text-[8px] text-muted-foreground mb-1">Analog</div>
            <div className="flex flex-wrap gap-1" data-testid="sim-analog-pins">
              {ANALOG_PINS.map((pin) => {
                const val = pinStates.get(pin) ?? 'LOW';
                return (
                  <div
                    key={pin}
                    className="flex flex-col items-center gap-0.5"
                    title={`${pin}: ${val}`}
                    data-testid={`sim-pin-${pin}`}
                  >
                    <div
                      className={cn(
                        'w-3 h-3 rounded-full border transition-colors',
                        val === 'HIGH'
                          ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.5)]'
                          : 'bg-zinc-700 border-zinc-600',
                      )}
                      data-testid={`sim-pin-dot-${pin}`}
                    />
                    <span className="text-[7px] text-muted-foreground font-mono">
                      {pin}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Error panel ───────────────────────────────────────────── */}
        {isError && errorMessage && (
          <div
            className="rounded border border-red-500/40 bg-red-950/20 p-2.5 space-y-2"
            data-testid="sim-error-panel"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-300 leading-relaxed" data-testid="sim-error-message">
                {errorMessage}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-6 gap-1.5 text-[9px] border-red-500/30 hover:bg-red-950/40"
              onClick={() => void handleStart()}
              data-testid="button-sim-try-again"
            >
              <RefreshCw className="w-3 h-3" />
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
