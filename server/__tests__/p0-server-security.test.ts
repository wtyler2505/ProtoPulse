/**
 * P0 Server Security Tests (Wave 52)
 *
 * Covers:
 * - BL-0002: /api/seed removed from PUBLIC_PATHS bypass
 * - BL-0006: Timing-safe admin key comparison
 * - BL-0008: LIKE wildcard escaping
 * - BL-0070: FZZ ZIP bomb protection
 * - E2E-312/313: /api/parts/browse/* is public AND does not leak user-scoped fields
 */

import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

/* ------------------------------------------------------------------ */
/*  Mocks — prevent transitive imports from reaching the real DB      */
/* ------------------------------------------------------------------ */

vi.mock('../db', () => ({
  db: {},
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../metrics', () => ({
  getMetrics: vi.fn().mockReturnValue({}),
}));

/* ------------------------------------------------------------------ */
/*  Imports (after mocks are hoisted)                                 */
/* ------------------------------------------------------------------ */

import { safeCompareAdminKey } from '../routes/admin';
import { escapeLikeWildcards } from '../storage/utils';
import { importFzz } from '../export/fzz-handler';

/* ------------------------------------------------------------------ */
/*  BL-0002: PUBLIC_PATHS no longer includes /api/seed                */
/* ------------------------------------------------------------------ */

describe('BL-0002: PUBLIC_PATHS auth bypass', () => {
  it('should not include /api/seed in public paths', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');

    // PUBLIC_API_PATHS was moved from index.ts to request-routing.ts
    const routingSource = await fs.readFile(path.resolve(__dirname, '..', 'request-routing.ts'), 'utf-8');

    // The PUBLIC_API_PATHS array should not contain seed-related paths
    const publicPathsMatch = routingSource.match(/const PUBLIC_API_PATHS\s*=\s*\[([\s\S]+?)\]/);
    expect(publicPathsMatch).not.toBeNull();
    const publicPathsContent = publicPathsMatch![1];
    expect(publicPathsContent).not.toContain('seed');

    // Verify index.ts does not have a stale PUBLIC_PATHS bypass either
    const indexSource = await fs.readFile(path.resolve(__dirname, '..', 'index.ts'), 'utf-8');
    const authBypassLines = indexSource
      .split('\n')
      .filter((line) => line.includes('isPublicApiPath') || line.includes('PUBLIC_PATHS'));
    for (const line of authBypassLines) {
      expect(line).not.toContain('/api/seed');
      expect(line).not.toContain('/api/admin/seed-library');
    }
  });
});

/* ------------------------------------------------------------------ */
/*  BL-0006: Timing-safe admin key comparison                        */
/* ------------------------------------------------------------------ */

