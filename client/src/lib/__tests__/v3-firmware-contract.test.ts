import { describe, expect, it } from 'vitest';
import {
  checkV3PinOwnershipBeforeFirmware,
  validateV3ArduinoCppFirmwareOutput,
} from '@/lib/v3-firmware-contract';

describe('v3 firmware contract', () => {
  it('accepts Arduino/C++ output with at least one sketch file', () => {
    const output = validateV3ArduinoCppFirmwareOutput({
      sketchName: 'mega_hid_profile',
      board: 'Arduino Mega 2560 R3',
      fqbn: 'arduino:avr:mega',
      files: [
        { path: 'mega_hid_profile.ino', language: 'arduino', content: 'void setup() {} void loop() {}' },
        { path: 'pins.h', language: 'header', content: '#pragma once' },
      ],
      ownedPins: ['D2', 'D3'],
    });

    expect(output.sketchName).toBe('mega_hid_profile');
    expect(output.files.map((file) => file.path)).toContain('mega_hid_profile.ino');
  });

  it('rejects firmware output without a sketch file', () => {
    expect(() => validateV3ArduinoCppFirmwareOutput({
      sketchName: 'missing_sketch',
      board: 'Arduino Mega 2560 R3',
      files: [{ path: 'helper.cpp', language: 'cpp', content: 'void helper() {}' }],
    })).toThrow('Arduino firmware output must include at least one .ino sketch file.');
  });

  it('blocks firmware generation until pinout and owned pins are ready', () => {
    const missingPinout = checkV3PinOwnershipBeforeFirmware({
      board: 'Arduino Mega 2560 R3',
      ownedPins: ['D2'],
      behavior: 'blink LED',
    }, []);
    expect(missingPinout.status).toBe('blocked');
    expect(missingPinout.blockedReasons).toContain('pinout must be verified before firmware generation');

    const duplicatePins = checkV3PinOwnershipBeforeFirmware({
      board: 'Arduino Mega 2560 R3',
      ownedPins: ['D2', 'D2'],
      behavior: 'blink LED',
    }, ['pinout']);
    expect(duplicatePins.status).toBe('blocked');
    expect(duplicatePins.blockedReasons).toContain('duplicate owned pins: D2');

    const ready = checkV3PinOwnershipBeforeFirmware({
      board: 'Arduino Mega 2560 R3',
      ownedPins: ['D2', 'D3'],
      behavior: 'blink LED',
    }, ['pinout']);
    expect(ready.status).toBe('ready');
    expect(ready.blockedReasons).toEqual([]);
  });
});
