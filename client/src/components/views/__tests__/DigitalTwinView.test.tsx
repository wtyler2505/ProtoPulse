import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { ShadowState } from '@/lib/digital-twin/device-shadow';
import { readViewer3DBridgeTarget, readViewer3DRepairTarget } from '@/lib/viewer-3d-bridge';

const mockSetActiveView = vi.fn();
const mockAddValidationIssue = vi.fn();
const mockToast = vi.fn();
const mockConnectLogger = vi.fn();
const mockDisconnectLogger = vi.fn();

let mockShadowState: ShadowState & {
  setDesired: ReturnType<typeof vi.fn>;
  attachSerial: ReturnType<typeof vi.fn>;
  detachSerial: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
};

vi.mock('@/lib/digital-twin/device-shadow', () => ({
  useDeviceShadow: () => mockShadowState,
  DeviceShadow: {
    getInstance: () => ({}),
  },
}));

vi.mock('@/lib/telemetry-shadow-bridge', () => ({
  TelemetryShadowBridge: {
    getInstance: () => ({
      connectLogger: mockConnectLogger,
      disconnect: mockDisconnectLogger,
    }),
  },
}));

vi.mock('@/lib/digital-twin/telemetry-logger', () => ({
  TelemetryLogger: {
    getInstance: () => ({}),
  },
}));

