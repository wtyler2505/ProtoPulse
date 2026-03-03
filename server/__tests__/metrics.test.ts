import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  recordRequest,
  getMetrics,
  flushMetrics,
  startMetricsCollection,
  stopMetricsCollection,
  normalizePath,
  _resetForTesting,
  _loadFromDiskForTesting,
} from '../metrics';
import type { MetricsSnapshot } from '../metrics';

const METRICS_DIR = join(process.cwd(), 'data');
const METRICS_FILE = join(METRICS_DIR, 'metrics.json');

beforeEach(() => {
  _resetForTesting();
});

afterEach(() => {
  stopMetricsCollection();
});

// ---------------------------------------------------------------------------
// Route normalization
// ---------------------------------------------------------------------------

describe('normalizePath', () => {
  it('normalizes project-level numeric IDs', () => {
    expect(normalizePath('/api/projects/1')).toBe('/api/projects/:id');
    expect(normalizePath('/api/projects/42')).toBe('/api/projects/:id');
    expect(normalizePath('/api/projects/999')).toBe('/api/projects/:id');
  });

  it('normalizes project sub-resource paths', () => {
    expect(normalizePath('/api/projects/1/bom')).toBe('/api/projects/:id/bom');
    expect(normalizePath('/api/projects/1/bom/42')).toBe('/api/projects/:id/bom/:bomId');
    expect(normalizePath('/api/projects/5/nodes')).toBe('/api/projects/:id/nodes');
    expect(normalizePath('/api/projects/5/nodes/10')).toBe('/api/projects/:id/nodes/:nodeId');
    expect(normalizePath('/api/projects/3/edges')).toBe('/api/projects/:id/edges');
    expect(normalizePath('/api/projects/3/edges/7')).toBe('/api/projects/:id/edges/:edgeId');
    expect(normalizePath('/api/projects/2/validation')).toBe('/api/projects/:id/validation');
    expect(normalizePath('/api/projects/2/validation/99')).toBe('/api/projects/:id/validation/:issueId');
    expect(normalizePath('/api/projects/1/chat')).toBe('/api/projects/:id/chat');
    expect(normalizePath('/api/projects/1/chat/5')).toBe('/api/projects/:id/chat/:messageId');
    expect(normalizePath('/api/projects/1/history')).toBe('/api/projects/:id/history');
    expect(normalizePath('/api/projects/1/history/8')).toBe('/api/projects/:id/history/:itemId');
  });

  it('normalizes circuit design paths under projects', () => {
    expect(normalizePath('/api/projects/1/circuits')).toBe('/api/projects/:id/circuits');
    expect(normalizePath('/api/projects/1/circuits/3')).toBe('/api/projects/:id/circuits/:circuitId');
    expect(normalizePath('/api/projects/1/circuits/3/simulations/7')).toBe(
      '/api/projects/:id/circuits/:circuitId/simulations/:simId',
    );
  });

  it('normalizes circuit-level resource paths (no project prefix)', () => {
    expect(normalizePath('/api/circuits/5/instances')).toBe('/api/circuits/:circuitId/instances');
    expect(normalizePath('/api/circuits/5/instances/10')).toBe('/api/circuits/:circuitId/instances/:id');
    expect(normalizePath('/api/circuits/5/nets')).toBe('/api/circuits/:circuitId/nets');
    expect(normalizePath('/api/circuits/5/nets/3')).toBe('/api/circuits/:circuitId/nets/:id');
    expect(normalizePath('/api/circuits/5/wires')).toBe('/api/circuits/:circuitId/wires');
    expect(normalizePath('/api/circuits/5/autoroute')).toBe('/api/circuits/:circuitId/autoroute');
    expect(normalizePath('/api/circuits/5/suggest-layout')).toBe('/api/circuits/:circuitId/suggest-layout');
    expect(normalizePath('/api/circuits/5/netlist')).toBe('/api/circuits/:circuitId/netlist');
  });

  it('normalizes wire by ID paths', () => {
    expect(normalizePath('/api/wires/42')).toBe('/api/wires/:id');
  });

  it('normalizes export and import paths', () => {
    expect(normalizePath('/api/projects/1/export/kicad')).toBe('/api/projects/:id/export/:format');
    expect(normalizePath('/api/projects/1/export/gerber')).toBe('/api/projects/:id/export/:format');
    expect(normalizePath('/api/projects/1/export/spice')).toBe('/api/projects/:id/export/:format');
    expect(normalizePath('/api/projects/1/import/fzz')).toBe('/api/projects/:id/import/:format');
    expect(normalizePath('/api/projects/1/import/kicad')).toBe('/api/projects/:id/import/:format');
  });

  it('normalizes component library paths', () => {
    expect(normalizePath('/api/components/5')).toBe('/api/components/:id');
    expect(normalizePath('/api/components/library/3')).toBe('/api/components/library/:id');
    expect(normalizePath('/api/components/library/3/parts')).toBe('/api/components/library/:id/parts');
    expect(normalizePath('/api/components/parts/7')).toBe('/api/components/parts/:id');
  });

  it('normalizes deprecated endpoints', () => {
    expect(normalizePath('/api/bom/42')).toBe('/api/bom/:id');
    expect(normalizePath('/api/validation/99')).toBe('/api/validation/:id');
  });

  it('normalizes UUID segments', () => {
    expect(normalizePath('/api/something/550e8400-e29b-41d4-a716-446655440000')).toBe('/api/something/:uuid');
  });

  it('leaves static paths unchanged', () => {
    expect(normalizePath('/api/health')).toBe('/api/health');
    expect(normalizePath('/api/ready')).toBe('/api/ready');
    expect(normalizePath('/api/metrics')).toBe('/api/metrics');
    expect(normalizePath('/api/auth/login')).toBe('/api/auth/login');
    expect(normalizePath('/api/seed')).toBe('/api/seed');
    expect(normalizePath('/api/admin/purge')).toBe('/api/admin/purge');
    expect(normalizePath('/api/admin/metrics')).toBe('/api/admin/metrics');
  });

  it('normalizes settings sub-resources', () => {
    expect(normalizePath('/api/settings/chat/1')).toBe('/api/settings/chat/:id');
  });
});

