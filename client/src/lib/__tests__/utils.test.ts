import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn (classname utility)', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes (falsy values filtered)', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('handles undefined and null inputs', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end');
  });

  it('handles empty string', () => {
    expect(cn('')).toBe('');
  });

  it('merges Tailwind classes (twMerge deduplication)', () => {
    // twMerge should deduplicate conflicting Tailwind classes
    const result = cn('px-4 py-2', 'px-8');
    expect(result).toBe('py-2 px-8');
  });

  it('handles array input via clsx', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('handles object input via clsx', () => {
    expect(cn({ active: true, disabled: false })).toBe('active');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });
});
