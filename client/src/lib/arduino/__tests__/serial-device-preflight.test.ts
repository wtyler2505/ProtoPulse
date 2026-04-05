import { describe, expect, it } from 'vitest';

import { assessSerialDevicePreflight } from '@/lib/arduino/serial-device-preflight';
import type { ArduinoBuildProfile } from '@shared/schema';

function buildProfile(overrides: Partial<ArduinoBuildProfile> = {}): ArduinoBuildProfile {
  return {
    id: 1,
    projectId: 21,
    name: 'Uno Upload Profile',
    profileName: null,
    fqbn: 'arduino:avr:uno',
    port: '/dev/ttyACM0',
    protocol: 'serial',
    boardOptions: {},
    portConfig: {},
    libOverrides: {},
    verboseCompile: false,
    verboseUpload: false,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('assessSerialDevicePreflight', () => {
  it('warns when the connected device does not match the active Arduino profile', () => {
    const assessment = assessSerialDevicePreflight({
      connectionState: 'connected',
      normalizedBoardFilter: '',
      portInfo: { usbVendorId: 0x303a },
      selectedProfile: buildProfile({ fqbn: 'arduino:avr:uno', name: 'Arduino Uno Profile' }),
    });

    expect(assessment.status).toBe('profile_mismatch');
    expect(assessment.blockerReason).toContain('ESP32 Dev Module');
    expect(assessment.boardSafetyLabel).toBe('Profile mismatch');
  });

  it('warns when the selected serial filter does not match the detected device', () => {
    const assessment = assessSerialDevicePreflight({
      connectionState: 'connected',
      normalizedBoardFilter: 'Arduino Uno/Mega (ATmega16U2)',
      portInfo: { usbVendorId: 0x303a },
      selectedProfile: undefined,
    });

    expect(assessment.status).toBe('filter_mismatch');
    expect(assessment.blockerReason).toContain('selected serial filter');
  });

  it('reports a clean match when the device aligns with the Arduino profile', () => {
    const assessment = assessSerialDevicePreflight({
      connectionState: 'connected',
      normalizedBoardFilter: '',
      portInfo: { usbVendorId: 0x2341, usbProductId: 0x0043 },
      selectedProfile: buildProfile({ fqbn: 'arduino:avr:uno', name: 'Arduino Uno Profile' }),
    });

    expect(assessment.status).toBe('matched');
    expect(assessment.boardSafetyLabel).toBe('Matched to Arduino profile');
    expect(assessment.detectedDeviceLabel).toBe('Arduino Uno');
  });
});
