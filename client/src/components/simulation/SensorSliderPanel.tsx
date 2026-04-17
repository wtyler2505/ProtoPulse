/**
 * SensorSliderPanel — renders environmental input sliders for detected
 * sensors during live simulation (BL-0622).
 *
 * Auto-detects sensor components from circuit instances and provides
 * labeled sliders with real-time voltage and ADC readouts.
 */

import { useState, useMemo, useSyncExternalStore, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Thermometer,
  Sun,
  Ruler,
  SlidersHorizontal,
  Droplets,
  Gauge,
} from 'lucide-react';
import {
  SensorInputManager,
  detectSensors,
} from '@/lib/simulation/sensor-inputs';
import type {
  SensorInput,
  SensorInputSnapshot,
  SensorFamily,
  DetectableInstance,
} from '@/lib/simulation/sensor-inputs';

// ---------------------------------------------------------------------------
// Sensor family → icon mapping
// ---------------------------------------------------------------------------

function getSensorIcon(family: SensorFamily) {
  switch (family) {
    case 'ntc_10k':
    case 'lm35':
      return Thermometer;
    case 'ldr':
    case 'photodiode':
      return Sun;
    case 'hc_sr04':
      return Ruler;
    case 'potentiometer':
      return SlidersHorizontal;
    case 'dht11':
    case 'dht22':
      return Droplets;
    case 'bmp280':
      return Gauge;
  }
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatValue(value: number, unit: string): string {
  if (unit === '°C') {
    return `${value.toFixed(1)}${unit}`;
  }
  if (unit === '%' || unit === '%RH') {
    return `${value.toFixed(1)}${unit}`;
  }
  if (unit === 'lux') {
    if (value >= 10_000) {
      return `${(value / 1000).toFixed(1)}k ${unit}`;
    }
    return `${value.toFixed(0)} ${unit}`;
  }
  if (unit === 'cm') {
    return `${value.toFixed(1)} ${unit}`;
  }
  if (unit === 'hPa') {
    return `${value.toFixed(1)} ${unit}`;
  }
  return `${value.toFixed(2)} ${unit}`;
}

function formatVoltage(voltage: number): string {
  if (Math.abs(voltage) < 0.001) {
    return `${(voltage * 1000).toFixed(2)} mV`;
  }
  return `${voltage.toFixed(3)} V`;
}

// ---------------------------------------------------------------------------
// Single sensor slider row
// ---------------------------------------------------------------------------

interface SensorSliderRowProps {
  sensor: SensorInput;
  manager: SensorInputManager;
}

function SensorSliderRow({ sensor, manager }: SensorSliderRowProps) {
  const Icon = getSensorIcon(sensor.type.family);
  const voltage = manager.getVoltage(sensor.id);
  const adcValue = manager.getAdcValue(sensor.id);
  const isModified = Math.abs(sensor.currentValue - sensor.type.defaultValue) > (sensor.type.max - sensor.type.min) * 0.001;

  const step = useMemo(() => {
    const range = sensor.type.max - sensor.type.min;
    // Target ~400 steps across the range
    const rawStep = range / 400;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    if (normalized <= 1.5) { return magnitude; }
    if (normalized <= 3.5) { return 2 * magnitude; }
    if (normalized <= 7.5) { return 5 * magnitude; }
    return 10 * magnitude;
  }, [sensor.type.min, sensor.type.max]);

  const handleValueChange = useCallback(([v]: number[]) => {
    if (v !== undefined) {
      manager.setEnvironmentalValue(sensor.id, v);
    }
  }, [manager, sensor.id]);

  const handleReset = useCallback(() => {
    manager.setEnvironmentalValue(sensor.id, sensor.type.defaultValue);
  }, [manager, sensor.id, sensor.type.defaultValue]);

  return (
    <div className="space-y-2" data-testid={`sensor-slider-${sensor.id}`}>
      {/* Header row: icon, label, value badge, reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-[var(--color-editor-accent)]/70" />
          <span className="text-xs font-medium text-muted-foreground" data-testid={`sensor-label-${sensor.id}`}>
            {sensor.id} — {sensor.type.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant={isModified ? 'default' : 'secondary'}
            className={cn(
              'font-mono text-[10px] px-1.5 py-0',
              isModified ? 'bg-[var(--color-editor-accent)]/20 text-[var(--color-editor-accent)] border-[var(--color-editor-accent)]/30' : '',
            )}
            data-testid={`sensor-value-${sensor.id}`}
          >
            {formatValue(sensor.currentValue, sensor.type.unit)}
          </Badge>
          {isModified && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={handleReset}
              title={`Reset ${sensor.id} to default`}
              aria-label={`Reset ${sensor.id} to default`}
              data-testid={`sensor-reset-${sensor.id}`}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Slider */}
      <Slider
        min={sensor.type.min}
        max={sensor.type.max}
        step={step}
        value={[sensor.currentValue]}
        onValueChange={handleValueChange}
        className="[&_[data-slot=range]]:bg-[var(--color-editor-accent)] [&_[data-slot=thumb]]:border-[var(--color-editor-accent)]/50"
        aria-label={`${sensor.type.name} slider for ${sensor.id}`}
        data-testid={`sensor-slider-input-${sensor.id}`}
      />

      {/* Range labels + computed values */}
      <div className="flex justify-between text-[10px] text-muted-foreground/60 font-mono">
        <span>{formatValue(sensor.type.min, sensor.type.unit)}</span>
        <span className="text-muted-foreground/80">
          {formatVoltage(voltage)} · ADC: {adcValue}
        </span>
        <span>{formatValue(sensor.type.max, sensor.type.unit)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SensorSliderPanelProps {
  /** Circuit instances to scan for sensors. */
  instances: DetectableInstance[];
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function SensorSliderPanel({ instances }: SensorSliderPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const manager = SensorInputManager.getInstance();

  // Subscribe to manager changes via useSyncExternalStore
  const snapshot = useSyncExternalStore<SensorInputSnapshot>(manager.subscribe, manager.getSnapshot);

  // Detect sensors whenever instances change
  const detectedSensors = useMemo(() => detectSensors(instances), [instances]);

  // Register sensors when detection changes
  useMemo(() => {
    if (detectedSensors.length > 0) {
      manager.registerSensors(instances);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedSensors.length, instances]);

  const handleResetAll = useCallback(() => {
    manager.resetAll();
  }, [manager]);

  // Use snapshot sensors for rendering (reactive to manager updates)
  const sensors = snapshot.sensors;

  if (sensors.length === 0) {
    return null; // Don't render panel if no sensors detected
  }

  const hasModified = sensors.some(
    (s) => Math.abs(s.currentValue - s.type.defaultValue) > (s.type.max - s.type.min) * 0.001,
  );

  return (
    <div
      className="border-b border-border/50"
      data-testid="sensor-slider-panel"
    >
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
        onClick={() => { setCollapsed((c) => !c); }}
        aria-expanded={!collapsed}
        data-testid="sensor-panel-toggle"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Sensor Inputs
        <Badge variant="secondary" className="ml-auto font-mono text-[10px] px-1.5 py-0">
          {sensors.length}
        </Badge>
        {hasModified && (
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-editor-accent)]" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-4">
          {sensors.map((sensor) => (
            <SensorSliderRow
              key={sensor.id}
              sensor={sensor}
              manager={manager}
            />
          ))}

          {hasModified && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleResetAll}
                data-testid="sensor-reset-all"
                aria-label="Reset all sensors to defaults"
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Reset All
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
