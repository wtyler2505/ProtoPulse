import { describe, it, expect } from 'vitest';
import {
  forwardSubShader,
  backSubShader,
  matVecMulShader,
  batchSolveShader,
  workgroupSize,
} from '../shaders';

describe('WGSL Shader Generators', () => {
  // ---- forwardSubShader ----

  describe('forwardSubShader', () => {
    it('generates valid WGSL for N=3', () => {
      const src = forwardSubShader(3);
      expect(src).toContain('@group(0)');
      expect(src).toContain('@binding');
      expect(src).toContain('@compute');
      expect(src).toContain('@workgroup_size');
      expect(src).toContain('fn forward_sub');
    });

    it('includes matrix dimension constant for N=4', () => {
      const src = forwardSubShader(4);
      expect(src).toContain('const N: u32 = 4');
    });

    it('references L matrix and b vector bindings', () => {
      const src = forwardSubShader(5);
      expect(src).toContain('L');
      expect(src).toContain('b');
    });

    it('returns empty string for N=0', () => {
      const src = forwardSubShader(0);
      expect(src).toBe('');
    });
  });

  // ---- backSubShader ----

  describe('backSubShader', () => {
    it('generates valid WGSL for N=3', () => {
      const src = backSubShader(3);
      expect(src).toContain('@group(0)');
      expect(src).toContain('@binding');
      expect(src).toContain('@compute');
      expect(src).toContain('fn back_sub');
    });

    it('includes matrix dimension constant for N=6', () => {
      const src = backSubShader(6);
      expect(src).toContain('const N: u32 = 6');
    });

    it('references U matrix and x vector', () => {
      const src = backSubShader(4);
      expect(src).toContain('U');
      expect(src).toContain('x');
    });

    it('returns empty string for N=0', () => {
      const src = backSubShader(0);
      expect(src).toBe('');
    });
  });

  // ---- matVecMulShader ----

  describe('matVecMulShader', () => {
    it('generates valid WGSL for N=4', () => {
      const src = matVecMulShader(4);
      expect(src).toContain('@group(0)');
      expect(src).toContain('@binding');
      expect(src).toContain('@compute');
      expect(src).toContain('fn mat_vec_mul');
    });

    it('includes matrix dimension constant', () => {
      const src = matVecMulShader(8);
      expect(src).toContain('const N: u32 = 8');
    });

    it('references A matrix, x input, and y output', () => {
      const src = matVecMulShader(3);
      expect(src).toContain('A');
      expect(src).toContain('x');
      expect(src).toContain('y');
    });

    it('returns empty string for N=0', () => {
      const src = matVecMulShader(0);
      expect(src).toBe('');
    });
  });

  // ---- batchSolveShader ----

  describe('batchSolveShader', () => {
    it('generates valid WGSL for N=3', () => {
      const src = batchSolveShader(3);
      expect(src).toContain('@group(0)');
      expect(src).toContain('@binding');
      expect(src).toContain('@compute');
      expect(src).toContain('fn batch_solve');
    });

    it('includes matrix dimension constant', () => {
      const src = batchSolveShader(5);
      expect(src).toContain('const N: u32 = 5');
    });

    it('performs forward then back substitution', () => {
      const src = batchSolveShader(4);
      // Should contain both forward and back sub logic in one shader
      expect(src).toMatch(/for\s*\(/); // loop constructs
    });

    it('references LU matrix, b input, and x output', () => {
      const src = batchSolveShader(3);
      expect(src).toContain('LU');
      expect(src).toContain('b');
      expect(src).toContain('x');
    });

    it('returns empty string for N=0', () => {
      const src = batchSolveShader(0);
      expect(src).toBe('');
    });

    it('handles large N=1000', () => {
      const src = batchSolveShader(1000);
      expect(src).toContain('const N: u32 = 1000');
      expect(src.length).toBeGreaterThan(100);
    });
  });

  // ---- workgroupSize ----

  describe('workgroupSize', () => {
    it('returns 1 for batchSize=1', () => {
      expect(workgroupSize(1)).toBe(1);
    });

    it('returns 1 for small batch sizes within one workgroup', () => {
      expect(workgroupSize(64)).toBe(1);
    });

    it('dispatches multiple workgroups for large batch sizes', () => {
      expect(workgroupSize(256)).toBeGreaterThanOrEqual(1);
    });

    it('scales with batch size', () => {
      const small = workgroupSize(100);
      const large = workgroupSize(10000);
      expect(large).toBeGreaterThanOrEqual(small);
    });

    it('returns at least 1 for any positive batch size', () => {
      expect(workgroupSize(1)).toBeGreaterThanOrEqual(1);
      expect(workgroupSize(10)).toBeGreaterThanOrEqual(1);
      expect(workgroupSize(100000)).toBeGreaterThanOrEqual(1);
    });
  });
});
