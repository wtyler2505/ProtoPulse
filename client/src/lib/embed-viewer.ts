/**
 * Embeddable Schematic Viewer — EmbedManager
 *
 * Serializes circuit data, compresses it to URL-safe strings, and generates
 * embed codes (iframe, markdown, direct link) for sharing read-only schematics.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbedCircuitNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  rotation?: number;
  properties?: Record<string, unknown>;
}

export interface EmbedCircuitWire {
  id: number;
  netId: number;
  points: unknown[];
  layer?: string;
  width?: number;
  color?: string;
  wireType?: string;
}

export interface EmbedCircuitNet {
  id: number;
  name: string;
  netType?: string;
  voltage?: string;
  segments?: unknown[];
  labels?: unknown[];
  style?: Record<string, unknown>;
}

export interface EmbedCircuitData {
  nodes: EmbedCircuitNode[];
  wires: EmbedCircuitWire[];
  nets: EmbedCircuitNet[];
  metadata?: {
    name?: string;
    description?: string;
    version?: number;
  };
}

export interface EmbedTheme {
  dark: boolean;
  accentColor: string;
  showGrid: boolean;
  showLabels: boolean;
}

export type EmbedFormat = 'iframe' | 'markdown' | 'link';

export interface EmbedOptions {
  theme?: Partial<EmbedTheme>;
  width?: string;
  height?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum URL length safe for all browsers */
const MAX_URL_LENGTH = 8000;

/** Compression threshold — skip compression for tiny payloads */
const COMPRESSION_THRESHOLD = 256;

/** Default embed theme */
const DEFAULT_THEME: EmbedTheme = {
  dark: true,
  accentColor: '#00F0FF',
  showGrid: true,
  showLabels: true,
};

// ---------------------------------------------------------------------------
// base64url helpers (URL-safe base64 without padding)
// ---------------------------------------------------------------------------

