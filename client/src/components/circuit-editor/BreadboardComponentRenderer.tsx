import { memo, useMemo } from 'react';
import { computeShapesBounds, renderPartShape } from '@/components/circuit-editor/PartSymbolRenderer';
import { useSimulation } from '@/lib/contexts/simulation-context';
import { cn } from '@/lib/utils';
import { getVerificationStatus, shouldPreferExactBreadboardView } from '@shared/component-trust';
import {
  ResistorSvg, CapacitorSvg, LedSvg, IcSvg, DiodeSvg, TransistorSvg,
  PotentiometerSvg, ButtonSvg, SwitchSvg, HeaderSvg, RegulatorSvg,
  CrystalSvg, BuzzerSvg, FuseSvg, SensorSvg, DisplaySvg, RelaySvg,
  MotorSvg, ConnectorSvg,
} from './breadboard-components';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';

// ---------------------------------------------------------------------------
// Part family value constants (BL-0594)
// ---------------------------------------------------------------------------

/** E12 resistor decade values */
const E12_BASE = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
const RESISTOR_DECADES = [1, 10, 100, 1e3, 10e3, 100e3, 1e6];

/** Generate full E12 resistor value list with SI suffix */
function buildResistorValues(): Array<{ value: number; label: string }> {
  const result: Array<{ value: number; label: string }> = [];
  for (const decade of RESISTOR_DECADES) {
    for (const base of E12_BASE) {
      const val = base * decade;
      result.push({ value: val, label: formatSI(val, '\u03A9') });
    }
  }
  return result;
}

/** Standard capacitor values */
const CAPACITOR_VALUES: Array<{ value: number; label: string }> = [
  10e-12, 22e-12, 47e-12, 100e-12, 220e-12, 470e-12,
  1e-9, 2.2e-9, 4.7e-9, 10e-9, 22e-9, 47e-9, 100e-9,
  220e-9, 470e-9, 1e-6, 2.2e-6, 4.7e-6, 10e-6, 22e-6,
  47e-6, 100e-6, 220e-6, 470e-6, 1000e-6,
].map(v => ({ value: v, label: formatSI(v, 'F') }));

/** Standard inductor values */
const INDUCTOR_VALUES: Array<{ value: number; label: string }> = [
  1e-6, 2.2e-6, 4.7e-6, 10e-6, 22e-6, 47e-6, 100e-6,
  220e-6, 470e-6, 1e-3, 2.2e-3, 4.7e-3, 10e-3,
].map(v => ({ value: v, label: formatSI(v, 'H') }));

/** LED color options */
const LED_COLORS: Array<{ value: string; label: string; hex: string }> = [
  { value: 'red', label: 'Red', hex: '#ef4444' },
  { value: 'green', label: 'Green', hex: '#22c55e' },
  { value: 'blue', label: 'Blue', hex: '#3b82f6' },
  { value: 'yellow', label: 'Yellow', hex: '#eab308' },
  { value: 'white', label: 'White', hex: '#f5f5f5' },
  { value: 'orange', label: 'Orange', hex: '#f97316' },
];

/** Format a number with SI prefix */
function formatSI(value: number, unit: string): string {
  if (value >= 1e6) return `${+(value / 1e6).toPrecision(3)}M${unit}`;
  if (value >= 1e3) return `${+(value / 1e3).toPrecision(3)}k${unit}`;
  if (value >= 1) return `${+value.toPrecision(3)}${unit}`;
  if (value >= 1e-3) return `${+(value * 1e3).toPrecision(3)}m${unit}`;
  if (value >= 1e-6) return `${+(value * 1e6).toPrecision(3)}\u00B5${unit}`;
  if (value >= 1e-9) return `${+(value * 1e9).toPrecision(3)}n${unit}`;
  if (value >= 1e-12) return `${+(value * 1e12).toPrecision(3)}p${unit}`;
  return `${value}${unit}`;
}

const RESISTOR_VALUES = buildResistorValues();

/** Detect component family from type string — extended for photorealistic rendering */
export type ComponentFamily = 'resistor' | 'capacitor' | 'inductor' | 'led' | null;
export type ExtendedComponentType = ComponentFamily | 'ic' | 'diode' | 'transistor'
  | 'potentiometer' | 'button' | 'switch' | 'header' | 'regulator'
  | 'crystal' | 'buzzer' | 'fuse' | 'sensor' | 'display' | 'relay'
  | 'motor' | 'connector';

