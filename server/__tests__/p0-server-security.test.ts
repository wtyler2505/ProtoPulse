/**
 * P0 Server Security Tests (Wave 52)
 *
 * Covers:
 * - BL-0002: /api/seed removed from PUBLIC_PATHS bypass
 * - BL-0006: Timing-safe admin key comparison
 * - BL-0008: LIKE wildcard escaping
 * - BL-0070: FZZ ZIP bomb protection
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
    const indexSource = await fs.readFile(
      path.resolve(__dirname, '..', 'index.ts'),
      'utf-8',
    );

    // The PUBLIC_PATHS array should not contain seed-related paths
    const publicPathsMatch = indexSource.match(/const PUBLIC_PATHS\s*=\s*\[([^\]]+)\]/);
    expect(publicPathsMatch).not.toBeNull();
    const publicPathsContent = publicPathsMatch![1];
    expect(publicPathsContent).not.toContain('seed');

    // The auth bypass condition should not mention /api/seed
    const authBypassLines = indexSource
      .split('\n')
      .filter((line) => line.includes('PUBLIC_PATHS') && line.includes('req.path'));
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
      zip.file(`part.${String(i)}.fzp`, `<module moduleId="mod-${String(i)}"><title>Part ${String(i)}</title></module>`);
    }
    const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));

    await expect(importFzz(buffer)).rejects.toThrow(/too many entries.*101.*max 100/);
  });

  it('allows archive with exactly 100 files', async () => {
    const zip = new JSZip();
    for (let i = 0; i < 100; i++) {
      zip.file(`part.${String(i)}.fzp`, `<module moduleId="mod-${String(i)}"><title>Part ${String(i)}</title></module>`);
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
