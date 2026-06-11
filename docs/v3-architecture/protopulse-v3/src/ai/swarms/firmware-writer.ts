import { z } from 'zod';

export const FirmwareRequestSchema = z.object({
  board: z.string().min(1),
  voltageAssumptions: z.array(z.string()).default([]),
  ownedPins: z.array(z.string()).default([]),
  behavior: z.string().min(1),
});

export type FirmwareRequest = z.infer<typeof FirmwareRequestSchema>;

export const ArduinoFirmwareFileSchema = z.object({
  path: z.string().regex(/\.(ino|cpp|h|hpp)$/),
  language: z.enum(['arduino', 'cpp', 'header']),
  content: z.string().min(1),
});

export const ArduinoCppFirmwareOutputSchema = z.object({
  sketchName: z.string().min(1),
  board: z.string().min(1),
  fqbn: z.string().min(1).optional(),
  files: z.array(ArduinoFirmwareFileSchema).min(1),
  requiredLibraries: z.array(z.string()).default([]),
  ownedPins: z.array(z.string()).default([]),
  verificationNotes: z.array(z.string()).default([]),
});

export type ArduinoCppFirmwareOutput = z.infer<typeof ArduinoCppFirmwareOutputSchema>;

export const PinOwnershipGateSchema = z.object({
  status: z.enum(['ready', 'blocked']),
  board: z.string(),
  ownedPins: z.array(z.string()),
  blockedReasons: z.array(z.string()),
});

export type PinOwnershipGate = z.infer<typeof PinOwnershipGateSchema>;

export function validateFirmwareRequest(input: unknown): FirmwareRequest {
  return FirmwareRequestSchema.parse(input);
}

export function validateArduinoCppFirmwareOutput(input: unknown): ArduinoCppFirmwareOutput {
  const output = ArduinoCppFirmwareOutputSchema.parse(input);
  const hasSketch = output.files.some((file) => file.path.endsWith('.ino'));

  if (!hasSketch) {
    throw new Error('Arduino firmware output must include at least one .ino sketch file.');
  }

  return output;
}

export function checkPinOwnershipBeforeFirmware(input: unknown, verifiedFacts: string[] = []): PinOwnershipGate {
  const request = FirmwareRequestSchema.parse(input);
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

  return PinOwnershipGateSchema.parse({
    status: blockedReasons.length > 0 ? 'blocked' : 'ready',
    board: request.board,
    ownedPins: normalizedPins,
    blockedReasons,
  });
}
