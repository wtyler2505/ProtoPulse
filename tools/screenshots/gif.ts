/**
 * PNG frames → looping GIF, no native tools (the box has no ffmpeg).
 *
 * Size strategy: one global 255-color palette quantized from pixels
 * sampled across ALL frames, plus inter-frame diffing — any pixel
 * byte-identical to the previous frame is written as the reserved
 * transparent index with disposal "keep previous", so a frame costs
 * only the pixels that actually changed. On a mostly-static editor UI
 * that collapses tab-panel animations to a fraction of full frames.
 */

// gifenc's main is a CJS bundle without static named exports — default-
// import the namespace and destructure.
import gifenc from 'gifenc';
import { PNG } from 'pngjs';

const { GIFEncoder, applyPalette, quantize } = gifenc;

export interface GifFrame {
  /** PNG-encoded screenshot, all frames the same dimensions. */
  png: Buffer;
  /** How long this frame holds on screen, in milliseconds. */
  delayMs: number;
}

/** Browsers snap tiny GIF delays up to ~100 ms; never go below this. */
const MIN_DELAY_MS = 40;

/** Pixel sample budget for building the global palette. */
const PALETTE_SAMPLE_PX = 400_000;

export function encodeGif(frames: GifFrame[]): Uint8Array {
  const decoded = frames.map((f) => PNG.sync.read(f.png));
  const first = decoded[0];
  if (!first) throw new Error('encodeGif: no frames');
  const { width, height } = first;
  for (const img of decoded) {
    if (img.width !== width || img.height !== height) {
      throw new Error(`encodeGif: frame size mismatch (${img.width}x${img.height} vs ${width}x${height})`);
    }
  }

  // Global palette from a uniform sample across every frame. 255 colors —
  // index 255 is reserved for "unchanged since last frame". The sentinel
  // is appended AFTER applyPalette runs so no real pixel (this UI is
  // mostly near-black) can ever land on the transparent slot.
  const totalPx = decoded.length * width * height;
  const stride = Math.max(1, Math.ceil(totalPx / PALETTE_SAMPLE_PX));
  const samples: number[] = [];
  for (const img of decoded) {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4 * stride) {
      samples.push(d[i], d[i + 1], d[i + 2], 255);
    }
  }
  const palette = quantize(new Uint8Array(samples), 255);
  const transparentIndex = palette.length; // appended below
  const writtenPalette = [...palette, [0, 0, 0] as [number, number, number]];

  const gif = GIFEncoder();
  let prev: Uint8Array | null = null;
  decoded.forEach((img, n) => {
    const index = applyPalette(img.data, palette);
    if (prev) {
      const d = img.data;
      for (let p = 0, i = 0; i < d.length; i += 4, p++) {
        if (d[i] === prev[i] && d[i + 1] === prev[i + 1] && d[i + 2] === prev[i + 2]) {
          index[p] = transparentIndex;
        }
      }
    }
    gif.writeFrame(index, width, height, {
      // Palette only on the first frame → one global color table.
      ...(n === 0 ? { palette: writtenPalette, repeat: 0 } : {}),
      delay: Math.max(MIN_DELAY_MS, frames[n]?.delayMs ?? MIN_DELAY_MS),
      transparent: n > 0,
      transparentIndex,
      dispose: 1, // keep the previous frame under the transparent holes
    });
    prev = Uint8Array.from(img.data);
  });
  gif.finish();
  return gif.bytes();
}
