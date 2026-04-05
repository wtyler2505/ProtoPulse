import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { IntervalHistogram } from 'node:perf_hooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LatencyHistogram {
  count: number;
  totalDuration: number;
  errors: number;
  min: number;
  max: number;
  /** Sorted array of recorded latencies for percentile computation */
  samples: number[];
}

interface RouteMetricSnapshot {
  count: number;
  totalDuration: number;
  errors: number;
  avgMs: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

interface ProcessMetrics {
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  eventLoop: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
}

export interface MetricsSnapshot {
  uptimeSeconds: number;
  collectedAt: string;
  process: ProcessMetrics;
  routes: Record<string, RouteMetricSnapshot>;
}

/** Shape persisted to disk — raw histograms, not computed snapshots */
interface PersistedMetrics {
  version: 1;
  persistedAt: string;
  routes: Record<string, { count: number; totalDuration: number; errors: number; min: number; max: number; samples: number[] }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const METRICS_DIR = join(process.cwd(), 'data');
const METRICS_FILE = join(METRICS_DIR, 'metrics.json');
const FLUSH_INTERVAL_MS = 60_000;
const PROCESS_SAMPLE_INTERVAL_MS = 30_000;

/**
 * Maximum number of latency samples kept per route.
 * Uses reservoir sampling to cap memory: when samples exceed this limit,
 * a random existing sample is replaced with the new observation.
 */
const MAX_SAMPLES_PER_ROUTE = 1_000;

// ---------------------------------------------------------------------------
// Route normalization
// ---------------------------------------------------------------------------

/**
 * Maps known API resource prefixes to their parameter names.
 * Order matters: longer/more-specific prefixes must come first so that
 * `/api/projects/:id/circuits/:circuitId/simulations/:simId` normalizes
 * before the shorter `/api/projects/:id` prefix matches.
 */
const NORMALIZATION_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  // Circuit sub-resources (must precede shorter circuit patterns)
  { pattern: /\/api\/projects\/\d+\/circuits\/\d+\/simulations\/\d+/g, replacement: '/api/projects/:id/circuits/:circuitId/simulations/:simId' },
  { pattern: /\/api\/projects\/\d+\/circuits\/\d+/g, replacement: '/api/projects/:id/circuits/:circuitId' },
  { pattern: /\/api\/projects\/\d+\/circuits/g, replacement: '/api/projects/:id/circuits' },

  // Project sub-resources
  { pattern: /\/api\/projects\/\d+\/agent/g, replacement: '/api/projects/:id/agent' },
  { pattern: /\/api\/projects\/\d+\/arduino\/jobs\/\d+\/artifact/g, replacement: '/api/projects/:id/arduino/jobs/:jobId/artifact' },
  { pattern: /\/api\/projects\/\d+\/arduino\/jobs\/\d+\/memory/g, replacement: '/api/projects/:id/arduino/jobs/:jobId/memory' },
  { pattern: /\/api\/projects\/\d+\/arduino\/jobs\/\d+\/cancel/g, replacement: '/api/projects/:id/arduino/jobs/:jobId/cancel' },
  { pattern: /\/api\/projects\/\d+\/arduino\/jobs\/\d+\/stream/g, replacement: '/api/projects/:id/arduino/jobs/:jobId/stream' },
  { pattern: /\/api\/projects\/\d+\/arduino\/jobs\/\d+/g, replacement: '/api/projects/:id/arduino/jobs/:jobId' },
  { pattern: /\/api\/projects\/\d+\/arduino\/jobs\/(?:compile|upload)/g, replacement: '/api/projects/:id/arduino/jobs/:action' },
  { pattern: /\/api\/projects\/\d+\/arduino\/jobs/g, replacement: '/api/projects/:id/arduino/jobs' },
  { pattern: /\/api\/projects\/\d+\/arduino\/serial\/[^/]+\/close/g, replacement: '/api/projects/:id/arduino/serial/:sessionId/close' },
  { pattern: /\/api\/projects\/\d+\/firmware\/simulate\/[^/]+\/(?:events|status|reset|stop)/g, replacement: '/api/projects/:id/firmware/simulate/:sessionId/:action' },
  { pattern: /\/api\/projects\/\d+\/firmware\/simulate/g, replacement: '/api/projects/:id/firmware/simulate' },
  { pattern: /\/api\/projects\/\d+\/bom\/\d+/g, replacement: '/api/projects/:id/bom/:bomId' },
  { pattern: /\/api\/projects\/\d+\/bom/g, replacement: '/api/projects/:id/bom' },
  { pattern: /\/api\/projects\/\d+\/nodes\/\d+/g, replacement: '/api/projects/:id/nodes/:nodeId' },
  { pattern: /\/api\/projects\/\d+\/nodes/g, replacement: '/api/projects/:id/nodes' },
  { pattern: /\/api\/projects\/\d+\/edges\/\d+/g, replacement: '/api/projects/:id/edges/:edgeId' },
  { pattern: /\/api\/projects\/\d+\/edges/g, replacement: '/api/projects/:id/edges' },
  { pattern: /\/api\/projects\/\d+\/validation\/\d+/g, replacement: '/api/projects/:id/validation/:issueId' },
  { pattern: /\/api\/projects\/\d+\/validation/g, replacement: '/api/projects/:id/validation' },
  { pattern: /\/api\/projects\/\d+\/chat\/\d+/g, replacement: '/api/projects/:id/chat/:messageId' },
  { pattern: /\/api\/projects\/\d+\/chat/g, replacement: '/api/projects/:id/chat' },
  { pattern: /\/api\/projects\/\d+\/history\/\d+/g, replacement: '/api/projects/:id/history/:itemId' },
  { pattern: /\/api\/projects\/\d+\/history/g, replacement: '/api/projects/:id/history' },
  { pattern: /\/api\/projects\/\d+\/import\/\w+/g, replacement: '/api/projects/:id/import/:format' },
  { pattern: /\/api\/projects\/\d+\/export\/\w+/g, replacement: '/api/projects/:id/export/:format' },
  { pattern: /\/api\/projects\/\d+/g, replacement: '/api/projects/:id' },

