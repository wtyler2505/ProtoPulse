import { describe, expect, it } from 'vitest';
import { isSafeUrl, sanitizeUrl } from '../url-validation';

describe('isSafeUrl', () => {
  it('blocks javascript: protocol', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('blocks javascript:void(0)', () => {
    expect(isSafeUrl('javascript:void(0)')).toBe(false);
  });

  it('blocks case-insensitive JAVASCRIPT:', () => {
    expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
  });

  it('blocks mixed-case JaVaScRiPt:', () => {
    expect(isSafeUrl('JaVaScRiPt:alert(1)')).toBe(false);
  });

  it('blocks vbscript: protocol', () => {
    expect(isSafeUrl('vbscript:msgbox')).toBe(false);
  });

  it('blocks data: protocol', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('blocks javascript: with leading whitespace', () => {
    expect(isSafeUrl('  javascript:alert(1)')).toBe(false);
  });

  it('allows https:// URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
  });

  it('allows http:// URLs', () => {
    expect(isSafeUrl('http://localhost:3000')).toBe(true);
  });

  it('allows mailto: URLs', () => {
    expect(isSafeUrl('mailto:user@example.com')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isSafeUrl('')).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(isSafeUrl('   ')).toBe(false);
  });

  it('allows relative paths', () => {
    expect(isSafeUrl('/api/foo')).toBe(true);
  });

  it('allows relative paths without leading slash', () => {
    expect(isSafeUrl('some/path')).toBe(true);
  });

  it('blocks ftp: protocol', () => {
    expect(isSafeUrl('ftp://evil.com/malware')).toBe(false);
  });

  it('blocks file: protocol', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });
});

describe('sanitizeUrl', () => {
  it('returns the URL when safe', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('returns empty string for javascript: URL', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeUrl('')).toBe('');
  });

  it('returns relative paths unchanged', () => {
    expect(sanitizeUrl('/api/foo')).toBe('/api/foo');
  });
});
