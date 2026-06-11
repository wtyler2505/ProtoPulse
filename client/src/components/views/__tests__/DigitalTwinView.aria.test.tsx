/// <reference lib="dom" />

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { ShadowState } from '@/lib/digital-twin/device-shadow';

/**
 * BL-0781 ARIA spinbutton contract for DigitalTwinView (FirmwareDialog).
 *
 * Audit row mapping (docs/audits/bl-0781-number-input-audit.md, T4 section):
 *   L753 sample-rate-input  min=1, max=100 (Hz)         KEEP
 *   L789 pin-number-{i}     min=0, max=99 (Arduino pin) ADD-MIN + ADD-MAX
 *
 * The sample-rate-input and pin-number rows live inside a FirmwareDialog
 * component opened via `open-firmware-dialog` button. pin-number rows only
 * appear after `add-pin-button` is clicked.
 *
 * Mocks mirror the existing client/src/components/views/__tests__/DigitalTwinView.test.tsx
 * harness so the DTV component can mount without external services.
 */

let mockShadowState: ShadowState & {
  setDesired: ReturnType<typeof vi.fn>;
  attachSerial: ReturnType<typeof vi.fn>;
  detachSerial: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
};

vi.mock('@/lib/digital-twin/device-shadow', () => ({
  useDeviceShadow: () => mockShadowState,
  DeviceShadow: { getInstance: () => ({}) },
}));

vi.mock('@/lib/telemetry-shadow-bridge', () => ({
  TelemetryShadowBridge: {
    getInstance: () => ({ connectLogger: vi.fn(), disconnect: vi.fn() }),
  },
}));

vi.mock('@/lib/digital-twin/telemetry-logger', () => ({
  TelemetryLogger: { getInstance: () => ({}) },
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
  useProjectMeta: () => ({ setActiveView: vi.fn() }),
}));

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({ addValidationIssue: vi.fn(), issues: [] }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import DigitalTwinView from '../DigitalTwinView';

function makeShadowState(): typeof mockShadowState {
  return {
    connected: false,
    manifest: null,
    reported: new Map(),
    desired: new Map(),
    delta: new Map(),
    lastUpdate: 0,
    frameRate: 0,
    setDesired: vi.fn(),
    attachSerial: vi.fn(),
    detachSerial: vi.fn(),
    reset: vi.fn(),
  };
}

describe('DigitalTwinView — BL-0781 ARIA spinbutton contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockShadowState = makeShadowState();
  });

  it('mirrors min/max on sample-rate-input (KEEP: 1..100 Hz)', () => {
    render(<DigitalTwinView />);
    fireEvent.click(screen.getByTestId('open-firmware-dialog'));
    const sampleRate = screen.getByTestId('sample-rate-input') as HTMLInputElement;
    expect(sampleRate.getAttribute('aria-valuemin')).toBe('1');
    expect(sampleRate.getAttribute('aria-valuemax')).toBe('100');
    expect(sampleRate.getAttribute('min')).toBe('1');
    expect(sampleRate.getAttribute('max')).toBe('100');
  });

  it('mirrors min/max on pin-number rows (ADD-MIN, ADD-MAX: 0..99)', () => {
    render(<DigitalTwinView />);
    fireEvent.click(screen.getByTestId('open-firmware-dialog'));
    fireEvent.click(screen.getByTestId('add-pin-button'));
    const pinNumber = screen.getByTestId('pin-number-0') as HTMLInputElement;
    expect(pinNumber.getAttribute('aria-valuemin')).toBe('0');
    expect(pinNumber.getAttribute('aria-valuemax')).toBe('99');
    expect(pinNumber.getAttribute('min')).toBe('0');
    expect(pinNumber.getAttribute('max')).toBe('99');
  });
});
