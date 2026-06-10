/**
 * Minimal local typings for gifenc@1.0.3 (ships none). Only the surface
 * gif.ts uses; signatures verified against node_modules/gifenc/src.
 */
declare module 'gifenc' {
  export type Rgb = [number, number, number];

  export interface WriteFrameOpts {
    /** Per-frame palette; on the FIRST frame it becomes the global color table. */
    palette?: Rgb[];
    /** Delay in milliseconds (encoder rounds to 10 ms GIF ticks). */
    delay?: number;
    /** Loop count, first frame only: -1 = play once, 0 = forever. */
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
    /** GIF disposal method; 1 = leave previous frame in place. */
    dispose?: number;
  }

  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: WriteFrameOpts): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): Encoder;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): Rgb[];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Rgb[],
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array;

  // The CJS bundle is consumed via default import under Node ESM.
  const gifenc: {
    GIFEncoder: typeof GIFEncoder;
    quantize: typeof quantize;
    applyPalette: typeof applyPalette;
  };
  export default gifenc;
}
