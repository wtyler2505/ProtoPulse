/**
 * EmbedManager Tests — client/src/lib/embed-viewer.ts
 *
 * Tests serialization, encoding/decoding, URL generation,
 * embed code generation, theme handling, and edge cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EmbedManager,
  uint8ToBase64url,
  base64urlToUint8,
  MAX_URL_LENGTH,
  COMPRESSION_THRESHOLD,
} from '../embed-viewer';

import type { EmbedCircuitData, EmbedTheme } from '../embed-viewer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSimpleCircuit(): EmbedCircuitData {
  return {
    nodes: [
      { id: 'n1', type: 'resistor', label: 'R1', x: 100, y: 200 },
      { id: 'n2', type: 'capacitor', label: 'C1', x: 300, y: 200, rotation: 90 },
    ],
    wires: [
      { id: 1, netId: 1, points: [{ x: 100, y: 200 }, { x: 300, y: 200 }], width: 1 },
    ],
    nets: [
      { id: 1, name: 'NET1', netType: 'signal' },
    ],
    metadata: { name: 'Test Circuit', version: 1 },
  };
}

function makeEmptyCircuit(): EmbedCircuitData {
  return { nodes: [], wires: [], nets: [] };
}

function makeLargeCircuit(count: number): EmbedCircuitData {
  const nodes = Array.from({ length: count }, (_, i) => ({
    id: `node-${String(i)}`,
    type: 'resistor',
    label: `R${String(i)}`,
    x: i * 50,
    y: i * 30,
    properties: { value: `${String(i * 10)}k`, tolerance: '5%', package: 'SMD-0603' },
  }));
  const nets = Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `NET${String(i)}`,
  }));
  const wires = Array.from({ length: count }, (_, i) => ({
    id: i,
    netId: i,
    points: [{ x: i * 50, y: i * 30 }, { x: (i + 1) * 50, y: (i + 1) * 30 }],
  }));
  return { nodes, wires, nets, metadata: { name: 'Large Circuit' } };
}

// ---------------------------------------------------------------------------
// base64url helpers
// ---------------------------------------------------------------------------

describe('base64url helpers', () => {
  it('round-trips simple ASCII bytes', () => {
    const original = new TextEncoder().encode('Hello, World!');
    const encoded = uint8ToBase64url(original);
    const decoded = base64urlToUint8(encoded);
    expect(decoded).toEqual(original);
  });

  it('round-trips binary data with all byte values', () => {
    const original = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      original[i] = i;
    }
    const encoded = uint8ToBase64url(original);
    const decoded = base64urlToUint8(encoded);
    expect(decoded).toEqual(original);
  });

  it('produces URL-safe output (no +, /, or =)', () => {
    // Use bytes that produce +, /, = in standard base64
    const tricky = new Uint8Array([251, 255, 254, 63, 62]);
    const encoded = uint8ToBase64url(tricky);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('round-trips empty byte array', () => {
    const original = new Uint8Array(0);
    const encoded = uint8ToBase64url(original);
    const decoded = base64urlToUint8(encoded);
    expect(decoded).toEqual(original);
  });

  it('round-trips single byte', () => {
    const original = new Uint8Array([42]);
    const encoded = uint8ToBase64url(original);
    const decoded = base64urlToUint8(encoded);
    expect(decoded).toEqual(original);
  });

  it('produces different output than standard base64 for tricky bytes', () => {
    const bytes = new Uint8Array([251, 255, 254]);
    const standard = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
    const urlSafe = uint8ToBase64url(bytes);
    // Standard should have + or / while url-safe should not
    if (standard.includes('+') || standard.includes('/')) {
      expect(urlSafe).not.toBe(standard.replace(/=+$/, ''));
    }
  });
});

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

describe('EmbedManager.serialize / deserialize', () => {
  let manager: EmbedManager;

  beforeEach(() => {
    manager = new EmbedManager('https://example.com');
  });

  it('round-trips a simple circuit', () => {
    const original = makeSimpleCircuit();
    const json = manager.serialize(original);
    const restored = manager.deserialize(json);

    expect(restored.nodes).toHaveLength(2);
    expect(restored.nodes[0].id).toBe('n1');
    expect(restored.nodes[0].type).toBe('resistor');
    expect(restored.nodes[0].label).toBe('R1');
    expect(restored.nodes[0].x).toBe(100);
    expect(restored.nodes[0].y).toBe(200);
    expect(restored.nodes[1].rotation).toBe(90);

    expect(restored.wires).toHaveLength(1);
    expect(restored.wires[0].netId).toBe(1);

    expect(restored.nets).toHaveLength(1);
    expect(restored.nets[0].name).toBe('NET1');

    expect(restored.metadata?.name).toBe('Test Circuit');
  });

  it('round-trips an empty circuit', () => {
    const original = makeEmptyCircuit();
    const json = manager.serialize(original);
    const restored = manager.deserialize(json);
    expect(restored.nodes).toHaveLength(0);
    expect(restored.wires).toHaveLength(0);
    expect(restored.nets).toHaveLength(0);
  });

  it('produces compact JSON (uses short keys)', () => {
    const original = makeSimpleCircuit();
    const json = manager.serialize(original);
    expect(json).toContain('"n"');  // nodes key
    expect(json).toContain('"w"');  // wires key
    expect(json).toContain('"t"');  // nets key
    expect(json).not.toContain('"nodes"');
    expect(json).not.toContain('"wires"');
  });

  it('omits default values for compact output', () => {
    const data: EmbedCircuitData = {
      nodes: [{ id: 'n1', type: 'r', label: 'R1', x: 0, y: 0 }],
      wires: [{ id: 1, netId: 1, points: [], width: 1 }],
      nets: [{ id: 1, name: 'N1', netType: 'signal' }],
    };
    const json = manager.serialize(data);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    // Default rotation (0) should not appear as "r" key in node objects
    const nodeObj = (parsed.n as Array<Record<string, unknown>>)[0];
    expect(nodeObj).not.toHaveProperty('r');
    // Default wireType ('wire') should not appear as "wt" key in wire objects
    const wireObj = (parsed.w as Array<Record<string, unknown>>)[0];
    expect(wireObj).not.toHaveProperty('wt');
    // Default netType ('signal') should not appear as 'nt' key in net objects
    const netObj = (parsed.t as Array<Record<string, unknown>>)[0];
    expect(netObj).not.toHaveProperty('nt');
  });

  it('preserves node properties', () => {
    const data: EmbedCircuitData = {
      nodes: [{ id: 'n1', type: 'r', label: 'R1', x: 0, y: 0, properties: { value: '10k' } }],
      wires: [],
      nets: [],
    };
    const json = manager.serialize(data);
    const restored = manager.deserialize(json);
    expect(restored.nodes[0].properties).toEqual({ value: '10k' });
  });

  it('preserves wire optional fields', () => {
    const data: EmbedCircuitData = {
      nodes: [],
      wires: [{ id: 1, netId: 1, points: [], layer: 'back', width: 2, color: '#ff0000', wireType: 'bus' }],
      nets: [],
    };
    const json = manager.serialize(data);
    const restored = manager.deserialize(json);
    expect(restored.wires[0].layer).toBe('back');
    expect(restored.wires[0].width).toBe(2);
    expect(restored.wires[0].color).toBe('#ff0000');
    expect(restored.wires[0].wireType).toBe('bus');
  });

  it('preserves net optional fields', () => {
    const data: EmbedCircuitData = {
      nodes: [],
      wires: [],
      nets: [{
        id: 1,
        name: 'VCC',
        netType: 'power',
        voltage: '3.3V',
        segments: [{ from: 'a', to: 'b' }],
        labels: ['power'],
        style: { color: 'red' },
      }],
    };
    const json = manager.serialize(data);
    const restored = manager.deserialize(json);
    expect(restored.nets[0].netType).toBe('power');
    expect(restored.nets[0].voltage).toBe('3.3V');
    expect(restored.nets[0].segments).toEqual([{ from: 'a', to: 'b' }]);
    expect(restored.nets[0].labels).toEqual(['power']);
    expect(restored.nets[0].style).toEqual({ color: 'red' });
  });

  it('handles special characters in labels and names', () => {
    const data: EmbedCircuitData = {
      nodes: [{ id: 'n1', type: 'ic', label: 'ATmega328P "Pro"', x: 0, y: 0 }],
      wires: [],
      nets: [{ id: 1, name: 'NET<1>&2' }],
    };
    const json = manager.serialize(data);
    const restored = manager.deserialize(json);
    expect(restored.nodes[0].label).toBe('ATmega328P "Pro"');
    expect(restored.nets[0].name).toBe('NET<1>&2');
  });

  it('throws on invalid JSON', () => {
    expect(() => manager.deserialize('not valid json')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Encode / Decode
// ---------------------------------------------------------------------------

describe('EmbedManager.encode / decode', () => {
  let manager: EmbedManager;

  beforeEach(() => {
    manager = new EmbedManager('https://example.com');
  });

  it('round-trips a simple circuit through encode/decode', async () => {
    const original = makeSimpleCircuit();
    const encoded = await manager.encode(original);
    const decoded = await manager.decode(encoded);

    expect(decoded.nodes).toHaveLength(2);
    expect(decoded.nodes[0].id).toBe('n1');
    expect(decoded.metadata?.name).toBe('Test Circuit');
  });

  it('round-trips an empty circuit', async () => {
    const original = makeEmptyCircuit();
    const encoded = await manager.encode(original);
    const decoded = await manager.decode(encoded);
    expect(decoded.nodes).toHaveLength(0);
    expect(decoded.wires).toHaveLength(0);
    expect(decoded.nets).toHaveLength(0);
  });

  it('uses raw encoding for small data (prefix "r")', async () => {
    const original = makeEmptyCircuit();
    const encoded = await manager.encode(original);
    expect(encoded[0]).toBe('r');
  });

  it('attempts compression for larger data', async () => {
    const original = makeLargeCircuit(50);
    const encoded = await manager.encode(original);
    // Should be either 'c' (compressed) or 'r' (raw if compression didn't help)
    expect(['c', 'r']).toContain(encoded[0]);
  });

  it('round-trips a large circuit through encode/decode', async () => {
    const original = makeLargeCircuit(100);
    const encoded = await manager.encode(original);
    const decoded = await manager.decode(encoded);
    expect(decoded.nodes).toHaveLength(100);
    expect(decoded.nodes[99].id).toBe('node-99');
  });

  it('throws on empty encoded data', async () => {
    await expect(manager.decode('')).rejects.toThrow('Empty embed data');
  });

  it('throws on unknown prefix', async () => {
    await expect(manager.decode('x' + 'abc')).rejects.toThrow('Unknown embed data prefix');
  });

  it('encoded data is URL-safe', async () => {
    const original = makeSimpleCircuit();
    const encoded = await manager.encode(original);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
    expect(encoded).not.toContain(' ');
  });
});

// ---------------------------------------------------------------------------
// URL generation
// ---------------------------------------------------------------------------

describe('EmbedManager URL generation', () => {
  let manager: EmbedManager;

  beforeEach(() => {
    manager = new EmbedManager('https://proto.app');
  });

  it('getEmbedUrl builds correct URL without theme', () => {
    const url = manager.getEmbedUrl('rABC123');
    expect(url).toBe('https://proto.app/embed/rABC123');
  });

  it('getEmbedUrl appends theme params', () => {
    const url = manager.getEmbedUrl('rABC', { dark: true, showGrid: false });
    expect(url).toContain('theme=dark');
    expect(url).toContain('grid=false');
  });

  it('getShortEmbedUrl builds correct URL', () => {
    const url = manager.getShortEmbedUrl('abcd1234');
    expect(url).toBe('https://proto.app/embed/s/abcd1234');
  });

  it('getShortEmbedUrl appends theme params', () => {
    const url = manager.getShortEmbedUrl('abcd1234', { dark: false, showLabels: true });
    expect(url).toContain('theme=light');
    expect(url).toContain('labels=true');
  });

  it('exceedsUrlLimit returns false for short data', () => {
    expect(manager.exceedsUrlLimit('rShort')).toBe(false);
  });

  it('exceedsUrlLimit returns true for very long data', () => {
    const longData = 'r' + 'A'.repeat(MAX_URL_LENGTH);
    expect(manager.exceedsUrlLimit(longData)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Embed code generation
// ---------------------------------------------------------------------------

describe('EmbedManager embed code generation', () => {
  let manager: EmbedManager;

  beforeEach(() => {
    manager = new EmbedManager('https://proto.app');
  });

  it('generateIframe produces valid HTML', () => {
    const iframe = manager.generateIframe('https://proto.app/embed/rABC');
    expect(iframe).toContain('<iframe');
    expect(iframe).toContain('src="https://proto.app/embed/rABC"');
    expect(iframe).toContain('width="100%"');
    expect(iframe).toContain('height="400"');
    expect(iframe).toContain('frameBorder="0"');
    expect(iframe).toContain('</iframe>');
  });

  it('generateIframe respects custom dimensions', () => {
    const iframe = manager.generateIframe('https://proto.app/embed/rABC', { width: '600', height: '300' });
    expect(iframe).toContain('width="600"');
    expect(iframe).toContain('height="300"');
  });

  it('generateMarkdown produces valid markdown', () => {
    const md = manager.generateMarkdown('https://proto.app/embed/rABC', 'My Circuit');
    expect(md).toContain('[![My Circuit]');
    expect(md).toContain('preview');
    expect(md).toContain('.png');
    expect(md).toContain('(https://proto.app/embed/rABC)');
  });

  it('generateMarkdown uses default title', () => {
    const md = manager.generateMarkdown('https://proto.app/embed/rABC');
    expect(md).toContain('Circuit Schematic');
  });

  it('generateEmbedCode dispatches to correct format', () => {
    const url = 'https://proto.app/embed/rABC';
    expect(manager.generateEmbedCode('link', url)).toBe(url);
    expect(manager.generateEmbedCode('iframe', url)).toContain('<iframe');
    expect(manager.generateEmbedCode('markdown', url)).toContain('[![');
  });

  it('generateEmbedCode passes title to markdown', () => {
    const url = 'https://proto.app/embed/rABC';
    const md = manager.generateEmbedCode('markdown', url, { title: 'Hello' });
    expect(md).toContain('Hello');
  });
});

// ---------------------------------------------------------------------------
// Theme handling
// ---------------------------------------------------------------------------

describe('EmbedManager theme handling', () => {
  let manager: EmbedManager;

  beforeEach(() => {
    manager = new EmbedManager('https://proto.app');
  });

  it('resolveTheme returns defaults when no partial given', () => {
    const theme = manager.resolveTheme();
    expect(theme.dark).toBe(true);
    expect(theme.accentColor).toBe('#00F0FF');
    expect(theme.showGrid).toBe(true);
    expect(theme.showLabels).toBe(true);
  });

  it('resolveTheme merges partial with defaults', () => {
    const theme = manager.resolveTheme({ dark: false });
    expect(theme.dark).toBe(false);
    expect(theme.accentColor).toBe('#00F0FF'); // default preserved
    expect(theme.showGrid).toBe(true); // default preserved
  });

  it('parseThemeFromParams extracts dark theme', () => {
    const params = new URLSearchParams('theme=dark');
    const theme = manager.parseThemeFromParams(params);
    expect(theme.dark).toBe(true);
  });

  it('parseThemeFromParams extracts light theme', () => {
    const params = new URLSearchParams('theme=light');
    const theme = manager.parseThemeFromParams(params);
    expect(theme.dark).toBe(false);
  });

  it('parseThemeFromParams extracts accent color', () => {
    const params = new URLSearchParams('accent=%23FF0000');
    const theme = manager.parseThemeFromParams(params);
    expect(theme.accentColor).toBe('#FF0000');
  });

  it('parseThemeFromParams extracts grid=false', () => {
    const params = new URLSearchParams('grid=false');
    const theme = manager.parseThemeFromParams(params);
    expect(theme.showGrid).toBe(false);
  });

  it('parseThemeFromParams extracts labels=false', () => {
    const params = new URLSearchParams('labels=false');
    const theme = manager.parseThemeFromParams(params);
    expect(theme.showLabels).toBe(false);
  });

  it('parseThemeFromParams returns empty for no params', () => {
    const params = new URLSearchParams('');
    const theme = manager.parseThemeFromParams(params);
    expect(theme.dark).toBeUndefined();
    expect(theme.accentColor).toBeUndefined();
    expect(theme.showGrid).toBeUndefined();
    expect(theme.showLabels).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Server short URL (mocked fetch)
// ---------------------------------------------------------------------------

describe('EmbedManager server short URL', () => {
  let manager: EmbedManager;

  beforeEach(() => {
    manager = new EmbedManager('https://proto.app');
    vi.restoreAllMocks();
  });

  it('createShortUrl sends POST and returns code + url', async () => {
    const mockResponse = { code: 'abcd1234', url: 'https://proto.app/embed/s/abcd1234' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await manager.createShortUrl('rABC');
    expect(result.code).toBe('abcd1234');
    expect(result.url).toBe('https://proto.app/embed/s/abcd1234');
    expect(fetch).toHaveBeenCalledWith('/api/embeds', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('createShortUrl throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ message: 'Rate limited' }),
    } as unknown as Response);

    await expect(manager.createShortUrl('rABC')).rejects.toThrow('Rate limited');
  });

  it('fetchShortUrl sends GET and returns data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'rEncodedData' }),
    } as Response);

    const data = await manager.fetchShortUrl('abcd1234');
    expect(data).toBe('rEncodedData');
    expect(fetch).toHaveBeenCalledWith('/api/embeds/abcd1234');
  });

  it('fetchShortUrl throws on 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(manager.fetchShortUrl('noexist')).rejects.toThrow('Embed not found or expired');
  });

  it('fetchShortUrl throws generic error on other status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(manager.fetchShortUrl('err')).rejects.toThrow('Failed to fetch embed');
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('EmbedManager constants', () => {
  it('MAX_URL_LENGTH is 8000', () => {
    expect(MAX_URL_LENGTH).toBe(8000);
  });

  it('COMPRESSION_THRESHOLD is 256', () => {
    expect(COMPRESSION_THRESHOLD).toBe(256);
  });
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('EmbedManager constructor', () => {
  it('uses provided origin', () => {
    const m = new EmbedManager('https://custom.com');
    const url = m.getEmbedUrl('rABC');
    expect(url).toMatch(/^https:\/\/custom\.com/);
  });

  it('defaults to window.location.origin when available', () => {
    const m = new EmbedManager();
    const url = m.getEmbedUrl('rABC');
    expect(url).toContain('/embed/rABC');
  });
});
