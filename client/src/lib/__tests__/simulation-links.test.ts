/**
 * Tests for simulation-links.ts (BL-0213)
 *
 * Covers: encodeSnapshot, decodeSnapshot, encodeSimulationLink,
 * decodeSimulationLink, copySimulationLink, and validation edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  encodeSnapshot,
  decodeSnapshot,
  encodeSimulationLink,
  decodeSimulationLink,
  copySimulationLink,
} from '../simulation-links';
import type { SimulationSnapshot, SimLinkProbe } from '../simulation-links';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(overrides?: Partial<SimulationSnapshot>): SimulationSnapshot {
  return {
    circuitId: 42,
    simType: 'transient',
    parameters: { startTime: '0', stopTime: '10m', timeStep: '100u' },
    timestamp: '2026-03-15T12:00:00.000Z',
    ...overrides,
  };
}

function makeProbe(overrides?: Partial<SimLinkProbe>): SimLinkProbe {
  return {
    id: 'probe-1',
    name: 'V(out)',
    type: 'voltage',
    nodeOrComponent: 'out',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// encodeSnapshot / decodeSnapshot round-trip
// ---------------------------------------------------------------------------

describe('encodeSnapshot / decodeSnapshot', () => {
  it('round-trips a minimal DCOP snapshot', () => {
    const snap = makeSnapshot({ simType: 'dcop', parameters: {} });
    const encoded = encodeSnapshot(snap);
    const decoded = decodeSnapshot(encoded);
    expect(decoded).toEqual(snap);
  });

  it('round-trips a transient snapshot with parameters', () => {
    const snap = makeSnapshot();
    const encoded = encodeSnapshot(snap);
    const decoded = decodeSnapshot(encoded);
    expect(decoded).toEqual(snap);
  });

  it('round-trips an AC snapshot', () => {
    const snap = makeSnapshot({
      simType: 'ac',
      parameters: { startFrequency: '1', stopFrequency: '1M', pointsPerDecade: '10' },
    });
    const encoded = encodeSnapshot(snap);
    const decoded = decodeSnapshot(encoded);
    expect(decoded).toEqual(snap);
  });

  it('round-trips a DC sweep snapshot', () => {
    const snap = makeSnapshot({
      simType: 'dcsweep',
      parameters: { source: 'V1', startValue: '0', stopValue: '5', stepValue: '0.1' },
    });
    const encoded = encodeSnapshot(snap);
    const decoded = decodeSnapshot(encoded);
    expect(decoded).toEqual(snap);
  });

  it('round-trips a snapshot with probes', () => {
    const snap = makeSnapshot({
      probes: [
        makeProbe(),
        makeProbe({ id: 'probe-2', name: 'I(R1)', type: 'current', nodeOrComponent: 'R1' }),
      ],
    });
    const encoded = encodeSnapshot(snap);
    const decoded = decodeSnapshot(encoded);
    expect(decoded).toEqual(snap);
  });

  it('produces URL-safe output (no +, /, or =)', () => {
    const snap = makeSnapshot({ parameters: { value: 'special chars: /+=' } });
    const encoded = encodeSnapshot(snap);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('handles unicode in parameter values', () => {
    const snap = makeSnapshot({ parameters: { name: 'resistor \u03A9 100k' } });
    const encoded = encodeSnapshot(snap);
    const decoded = decodeSnapshot(encoded);
    expect(decoded.parameters.name).toBe('resistor \u03A9 100k');
  });

  it('handles numeric parameter values', () => {
    const snap = makeSnapshot({ parameters: { voltage: 3.3, current: 0.001 } });
    const encoded = encodeSnapshot(snap);
    const decoded = decodeSnapshot(encoded);
    expect(decoded.parameters.voltage).toBe(3.3);
    expect(decoded.parameters.current).toBe(0.001);
  });
});

// ---------------------------------------------------------------------------
// decodeSnapshot validation errors
// ---------------------------------------------------------------------------

describe('decodeSnapshot — validation', () => {
  it('throws on invalid base64', () => {
    expect(() => decodeSnapshot('!!!not-base64!!!')).toThrow('Invalid base64');
  });

  it('throws on valid base64 but non-JSON content', () => {
    const encoded = btoa('not json at all');
    expect(() => decodeSnapshot(encoded)).toThrow('Invalid JSON');
  });

  it('throws when snapshot is not an object', () => {
    const encoded = btoa(JSON.stringify('just a string'));
    expect(() => decodeSnapshot(encoded)).toThrow('must be an object');
  });

  it('throws when circuitId is missing', () => {
    const encoded = btoa(JSON.stringify({ simType: 'dcop', parameters: {}, timestamp: 'x' }));
    expect(() => decodeSnapshot(encoded)).toThrow('numeric circuitId');
  });

  it('throws when circuitId is not finite', () => {
    const encoded = btoa(JSON.stringify({ circuitId: NaN, simType: 'dcop', parameters: {}, timestamp: 'x' }));
    expect(() => decodeSnapshot(encoded)).toThrow('numeric circuitId');
  });

  it('throws on invalid simType', () => {
    const encoded = btoa(JSON.stringify({ circuitId: 1, simType: 'nope', parameters: {}, timestamp: 'x' }));
    expect(() => decodeSnapshot(encoded)).toThrow('Invalid simType');
  });

  it('throws when parameters is missing', () => {
    const encoded = btoa(JSON.stringify({ circuitId: 1, simType: 'dcop', timestamp: 'x' }));
    expect(() => decodeSnapshot(encoded)).toThrow('parameters object');
  });

  it('throws when parameters is an array', () => {
    const encoded = btoa(JSON.stringify({ circuitId: 1, simType: 'dcop', parameters: [], timestamp: 'x' }));
    expect(() => decodeSnapshot(encoded)).toThrow('parameters object');
  });

  it('throws when timestamp is empty', () => {
    const encoded = btoa(JSON.stringify({ circuitId: 1, simType: 'dcop', parameters: {}, timestamp: '' }));
    expect(() => decodeSnapshot(encoded)).toThrow('non-empty timestamp');
  });

  it('throws when probes is not an array', () => {
    const encoded = btoa(
      JSON.stringify({ circuitId: 1, simType: 'dcop', parameters: {}, timestamp: 'x', probes: 'bad' }),
    );
    expect(() => decodeSnapshot(encoded)).toThrow('probes must be an array');
  });

  it('throws when a probe is missing required fields', () => {
    const encoded = btoa(
      JSON.stringify({
        circuitId: 1,
        simType: 'dcop',
        parameters: {},
        timestamp: 'x',
        probes: [{ id: 'p1' }],
      }),
    );
    expect(() => decodeSnapshot(encoded)).toThrow('Probe must have a string name');
  });

  it('throws when probe type is invalid', () => {
    const encoded = btoa(
      JSON.stringify({
        circuitId: 1,
        simType: 'dcop',
        parameters: {},
        timestamp: 'x',
        probes: [{ id: 'p1', name: 'V(out)', type: 'power', nodeOrComponent: 'out' }],
      }),
    );
    expect(() => decodeSnapshot(encoded)).toThrow('Probe type must be');
  });
});

// ---------------------------------------------------------------------------
// encodeSimulationLink / decodeSimulationLink
// ---------------------------------------------------------------------------

describe('encodeSimulationLink / decodeSimulationLink', () => {
  it('round-trips through a full URL', () => {
    const snap = makeSnapshot();
    const url = encodeSimulationLink(snap, 7);
    const decoded = decodeSimulationLink(url);
    expect(decoded).toEqual(snap);
  });

  it('includes the project ID in the URL path', () => {
    const snap = makeSnapshot();
    const url = encodeSimulationLink(snap, 99);
    expect(url).toContain('/projects/99/simulation');
  });

  it('includes the sim query parameter', () => {
    const snap = makeSnapshot();
    const url = encodeSimulationLink(snap, 1);
    expect(url).toContain('?sim=');
  });

  it('decodes from a URL object', () => {
    const snap = makeSnapshot();
    const url = new URL(encodeSimulationLink(snap, 1));
    const decoded = decodeSimulationLink(url);
    expect(decoded).toEqual(snap);
  });

  it('decodes from a query string starting with ?', () => {
    const snap = makeSnapshot();
    const url = encodeSimulationLink(snap, 1);
    const queryString = url.slice(url.indexOf('?'));
    const decoded = decodeSimulationLink(queryString);
    expect(decoded).toEqual(snap);
  });

  it('decodes from a relative path with query string', () => {
    const snap = makeSnapshot();
    const fullUrl = encodeSimulationLink(snap, 5);
    const path = fullUrl.replace(/^https?:\/\/[^/]+/, '');
    const decoded = decodeSimulationLink(path);
    expect(decoded).toEqual(snap);
  });

  it('returns null when no sim parameter is present', () => {
    const result = decodeSimulationLink('https://example.com/projects/1/simulation');
    expect(result).toBeNull();
  });

  it('returns null for a completely invalid input', () => {
    const result = decodeSimulationLink('');
    expect(result).toBeNull();
  });

  it('decodes a bare encoded string (no URL wrapping)', () => {
    const snap = makeSnapshot({ simType: 'dcop', parameters: {} });
    const encoded = encodeSnapshot(snap);
    const decoded = decodeSimulationLink(encoded);
    expect(decoded).toEqual(snap);
  });

  it('returns null for a bare string that is not valid base64', () => {
    const result = decodeSimulationLink('not-a-valid-snapshot');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// copySimulationLink
// ---------------------------------------------------------------------------

describe('copySimulationLink', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('copies the URL to the clipboard and returns it', async () => {
    const snap = makeSnapshot();
    const url = await copySimulationLink(snap, 3);
    expect(url).toContain('/projects/3/simulation?sim=');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(url);
  });

  it('throws when clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const snap = makeSnapshot();
    await expect(copySimulationLink(snap, 1)).rejects.toThrow('Clipboard API not available');
  });

  it('propagates clipboard write errors', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('Permission denied')) },
      writable: true,
      configurable: true,
    });

    const snap = makeSnapshot();
    await expect(copySimulationLink(snap, 1)).rejects.toThrow('Permission denied');
  });
});
