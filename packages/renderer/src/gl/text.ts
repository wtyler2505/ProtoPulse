/**
 * Canvas-2D-rasterized glyph atlas (honest M1 cut — no MSDF). ASCII
 * 32..126 rendered once at a single font size into an offscreen canvas,
 * uploaded as a texture; text draws as textured quads scaled to size.
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
const FONT_PX = 32;
const CELL_W = 40;
const CELL_H = 44;
const COLS = 12;

export class GlyphAtlas {
  private texture: WebGLTexture | null = null;
  private glyphs = new Map<string, Glyph>();
  private fallback: Glyph | null = null;

  /** Lazily rasterize + upload. Returns false when unavailable (no DOM). */
  ensure(gl: WebGL2RenderingContext): boolean {
    if (this.texture) return true;
    if (typeof document === 'undefined') return false;

    const count = LAST_CHAR - FIRST_CHAR + 1;
    const rows = Math.ceil(count / COLS);
    const canvas = document.createElement('canvas');
    canvas.width = COLS * CELL_W;
    canvas.height = rows * CELL_H;
    const ctx = canvas.getContext('2d');
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
      // Baseline sits ~80% down the cell so descenders fit.
      const y = row * CELL_H + Math.round(CELL_H * 0.78);
      ctx.fillText(ch, x + 2, y);
      const advancePx = ctx.measureText(ch).width;
      this.glyphs.set(ch, {
        u0: x / canvas.width,
        v0: (row * CELL_H) / canvas.height,
        u1: (x + CELL_W) / canvas.width,
        v1: (row * CELL_H + CELL_H) / canvas.height,
        advance: (advancePx + 2) / FONT_PX,
        width: CELL_W / FONT_PX,
      });
    }
    this.fallback = this.glyphs.get('?') ?? null;

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
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

  /**
   * Emit textured-quad vertices for one text run anchored at (xMm, yMm)
   * world-mm, glyph height `sizeMm`. Layout: [x, y, u, v] × 6 per glyph.
   * The cell's full height maps onto sizeMm; glyphs stay upright.
   */
  appendRun(out: number[], text: string, xMm: number, yMm: number, sizeMm: number): void {
    let penX = xMm;
    const h = sizeMm * (CELL_H / FONT_PX);
    const yBottom = yMm - sizeMm * 0.25; // descender room below the anchor
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
