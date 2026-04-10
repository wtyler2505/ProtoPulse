import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('breadboard-animations.css', () => {
  let css: string;

  beforeAll(() => {
    css = readFileSync(
      resolve(__dirname, '..', 'breadboard-animations.css'),
      'utf-8',
    );
  });

  describe('keyframes', () => {
    it('defines breadboard-snap-pulse keyframe', () => {
      expect(css).toContain('@keyframes breadboard-snap-pulse');
    });

    it('defines breadboard-row-flash keyframe', () => {
      expect(css).toContain('@keyframes breadboard-row-flash');
    });

    it('snap-pulse uses scale transform', () => {
      expect(css).toContain('scale(');
    });

    it('snap-pulse uses brightness filter', () => {
      expect(css).toContain('brightness(');
    });

    it('row-flash uses opacity', () => {
      expect(css).toMatch(/opacity:\s*0/);
    });
  });

  describe('utility classes', () => {
    it('defines .bb-snap-pulse class', () => {
      expect(css).toContain('.bb-snap-pulse');
    });

    it('defines .bb-row-flash class', () => {
      expect(css).toContain('.bb-row-flash');
    });

    it('snap-pulse animation is 120ms', () => {
      expect(css).toMatch(/breadboard-snap-pulse\s+120ms/);
    });

    it('row-flash animation is 200ms', () => {
      expect(css).toMatch(/breadboard-row-flash\s+200ms/);
    });
  });

  describe('accessibility', () => {
    it('respects prefers-reduced-motion', () => {
      expect(css).toContain('prefers-reduced-motion: reduce');
    });

    it('disables animations under reduced motion', () => {
      // Should set animation: none for both classes
      const reducedMotionBlock = css.slice(css.indexOf('prefers-reduced-motion'));
      expect(reducedMotionBlock).toContain('animation: none');
    });
  });

  describe('additional classes', () => {
    it('defines .bb-cursor-blink for keyboard cursor', () => {
      expect(css).toContain('.bb-cursor-blink');
    });

    it('defines .bb-wire-draw for wire drawing feedback', () => {
      expect(css).toContain('.bb-wire-draw');
    });
  });
});
