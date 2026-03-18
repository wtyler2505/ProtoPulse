import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DigitalTwinView from '../DigitalTwinView';
import { DeviceShadow } from '@/lib/digital-twin/device-shadow';
import type { TelemetryManifest, TelemetryFrame } from '@/lib/digital-twin/telemetry-protocol';

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({
    issues: [],
    addValidationIssue: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeManifest(channels: Array<{ id: string; name: string }>): TelemetryManifest {
  return {
    type: 'manifest',
    board: 'Arduino Mega 2560',
    firmware: '1.0.0',
    channels: channels.map((ch) => ({ ...ch, dataType: 'analog' as const })),
  };
}

function makeTelemetry(ts: number, ch: Record<string, number | boolean | string>): TelemetryFrame {
  return { type: 'telemetry', ts, ch };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DigitalTwinView', () => {
  beforeEach(() => {
    DeviceShadow.resetInstance();
  });

  afterEach(() => {
    DeviceShadow.resetInstance();
  });

  it('renders the digital twin view', () => {
    render(<DigitalTwinView />);
    expect(screen.getByTestId('digital-twin-view')).toBeDefined();
  });

  it('renders connection bar', () => {
    render(<DigitalTwinView />);
    expect(screen.getByTestId('connection-bar')).toBeDefined();
  });

  it('shows "No device" when disconnected', () => {
    render(<DigitalTwinView />);
    expect(screen.getByTestId('device-name').textContent).toBe('No device');
  });

  it('shows connect button when disconnected', () => {
    render(<DigitalTwinView />);
    expect(screen.getByTestId('connect-button')).toBeDefined();
  });

  it('shows no channels message when no data', () => {
    render(<DigitalTwinView />);
    expect(screen.getByTestId('no-channels')).toBeDefined();
  });

  it('shows no comparison message initially', () => {
    render(<DigitalTwinView />);
    expect(screen.getByTestId('no-comparison')).toBeDefined();
  });

  it('displays device name from manifest', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeManifest([{ id: 'A0', name: 'Analog 0' }]));

    render(<DigitalTwinView />);
    expect(screen.getByTestId('device-name').textContent).toBe('Arduino Mega 2560');
  });

  it('displays firmware version from manifest', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeManifest([{ id: 'A0', name: 'Analog 0' }]));

    render(<DigitalTwinView />);
    expect(screen.getByTestId('firmware-version').textContent).toContain('1.0.0');
  });

  it('displays channel values after telemetry', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeManifest([{ id: 'A0', name: 'Analog 0' }]));
    shadow.processFrame(makeTelemetry(100, { A0: 3.30 }));

    render(<DigitalTwinView />);
    expect(screen.getByTestId('live-values-grid')).toBeDefined();
    expect(screen.getByTestId('channel-card-A0')).toBeDefined();
    expect(screen.getByTestId('channel-value-A0').textContent).toBe('3.30');
  });

  it('displays boolean channel as HIGH/LOW', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeTelemetry(100, { D13: true }));

    render(<DigitalTwinView />);
    expect(screen.getByTestId('channel-value-D13').textContent).toBe('HIGH');
  });

  it('shows staleness indicator for stale channels', () => {
    const shadow = DeviceShadow.getInstance();
    // Process manifest which initializes channels as stale (timestamp=0)
    shadow.processFrame(makeManifest([{ id: 'A0', name: 'Analog 0' }]));

    render(<DigitalTwinView />);
    expect(screen.getByTestId('stale-indicator-A0')).toBeDefined();
  });

  it('opens firmware dialog on button click', () => {
    render(<DigitalTwinView />);
    fireEvent.click(screen.getByTestId('open-firmware-dialog'));
    expect(screen.getByTestId('firmware-dialog')).toBeDefined();
  });

  it('closes firmware dialog on close button click', () => {
    render(<DigitalTwinView />);
    fireEvent.click(screen.getByTestId('open-firmware-dialog'));
    expect(screen.getByTestId('firmware-dialog')).toBeDefined();
    fireEvent.click(screen.getByTestId('close-firmware-dialog'));
    expect(screen.queryByTestId('firmware-dialog')).toBeNull();
  });

  it('firmware dialog has board selector', () => {
    render(<DigitalTwinView />);
    fireEvent.click(screen.getByTestId('open-firmware-dialog'));
    expect(screen.getByTestId('board-select')).toBeDefined();
  });

  it('firmware dialog generates code', () => {
    render(<DigitalTwinView />);
    fireEvent.click(screen.getByTestId('open-firmware-dialog'));
    fireEvent.click(screen.getByTestId('generate-firmware-button'));
    expect(screen.getByTestId('firmware-code')).toBeDefined();
    expect(screen.getByTestId('firmware-code').textContent).toContain('void setup()');
  });

  it('firmware dialog add pin button works', () => {
    render(<DigitalTwinView />);
    fireEvent.click(screen.getByTestId('open-firmware-dialog'));
    fireEvent.click(screen.getByTestId('add-pin-button'));
    expect(screen.getByTestId('pin-id-0')).toBeDefined();
  });

  it('firmware dialog remove pin works', () => {
    render(<DigitalTwinView />);
    fireEvent.click(screen.getByTestId('open-firmware-dialog'));
    fireEvent.click(screen.getByTestId('add-pin-button'));
    expect(screen.getByTestId('pin-id-0')).toBeDefined();
    fireEvent.click(screen.getByTestId('remove-pin-0'));
    expect(screen.queryByTestId('pin-id-0')).toBeNull();
  });

  it('shows toggle button for boolean channels', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeTelemetry(100, { D13: false }));

    render(<DigitalTwinView />);
    expect(screen.getByTestId('toggle-D13')).toBeDefined();
  });

  it('displays multiple channels', () => {
    const shadow = DeviceShadow.getInstance();
    shadow.processFrame(makeTelemetry(100, { A0: 3.3, A1: 2.5, D13: true }));

    render(<DigitalTwinView />);
    expect(screen.getByTestId('channel-card-A0')).toBeDefined();
    expect(screen.getByTestId('channel-card-A1')).toBeDefined();
    expect(screen.getByTestId('channel-card-D13')).toBeDefined();
  });
});
