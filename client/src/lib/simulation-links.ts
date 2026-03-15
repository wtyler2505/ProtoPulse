/**
 * Simulation Link Manager (BL-0213)
 *
 * Generates shareable URLs that capture simulation state (analysis type,
 * parameters, probes, circuit ID) for reproducibility. State is compressed
 * to a base64url-encoded JSON string stored in a URL search parameter.
 *
 * Format: <origin>/projects/:projectId/simulation?sim=<base64url-encoded JSON>
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SimLinkAnalysisType = 'dcop' | 'transient' | 'ac' | 'dcsweep';

export interface SimLinkProbe {
  id: string;
  name: string;
  type: 'voltage' | 'current';
  nodeOrComponent: string;
}

export interface SimulationSnapshot {
  /** Circuit design ID this simulation belongs to. */
  circuitId: number;
  /** Analysis type to run. */
  simType: SimLinkAnalysisType;
  /** Analysis parameters (shape depends on simType). */
  parameters: Record<string, string | number>;
  /** Optional probes to restore. */
  probes?: SimLinkProbe[];
  /** ISO-8601 timestamp when the snapshot was created. */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Encode / Decode helpers
// ---------------------------------------------------------------------------

/**
 * Encode a simulation snapshot into a URL-safe base64 string.
 *
 * Uses standard TextEncoder + btoa with URL-safe alphabet substitution
 * (+→-  /→_  strip trailing =).
 */
export function encodeSnapshot(snapshot: SimulationSnapshot): string {
  const json = JSON.stringify(snapshot);
  const bytes = new TextEncoder().encode(json);
  // Convert Uint8Array to a binary string for btoa
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  // Make URL-safe: + → -, / → _, strip trailing =
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a URL-safe base64 string back into a SimulationSnapshot.
 *
 * Throws if the string is malformed or the JSON doesn't match the expected shape.
 */
export function decodeSnapshot(encoded: string): SimulationSnapshot {
  // Restore standard base64 characters
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  // Re-pad if needed
  const pad = base64.length % 4;
  if (pad === 2) {
    base64 += '==';
  } else if (pad === 3) {
    base64 += '=';
  }

  let json: string;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    json = new TextDecoder().decode(bytes);
  } catch {
    throw new Error('Invalid base64 encoding in simulation link');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON in simulation link');
  }

  return validateSnapshot(parsed);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_SIM_TYPES = new Set<SimLinkAnalysisType>(['dcop', 'transient', 'ac', 'dcsweep']);

function validateSnapshot(value: unknown): SimulationSnapshot {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Simulation snapshot must be an object');
  }

  const obj = value as Record<string, unknown>;

  // circuitId
  if (typeof obj.circuitId !== 'number' || !Number.isFinite(obj.circuitId)) {
    throw new Error('Simulation snapshot must have a numeric circuitId');
  }

  // simType
  if (typeof obj.simType !== 'string' || !VALID_SIM_TYPES.has(obj.simType as SimLinkAnalysisType)) {
    throw new Error(`Invalid simType: expected one of ${Array.from(VALID_SIM_TYPES).join(', ')}`);
  }

  // parameters
  if (typeof obj.parameters !== 'object' || obj.parameters === null || Array.isArray(obj.parameters)) {
    throw new Error('Simulation snapshot must have a parameters object');
  }

  // timestamp
  if (typeof obj.timestamp !== 'string' || obj.timestamp.length === 0) {
    throw new Error('Simulation snapshot must have a non-empty timestamp string');
  }

  // probes (optional)
  if (obj.probes !== undefined) {
    if (!Array.isArray(obj.probes)) {
      throw new Error('probes must be an array');
    }
    for (const probe of obj.probes) {
      validateProbe(probe);
    }
  }

  return {
    circuitId: obj.circuitId as number,
    simType: obj.simType as SimLinkAnalysisType,
    parameters: obj.parameters as Record<string, string | number>,
    probes: obj.probes as SimLinkProbe[] | undefined,
    timestamp: obj.timestamp as string,
  };
}

function validateProbe(value: unknown): void {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Each probe must be an object');
  }
  const p = value as Record<string, unknown>;
  if (typeof p.id !== 'string') {
    throw new Error('Probe must have a string id');
  }
  if (typeof p.name !== 'string') {
    throw new Error('Probe must have a string name');
  }
  if (p.type !== 'voltage' && p.type !== 'current') {
    throw new Error('Probe type must be "voltage" or "current"');
  }
  if (typeof p.nodeOrComponent !== 'string') {
    throw new Error('Probe must have a string nodeOrComponent');
  }
}

// ---------------------------------------------------------------------------
// URL construction / parsing
// ---------------------------------------------------------------------------

const SIM_PARAM_KEY = 'sim';

/**
 * Build a full shareable simulation URL from a snapshot and project ID.
 */
export function encodeSimulationLink(snapshot: SimulationSnapshot, projectId: number): string {
  const encoded = encodeSnapshot(snapshot);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://protopulse.local';
  return `${origin}/projects/${projectId}/simulation?${SIM_PARAM_KEY}=${encoded}`;
}

/**
 * Parse a shareable simulation URL back into a SimulationSnapshot.
 *
 * Accepts a full URL string, a URL object, or just a search/query string.
 * Returns null if no simulation parameter is found.
 */
export function decodeSimulationLink(input: string | URL): SimulationSnapshot | null {
  let searchParams: URLSearchParams;

  if (input instanceof URL) {
    searchParams = input.searchParams;
  } else if (typeof input === 'string') {
    // Handle both full URLs and bare query strings
    if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('/')) {
      try {
        // Absolute URL
        const url = new URL(input, 'https://protopulse.local');
        searchParams = url.searchParams;
      } catch {
        return null;
      }
    } else if (input.startsWith('?')) {
      searchParams = new URLSearchParams(input);
    } else {
      // Try as bare encoded string
      try {
        return decodeSnapshot(input);
      } catch {
        return null;
      }
    }
  } else {
    return null;
  }

  const simValue = searchParams.get(SIM_PARAM_KEY);
  if (!simValue) {
    return null;
  }

  return decodeSnapshot(simValue);
}

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

/**
 * Encode a simulation snapshot as a shareable URL and copy it to the clipboard.
 *
 * Returns the URL string on success, throws on clipboard failure.
 */
export async function copySimulationLink(snapshot: SimulationSnapshot, projectId: number): Promise<string> {
  const url = encodeSimulationLink(snapshot, projectId);

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
  } else {
    throw new Error('Clipboard API not available');
  }

  return url;
}