export function detectFamily(type: string | undefined | null): ComponentFamily {
  if (!type) return null;
  const lower = type.toLowerCase();
  if (lower === 'resistor' || lower === 'res' || lower === 'r') return 'resistor';
  if (lower === 'capacitor' || lower === 'cap' || lower === 'c') return 'capacitor';
  if (lower === 'inductor' || lower === 'ind' || lower === 'l') return 'inductor';
  if (lower === 'led') return 'led';
  return null;
}

/** Extended type detection for photorealistic SVG dispatch */
export function detectExtendedType(type: string | undefined | null): ExtendedComponentType {
  if (!type) return null;
  const lower = type.toLowerCase();
  if (lower === 'resistor' || lower === 'res' || lower === 'r') return 'resistor';
  if (lower === 'capacitor' || lower === 'cap' || lower === 'c') return 'capacitor';
  if (lower === 'inductor' || lower === 'ind' || lower === 'l') return 'inductor';
  if (lower === 'led') return 'led';
  if (lower === 'ic' || lower === 'mcu' || lower === 'microcontroller') return 'ic';
  if (lower === 'diode' || lower === 'd') return 'diode';
  if (lower === 'transistor' || lower === 'bjt' || lower === 'mosfet' || lower === 'q') return 'transistor';
  if (lower === 'potentiometer' || lower === 'pot' || lower === 'trimmer') return 'potentiometer';
  if (lower === 'button' || lower === 'pushbutton' || lower === 'tactile') return 'button';
  if (lower === 'switch' || lower === 'toggle' || lower === 'spdt' || lower === 'spst') return 'switch';
  if (lower === 'header' || lower === 'pinheader' || lower === 'pin_header') return 'header';
  if (lower === 'regulator' || lower === 'vreg' || lower === 'ldo') return 'regulator';
  if (lower === 'crystal' || lower === 'oscillator' || lower === 'xtal') return 'crystal';
  if (lower === 'buzzer' || lower === 'piezo' || lower === 'speaker') return 'buzzer';
  if (lower === 'fuse' || lower === 'polyfuse' || lower === 'ptc') return 'fuse';
  if (lower === 'sensor' || lower === 'thermistor' || lower === 'photoresistor' || lower === 'ldr') return 'sensor';
  if (lower === 'display' || lower === '7seg' || lower === 'seven_segment' || lower === 'segment') return 'display';
  if (lower === 'relay') return 'relay';
  if (lower === 'motor' || lower === 'dc_motor' || lower === 'servo') return 'motor';
  if (lower === 'connector' || lower === 'terminal' || lower === 'barrel_jack' || lower === 'jst') return 'connector';
  return null;
}

/** Get available values for a family */
export function getFamilyValues(family: ComponentFamily): Array<{ value: number | string; label: string; hex?: string }> {
  switch (family) {
    case 'resistor': return RESISTOR_VALUES;
    case 'capacitor': return CAPACITOR_VALUES;
    case 'inductor': return INDUCTOR_VALUES;
    case 'led': return LED_COLORS;
    default: return [];
  }
}

/** Get the current value label for display */
export function getCurrentValueLabel(instance: CircuitInstanceRow, family: ComponentFamily): string {
  const props = instance.properties as Record<string, unknown> | null;
  if (!props) return '';
  if (family === 'led') return (props.color as string) ?? 'red';
  if (family === 'resistor') return props.value ? formatSI(Number(props.value), '\u03A9') : '10k\u03A9';
  if (family === 'capacitor') return props.value ? formatSI(Number(props.value), 'F') : '100nF';
  if (family === 'inductor') return props.value ? formatSI(Number(props.value), 'H') : '10\u00B5H';
  return '';
}

// ---------------------------------------------------------------------------
// Component rendering — photorealistic SVGs (BL-0590)
// ---------------------------------------------------------------------------

interface BreadboardComponentProps {
  instance: CircuitInstanceRow;
  part?: ComponentPart;
  selected?: boolean;
  onClick?: (id: number) => void;
}

