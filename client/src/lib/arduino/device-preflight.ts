import type { ArduinoBuildProfile } from '@shared/schema';

export interface DetectedArduinoDevice {
  address: string | null;
  fqbn: string | null;
  name: string | null;
  protocol: string | null;
}

export interface ArduinoUploadTargetAssessment {
  status: 'not_checked' | 'checking' | 'matched' | 'port_missing' | 'board_mismatch' | 'device_unidentified';
  shouldBlockUpload: boolean;
  blockerReason: string | null;
  detectedDeviceLabel: string;
  portSafetyLabel: string;
  warnings: string[];
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function extractBoardCandidates(record: Record<string, unknown>): DetectedArduinoDevice[] {
  const candidateGroups = [record.boards, record.matching_boards, record.matchingBoards];
  const devices: DetectedArduinoDevice[] = [];

  for (const group of candidateGroups) {
    if (!Array.isArray(group)) {
      continue;
    }

    for (const entry of group) {
      if (typeof entry !== 'object' || entry === null) {
        continue;
      }
      const candidate = entry as Record<string, unknown>;
      devices.push({
        address: readString(record, 'address'),
        fqbn: readString(candidate, 'fqbn'),
        name: readString(candidate, 'name'),
        protocol: readString(record, 'protocol'),
      });
    }
  }

  if (devices.length > 0) {
    return devices;
  }

  return [{
    address: readString(record, 'address'),
    fqbn: readString(record, 'fqbn'),
    name: readString(record, 'name'),
    protocol: readString(record, 'protocol'),
  }];
}

export function normalizeDetectedArduinoBoards(input: unknown): DetectedArduinoDevice[] {
  const rawPorts = Array.isArray(input)
    ? input
    : (
      typeof input === 'object' &&
      input !== null &&
      Array.isArray((input as Record<string, unknown>).detected_ports)
        ? (input as { detected_ports: unknown[] }).detected_ports
        : []
    );

  if (!Array.isArray(rawPorts)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: DetectedArduinoDevice[] = [];

  for (const entry of rawPorts) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const candidates = extractBoardCandidates(record);
    for (const candidate of candidates) {
      const key = [
        candidate.address ?? '',
        candidate.fqbn ?? '',
        candidate.name ?? '',
        candidate.protocol ?? '',
      ].join('|');
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      normalized.push(candidate);
    }
  }

  return normalized;
}

function formatDetectedDeviceLabel(device: DetectedArduinoDevice | null): string {
  if (!device) {
    return 'No device detected';
  }

  const name = device.name ?? device.fqbn ?? 'Unknown board';
  const address = device.address ?? 'Unknown port';
  return `${name} on ${address}`;
}

export function assessArduinoUploadTarget({
  detectedBoards,
  isChecking,
  selectedProfile,
}: {
  detectedBoards: DetectedArduinoDevice[] | null;
  isChecking: boolean;
  selectedProfile: ArduinoBuildProfile | undefined;
}): ArduinoUploadTargetAssessment {
  const port = selectedProfile?.port?.trim();
  if (!selectedProfile || !port) {
    return {
      status: 'not_checked',
      shouldBlockUpload: false,
      blockerReason: null,
      detectedDeviceLabel: 'No profile port set',
      portSafetyLabel: 'Not checked',
      warnings: [],
    };
  }

  if (isChecking) {
    return {
      status: 'checking',
      shouldBlockUpload: false,
      blockerReason: null,
      detectedDeviceLabel: 'Checking connected board…',
      portSafetyLabel: 'Checking device',
      warnings: ['ProtoPulse is checking the connected board identity before trusting the selected upload target.'],
    };
  }

  const boards = detectedBoards ?? [];
  if (boards.length === 0) {
    return {
      status: 'port_missing',
      shouldBlockUpload: true,
      blockerReason: 'Arduino CLI did not detect any connected boards. Reconnect the target device or refresh the selected port before uploading.',
      detectedDeviceLabel: 'No device detected',
      portSafetyLabel: 'Device missing',
      warnings: ['No connected Arduino-compatible device was detected, so upload would be a blind guess right now.'],
    };
  }

  const matchedDevice = boards.find((board) => board.address === port) ?? null;
  if (!matchedDevice) {
    return {
      status: 'port_missing',
      shouldBlockUpload: true,
      blockerReason: `The selected profile points to ${port}, but Arduino CLI did not detect a board on that port.`,
      detectedDeviceLabel: boards[0] ? formatDetectedDeviceLabel(boards[0]) : 'No device detected',
      portSafetyLabel: 'Port mismatch',
      warnings: [`Configured upload port ${port} is not present in the current Arduino CLI device list.`],
    };
  }

  if (matchedDevice.fqbn && matchedDevice.fqbn !== selectedProfile.fqbn) {
    return {
      status: 'board_mismatch',
      shouldBlockUpload: true,
      blockerReason: `The selected profile (${selectedProfile.fqbn}) does not match the detected board (${matchedDevice.fqbn}) on ${port}.`,
      detectedDeviceLabel: formatDetectedDeviceLabel(matchedDevice),
      portSafetyLabel: 'Board mismatch',
      warnings: ['The detected board identity disagrees with the selected build profile, so upload is blocked until they match.'],
    };
  }

  if (!matchedDevice.fqbn) {
    return {
      status: 'device_unidentified',
      shouldBlockUpload: false,
      blockerReason: null,
      detectedDeviceLabel: formatDetectedDeviceLabel(matchedDevice),
      portSafetyLabel: 'Device needs review',
      warnings: ['ProtoPulse found a device on the selected port, but Arduino CLI could not identify its exact board family. Double-check the profile before uploading.'],
    };
  }

  return {
    status: 'matched',
    shouldBlockUpload: false,
    blockerReason: null,
    detectedDeviceLabel: formatDetectedDeviceLabel(matchedDevice),
    portSafetyLabel: 'Matched',
    warnings: [],
  };
}
