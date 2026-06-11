import { z } from 'zod';

export const V3FirmwareRequestSchema = z.object({
  board: z.string().min(1),
  voltageAssumptions: z.array(z.string()).default([]),
  ownedPins: z.array(z.string()).default([]),
  behavior: z.string().min(1),
});

export type V3FirmwareRequest = z.infer<typeof V3FirmwareRequestSchema>;

export const V3ArduinoFirmwareFileSchema = z.object({
  path: z.string().regex(/\.(ino|cpp|h|hpp)$/),
  language: z.enum(['arduino', 'cpp', 'header']),
  content: z.string().min(1),
});

export const V3ArduinoCppFirmwareOutputSchema = z.object({
  sketchName: z.string().min(1),
  board: z.string().min(1),
  fqbn: z.string().min(1).optional(),
  files: z.array(V3ArduinoFirmwareFileSchema).min(1),
  requiredLibraries: z.array(z.string()).default([]),
  ownedPins: z.array(z.string()).default([]),
  verificationNotes: z.array(z.string()).default([]),
});

export type V3ArduinoCppFirmwareOutput = z.infer<typeof V3ArduinoCppFirmwareOutputSchema>;

export interface V3PinOwnershipGate {
  status: 'ready' | 'blocked';
  board: string;
  ownedPins: string[];
  blockedReasons: string[];
}

export function validateV3FirmwareRequest(input: unknown): V3FirmwareRequest {
  return V3FirmwareRequestSchema.parse(input);
}

export function validateV3ArduinoCppFirmwareOutput(input: unknown): V3ArduinoCppFirmwareOutput {
  const output = V3ArduinoCppFirmwareOutputSchema.parse(input);
  const hasSketch = output.files.some((file) => file.path.endsWith('.ino'));

  if (!hasSketch) {
    throw new Error('Arduino firmware output must include at least one .ino sketch file.');
  }

  return output;
}

export function checkV3PinOwnershipBeforeFirmware(input: unknown, verifiedFacts: string[] = []): V3PinOwnershipGate {
  const request = validateV3FirmwareRequest(input);
  const blockedReasons: string[] = [];
  const normalizedPins = request.ownedPins.map((pin) => pin.trim()).filter(Boolean);
  const duplicatePins = normalizedPins.filter((pin, index) => normalizedPins.indexOf(pin) !== index);

  if (!verifiedFacts.includes('pinout')) {
    blockedReasons.push('pinout must be verified before firmware generation');
  }
  if (normalizedPins.length === 0) {
    blockedReasons.push('at least one owned pin is required before firmware generation');
  }
  if (duplicatePins.length > 0) {
    blockedReasons.push(`duplicate owned pins: ${[...new Set(duplicatePins)].join(', ')}`);
  }

  return {
    status: blockedReasons.length > 0 ? 'blocked' : 'ready',
    board: request.board,
    ownedPins: normalizedPins,
    blockedReasons,
  };
}
