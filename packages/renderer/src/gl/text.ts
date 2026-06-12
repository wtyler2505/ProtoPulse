import { sdfFromAlpha } from '../sdf.js';

/**
 * SDF glyph atlas (ADR-0015, supersedes the M1 canvas-alpha atlas).
 * ASCII 32..126 rendered once at high resolution into an offscreen
 * canvas, converted per cell to a signed distance field (../sdf.ts),
 * uploaded as a single-channel R8 texture; the renderer's smoothstep
 * shader reconstructs a crisp edge at any zoom. Single-channel SDF —
 * corners round by ≤1 source pixel at extreme magnification.
 */

export interface Glyph {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Advance as a fraction of the em height. */
  advance: number;
  /** Cell width as a fraction of the em height. */
  width: number;
}

const FIRST_CHAR = 32;
const LAST_CHAR = 126;
const FONT_PX = 48;
/** Ink padding inside each cell — keeps the distance field from clipping. */
const PAD = 8;
/** SDF spread in source pixels (≤ PAD so fields stay inside their cell). */
const SPREAD = 8;
const CELL_W = 64;
const CELL_H = 72;
/** Baseline sits here so ascenders and descenders both fit the field. */
const BASELINE = 52;
const COLS = 12;

export class GlyphAtlas {
  private texture: WebGLTexture | null = null;
  private glyphs = new Map<string, Glyph>();
  private fallback: Glyph | null = null;

  /** Lazily rasterize + transform + upload. False when unavailable (no DOM). */
  ensure(gl: WebGL2RenderingContext): boolean {
    if (this.texture) return true;
    if (typeof document === 'undefined') return false;

    const count = LAST_CHAR - FIRST_CHAR + 1;
    const rows = Math.ceil(count / COLS);
    const canvas = document.createElement('canvas');
    canvas.width = COLS * CELL_W;
    canvas.height = rows * CELL_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${String(FONT_PX)}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';

    for (let i = 0; i < count; i++) {
      const ch = String.fromCharCode(FIRST_CHAR + i);
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = col * CELL_W;
      const y = row * CELL_H + BASELINE;
      ctx.fillText(ch, x + PAD, y);
      const advancePx = ctx.measureText(ch).width;
      this.glyphs.set(ch, {
        u0: x / canvas.width,
        v0: (row * CELL_H) / canvas.height,
        u1: (x + CELL_W) / canvas.width,
        v1: (row * CELL_H + CELL_H) / canvas.height,
        // Slight tracking (+3px) matches the pre-SDF atlas's spacing.
        advance: (advancePx + 3) / FONT_PX,
        width: CELL_W / FONT_PX,
      });
    }
    this.fallback = this.glyphs.get('?') ?? null;

    // Coverage → per-cell distance fields (cells are independent so a
    // wide neighbor can never bleed distance across a cell border).
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const sdf = new Uint8Array(canvas.width * canvas.height);
    const cellAlpha = new Uint8Array(CELL_W * CELL_H);
    for (let i = 0; i < count; i++) {
      const cx = (i % COLS) * CELL_W;
      const cy = Math.floor(i / COLS) * CELL_H;
      for (let yy = 0; yy < CELL_H; yy++) {
        for (let xx = 0; xx < CELL_W; xx++) {
          cellAlpha[yy * CELL_W + xx] =
            image.data[((cy + yy) * canvas.width + cx + xx) * 4 + 3] ?? 0;
        }
      }
      const cellSdf = sdfFromAlpha(cellAlpha, CELL_W, CELL_H, SPREAD);
      for (let yy = 0; yy < CELL_H; yy++) {
        for (let xx = 0; xx < CELL_W; xx++) {
          sdf[(cy + yy) * canvas.width + cx + xx] = cellSdf[yy * CELL_W + xx] ?? 0;
        }
      }
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      canvas.width,
      canvas.height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      sdf,
    );
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.texture = tex;
    return true;
  }

  bind(gl: WebGL2RenderingContext, unit = 0): void {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
  }

  glyph(ch: string): Glyph | null {
    return this.glyphs.get(ch) ?? this.fallback;
  }

  /** Sum of advances for a run, in mm at the given size. */
  measure(text: string, sizeMm: number): number {
    let w = 0;
    for (const ch of text) {
      const g = this.glyph(ch);
      if (g) w += sizeMm * g.advance;
    }
    return w;
  }

  /**
   * Emit textured-quad vertices for one text run anchored at (xMm, yMm)
   * world-mm, glyph height `sizeMm`. Layout: [x, y, u, v] × 6 per glyph.
   * The cell's full height maps onto the quad; glyphs stay upright.
   */
  appendRun(
    out: number[],
    text: string,
    xMm: number,
    yMm: number,
    sizeMm: number,
    align: 'left' | 'center' = 'left',
  ): void {
    // Ink starts PAD px into each cell — shift the pen left to cancel it
    // so the anchor (and centering) refer to the visible glyphs.
    const inkOffset = sizeMm * (PAD / FONT_PX);
    let penX =
      (align === 'center' ? xMm - this.measure(text, sizeMm) / 2 : xMm) - inkOffset;
    const h = sizeMm * (CELL_H / FONT_PX);
    // Place the baseline (BASELINE px from the cell top) ≈5% of the em
    // above the anchor — same visual seat as the pre-SDF atlas.
    const yBottom = yMm - sizeMm * ((CELL_H - BASELINE) / FONT_PX - 0.05);
    for (const ch of text) {
      const g = this.glyph(ch);
      if (!g) continue;
      const w = sizeMm * g.width;
      const x0 = penX;
      const x1 = penX + w;
      const y0 = yBottom;
      const y1 = yBottom + h;
      // Two triangles; v flipped (canvas Y-down → world Y-up).
      out.push(
        x0, y0, g.u0, g.v1,
        x1, y0, g.u1, g.v1,
        x1, y1, g.u1, g.v0,
        x0, y0, g.u0, g.v1,
        x1, y1, g.u1, g.v0,
        x0, y1, g.u0, g.v0,
      );
      penX += sizeMm * g.advance;
    }
  }
}
