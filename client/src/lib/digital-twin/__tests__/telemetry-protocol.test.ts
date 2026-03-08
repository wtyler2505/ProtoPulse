import { describe, it, expect } from 'vitest';
import {
  parseFrame,
  serializeCommand,
  createHandshake,
  parseMultipleFrames,
  type TelemetryManifest,
  type TelemetryFrame,
  type CommandResponse,
  type ProtocolFrame,
  type TelemetryChannel,
} from '../telemetry-protocol';

// ---------------------------------------------------------------------------
// parseFrame — Manifest frames
// ---------------------------------------------------------------------------

describe('parseFrame — manifest', () => {
  it('parses a valid manifest frame', () => {
    const line = JSON.stringify({
      type: 'manifest',
      board: 'Arduino Mega 2560',
      firmware: '1.0.0',
      channels: [
        { id: 'A0', name: 'Analog Pin 0', dataType: 'analog', unit: 'V', min: 0, max: 5, pin: 54 },
      ],
    });
    const frame = parseFrame(line);
    expect(frame).not.toBeNull();
    expect(frame!.type).toBe('manifest');
    const manifest = frame as TelemetryManifest;
    expect(manifest.board).toBe('Arduino Mega 2560');
    expect(manifest.firmware).toBe('1.0.0');
    expect(manifest.channels).toHaveLength(1);
    expect(manifest.channels[0].id).toBe('A0');
    expect(manifest.channels[0].dataType).toBe('analog');
    expect(manifest.channels[0].unit).toBe('V');
    expect(manifest.channels[0].min).toBe(0);
    expect(manifest.channels[0].max).toBe(5);
    expect(manifest.channels[0].pin).toBe(54);
  });

  it('parses manifest with multiple channels', () => {
    const line = JSON.stringify({
      type: 'manifest',
      board: 'ESP32-DevKit',
      firmware: '2.1.0',
      channels: [
        { id: 'A0', name: 'Analog 0', dataType: 'analog' },
        { id: 'D13', name: 'Built-in LED', dataType: 'digital' },
        { id: 'temp1', name: 'Temperature', dataType: 'float', unit: 'C' },
      ],
    });
    const frame = parseFrame(line) as TelemetryManifest;
    expect(frame).not.toBeNull();
    expect(frame.channels).toHaveLength(3);
    expect(frame.channels[1].id).toBe('D13');
    expect(frame.channels[2].dataType).toBe('float');
  });

  it('parses manifest with minimal channel (no optional fields)', () => {
    const line = JSON.stringify({
      type: 'manifest',
      board: 'Arduino Uno',
      firmware: '1.0.0',
      channels: [{ id: 'D2', name: 'Button', dataType: 'digital' }],
    });
    const frame = parseFrame(line) as TelemetryManifest;
    expect(frame).not.toBeNull();
    expect(frame.channels[0].unit).toBeUndefined();
    expect(frame.channels[0].min).toBeUndefined();
    expect(frame.channels[0].max).toBeUndefined();
    expect(frame.channels[0].pin).toBeUndefined();
  });

  it('rejects manifest missing board field', () => {
    const line = JSON.stringify({
      type: 'manifest',
      firmware: '1.0.0',
      channels: [],
    });
    expect(parseFrame(line)).toBeNull();
  });

  it('rejects manifest missing firmware field', () => {
    const line = JSON.stringify({
      type: 'manifest',
      board: 'Arduino',
      channels: [],
    });
    expect(parseFrame(line)).toBeNull();
  });

  it('rejects manifest with invalid channel dataType', () => {
    const line = JSON.stringify({
      type: 'manifest',
      board: 'Arduino',
      firmware: '1.0.0',
      channels: [{ id: 'X', name: 'Bad', dataType: 'invalid_type' }],
    });
    expect(parseFrame(line)).toBeNull();
  });

  it('accepts manifest with empty channels array', () => {
    const line = JSON.stringify({
      type: 'manifest',
      board: 'Arduino Nano',
      firmware: '0.1.0',
      channels: [],
    });
    const frame = parseFrame(line) as TelemetryManifest;
    expect(frame).not.toBeNull();
    expect(frame.channels).toHaveLength(0);
  });

  it('parses manifest with string dataType channel', () => {
    const line = JSON.stringify({
      type: 'manifest',
      board: 'ESP32',
      firmware: '1.0.0',
      channels: [{ id: 'status', name: 'Status', dataType: 'string' }],
    });
    const frame = parseFrame(line) as TelemetryManifest;
    expect(frame).not.toBeNull();
    expect(frame.channels[0].dataType).toBe('string');
  });

  it('parses manifest with pwm dataType channel', () => {
    const line = JSON.stringify({
      type: 'manifest',
      board: 'Arduino Mega 2560',
      firmware: '1.0.0',
      channels: [{ id: 'PWM3', name: 'PWM Pin 3', dataType: 'pwm', min: 0, max: 255, pin: 3 }],
    });
    const frame = parseFrame(line) as TelemetryManifest;
    expect(frame).not.toBeNull();
    expect(frame.channels[0].dataType).toBe('pwm');
  });
});

