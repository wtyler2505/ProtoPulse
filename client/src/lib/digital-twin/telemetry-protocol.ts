/**
 * Telemetry Protocol — JSON Lines parser for ProtoPulse Digital Twin
 *
 * Defines the serial communication protocol between firmware (Arduino/ESP32)
 * and the browser-based digital twin. Uses JSON Lines format (one JSON object
 * per line, terminated with \n).
 *
 * Three frame types:
 *   - manifest: Sent on connect, declares available channels
 *   - telemetry: Periodic data frame with channel values (10-50 Hz)
 *   - response: Ack/nack for desired-state commands
 *
 * All frames are validated with Zod discriminated unions for type safety.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Channel schema
// ---------------------------------------------------------------------------

const telemetryChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  dataType: z.enum(['digital', 'analog', 'pwm', 'float', 'string']),
  unit: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  pin: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Frame schemas (discriminated union on 'type')
// ---------------------------------------------------------------------------

const manifestSchema = z.object({
  type: z.literal('manifest'),
  board: z.string(),
  firmware: z.string(),
  channels: z.array(telemetryChannelSchema),
});

const telemetryFrameSchema = z.object({
  type: z.literal('telemetry'),
  ts: z.number(),
  ch: z.record(z.string(), z.union([z.number(), z.boolean(), z.string()])),
});

const commandResponseSchema = z.object({
  type: z.literal('response'),
  cmd: z.string(),
  ok: z.boolean(),
  msg: z.string().optional(),
});

const protocolFrameSchema = z.discriminatedUnion('type', [
  manifestSchema,
  telemetryFrameSchema,
  commandResponseSchema,
]);

// ---------------------------------------------------------------------------
// Exported types (inferred from Zod schemas)
// ---------------------------------------------------------------------------

export type TelemetryChannel = z.infer<typeof telemetryChannelSchema>;
export type TelemetryManifest = z.infer<typeof manifestSchema>;
export type TelemetryFrame = z.infer<typeof telemetryFrameSchema>;
export type CommandResponse = z.infer<typeof commandResponseSchema>;
export type ProtocolFrame = z.infer<typeof protocolFrameSchema>;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single JSON line into a typed protocol frame.
 * Returns null if the line is invalid, malformed, or fails validation.
 */
export function parseFrame(line: string): ProtocolFrame | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const result = protocolFrameSchema.safeParse(parsed);
  if (!result.success) {
    return null;
  }

  return result.data;
}

/**
 * Parse multiple JSON Lines (newline-separated) into an array of valid frames.
 * Invalid lines are silently skipped.
 */
export function parseMultipleFrames(data: string): ProtocolFrame[] {
  if (data.length === 0) {
    return [];
  }

  const lines = data.split('\n');
  const frames: ProtocolFrame[] = [];

  for (const line of lines) {
    const frame = parseFrame(line);
    if (frame !== null) {
      frames.push(frame);
    }
  }

  return frames;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a command to set a channel value.
 * Returns a JSON line terminated with \n, ready to send over serial.
 */
export function serializeCommand(channel: string, value: number | boolean): string {
  return JSON.stringify({ type: 'command', channel, value }) + '\n';
}

/**
 * Create the handshake frame sent when initiating the twin protocol.
 * Returns a JSON line terminated with \n.
 */
export function createHandshake(): string {
  return JSON.stringify({ type: 'handshake', protocol: 'protopulse-twin', version: 1 }) + '\n';
}