// ---------------------------------------------------------------------------
// recordRequest + getMetrics
// ---------------------------------------------------------------------------

describe('recordRequest', () => {
  it('accumulates counts and durations for normalized routes', () => {
    recordRequest('GET', '/api/projects/1', 200, 10);
    recordRequest('GET', '/api/projects/2', 200, 20);
    recordRequest('GET', '/api/projects/3', 404, 5);

    const snapshot = getMetrics();
    const route = snapshot.routes['GET /api/projects/:id'];
    expect(route).toBeDefined();
    expect(route.count).toBe(3);
    expect(route.totalDuration).toBe(35);
    expect(route.errors).toBe(1);
    expect(route.avgMs).toBe(12); // Math.round(35/3)
  });

  it('tracks min and max latencies', () => {
    recordRequest('POST', '/api/projects/1/bom', 201, 50);
    recordRequest('POST', '/api/projects/1/bom', 201, 10);
    recordRequest('POST', '/api/projects/1/bom', 201, 100);

    const snapshot = getMetrics();
    const route = snapshot.routes['POST /api/projects/:id/bom'];
    expect(route.min).toBe(10);
    expect(route.max).toBe(100);
  });

  it('counts errors for status codes >= 400', () => {
    recordRequest('DELETE', '/api/projects/1', 204, 5);
    recordRequest('DELETE', '/api/projects/2', 403, 2);
    recordRequest('DELETE', '/api/projects/3', 500, 3);

    const snapshot = getMetrics();
    const route = snapshot.routes['DELETE /api/projects/:id'];
    expect(route.errors).toBe(2);
    expect(route.count).toBe(3);
  });

  it('treats different methods as separate keys', () => {
    recordRequest('GET', '/api/projects/1', 200, 10);
    recordRequest('POST', '/api/projects/1', 201, 20);

    const snapshot = getMetrics();
    expect(snapshot.routes['GET /api/projects/:id']).toBeDefined();
    expect(snapshot.routes['POST /api/projects/:id']).toBeDefined();
    expect(snapshot.routes['GET /api/projects/:id'].count).toBe(1);
    expect(snapshot.routes['POST /api/projects/:id'].count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Latency percentiles
// ---------------------------------------------------------------------------

describe('latency percentiles', () => {
  it('computes p50, p95, p99 from recorded samples', () => {
    // Record 100 requests with latencies 1..100
    for (let i = 1; i <= 100; i++) {
      recordRequest('GET', '/api/health', 200, i);
    }

    const snapshot = getMetrics();
    const route = snapshot.routes['GET /api/health'];
    expect(route.p50).toBe(50);
    expect(route.p95).toBe(95);
    expect(route.p99).toBe(99);
  });

  it('returns 0 percentiles for a single request', () => {
    recordRequest('GET', '/api/health', 200, 42);

    const snapshot = getMetrics();
    const route = snapshot.routes['GET /api/health'];
    expect(route.p50).toBe(42);
    expect(route.p95).toBe(42);
    expect(route.p99).toBe(42);
    expect(route.min).toBe(42);
    expect(route.max).toBe(42);
  });

  it('handles two requests', () => {
    recordRequest('GET', '/api/health', 200, 10);
    recordRequest('GET', '/api/health', 200, 20);

    const snapshot = getMetrics();
    const route = snapshot.routes['GET /api/health'];
    expect(route.p50).toBe(10);
    expect(route.p95).toBe(20);
    expect(route.p99).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// getMetrics shape
// ---------------------------------------------------------------------------

describe('getMetrics', () => {
  it('returns complete snapshot shape with no requests', () => {
    const snapshot = getMetrics();

    expect(snapshot).toHaveProperty('uptimeSeconds');
    expect(typeof snapshot.uptimeSeconds).toBe('number');
    expect(snapshot.uptimeSeconds).toBeGreaterThanOrEqual(0);

    expect(snapshot).toHaveProperty('collectedAt');
    expect(typeof snapshot.collectedAt).toBe('string');

    expect(snapshot).toHaveProperty('process');
    expect(snapshot.process).toHaveProperty('memory');
    expect(snapshot.process.memory).toHaveProperty('rss');
    expect(snapshot.process.memory).toHaveProperty('heapUsed');
    expect(snapshot.process.memory).toHaveProperty('heapTotal');
    expect(snapshot.process).toHaveProperty('eventLoop');
    expect(snapshot.process.eventLoop).toHaveProperty('p50Ms');
    expect(snapshot.process.eventLoop).toHaveProperty('p95Ms');
    expect(snapshot.process.eventLoop).toHaveProperty('p99Ms');

    expect(snapshot).toHaveProperty('routes');
    expect(typeof snapshot.routes).toBe('object');
    expect(Object.keys(snapshot.routes)).toHaveLength(0);
  });

  it('returns route entries with all required fields', () => {
    recordRequest('GET', '/api/projects/1', 200, 15);

    const snapshot = getMetrics();
    const route = snapshot.routes['GET /api/projects/:id'];
    expect(route).toEqual({
      count: 1,
      totalDuration: 15,
      errors: 0,
      avgMs: 15,
      min: 15,
      max: 15,
      p50: 15,
      p95: 15,
      p99: 15,
    });
  });

  it('populates process metrics after startMetricsCollection', () => {
    startMetricsCollection();

    // startMetricsCollection calls sampleProcessMetrics synchronously
    const snapshot = getMetrics();
    expect(snapshot.process.memory.rss).toBeGreaterThan(0);
    expect(snapshot.process.memory.heapUsed).toBeGreaterThan(0);
    expect(snapshot.process.memory.heapTotal).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// File persistence
// ---------------------------------------------------------------------------

describe('file persistence', () => {
  afterEach(async () => {
    // Clean up the test metrics file
    try {
      await rm(METRICS_FILE, { force: true });
    } catch {
      // ignore
    }
  });

  it('writes metrics to disk and reads them back', async () => {
    recordRequest('GET', '/api/projects/1', 200, 25);
    recordRequest('POST', '/api/projects/1/bom', 201, 50);

    await flushMetrics();

    // Verify file was written
    expect(existsSync(METRICS_FILE)).toBe(true);

    const raw = await readFile(METRICS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as { version: number; persistedAt: string; routes: Record<string, unknown> };

    expect(parsed.version).toBe(1);
    expect(parsed.persistedAt).toBeTruthy();
    expect(Object.keys(parsed.routes)).toContain('GET /api/projects/:id');
    expect(Object.keys(parsed.routes)).toContain('POST /api/projects/:id/bom');
  });

  it('creates data/ directory if it does not exist', async () => {
    // Remove the directory first
    try {
      await rm(METRICS_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }

    recordRequest('GET', '/api/health', 200, 5);
    await flushMetrics();

    expect(existsSync(METRICS_DIR)).toBe(true);
    expect(existsSync(METRICS_FILE)).toBe(true);
  });

  it('survives a write+reset+read cycle', async () => {
    recordRequest('GET', '/api/projects/1', 200, 30);
    recordRequest('GET', '/api/projects/2', 500, 100);
    await flushMetrics();

    // Verify pre-reset state
    const beforeReset = getMetrics();
    expect(beforeReset.routes['GET /api/projects/:id'].count).toBe(2);

    // Reset in-memory state
    _resetForTesting();
    const afterReset = getMetrics();
    expect(Object.keys(afterReset.routes)).toHaveLength(0);

    // Load persisted metrics directly (avoids race condition with void loadFromDisk)
    await _loadFromDiskForTesting();

    const restored = getMetrics();
    expect(restored.routes['GET /api/projects/:id']).toBeDefined();
    expect(restored.routes['GET /api/projects/:id'].count).toBe(2);
    expect(restored.routes['GET /api/projects/:id'].errors).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe('startMetricsCollection / stopMetricsCollection', () => {
  it('starts and stops without error', () => {
    expect(() => startMetricsCollection()).not.toThrow();
    expect(() => stopMetricsCollection()).not.toThrow();
  });

  it('is idempotent on stop', () => {
    startMetricsCollection();
    expect(() => stopMetricsCollection()).not.toThrow();
    expect(() => stopMetricsCollection()).not.toThrow();
  });
});