// ---------------------------------------------------------------------------
// parseFrame — Telemetry frames
// ---------------------------------------------------------------------------

describe('parseFrame — telemetry', () => {
  it('parses a valid telemetry frame with numeric values', () => {
    const line = JSON.stringify({
      type: 'telemetry',
      ts: 12345,
      ch: { A0: 2.45, A1: 3.3 },
    });
    const frame = parseFrame(line) as TelemetryFrame;
    expect(frame).not.toBeNull();
    expect(frame.type).toBe('telemetry');
    expect(frame.ts).toBe(12345);
    expect(frame.ch.A0).toBe(2.45);
    expect(frame.ch.A1).toBe(3.3);
  });

  it('parses telemetry frame with boolean values', () => {
    const line = JSON.stringify({
      type: 'telemetry',
      ts: 100,
      ch: { D13: true, D2: false },
    });
    const frame = parseFrame(line) as TelemetryFrame;
    expect(frame).not.toBeNull();
    expect(frame.ch.D13).toBe(true);
    expect(frame.ch.D2).toBe(false);
  });

  it('parses telemetry frame with string values', () => {
    const line = JSON.stringify({
      type: 'telemetry',
      ts: 200,
      ch: { status: 'running' },
    });
    const frame = parseFrame(line) as TelemetryFrame;
    expect(frame).not.toBeNull();
    expect(frame.ch.status).toBe('running');
  });

  it('parses telemetry frame with mixed value types', () => {
    const line = JSON.stringify({
      type: 'telemetry',
      ts: 300,
      ch: { A0: 1.5, D13: true, label: 'OK' },
    });
    const frame = parseFrame(line) as TelemetryFrame;
    expect(frame).not.toBeNull();
    expect(typeof frame.ch.A0).toBe('number');
    expect(typeof frame.ch.D13).toBe('boolean');
    expect(typeof frame.ch.label).toBe('string');
  });

  it('rejects telemetry frame missing ts', () => {
    const line = JSON.stringify({
      type: 'telemetry',
      ch: { A0: 1.0 },
    });
    expect(parseFrame(line)).toBeNull();
  });

  it('rejects telemetry frame missing ch', () => {
    const line = JSON.stringify({
      type: 'telemetry',
      ts: 100,
    });
    expect(parseFrame(line)).toBeNull();
  });

  it('parses telemetry frame with empty channels', () => {
    const line = JSON.stringify({
      type: 'telemetry',
      ts: 0,
      ch: {},
    });
    const frame = parseFrame(line) as TelemetryFrame;
    expect(frame).not.toBeNull();
    expect(Object.keys(frame.ch)).toHaveLength(0);
  });

  it('parses telemetry with large timestamp', () => {
    const line = JSON.stringify({
      type: 'telemetry',
      ts: 4294967295, // uint32 max from millis()
      ch: { A0: 0 },
    });
    const frame = parseFrame(line) as TelemetryFrame;
    expect(frame).not.toBeNull();
    expect(frame.ts).toBe(4294967295);
  });
});

// ---------------------------------------------------------------------------
// parseFrame — Command response frames
// ---------------------------------------------------------------------------

