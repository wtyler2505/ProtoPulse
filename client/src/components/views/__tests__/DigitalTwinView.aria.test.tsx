/**
 * DigitalTwinView — NumberInput ARIA-contract migration test (BL-0781).
 *
 * Per the BL-0781 audit (docs/audits/bl-0781-number-input-audit.md,
 * "Component-editor + views" table):
 *   - Firmware dialog "Sample Rate (Hz)" (`sample-rate-input`) is KEEP:
 *     min=1/max=100, a real intentional UI cap.
 *   - Per-pin "Pin" number field (`pin-number-{i}`) is OMIT-MAX (static) — the
 *     audit explicitly scopes a dynamic per-board max (`boardPinCount()`) out of
 *     this wave; this is a plain wrapper swap only.
 *
 * Mirrors the mount pattern from the existing
 * `client/src/components/views/__tests__/DigitalTwinView.test.tsx` suite
 * (no QueryClientProvider needed; validation-context is mocked).
 */

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import DigitalTwinView from '../DigitalTwinView';
import { DeviceShadow } from '@/lib/digital-twin/device-shadow';

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({
    issues: [],
    addValidationIssue: vi.fn(),
  }),
}));

function openFirmwareDialog() {
  render(<DigitalTwinView />);
  fireEvent.click(screen.getByTestId('open-firmware-dialog'));
}

describe('DigitalTwinView — NumberInput ARIA contract (BL-0781)', () => {
  beforeEach(() => {
    DeviceShadow.resetInstance();
  });

  afterEach(() => {
    cleanup();
    DeviceShadow.resetInstance();
  });

  it('sample rate: renders as a spinbutton, KEEP min=1/max=100', () => {
    openFirmwareDialog();
    const el = screen.getByTestId('sample-rate-input');
    expect(el.getAttribute('type')).toBe('number');
    expect(el.getAttribute('aria-valuemin')).toBe('1');
    expect(el.getAttribute('aria-valuemax')).toBe('100');
    expect(el.getAttribute('min')).toBe('1');
    expect(el.getAttribute('max')).toBe('100');
  });

  it('sample rate mirrors the default value (10) onto aria-valuenow', () => {
    openFirmwareDialog();
    expect(screen.getByTestId('sample-rate-input').getAttribute('aria-valuenow')).toBe('10');
  });

  it('GPIO pin number: renders as a spinbutton, OMIT-MAX (static, no dynamic per-board max)', () => {
    openFirmwareDialog();
    fireEvent.click(screen.getByTestId('add-pin-button'));
    const el = screen.getByTestId('pin-number-0');
    expect(el.getAttribute('type')).toBe('number');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
  });

  it('GPIO pin number: OMIT-MIN as well (no bound passed at this call site)', () => {
    openFirmwareDialog();
    fireEvent.click(screen.getByTestId('add-pin-button'));
    const el = screen.getByTestId('pin-number-0');
    expect(el.hasAttribute('aria-valuemin')).toBe(false);
    expect(el.hasAttribute('min')).toBe(false);
  });

  it('regression guard: GPIO pin number never coerces the missing max to aria-valuemax="0"', () => {
    openFirmwareDialog();
    fireEvent.click(screen.getByTestId('add-pin-button'));
    const el = screen.getByTestId('pin-number-0');
    expect(el.getAttribute('aria-valuemax')).not.toBe('0');
  });

  it('GPIO pin number mirrors its default value (0) onto aria-valuenow', () => {
    openFirmwareDialog();
    fireEvent.click(screen.getByTestId('add-pin-button'));
    expect(screen.getByTestId('pin-number-0').getAttribute('aria-valuenow')).toBe('0');
  });
});
