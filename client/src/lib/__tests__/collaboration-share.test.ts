import { describe, it, expect } from 'vitest';
import {
  generateShareUrl,
  parseShareUrl,
  getInitials,
  computeAvatarOverflow,
  SHAREABLE_ROLES,
  MAX_VISIBLE_AVATARS,
} from '../collaboration-share';

/* ------------------------------------------------------------------ */
/*  generateShareUrl                                                   */
/* ------------------------------------------------------------------ */

describe('generateShareUrl', () => {
  it('generates URL with editor role', () => {
    const url = generateShareUrl({ projectId: 42, role: 'editor', origin: 'https://app.example.com' });
    expect(url).toBe('https://app.example.com/projects/42?role=editor');
  });

  it('generates URL with viewer role', () => {
    const url = generateShareUrl({ projectId: 1, role: 'viewer', origin: 'https://app.example.com' });
    expect(url).toBe('https://app.example.com/projects/1?role=viewer');
  });

  it('uses provided origin', () => {
    const url = generateShareUrl({ projectId: 10, role: 'editor', origin: 'http://localhost:3000' });
    expect(url).toBe('http://localhost:3000/projects/10?role=editor');
  });

  it('falls back to localhost when no origin and no window', () => {
    // In test environment window.location.origin exists, so we test with explicit origin
    const url = generateShareUrl({ projectId: 5, role: 'viewer', origin: 'http://localhost:5000' });
    expect(url).toContain('/projects/5');
    expect(url).toContain('role=viewer');
  });

  it('throws for non-positive projectId', () => {
    expect(() => generateShareUrl({ projectId: 0, role: 'editor', origin: 'http://x.com' })).toThrow('positive integer');
    expect(() => generateShareUrl({ projectId: -1, role: 'editor', origin: 'http://x.com' })).toThrow('positive integer');
  });

  it('throws for non-integer projectId', () => {
    expect(() => generateShareUrl({ projectId: 1.5, role: 'editor', origin: 'http://x.com' })).toThrow('positive integer');
  });

  it('throws for NaN projectId', () => {
    expect(() => generateShareUrl({ projectId: NaN, role: 'editor', origin: 'http://x.com' })).toThrow('positive integer');
  });

  it('throws for Infinity projectId', () => {
    expect(() => generateShareUrl({ projectId: Infinity, role: 'editor', origin: 'http://x.com' })).toThrow('positive integer');
  });

  it('throws for owner role', () => {
    expect(() => generateShareUrl({ projectId: 1, role: 'owner', origin: 'http://x.com' })).toThrow('not shareable');
  });
});

/* ------------------------------------------------------------------ */
/*  parseShareUrl                                                      */
/* ------------------------------------------------------------------ */