  // Circuit-level resources (without project prefix)
  { pattern: /\/api\/circuits\/\d+\/instances\/\d+/g, replacement: '/api/circuits/:circuitId/instances/:id' },
  { pattern: /\/api\/circuits\/\d+\/instances/g, replacement: '/api/circuits/:circuitId/instances' },
  { pattern: /\/api\/circuits\/\d+\/nets\/\d+/g, replacement: '/api/circuits/:circuitId/nets/:id' },
  { pattern: /\/api\/circuits\/\d+\/nets/g, replacement: '/api/circuits/:circuitId/nets' },
  { pattern: /\/api\/circuits\/\d+\/wires/g, replacement: '/api/circuits/:circuitId/wires' },
  { pattern: /\/api\/circuits\/\d+\/autoroute/g, replacement: '/api/circuits/:circuitId/autoroute' },
  { pattern: /\/api\/circuits\/\d+\/suggest-layout/g, replacement: '/api/circuits/:circuitId/suggest-layout' },
  { pattern: /\/api\/circuits\/\d+\/netlist/g, replacement: '/api/circuits/:circuitId/netlist' },
  { pattern: /\/api\/circuits\/\d+/g, replacement: '/api/circuits/:circuitId' },

  // Wire by ID
  { pattern: /\/api\/wires\/\d+/g, replacement: '/api/wires/:id' },

  // Component library
  { pattern: /\/api\/components\/library\/\d+\/parts/g, replacement: '/api/components/library/:id/parts' },
  { pattern: /\/api\/components\/library\/\d+/g, replacement: '/api/components/library/:id' },
  { pattern: /\/api\/components\/parts\/\d+/g, replacement: '/api/components/parts/:id' },
  { pattern: /\/api\/components\/\d+/g, replacement: '/api/components/:id' },

  // Deprecated BOM/validation endpoints
  { pattern: /\/api\/bom\/\d+/g, replacement: '/api/bom/:id' },
  { pattern: /\/api\/validation\/\d+/g, replacement: '/api/validation/:id' },

  // Settings
  { pattern: /\/api\/settings\/chat\/\d+/g, replacement: '/api/settings/chat/:id' },