const BreadboardComponent = memo(({ instance, part, selected, onClick }: BreadboardComponentProps) => {
  const { componentStates, isLive } = useSimulation();
  const liveState = componentStates[instance.referenceDesignator];

  const pos = useMemo(() => {
    if (instance.breadboardX == null || instance.breadboardY == null) return null;
    return { x: instance.breadboardX, y: instance.breadboardY };
  }, [instance.breadboardX, instance.breadboardY]);

  if (!pos) return null;

  const meta = (part?.meta as Record<string, unknown> | undefined) ?? {};
  const props = instance.properties as Record<string, unknown> | null;
  const type = (meta.type as string | undefined) ?? (props?.type as string | undefined);
  const typeLower = type?.toLowerCase() || 'generic';
  const color = (props?.color as string) || '#ff0000';
  const family = detectFamily(typeLower);
  const extType = detectExtendedType(typeLower);
  const valueLabel = family ? getCurrentValueLabel(instance, family) : null;
  const exactShapes = (((part?.views as { breadboard?: { shapes?: unknown[] } } | undefined)?.breadboard?.shapes ?? []) as unknown[])
    .filter((shape): shape is Parameters<typeof renderPartShape>[0] => shape != null && typeof shape === 'object');
  const renderExactView = part != null && shouldPreferExactBreadboardView(meta, part.views) && exactShapes.length > 0;
  const exactViewBounds = renderExactView ? computeShapesBounds(exactShapes) : null;
  const exactViewTransform = exactViewBounds
    ? `translate(${String(pos.x - (exactViewBounds.x + exactViewBounds.width / 2))} ${String(pos.y - (exactViewBounds.y + exactViewBounds.height / 2))})`
    : undefined;
  const exactViewRotation = instance.breadboardRotation != null && instance.breadboardRotation !== 0
    ? `rotate(${String(instance.breadboardRotation)} ${String(pos.x)} ${String(pos.y)})`
    : undefined;
  const exactStatusLabel = getVerificationStatus(meta) === 'verified' ? 'Verified exact' : 'Candidate exact';

  // Component-specific photorealistic rendering
  const renderShape = () => {
    if (renderExactView) {
      return (
        <g
          className="cursor-pointer"
          onClick={() => onClick?.(instance.id)}
          transform={exactViewRotation}
          data-testid={`bb-exact-view-${instance.id}`}
        >
          <g transform={exactViewTransform}>
            {exactShapes.map((shape) => renderPartShape(shape))}
          </g>
        </g>
      );
    }

    switch (extType) {
      case 'led': {
        const brightness = isLive
          ? (liveState?.isActive ? 1 : (liveState?.brightness ?? 0))
          : 0;
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <LedSvg cx={pos.x} cy={pos.y} color={color} brightness={brightness} />
          </g>
        );
      }
      case 'resistor': {
        const ohms = props?.value ? Number(props.value) : 10_000;
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <ResistorSvg cx={pos.x} cy={pos.y} ohms={ohms} />
          </g>
        );
      }
      case 'capacitor': {
        const farads = props?.value ? Number(props.value) : 100e-9;
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <CapacitorSvg cx={pos.x} cy={pos.y} farads={farads} />
          </g>
        );
      }
      case 'ic': {
        const pinCount = (part?.connectors as unknown[])?.length || 8;
        const partNumber = instance.referenceDesignator;
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <IcSvg cx={pos.x} cy={pos.y} pinCount={pinCount} partNumber={partNumber} />
          </g>
        );
      }
      case 'diode': {
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <DiodeSvg cx={pos.x} cy={pos.y} />
          </g>
        );
      }
      case 'transistor': {
        const partNumber = (props?.partNumber as string) || instance.referenceDesignator;
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <TransistorSvg cx={pos.x} cy={pos.y} partNumber={partNumber} />
          </g>
        );
      }
      case 'potentiometer': {
        const potOhms = props?.value ? Number(props.value) : 10_000;
        const potPos = props?.position ? Number(props.position) : 0.5;
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <PotentiometerSvg cx={pos.x} cy={pos.y} ohms={potOhms} position={potPos} />
          </g>
        );
      }
      case 'button': {
        const btnPressed = Boolean(props?.pressed);
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <ButtonSvg cx={pos.x} cy={pos.y} pressed={btnPressed} />
          </g>
        );
      }
      case 'switch': {
        const swOn = Boolean(props?.on);
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <SwitchSvg cx={pos.x} cy={pos.y} on={swOn} />
          </g>
        );
      }
      case 'header': {
        const headerPins = (part?.connectors as unknown[])?.length || 6;
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <HeaderSvg cx={pos.x} cy={pos.y} pinCount={headerPins} />
          </g>
        );
      }
      case 'regulator': {
        const regVoltage = props?.voltage ? Number(props.voltage) : 5;
        const regPart = (props?.partNumber as string) || undefined;
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <RegulatorSvg cx={pos.x} cy={pos.y} voltage={regVoltage} partNumber={regPart} />
          </g>
        );
      }
      case 'crystal': {
        const freq = props?.frequency ? Number(props.frequency) : 16_000_000;
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <CrystalSvg cx={pos.x} cy={pos.y} frequency={freq} />
          </g>
        );
      }
      case 'buzzer': {
        const buzActive = Boolean(props?.active);
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <BuzzerSvg cx={pos.x} cy={pos.y} active={buzActive} />
          </g>
        );
      }
      case 'fuse': {
        const fuseAmps = props?.value ? Number(props.value) : 1;
        const fuseBlown = Boolean(props?.blown);
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <FuseSvg cx={pos.x} cy={pos.y} amps={fuseAmps} blown={fuseBlown} />
          </g>
        );
      }
      case 'sensor': {
        const sType = (props?.sensorType as string) || 'generic';
        const sensPins = (part?.connectors as unknown[])?.length || 3;
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <SensorSvg cx={pos.x} cy={pos.y} sensorType={sType as 'generic'} pinCount={sensPins} />
          </g>
        );
      }
      case 'display': {
        const dispDigit = props?.digit != null ? Number(props.digit) : undefined;
        const dispColor = (props?.color as string) || '#ef4444';
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <DisplaySvg cx={pos.x} cy={pos.y} digit={dispDigit} color={dispColor} />
          </g>
        );
      }
      case 'relay': {
        const relayOn = Boolean(props?.energized);
        const relayV = props?.voltage ? Number(props.voltage) : 5;
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <RelaySvg cx={pos.x} cy={pos.y} energized={relayOn} voltage={relayV} />
          </g>
        );
      }
      case 'motor': {
        const motSpin = Boolean(props?.spinning);
        const motV = props?.voltage ? Number(props.voltage) : 6;
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <MotorSvg cx={pos.x} cy={pos.y} spinning={motSpin} voltage={motV} />
          </g>
        );
      }
      case 'connector': {
        const connType = (props?.connectorType as string) || 'generic';
        const connPins = (part?.connectors as unknown[])?.length || 2;
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <ConnectorSvg cx={pos.x} cy={pos.y} connectorType={connType as 'generic'} pinCount={connPins} />
          </g>
        );
      }
      default: {
        return (
          <rect
            x={pos.x - 5}
            y={pos.y - 5}
            width={10}
            height={10}
            fill="#444"
            className="cursor-pointer"
            onClick={() => onClick?.(instance.id)}
          />
        );
      }
    }
  };

  return (
    <g
      data-testid={`bb-instance-${instance.id}`}
      className={cn(selected && "filter drop-shadow-[0_0_2px_#00F0FF]")}
    >
      {renderShape()}
      {/* Value label shown below selected components with a family */}
      {selected && valueLabel && (
        <text
          x={pos.x}
          y={pos.y + 14}
          textAnchor="middle"
          dominantBaseline="hanging"
          fontSize={4}
          fill="#00F0FF"
          className="font-mono select-none pointer-events-none"
          data-testid={`bb-value-label-${instance.id}`}
        >
          {valueLabel}
        </text>
      )}
      {selected && renderExactView && (
        <text
          x={pos.x}
          y={pos.y + (valueLabel ? 20 : 14)}
          textAnchor="middle"
          dominantBaseline="hanging"
          fontSize={4}
          fill={getVerificationStatus(meta) === 'verified' ? '#86efac' : '#fde68a'}
          className="font-mono select-none pointer-events-none"
          data-testid={`bb-exact-status-${instance.id}`}
        >
          {exactStatusLabel}
        </text>
      )}
    </g>
  );
});

export const BreadboardComponentOverlay = memo(({
  instances,
  parts,
  selectedId,
  onInstanceClick
}: {
  instances: CircuitInstanceRow[],
  parts: ComponentPart[],
  selectedId: number | null,
  onInstanceClick: (id: number) => void
}) => {
  const partsMap = useMemo(() => new Map(parts.map(p => [p.id, p])), [parts]);

  return (
    <g data-testid="bb-component-overlay">
      {instances.map(inst => (
        <BreadboardComponent
          key={inst.id}
          instance={inst}
          part={inst.partId ? partsMap.get(inst.partId) : undefined}
          selected={inst.id === selectedId}
          onClick={onInstanceClick}
        />
      ))}
    </g>
  );
});