describe('parseFrame — response', () => {
  it('parses a successful command response', () => {
    const line = JSON.stringify({
      type: 'response',
      cmd: 'set_D13',
      ok: true,
    });
    const frame = parseFrame(line) as CommandResponse;
    expect(frame).not.toBeNull();
    expect(frame.type).toBe('response');
    expect(frame.cmd).toBe('set_D13');
    expect(frame.ok).toBe(true);
    expect(frame.msg).toBeUndefined();
  });

  it('parses a failed command response with message', () => {
    const line = JSON.stringify({
      type: 'response',
      cmd: 'set_A0',
      ok: false,
      msg: 'Pin A0 is input-only',
    });
    const frame = parseFrame(line) as CommandResponse;
    expect(frame).not.toBeNull();
    expect(frame.ok).toBe(false);
    expect(frame.msg).toBe('Pin A0 is input-only');
  });

  it('rejects response missing cmd field', () => {
    const line = JSON.stringify({
      type: 'response',
      ok: true,
    });
    expect(parseFrame(line)).toBeNull();
  });

  it('rejects response missing ok field', () => {
    const line = JSON.stringify({
      type: 'response',
      cmd: 'set_D13',
    });
    expect(parseFrame(line)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseFrame — Error handling
// ---------------------------------------------------------------------------

describe('parseFrame — error handling', () => {
  it('returns null for empty string', () => {
    expect(parseFrame('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseFrame('   ')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseFrame('not json at all')).toBeNull();
  });

  it('returns null for JSON array', () => {
    expect(parseFrame('[1, 2, 3]')).toBeNull();
  });

  it('returns null for JSON without type field', () => {
    expect(parseFrame(JSON.stringify({ board: 'Arduino', firmware: '1.0' }))).toBeNull();
  });

  it('returns null for unknown type field', () => {
    expect(parseFrame(JSON.stringify({ type: 'unknown_type', data: 123 }))).toBeNull();
  });

  it('returns null for JSON number', () => {
    expect(parseFrame('42')).toBeNull();
  });

  it('returns null for JSON null', () => {
    expect(parseFrame('null')).toBeNull();
  });

  it('handles line with leading/trailing whitespace', () => {
    const line = `  ${JSON.stringify({ type: 'telemetry', ts: 100, ch: { A0: 1.0 } })}  `;
    const frame = parseFrame(line);
    expect(frame).not.toBeNull();
    expect(frame!.type).toBe('telemetry');
  });

  it('handles line with trailing newline', () => {
    const line = JSON.stringify({ type: 'telemetry', ts: 100, ch: { A0: 1.0 } }) + '\n';
    const frame = parseFrame(line);
    expect(frame).not.toBeNull();
  });

  it('handles unicode in string channel values', () => {
    const line = JSON.stringify({
      type: 'telemetry',
      ts: 100,
      ch: { status: '\u00b0C reading \u2714' },
    });
    const frame = parseFrame(line) as TelemetryFrame;
    expect(frame).not.toBeNull();
    expect(frame.ch.status).toBe('\u00b0C reading \u2714');
  });
});

// ---------------------------------------------------------------------------
// serializeCommand
// ---------------------------------------------------------------------------

describe('serializeCommand', () => {
  it('serializes a numeric command', () => {
    const result = serializeCommand('A0', 128);
    const parsed = JSON.parse(result.trim());
    expect(parsed.type).toBe('command');
    expect(parsed.channel).toBe('A0');
    expect(parsed.value).toBe(128);
  });

  it('serializes a boolean command', () => {
    const result = serializeCommand('D13', true);
    const parsed = JSON.parse(result.trim());
    expect(parsed.type).toBe('command');
    expect(parsed.channel).toBe('D13');
    expect(parsed.value).toBe(true);
  });

  it('serializes a false boolean command', () => {
    const result = serializeCommand('D13', false);
    const parsed = JSON.parse(result.trim());
    expect(parsed.value).toBe(false);
  });

  it('appends newline to serialized command', () => {
    const result = serializeCommand('D2', 1);
    expect(result.endsWith('\n')).toBe(true);
  });

  it('produces valid JSON', () => {
    const result = serializeCommand('PWM3', 200);
    expect(() => JSON.parse(result.trim())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createHandshake
// ---------------------------------------------------------------------------

describe('createHandshake', () => {
  it('returns valid handshake JSON', () => {
    const handshake = createHandshake();
    const parsed = JSON.parse(handshake.trim());
    expect(parsed.type).toBe('handshake');
    expect(parsed.protocol).toBe('protopulse-twin');
    expect(parsed.version).toBe(1);
  });

  it('appends newline', () => {
    const handshake = createHandshake();
    expect(handshake.endsWith('\n')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseMultipleFrames
// ---------------------------------------------------------------------------

describe('parseMultipleFrames', () => {
  it('parses multiple lines separated by newlines', () => {
    const data = [
      JSON.stringify({ type: 'telemetry', ts: 100, ch: { A0: 1.0 } }),
      JSON.stringify({ type: 'telemetry', ts: 200, ch: { A0: 2.0 } }),
      JSON.stringify({ type: 'telemetry', ts: 300, ch: { A0: 3.0 } }),
    ].join('\n');
    const frames = parseMultipleFrames(data);
    expect(frames).toHaveLength(3);
    expect((frames[0] as TelemetryFrame).ts).toBe(100);
    expect((frames[2] as TelemetryFrame).ts).toBe(300);
  });

  it('skips invalid lines', () => {
    const data = [
      JSON.stringify({ type: 'telemetry', ts: 100, ch: { A0: 1.0 } }),
      'invalid json',
      JSON.stringify({ type: 'telemetry', ts: 200, ch: { A0: 2.0 } }),
    ].join('\n');
    const frames = parseMultipleFrames(data);
    expect(frames).toHaveLength(2);
  });

  it('handles empty string', () => {
    expect(parseMultipleFrames('')).toHaveLength(0);
  });

  it('handles trailing newline', () => {
    const data = JSON.stringify({ type: 'telemetry', ts: 100, ch: { A0: 1.0 } }) + '\n';
    const frames = parseMultipleFrames(data);
    expect(frames).toHaveLength(1);
  });
});