  // Generic UUID segments (for any routes using UUID identifiers)
  { pattern: /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, replacement: '/:uuid' },
];

export function normalizePath(path: string): string {
  let normalized = path;
  for (const rule of NORMALIZATION_RULES) {
    // Regex objects with /g flag have lastIndex state — reset it
    rule.pattern.lastIndex = 0;
    normalized = normalized.replace(rule.pattern, rule.replacement);
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const routeMetrics = new Map<string, LatencyHistogram>();
let eventLoopHistogram: IntervalHistogram | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let processTimer: ReturnType<typeof setInterval> | null = null;
let persistedMetricsLoaded = false;
let latestProcessMetrics: ProcessMetrics = {
  memory: { rss: 0, heapUsed: 0, heapTotal: 0 },
  eventLoop: { p50Ms: 0, p95Ms: 0, p99Ms: 0 },
};

// ---------------------------------------------------------------------------
// Percentile helper
// ---------------------------------------------------------------------------

/**
 * Compute a percentile from a sorted array of numbers.
 * Uses the "nearest rank" method.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

export function recordRequest(method: string, path: string, statusCode: number, durationMs: number): void {
  const normalizedPath = normalizePath(path);
  const key = `${method} ${normalizedPath}`;

  let histogram = routeMetrics.get(key);
  if (!histogram) {
    histogram = {
      count: 0,
      totalDuration: 0,
      errors: 0,
      min: Infinity,
      max: -Infinity,
      samples: [],
    };
    routeMetrics.set(key, histogram);
  }

  histogram.count++;
  histogram.totalDuration += durationMs;
  if (statusCode >= 400) {
    histogram.errors++;
  }
  if (durationMs < histogram.min) {
    histogram.min = durationMs;
  }
  if (durationMs > histogram.max) {
    histogram.max = durationMs;
  }

  // Reservoir sampling to cap memory usage
  if (histogram.samples.length < MAX_SAMPLES_PER_ROUTE) {
    insertSorted(histogram.samples, durationMs);
  } else {
    // Replace a random sample with probability MAX_SAMPLES / count
    const j = Math.floor(Math.random() * histogram.count);
    if (j < MAX_SAMPLES_PER_ROUTE) {
      histogram.samples[j] = durationMs;
      histogram.samples.sort((a, b) => a - b);
    }
  }
}

/** Binary-insert into a sorted array to maintain sort order cheaply */
function insertSorted(arr: number[], value: number): void {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < value) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  arr.splice(lo, 0, value);
}

export function getMetrics(): MetricsSnapshot {
  const routes: Record<string, RouteMetricSnapshot> = {};

  routeMetrics.forEach((h, key) => {
    routes[key] = {
      count: h.count,
      totalDuration: h.totalDuration,
      errors: h.errors,
      avgMs: h.count > 0 ? Math.round(h.totalDuration / h.count) : 0,
      min: h.min === Infinity ? 0 : Math.round(h.min),
      max: h.max === -Infinity ? 0 : Math.round(h.max),
      p50: Math.round(percentile(h.samples, 50)),
      p95: Math.round(percentile(h.samples, 95)),
      p99: Math.round(percentile(h.samples, 99)),
    };
  });

  return {
    uptimeSeconds: Math.round(process.uptime()),
    collectedAt: new Date().toISOString(),
    process: { ...latestProcessMetrics },
    routes,
  };
}

// ---------------------------------------------------------------------------
// Process metrics sampling
// ---------------------------------------------------------------------------

function sampleProcessMetrics(): void {
  const mem = process.memoryUsage();
  latestProcessMetrics.memory = {
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
  };

  if (eventLoopHistogram) {
    latestProcessMetrics.eventLoop = {
      p50Ms: nanosToMs(eventLoopHistogram.percentile(50)),
      p95Ms: nanosToMs(eventLoopHistogram.percentile(95)),
      p99Ms: nanosToMs(eventLoopHistogram.percentile(99)),
    };
  }
}

function nanosToMs(nanos: number): number {
  return Math.round(nanos / 1e6 * 100) / 100;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function loadFromDisk(): Promise<void> {
  try {
    const raw = await readFile(METRICS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as PersistedMetrics;
    if (parsed.version !== 1) {
      return;
    }

    for (const [key, data] of Object.entries(parsed.routes)) {
      routeMetrics.set(key, {
        count: data.count,
        totalDuration: data.totalDuration,
        errors: data.errors,
        min: data.min,
        max: data.max,
        samples: data.samples,
      });
    }
  } catch {
    // File doesn't exist or is corrupt — start fresh
  } finally {
    persistedMetricsLoaded = true;
  }
}

export async function flushMetrics(): Promise<void> {
  await ensureDir(dirname(METRICS_FILE));

  const routes: PersistedMetrics['routes'] = {};
  routeMetrics.forEach((h, key) => {
    routes[key] = {
      count: h.count,
      totalDuration: h.totalDuration,
      errors: h.errors,
      min: h.min === Infinity ? 0 : h.min,
      max: h.max === -Infinity ? 0 : h.max,
      samples: h.samples,
    };
  });

  const payload: PersistedMetrics = {
    version: 1,
    persistedAt: new Date().toISOString(),
    routes,
  };

  await writeFile(METRICS_FILE, JSON.stringify(payload, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function startMetricsCollection(): void {
  if (eventLoopHistogram || flushTimer || processTimer) {
    return;
  }

  // Load persisted metrics from previous run
  if (!persistedMetricsLoaded) {
    void loadFromDisk();
  }

  // Start event loop delay monitoring
  eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
  eventLoopHistogram.enable();

  // Sample process metrics immediately, then periodically
  sampleProcessMetrics();
  processTimer = setInterval(sampleProcessMetrics, PROCESS_SAMPLE_INTERVAL_MS);
  processTimer.unref();

  // Periodic flush to disk
  flushTimer = setInterval(() => {
    void flushMetrics();
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref();
}

export function stopMetricsCollection(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  if (processTimer) {
    clearInterval(processTimer);
    processTimer = null;
  }
  if (eventLoopHistogram) {
    eventLoopHistogram.disable();
    eventLoopHistogram = null;
  }
}

/**
 * Reset all in-memory metrics state.
 * Exported for testing only — not intended for production use.
 */
export function _resetForTesting(): void {
  routeMetrics.clear();
  persistedMetricsLoaded = false;
  latestProcessMetrics = {
    memory: { rss: 0, heapUsed: 0, heapTotal: 0 },
    eventLoop: { p50Ms: 0, p95Ms: 0, p99Ms: 0 },
  };
}

/**
 * Load persisted metrics from disk.
 * Exported for testing only — production code uses startMetricsCollection.
 */
export const _loadFromDiskForTesting = loadFromDisk;