describe('BL-0006: safeCompareAdminKey', () => {
  it('returns true for matching keys', () => {
    expect(safeCompareAdminKey('my-secret-key', 'my-secret-key')).toBe(true);
  });

  it('returns false for mismatched keys', () => {
    expect(safeCompareAdminKey('my-secret-key', 'wrong-key')).toBe(false);
  });

  it('returns false when provided key is empty', () => {
    expect(safeCompareAdminKey('', 'expected-key')).toBe(false);
  });

  it('returns false when expected key is empty', () => {
    expect(safeCompareAdminKey('provided-key', '')).toBe(false);
  });

  it('returns false when both keys are empty', () => {
    expect(safeCompareAdminKey('', '')).toBe(false);
  });

  it('returns true for long identical keys', () => {
    const key = 'a'.repeat(256);
    expect(safeCompareAdminKey(key, key)).toBe(true);
  });

  it('returns false for keys differing by one character', () => {
    expect(safeCompareAdminKey('abcdef12345', 'abcdef12346')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  BL-0008: LIKE wildcard escaping                                  */
/* ------------------------------------------------------------------ */

describe('BL-0008: escapeLikeWildcards', () => {
  it('escapes percent sign', () => {
    expect(escapeLikeWildcards('100%')).toBe('100\\%');
  });

  it('escapes underscore', () => {
    expect(escapeLikeWildcards('some_value')).toBe('some\\_value');
  });

  it('escapes backslash', () => {
    expect(escapeLikeWildcards('path\\to')).toBe('path\\\\to');
  });

  it('escapes multiple wildcards in one string', () => {
    expect(escapeLikeWildcards('%_test_%')).toBe('\\%\\_test\\_\\%');
  });

  it('returns normal strings unchanged', () => {
    expect(escapeLikeWildcards('hello world')).toBe('hello world');
  });

  it('returns empty string unchanged', () => {
    expect(escapeLikeWildcards('')).toBe('');
  });

  it('handles string with only wildcards', () => {
    expect(escapeLikeWildcards('%%__')).toBe('\\%\\%\\_\\_');
  });
});

/* ------------------------------------------------------------------ */
/*  BL-0070: FZZ ZIP bomb protection                                 */
/* ------------------------------------------------------------------ */

describe('BL-0070: FZZ ZIP bomb protection', () => {
  it('rejects archive with too many files (>100)', async () => {
    const zip = new JSZip();
    for (let i = 0; i < 101; i++) {
      zip.file(
        `part.${String(i)}.fzp`,
        `<module moduleId="mod-${String(i)}"><title>Part ${String(i)}</title></module>`,
      );
    }
    const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));

    await expect(importFzz(buffer)).rejects.toThrow(/too many entries.*101.*max 100/);
  });

  it('allows archive with exactly 100 files', async () => {
    const zip = new JSZip();
    for (let i = 0; i < 100; i++) {
      zip.file(
        `part.${String(i)}.fzp`,
        `<module moduleId="mod-${String(i)}"><title>Part ${String(i)}</title></module>`,
      );
    }
    const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));

    // May fail on XML parsing, but must NOT fail on "too many entries"
    try {
      await importFzz(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain('too many entries');
    }
  });

  it('rejects archive with oversized uncompressed content', async () => {
    const zip = new JSZip();
    // Create multiple .fzp files whose combined size exceeds 50MB
    // Each file is ~6MB, 9 files = ~54MB total > 50MB limit
    const chunkContent = 'x'.repeat(6 * 1024 * 1024);
    for (let i = 0; i < 9; i++) {
      zip.file(`big-${String(i)}.fzp`, chunkContent);
    }
    const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

    await expect(importFzz(buffer)).rejects.toThrow(/uncompressed content too large/);
  }, 60_000);
});

/* ------------------------------------------------------------------ */
/*  E2E-312/313: /api/parts/browse/* public & user-agnostic           */
/* ------------------------------------------------------------------ */

describe('E2E-312/313: /api/parts/browse/* allowlist + user-agnostic response', () => {
  it('PUBLIC_API_PATHS includes /api/parts/browse/', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const routingSource = await fs.readFile(path.resolve(__dirname, '..', 'request-routing.ts'), 'utf-8');
    const publicPathsMatch = routingSource.match(/const PUBLIC_API_PATHS\s*=\s*\[([\s\S]+?)\]/);
    expect(publicPathsMatch).not.toBeNull();
    const publicPathsContent = publicPathsMatch![1];
    expect(publicPathsContent).toContain('/api/parts/browse/');
  });

  it('browse handlers do NOT reference req.userId, req.session, or req.user', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const partsRouteSource = await fs.readFile(path.resolve(__dirname, '..', 'routes', 'parts.ts'), 'utf-8');

    // Extract just the two browse handler bodies (from the comment to the next blank-line-separated route)
    const altMatch = partsRouteSource.match(
      /\/\/ GET \/api\/parts\/browse\/alternates[\s\S]+?app\.get\(['"]\/api\/parts\/browse\/alternates['"][\s\S]+?\n  \}\);/,
    );
    const usageMatch = partsRouteSource.match(
      /\/\/ GET \/api\/parts\/browse\/usage[\s\S]+?app\.get\(['"]\/api\/parts\/browse\/usage['"][\s\S]+?\n  \}\);/,
    );
    expect(altMatch, 'browse/alternates handler should be findable').not.toBeNull();
    expect(usageMatch, 'browse/usage handler should be findable').not.toBeNull();

    for (const handler of [altMatch![0], usageMatch![0]]) {
      expect(handler).not.toMatch(/\breq\.userId\b/);
      expect(handler).not.toMatch(/\breq\.session\b/);
      expect(handler).not.toMatch(/\breq\.user\b/);
      expect(handler).not.toMatch(/requireAuth|validateSession|requireProjectOwnership/);
    }
  });

  it('browse endpoints return 200 without a session and do NOT expose userId/ownerSecret (E2E-312/313)', async () => {
    // Integration-style: mount the parts routes on a bare Express app (no auth middleware)
    // and verify response shapes. We mock the storage layer to control the response.
    //
    // NOTE: This test lives in a file that already mocks ../db and ../logger at module
    // scope (see top). That's fine — we only add mocks for ../storage and ../auth via
    // dynamic import of the parts router below, using vi.doMock before import.

    vi.resetModules();

    vi.doMock('../db', () => ({ db: {}, pool: {}, checkConnection: vi.fn() }));
    vi.doMock('../logger', () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock('../metrics', () => ({ getMetrics: vi.fn().mockReturnValue({}) }));
    vi.doMock('../auth', () => ({
      validateSession: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock('../parts-ingress', () => ({
      ingressPart: vi.fn(),
      mirrorIngressBestEffort: vi.fn(),
    }));
    vi.doMock('../env', () => ({ featureFlags: { partsCatalogV2: false } }));

    const samplePart = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'resistor-10k',
      title: '10k Resistor',
      manufacturer: 'Yageo',
      mpn: 'RC0603FR-0710KL',
      canonicalCategory: 'resistor',
      authorUserId: 7,
      isPublic: true,
    };

    vi.doMock('../storage', () => ({
      partsStorage: {
        listPartsWithAlternates: vi.fn().mockResolvedValue([{ part: samplePart, alternateCount: 2 }]),
        listPartsUsageSummary: vi
          .fn()
          .mockResolvedValue([{ part: samplePart, projectCount: 3, totalQuantityNeeded: 15, totalPlacements: 4 }]),
      },
      storage: {},
      StorageError: class StorageError extends Error {},
      VersionConflictError: class VersionConflictError extends Error {},
    }));

    const express = (await import('express')).default;
    const { registerPartsRoutes } = await import('../routes/parts');

    const app = express();
    app.use(express.json());
    registerPartsRoutes(app);

    const server = await new Promise<{ url: string; close: () => void }>((resolve) => {
      const s = app.listen(0, () => {
        const addr = s.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve({ url: `http://127.0.0.1:${port}`, close: () => s.close() });
      });
    });

    try {
      for (const route of ['/api/parts/browse/alternates', '/api/parts/browse/usage']) {
        const res = await fetch(`${server.url}${route}`);
        expect(res.status, `${route} should return 200 without session`).toBe(200);
        const body = await res.json();
        const rows = body.data ?? body ?? [];
        expect(Array.isArray(rows)).toBe(true);

        // Top-level envelope must not expose user-scoped fields.
        expect(body).not.toHaveProperty('userId');
        expect(body).not.toHaveProperty('ownerSecret');

        // Rows must not expose userId/ownerSecret at top level (authorUserId on nested
        // `part` is acceptable — it's public-library author attribution, not a session token).
        for (const entry of rows) {
          expect(entry).not.toHaveProperty('userId');
          expect(entry).not.toHaveProperty('ownerSecret');
        }
      }
    } finally {
      server.close();
      vi.resetModules();
    }
  });
});