function uint8ToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlToUint8(encoded: string): Uint8Array {
  // Restore standard base64
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Compression (deflate via CompressionStream / DecompressionStream)
// ---------------------------------------------------------------------------

async function compressData(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    // Fallback: return uncompressed
    return data;
  }
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();

  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    totalLength += value.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function decompressData(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    // Fallback: assume uncompressed
    return data;
  }
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    totalLength += value.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// EmbedManager
// ---------------------------------------------------------------------------

export class EmbedManager {
  private origin: string;

  constructor(origin?: string) {
    this.origin = origin ?? (typeof window !== 'undefined' ? window.location.origin : 'https://protopulse.app');
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  /** Serialize circuit data to compact JSON string */
  serialize(data: EmbedCircuitData): string {
    return JSON.stringify({
      n: data.nodes.map((node) => ({
        i: node.id,
        t: node.type,
        l: node.label,
        x: node.x,
        y: node.y,
        ...(node.rotation !== undefined && node.rotation !== 0 ? { r: node.rotation } : {}),
        ...(node.properties && Object.keys(node.properties).length > 0 ? { p: node.properties } : {}),
      })),
      w: data.wires.map((wire) => ({
        i: wire.id,
        n: wire.netId,
        pt: wire.points,
        ...(wire.layer ? { ly: wire.layer } : {}),
        ...(wire.width !== undefined && wire.width !== 1 ? { wd: wire.width } : {}),
        ...(wire.color ? { c: wire.color } : {}),
        ...(wire.wireType && wire.wireType !== 'wire' ? { wt: wire.wireType } : {}),
      })),
      t: data.nets.map((net) => ({
        i: net.id,
        nm: net.name,
        ...(net.netType && net.netType !== 'signal' ? { nt: net.netType } : {}),
        ...(net.voltage ? { v: net.voltage } : {}),
        ...(net.segments && (net.segments as unknown[]).length > 0 ? { sg: net.segments } : {}),
        ...(net.labels && (net.labels as unknown[]).length > 0 ? { lb: net.labels } : {}),
        ...(net.style && Object.keys(net.style).length > 0 ? { st: net.style } : {}),
      })),
      ...(data.metadata ? { m: data.metadata } : {}),
    });
  }

  /** Deserialize compact JSON back to circuit data */
  deserialize(json: string): EmbedCircuitData {
    const parsed = JSON.parse(json) as {
      n: Array<{ i: string; t: string; l: string; x: number; y: number; r?: number; p?: Record<string, unknown> }>;
      w: Array<{ i: number; n: number; pt: unknown[]; ly?: string; wd?: number; c?: string; wt?: string }>;
      t: Array<{ i: number; nm: string; nt?: string; v?: string; sg?: unknown[]; lb?: unknown[]; st?: Record<string, unknown> }>;
      m?: { name?: string; description?: string; version?: number };
    };

    return {
      nodes: parsed.n.map((node) => ({
        id: node.i,
        type: node.t,
        label: node.l,
        x: node.x,
        y: node.y,
        ...(node.r !== undefined ? { rotation: node.r } : {}),
        ...(node.p ? { properties: node.p } : {}),
      })),
      wires: parsed.w.map((wire) => ({
        id: wire.i,
        netId: wire.n,
        points: wire.pt,
        ...(wire.ly ? { layer: wire.ly } : {}),
        ...(wire.wd !== undefined ? { width: wire.wd } : {}),
        ...(wire.c ? { color: wire.c } : {}),
        ...(wire.wt ? { wireType: wire.wt } : {}),
      })),
      nets: parsed.t.map((net) => ({
        id: net.i,
        name: net.nm,
        ...(net.nt ? { netType: net.nt } : {}),
        ...(net.v ? { voltage: net.v } : {}),
        ...(net.sg ? { segments: net.sg } : {}),
        ...(net.lb ? { labels: net.lb } : {}),
        ...(net.st ? { style: net.st } : {}),
      })),
      ...(parsed.m ? { metadata: parsed.m } : {}),
    };
  }

  // -------------------------------------------------------------------------
  // Encode / Decode
  // -------------------------------------------------------------------------

  /** Encode circuit data to a URL-safe string. Prefix: 'c' = compressed, 'r' = raw */
  async encode(data: EmbedCircuitData): Promise<string> {
    const json = this.serialize(data);
    const raw = new TextEncoder().encode(json);

    if (raw.length < COMPRESSION_THRESHOLD) {
      return 'r' + uint8ToBase64url(raw);
    }

    const compressed = await compressData(raw);
    // Only use compression if it actually reduced size
    if (compressed.length < raw.length) {
      return 'c' + uint8ToBase64url(compressed);
    }
    return 'r' + uint8ToBase64url(raw);
  }

  /** Decode a URL-safe string back to circuit data */
  async decode(encoded: string): Promise<EmbedCircuitData> {
    if (encoded.length === 0) {
      throw new Error('Empty embed data');
    }

    const prefix = encoded[0];
    const payload = encoded.slice(1);

    let bytes: Uint8Array;
    if (prefix === 'c') {
      const compressed = base64urlToUint8(payload);
      bytes = await decompressData(compressed);
    } else if (prefix === 'r') {
      bytes = base64urlToUint8(payload);
    } else {
      throw new Error(`Unknown embed data prefix: ${prefix}`);
    }

    const json = new TextDecoder().decode(bytes);
    return this.deserialize(json);
  }

  // -------------------------------------------------------------------------
  // URL generation
  // -------------------------------------------------------------------------

  /** Build the embed URL for client-encoded data */
  getEmbedUrl(encodedData: string, theme?: Partial<EmbedTheme>): string {
    let url = `${this.origin}/embed/${encodedData}`;
    const params = this.buildThemeParams(theme);
    if (params) {
      url += `?${params}`;
    }
    return url;
  }

  /** Build the short embed URL */
  getShortEmbedUrl(shortCode: string, theme?: Partial<EmbedTheme>): string {
    let url = `${this.origin}/embed/s/${shortCode}`;
    const params = this.buildThemeParams(theme);
    if (params) {
      url += `?${params}`;
    }
    return url;
  }

  /** Check if the encoded data exceeds the URL length limit */
  exceedsUrlLimit(encodedData: string, theme?: Partial<EmbedTheme>): boolean {
    const url = this.getEmbedUrl(encodedData, theme);
    return url.length > MAX_URL_LENGTH;
  }

  // -------------------------------------------------------------------------
  // Embed code generation
  // -------------------------------------------------------------------------

  /** Generate an iframe embed code */
  generateIframe(url: string, options?: EmbedOptions): string {
    const width = options?.width ?? '100%';
    const height = options?.height ?? '400';
    return `<iframe src="${url}" width="${width}" height="${height}" frameBorder="0" style="border:0;border-radius:8px;" allowfullscreen></iframe>`;
  }

  /** Generate a Markdown embed */
  generateMarkdown(url: string, title?: string): string {
    const label = title ?? 'Circuit Schematic';
    const previewUrl = url.replace(/\/embed\//, '/embed/preview/') + '.png';
    return `[![${label}](${previewUrl})](${url})`;
  }

  /** Generate embed code in the specified format */
  generateEmbedCode(format: EmbedFormat, url: string, options?: EmbedOptions & { title?: string }): string {
    switch (format) {
      case 'iframe':
        return this.generateIframe(url, options);
      case 'markdown':
        return this.generateMarkdown(url, options?.title);
      case 'link':
        return url;
    }
  }

  // -------------------------------------------------------------------------
  // Theme helpers
  // -------------------------------------------------------------------------

  /** Merge partial theme with defaults */
  resolveTheme(partial?: Partial<EmbedTheme>): EmbedTheme {
    return { ...DEFAULT_THEME, ...partial };
  }

  /** Parse theme from URL search params */
  parseThemeFromParams(params: URLSearchParams): Partial<EmbedTheme> {
    const theme: Partial<EmbedTheme> = {};
    if (params.has('theme')) {
      theme.dark = params.get('theme') === 'dark';
    }
    if (params.has('accent')) {
      theme.accentColor = params.get('accent') ?? DEFAULT_THEME.accentColor;
    }
    if (params.has('grid')) {
      theme.showGrid = params.get('grid') !== 'false';
    }
    if (params.has('labels')) {
      theme.showLabels = params.get('labels') !== 'false';
    }
    return theme;
  }

  // -------------------------------------------------------------------------
  // Server short URL
  // -------------------------------------------------------------------------

  /** Create a server-stored short URL */
  async createShortUrl(encodedData: string): Promise<{ code: string; url: string }> {
    const res = await fetch('/api/embeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: encodedData }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: 'Unknown error' })) as { message?: string };
      throw new Error(body.message ?? `Failed to create short URL (${String(res.status)})`);
    }
    return res.json() as Promise<{ code: string; url: string }>;
  }

  /** Fetch circuit data from a short code */
  async fetchShortUrl(code: string): Promise<string> {
    const res = await fetch(`/api/embeds/${code}`);
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Embed not found or expired');
      }
      throw new Error(`Failed to fetch embed (${String(res.status)})`);
    }
    const body = await res.json() as { data: string };
    return body.data;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private buildThemeParams(theme?: Partial<EmbedTheme>): string {
    if (!theme) {
      return '';
    }
    const params = new URLSearchParams();
    if (theme.dark !== undefined) {
      params.set('theme', theme.dark ? 'dark' : 'light');
    }
    if (theme.accentColor !== undefined) {
      params.set('accent', theme.accentColor);
    }
    if (theme.showGrid !== undefined) {
      params.set('grid', String(theme.showGrid));
    }
    if (theme.showLabels !== undefined) {
      params.set('labels', String(theme.showLabels));
    }
    const str = params.toString();
    return str;
  }
}

// Export helpers for testing
export { uint8ToBase64url, base64urlToUint8, MAX_URL_LENGTH, COMPRESSION_THRESHOLD };
