import { describe, expect, it } from 'vitest';

import { assessArduinoUploadTarget, normalizeDetectedArduinoBoards } from '@/lib/arduino/device-preflight';
import type { ArduinoBuildProfile } from '@shared/schema';

function buildProfile(overrides: Partial<ArduinoBuildProfile> = {}): ArduinoBuildProfile {
  return {
    id: 1,
    projectId: 1,
    name: 'Uno',
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

describe('normalizeDetectedArduinoBoards', () => {
  it('extracts nested board candidates from Arduino CLI board-list output', () => {
    const devices = normalizeDetectedArduinoBoards({
      detected_ports: [
        {
          address: '/dev/ttyACM0',
          protocol: 'serial',
          matching_boards: [{ name: 'Arduino Uno', fqbn: 'arduino:avr:uno' }],
        },
      ],
    });

    expect(devices).toEqual([
      {
        address: '/dev/ttyACM0',
        protocol: 'serial',
        name: 'Arduino Uno',
        fqbn: 'arduino:avr:uno',
      },
    ]);
  });
});

describe('assessArduinoUploadTarget', () => {
  it('blocks upload when the selected port is not present in the detected board list', () => {
    const assessment = assessArduinoUploadTarget({
      detectedBoards: [{
        address: '/dev/ttyUSB0',
        fqbn: 'arduino:avr:uno',
        name: 'Arduino Uno',
        protocol: 'serial',
      }],
      isChecking: false,
      selectedProfile: buildProfile({ port: '/dev/ttyACM0' }),
    });

    expect(assessment.status).toBe('port_missing');
    expect(assessment.shouldBlockUpload).toBe(true);
    expect(assessment.blockerReason).toContain('/dev/ttyACM0');
  });

  it('blocks upload when the detected board fqbn disagrees with the selected profile', () => {
    const assessment = assessArduinoUploadTarget({
      detectedBoards: [{
        address: '/dev/ttyACM0',
        fqbn: 'arduino:avr:mega',
        name: 'Arduino Mega',
        protocol: 'serial',
      }],
      isChecking: false,
      selectedProfile: buildProfile({ fqbn: 'arduino:avr:uno' }),
    });

    expect(assessment.status).toBe('board_mismatch');
    expect(assessment.shouldBlockUpload).toBe(true);
    expect(assessment.blockerReason).toContain('arduino:avr:mega');
  });

  it('allows upload when the selected profile matches the detected board', () => {
    const assessment = assessArduinoUploadTarget({
      detectedBoards: [{
        address: '/dev/ttyACM0',
        fqbn: 'arduino:avr:uno',
        name: 'Arduino Uno',
        protocol: 'serial',
      }],
      isChecking: false,
      selectedProfile: buildProfile(),
    });

    expect(assessment.status).toBe('matched');
    expect(assessment.shouldBlockUpload).toBe(false);
    expect(assessment.portSafetyLabel).toBe('Matched');
  });
});