vi.mock('@/lib/web-serial', () => ({
  WebSerialManager: {
    isSupported: () => true,
    getInstance: () => ({
      requestPort: vi.fn().mockResolvedValue(false),
      connect: vi.fn().mockResolvedValue(false),
    }),
  },
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 44,
}));

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({
    setActiveView: mockSetActiveView,
  }),
}));

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({
    addValidationIssue: mockAddValidationIssue,
    issues: [],
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import DigitalTwinView from '../DigitalTwinView';

function makeShadowState(): typeof mockShadowState {
  return {
    connected: true,
    manifest: {
      type: 'manifest',
      board: 'ESP32-S3',
      firmware: 'proto-1.0',
      channels: [
        { id: 'D2', name: 'Button', dataType: 'digital', pin: 2, refDes: 'U1', pinLabel: 'D2', netName: 'BUTTON' },
        { id: 'A0', name: 'Sensor', dataType: 'analog', pin: 36, min: 0, max: 3.3 },
        { id: 'PWM3', name: 'Motor PWM', dataType: 'pwm', pin: 3, min: 0, max: 255 },
      ],
    },
    reported: new Map([
      ['D2', { value: true, timestamp: Date.now(), stale: false }],
      ['A0', { value: 1.25, timestamp: Date.now(), stale: false }],
      ['PWM3', { value: 0, timestamp: 0, stale: true }],
    ]),
    desired: new Map(),
    delta: new Map(),
    lastUpdate: Date.now(),
    frameRate: 24,
    setDesired: vi.fn(),
    attachSerial: vi.fn(),
    detachSerial: vi.fn(),
    reset: vi.fn(),
  };
}

describe('DigitalTwinView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockShadowState = makeShadowState();
  });

  it('renders a 3D behavior preview with live pin/channel state', () => {
    render(<DigitalTwinView />);

    expect(screen.getByTestId('digital-twin-view')).toBeDefined();
    expect(screen.getByTestId('connection-bar')).toBeDefined();
    expect(screen.getByTestId('device-name').textContent).toBe('ESP32-S3');
    expect(screen.getByTestId('firmware-version').textContent).toContain('proto-1.0');
    const preview = screen.getByTestId('digital-twin-3d-preview');
    expect(preview.textContent).toContain('3D Behavior Preview');
    expect(preview.getAttribute('data-resizable')).toBe('true');
    expect(preview.getAttribute('data-collapsed')).toBe('false');
    expect(screen.getByTestId('digital-twin-3d-preview-body')).toBeDefined();
    expect(screen.getByTestId('digital-twin-preview-channel-D2').textContent).toContain('Button');
    expect(screen.getByTestId('digital-twin-preview-channel-D2').textContent).toContain('HIGH');
    expect(screen.getByTestId('digital-twin-preview-channel-D2').textContent).toContain('U1');
    expect(screen.getByTestId('digital-twin-preview-channel-A0').textContent).toContain('pin 36');
    expect(screen.getByTestId('digital-twin-preview-channel-PWM3').textContent).toContain('0.00');
    expect(screen.getByTestId('digital-twin-live-channel-count').textContent).toBe('2');
    expect(screen.getByTestId('digital-twin-pin-count').textContent).toBe('3');
    expect(screen.getByTestId('digital-twin-net-count').textContent).toBe('3');
    expect(screen.getByTestId('digital-twin-next-actions').textContent).toContain('Check stale channels on Breadboard');
  });

  it('keeps the 3D behavior preview collapsible for laptop-height layouts', () => {
    render(<DigitalTwinView />);

    const preview = screen.getByTestId('digital-twin-3d-preview');
    const toggle = screen.getByTestId('digital-twin-3d-preview-toggle');

    fireEvent.click(toggle);

    expect(preview.getAttribute('data-collapsed')).toBe('true');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('digital-twin-3d-preview-body')).toBeNull();
    expect(preview.textContent).toContain('3D Behavior Preview');

    fireEvent.click(toggle);

    expect(preview.getAttribute('data-collapsed')).toBe('false');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('digital-twin-3d-preview-body')).toBeDefined();
  });

  it('renders empty connection, channel, and comparison states without telemetry', () => {
    mockShadowState = {
      ...makeShadowState(),
      connected: false,
      manifest: null,
      reported: new Map(),
      frameRate: 0,
    };

    render(<DigitalTwinView />);

    expect(screen.getByTestId('device-name').textContent).toBe('No device');
    expect(screen.getByTestId('connect-button')).toBeDefined();
    expect(screen.getByTestId('no-channels')).toBeDefined();
    expect(screen.getByTestId('no-comparison')).toBeDefined();
    expect(screen.getByTestId('digital-twin-3d-preview').textContent).toContain('unconfigured');
    expect(screen.getByTestId('digital-twin-next-actions').textContent).toContain('Generate firmware manifest');

    fireEvent.click(screen.getByTestId('digital-twin-next-action-firmware'));
    expect(screen.getByTestId('firmware-dialog')).toBeDefined();
  });

  it('lets users request desired boolean channel changes', () => {
    render(<DigitalTwinView />);

    expect(screen.getByTestId('channel-value-D2').textContent).toBe('HIGH');
    fireEvent.click(screen.getByTestId('toggle-D2'));

    expect(mockShadowState.setDesired).toHaveBeenCalledWith('D2', false);
  });

  it('opens, edits, generates, and closes the firmware dialog', () => {
    render(<DigitalTwinView />);

    fireEvent.click(screen.getByTestId('open-firmware-dialog'));
    expect(screen.getByTestId('firmware-dialog')).toBeDefined();
    expect(screen.getByTestId('board-select')).toBeDefined();

    fireEvent.click(screen.getByTestId('add-pin-button'));
    expect(screen.getByTestId('pin-id-0')).toBeDefined();

    fireEvent.click(screen.getByTestId('generate-firmware-button'));
    expect(screen.getByTestId('firmware-code').textContent).toContain('void setup()');

    fireEvent.click(screen.getByTestId('remove-pin-0'));
    expect(screen.queryByTestId('pin-id-0')).toBeNull();

    fireEvent.click(screen.getByTestId('close-firmware-dialog'));
    expect(screen.queryByTestId('firmware-dialog')).toBeNull();
  });

  it('adds a validation warning when live telemetry exceeds manifest bounds', async () => {
    mockShadowState = makeShadowState();
    mockShadowState.reported.set('A0', { value: 4.2, timestamp: Date.now(), stale: false });

    render(<DigitalTwinView />);

    await waitFor(() => {
      expect(mockAddValidationIssue).toHaveBeenCalledWith(expect.objectContaining({
        severity: 'warning',
        message: expect.stringContaining('Sensor'),
        suggestion: expect.stringContaining('Sensor'),
      }));
    });
  });

  it('publishes live state into 3D view and exposes fix links', () => {
    render(<DigitalTwinView />);

    fireEvent.click(screen.getByTestId('digital-twin-open-3d'));

    expect(mockSetActiveView).toHaveBeenCalledWith('viewer_3d');
    expect(readViewer3DBridgeTarget()).toMatchObject({
      sourceView: 'digital-twin',
      projectId: 44,
      title: 'ESP32-S3 telemetry',
      channelCount: 3,
      liveChannelCount: 2,
      pinCount: 3,
      netCount: 3,
      healthStatus: 'no_data',
      stateConfidence: 'stale',
      modelKind: 'behavior-preview',
      liveChannels: [
        { id: 'D2', name: 'Button', value: 'HIGH', state: 'live', pin: 2, refDes: 'U1', pinLabel: 'D2', netName: 'BUTTON' },
        { id: 'A0', name: 'Sensor', value: '1.25', state: 'live', pin: 36 },
        { id: 'PWM3', name: 'Motor PWM', value: '0.00', state: 'stale', pin: 3 },
      ],
    });

    fireEvent.click(screen.getByTestId('digital-twin-next-action-breadboard'));
    expect(readViewer3DRepairTarget()).toMatchObject({
      destination: 'breadboard',
      channel: { id: 'PWM3', pinLabel: 'P3' },
    });
    fireEvent.click(screen.getByTestId('digital-twin-fix-breadboard'));
    expect(readViewer3DRepairTarget()).toMatchObject({
      destination: 'breadboard',
      channel: { id: 'PWM3', pinLabel: 'P3' },
    });
    fireEvent.click(screen.getByTestId('digital-twin-fix-component-editor'));
    expect(readViewer3DRepairTarget()).toMatchObject({
      destination: 'component-editor',
      channel: { id: 'PWM3', pinLabel: 'P3' },
    });

    expect(mockSetActiveView).toHaveBeenCalledWith('breadboard');
    expect(mockSetActiveView).toHaveBeenCalledWith('component_editor');
  });
});