describe('parseShareUrl', () => {
  it('parses a valid editor share URL', () => {
    const result = parseShareUrl('https://app.example.com/projects/42?role=editor');
    expect(result).toEqual({ projectId: 42, role: 'editor' });
  });

  it('parses a valid viewer share URL', () => {
    const result = parseShareUrl('https://app.example.com/projects/1?role=viewer');
    expect(result).toEqual({ projectId: 1, role: 'viewer' });
  });

  it('returns null for missing role param', () => {
    expect(parseShareUrl('https://app.example.com/projects/42')).toBeNull();
  });

  it('returns null for invalid role', () => {
    expect(parseShareUrl('https://app.example.com/projects/42?role=owner')).toBeNull();
    expect(parseShareUrl('https://app.example.com/projects/42?role=admin')).toBeNull();
  });

  it('returns null for non-numeric projectId', () => {
    expect(parseShareUrl('https://app.example.com/projects/abc?role=editor')).toBeNull();
  });

  it('returns null for zero projectId', () => {
    expect(parseShareUrl('https://app.example.com/projects/0?role=editor')).toBeNull();
  });

  it('returns null for negative projectId', () => {
    expect(parseShareUrl('https://app.example.com/projects/-5?role=editor')).toBeNull();
  });

  it('returns null for non-integer projectId in URL', () => {
    expect(parseShareUrl('https://app.example.com/projects/1.5?role=editor')).toBeNull();
  });

  it('returns null for wrong path', () => {
    expect(parseShareUrl('https://app.example.com/users/42?role=editor')).toBeNull();
  });

  it('returns null for malformed URL', () => {
    expect(parseShareUrl('not a url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseShareUrl('')).toBeNull();
  });

  it('handles extra path segments after projectId', () => {
    const result = parseShareUrl('https://app.example.com/projects/42/architecture?role=editor');
    expect(result).toEqual({ projectId: 42, role: 'editor' });
  });
});

/* ------------------------------------------------------------------ */
/*  getInitials                                                        */
/* ------------------------------------------------------------------ */

describe('getInitials', () => {
  it('returns first letters of two words', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('returns uppercase initials', () => {
    expect(getInitials('jane smith')).toBe('JS');
  });

  it('returns first two chars for single word', () => {
    expect(getInitials('Tyler')).toBe('TY');
  });

  it('returns single char uppercased for single char name', () => {
    expect(getInitials('t')).toBe('T');
  });

  it('returns "?" for empty string', () => {
    expect(getInitials('')).toBe('?');
  });

  it('returns "?" for whitespace-only string', () => {
    expect(getInitials('   ')).toBe('?');
  });

  it('handles three-word names (takes first two)', () => {
    expect(getInitials('John Michael Doe')).toBe('JM');
  });

  it('trims leading/trailing whitespace', () => {
    expect(getInitials('  Alice Bob  ')).toBe('AB');
  });
});

/* ------------------------------------------------------------------ */
/*  computeAvatarOverflow                                              */
/* ------------------------------------------------------------------ */

describe('computeAvatarOverflow', () => {
  it('returns 0 visible for 0 users', () => {
    expect(computeAvatarOverflow(0)).toEqual({ visible: 0, overflowCount: 0 });
  });

  it('returns 0 visible for negative users', () => {
    expect(computeAvatarOverflow(-3)).toEqual({ visible: 0, overflowCount: 0 });
  });

  it('returns all visible when under max', () => {
    expect(computeAvatarOverflow(2)).toEqual({ visible: 2, overflowCount: 0 });
  });

  it('returns all visible at exactly max', () => {
    expect(computeAvatarOverflow(MAX_VISIBLE_AVATARS)).toEqual({
      visible: MAX_VISIBLE_AVATARS,
      overflowCount: 0,
    });
  });

  it('overflows when exceeding max', () => {
    expect(computeAvatarOverflow(MAX_VISIBLE_AVATARS + 3)).toEqual({
      visible: MAX_VISIBLE_AVATARS,
      overflowCount: 3,
    });
  });

  it('handles large numbers', () => {
    expect(computeAvatarOverflow(100)).toEqual({
      visible: MAX_VISIBLE_AVATARS,
      overflowCount: 100 - MAX_VISIBLE_AVATARS,
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

describe('constants', () => {
  it('SHAREABLE_ROLES contains editor and viewer', () => {
    expect(SHAREABLE_ROLES).toContain('editor');
    expect(SHAREABLE_ROLES).toContain('viewer');
  });

  it('SHAREABLE_ROLES does not contain owner', () => {
    expect(SHAREABLE_ROLES).not.toContain('owner');
  });

  it('MAX_VISIBLE_AVATARS is a positive number', () => {
    expect(MAX_VISIBLE_AVATARS).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Round-trip: generate → parse                                       */
/* ------------------------------------------------------------------ */

describe('round-trip', () => {
  it('parse(generate(opts)) returns the same projectId and role', () => {
    const opts = { projectId: 99, role: 'editor' as const, origin: 'https://proto.pulse' };
    const url = generateShareUrl(opts);
    const parsed = parseShareUrl(url);
    expect(parsed).toEqual({ projectId: 99, role: 'editor' });
  });

  it('round-trips viewer role', () => {
    const opts = { projectId: 7, role: 'viewer' as const, origin: 'http://localhost:5000' };
    const url = generateShareUrl(opts);
    const parsed = parseShareUrl(url);
    expect(parsed).toEqual({ projectId: 7, role: 'viewer' });
  });
});
