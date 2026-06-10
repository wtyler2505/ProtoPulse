import { MM, SCHEMATIC_GRID } from '@protopulse/graph';

import { GlyphAtlas } from './text.js';

import type { Camera } from '../camera.js';
import type { RGBA, SceneGraph, SceneNode } from '../scene.js';

/**
 * Thin WebGL2 layer (not unit-tested — everything interesting lives in
 * the DOM-free modules). One flat-color shader (lines AND filled
 * triangles — same vertex layout, different primitive) + one
 * textured-quad shader for text.
 *
 * Coordinates upload as millimeter floats (nm / 1e6): f32 holds mm-scale
 * schematic coordinates exactly enough, while raw nm magnitudes (1e8+)
 * would chew through the mantissa.
 *
 * Per-node draw calls with a u_color uniform are fine at M1 scale: the
 * concatenated vertex buffers (one for lines, one for triangles) are
 * cached and rebuilt only when the scene version changes; draws then
 * index ranges of them. Triangles draw first so outlines stay legible
 * on top of fills; a node's holeTris draw right after its tris in the
 * board background color (drills punch through their own copper).
 */

export interface OverlayState {
  selection: Set<string>;
  highlight: Set<string>;
  diff?: Map<string, 'added' | 'removed' | 'changed'>;
  /** Per-node color override (lowest overlay priority) — e.g. the sim
   *  ghost tinting nets by their solved voltage. */
  tint?: Map<string, RGBA>;
  /** Tool preview geometry, world nm (x1,y1,x2,y2 …). */
  ghost?: { lines: Float32Array };
  /** Ratsnest geometry (pre-dashed CPU-side), world nm (x1,y1,x2,y2 …). */
  ratsnest?: { lines: Float32Array };
  gridVisible: boolean;
}

/** Canvas clear color — holeTris draw in it so drills read as board. */
const BACKGROUND: RGBA = [0.045, 0.055, 0.08, 1.0];

const COLORS = {
  grid: [0.16, 0.19, 0.24, 1.0] as RGBA,
  selection: [1.0, 0.85, 0.3, 1.0] as RGBA,
  highlight: [0.4, 0.95, 1.0, 1.0] as RGBA,
  diffAdded: [0.35, 0.95, 0.45, 1.0] as RGBA,
  diffRemoved: [1.0, 0.35, 0.35, 1.0] as RGBA,
  diffChanged: [1.0, 0.72, 0.25, 1.0] as RGBA,
  ghost: [0.75, 0.75, 0.85, 0.5] as RGBA,
  ratsnest: [0.62, 0.62, 0.68, 0.55] as RGBA,
  text: [0.78, 0.82, 0.9, 1.0] as RGBA,
};

const LINE_VS = `#version 300 es
in vec2 a_pos;
uniform mat3 u_transform;
void main() {
  vec3 p = u_transform * vec3(a_pos, 1.0);
  gl_Position = vec4(p.xy, 0.0, 1.0);
}`;

const LINE_FS = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 outColor;
void main() { outColor = u_color; }`;

const TEXT_VS = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
uniform mat3 u_transform;
out vec2 v_uv;
void main() {
  vec3 p = u_transform * vec3(a_pos, 1.0);
  v_uv = a_uv;
  gl_Position = vec4(p.xy, 0.0, 1.0);
}`;

const TEXT_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_atlas;
uniform vec4 u_color;
out vec4 outColor;
void main() {
  vec4 s = texture(u_atlas, v_uv);
  outColor = u_color * s;
}`;

interface NodeRange {
  /** First vertex (not float) in the concatenated line buffer. */
  first: number;
  count: number;
  /** First vertex in the concatenated triangle buffer (node color). */
  triFirst: number;
  triCount: number;
  /** First vertex of the node's hole triangles (background color). */
  holeFirst: number;
  holeCount: number;
  kind: SceneNode['kind'];
  color: RGBA;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader failed');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(shader) ?? 'unknown'}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('createProgram failed');
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(program) ?? 'unknown'}`);
  }
  return program;
}

const NM_TO_MM = 1 / MM;

export class WebGL2Renderer {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;

  private lineProgram: WebGLProgram | null = null;
  private lineTransformLoc: WebGLUniformLocation | null = null;
  private lineColorLoc: WebGLUniformLocation | null = null;
  private lineVao: WebGLVertexArrayObject | null = null;
  private lineVbo: WebGLBuffer | null = null;

  private triVao: WebGLVertexArrayObject | null = null;
  private triVbo: WebGLBuffer | null = null;

  private textProgram: WebGLProgram | null = null;
  private textTransformLoc: WebGLUniformLocation | null = null;
  private textColorLoc: WebGLUniformLocation | null = null;
  private textAtlasLoc: WebGLUniformLocation | null = null;
  private textVao: WebGLVertexArrayObject | null = null;
  private textVbo: WebGLBuffer | null = null;
  private textVertexCount = 0;

  private gridVao: WebGLVertexArrayObject | null = null;
  private gridVbo: WebGLBuffer | null = null;

  private ghostVao: WebGLVertexArrayObject | null = null;
  private ghostVbo: WebGLBuffer | null = null;

  private ratsnestVao: WebGLVertexArrayObject | null = null;
  private ratsnestVbo: WebGLBuffer | null = null;

  private atlas = new GlyphAtlas();
  private ranges = new Map<string, NodeRange>();
  private cachedSceneVersion = -1;
  private cssWidth = 1;
  private cssHeight = 1;

  attach(canvas: HTMLCanvasElement): void {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) throw new Error('WebGL2 is not available');
    this.canvas = canvas;
    this.gl = gl;

    this.lineProgram = link(gl, LINE_VS, LINE_FS);
    this.lineTransformLoc = gl.getUniformLocation(this.lineProgram, 'u_transform');
    this.lineColorLoc = gl.getUniformLocation(this.lineProgram, 'u_color');
    this.lineVbo = gl.createBuffer();
    this.lineVao = this.makeLineVao(gl, this.lineProgram, this.lineVbo);
    // Filled triangles share the flat-color program and vertex layout.
    this.triVbo = gl.createBuffer();
    this.triVao = this.makeLineVao(gl, this.lineProgram, this.triVbo);

    this.gridVbo = gl.createBuffer();
    this.gridVao = this.makeLineVao(gl, this.lineProgram, this.gridVbo);
    this.ghostVbo = gl.createBuffer();
    this.ghostVao = this.makeLineVao(gl, this.lineProgram, this.ghostVbo);
    this.ratsnestVbo = gl.createBuffer();
    this.ratsnestVao = this.makeLineVao(gl, this.lineProgram, this.ratsnestVbo);

    this.textProgram = link(gl, TEXT_VS, TEXT_FS);
    this.textTransformLoc = gl.getUniformLocation(this.textProgram, 'u_transform');
    this.textColorLoc = gl.getUniformLocation(this.textProgram, 'u_color');
    this.textAtlasLoc = gl.getUniformLocation(this.textProgram, 'u_atlas');
    this.textVbo = gl.createBuffer();
    this.textVao = gl.createVertexArray();
    gl.bindVertexArray(this.textVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textVbo);
    const posLoc = gl.getAttribLocation(this.textProgram, 'a_pos');
    const uvLoc = gl.getAttribLocation(this.textProgram, 'a_uv');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.resize();
  }

  private makeLineVao(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    vbo: WebGLBuffer | null,
  ): WebGLVertexArrayObject | null {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const posLoc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  resize(): void {
    const canvas = this.canvas;
    const gl = this.gl;
    if (!canvas || !gl) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    this.cssWidth = Math.max(1, canvas.clientWidth || canvas.width);
    this.cssHeight = Math.max(1, canvas.clientHeight || canvas.height);
    const w = Math.round(this.cssWidth * dpr);
    const h = Math.round(this.cssHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
  }

  /** mm → clip-space transform from the camera (column-major mat3). */
  private transform(camera: Camera): Float32Array {
    const sx = (camera.pxPerNm * MM * 2) / this.cssWidth;
    const sy = (camera.pxPerNm * MM * 2) / this.cssHeight;
    const cxMm = camera.center.x * NM_TO_MM;
    const cyMm = camera.center.y * NM_TO_MM;
    return Float32Array.of(sx, 0, 0, 0, sy, 0, -cxMm * sx, -cyMm * sy, 1);
  }

  /** Rebuild the concatenated vertex buffers when the scene changed. */
  private syncBuffers(scene: SceneGraph): void {
    const gl = this.gl;
    if (!gl || scene.version === this.cachedSceneVersion) return;
    this.cachedSceneVersion = scene.version;
    this.ranges.clear();

    // Line-ish geometry first so bodies draw on top (wires under symbols;
    // traces under vias under footprints).
    const drawRank: Record<SceneNode['kind'], number> = {
      wire: 0,
      trace: 0,
      via: 1,
      symbol: 2,
      footprint: 2,
    };
    const nodes = [...scene.nodes.values()].sort(
      (a, b) => drawRank[a.kind] - drawRank[b.kind],
    );

    let totalFloats = 0;
    let totalTriFloats = 0;
    for (const node of nodes) {
      totalFloats += node.lines.length;
      totalTriFloats += (node.tris?.length ?? 0) + (node.holeTris?.length ?? 0);
    }
    const data = new Float32Array(totalFloats);
    const triData = new Float32Array(totalTriFloats);
    let offset = 0;
    let triOffset = 0;
    for (const node of nodes) {
      const tris = node.tris ?? null;
      const holeTris = node.holeTris ?? null;
      const triFirst = triOffset / 2;
      if (tris) {
        for (let i = 0; i < tris.length; i++) triData[triOffset + i] = (tris[i] ?? 0) * NM_TO_MM;
        triOffset += tris.length;
      }
      const holeFirst = triOffset / 2;
      if (holeTris) {
        for (let i = 0; i < holeTris.length; i++) {
          triData[triOffset + i] = (holeTris[i] ?? 0) * NM_TO_MM;
        }
        triOffset += holeTris.length;
      }
      this.ranges.set(node.id, {
        first: offset / 2,
        count: node.lines.length / 2,
        triFirst,
        triCount: (tris?.length ?? 0) / 2,
        holeFirst,
        holeCount: (holeTris?.length ?? 0) / 2,
        kind: node.kind,
        color: node.color,
      });
      for (let i = 0; i < node.lines.length; i++) {
        data[offset + i] = (node.lines[i] ?? 0) * NM_TO_MM;
      }
      offset += node.lines.length;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.triVbo);
    gl.bufferData(gl.ARRAY_BUFFER, triData, gl.STATIC_DRAW);

    // Text quads rebuild alongside (single color, single atlas size).
    if (this.atlas.ensure(gl)) {
      const verts: number[] = [];
      for (const node of nodes) {
        for (const run of node.texts) {
          const sizeMm = run.sizeNm * NM_TO_MM;
          const yMm =
            run.align === 'center'
              ? run.at.y * NM_TO_MM - sizeMm / 2
              : run.at.y * NM_TO_MM;
          this.atlas.appendRun(
            verts,
            run.text,
            run.at.x * NM_TO_MM,
            yMm,
            sizeMm,
            run.align ?? 'left',
          );
        }
      }
      this.textVertexCount = verts.length / 4;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.textVbo);
      gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(verts), gl.DYNAMIC_DRAW);
    }
  }

  private colorFor(id: string, base: RGBA, overlay: OverlayState): RGBA {
    if (overlay.selection.has(id)) return COLORS.selection;
    if (overlay.highlight.has(id)) return COLORS.highlight;
    const d = overlay.diff?.get(id);
    if (d === 'added') return COLORS.diffAdded;
    if (d === 'removed') return COLORS.diffRemoved;
    if (d === 'changed') return COLORS.diffChanged;
    const t = overlay.tint?.get(id);
    if (t) return t;
    return base;
  }

  private drawGrid(camera: Camera): void {
    const gl = this.gl;
    if (!gl || !camera.showGrid()) return;
    const halfWnm = this.cssWidth / 2 / camera.pxPerNm;
    const halfHnm = this.cssHeight / 2 / camera.pxPerNm;
    const minX = camera.center.x - halfWnm;
    const maxX = camera.center.x + halfWnm;
    const minY = camera.center.y - halfHnm;
    const maxY = camera.center.y + halfHnm;
    const pitch = SCHEMATIC_GRID;
    const firstX = Math.floor(minX / pitch) * pitch;
    const firstY = Math.floor(minY / pitch) * pitch;
    const nx = Math.ceil((maxX - firstX) / pitch) + 1;
    const ny = Math.ceil((maxY - firstY) / pitch) + 1;
    if (nx + ny > 1200) return; // zoomed out too far for a useful grid

    const verts: number[] = [];
    for (let i = 0; i < nx; i++) {
      const x = (firstX + i * pitch) * NM_TO_MM;
      verts.push(x, minY * NM_TO_MM, x, maxY * NM_TO_MM);
    }
    for (let j = 0; j < ny; j++) {
      const y = (firstY + j * pitch) * NM_TO_MM;
      verts.push(minX * NM_TO_MM, y, maxX * NM_TO_MM, y);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gridVbo);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(verts), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(this.gridVao);
    gl.uniform4fv(this.lineColorLoc, COLORS.grid);
    gl.drawArrays(gl.LINES, 0, verts.length / 2);
    gl.bindVertexArray(null);
  }

  render(scene: SceneGraph, camera: Camera, overlay: OverlayState): void {
    const gl = this.gl;
    if (!gl || !this.lineProgram) return;
    this.syncBuffers(scene);

    gl.clearColor(BACKGROUND[0], BACKGROUND[1], BACKGROUND[2], BACKGROUND[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const transform = this.transform(camera);
    gl.useProgram(this.lineProgram);
    gl.uniformMatrix3fv(this.lineTransformLoc, false, transform);

    if (overlay.gridVisible) this.drawGrid(camera);

    // Ratsnest — dashed-on-CPU airwires under the copper geometry.
    const ratsnest = overlay.ratsnest;
    if (ratsnest && ratsnest.lines.length >= 4) {
      const mm = new Float32Array(ratsnest.lines.length);
      for (let i = 0; i < ratsnest.lines.length; i++) {
        mm[i] = (ratsnest.lines[i] ?? 0) * NM_TO_MM;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ratsnestVbo);
      gl.bufferData(gl.ARRAY_BUFFER, mm, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(this.ratsnestVao);
      gl.uniform4fv(this.lineColorLoc, COLORS.ratsnest);
      gl.drawArrays(gl.LINES, 0, mm.length / 2);
      gl.bindVertexArray(null);
    }

    // Filled triangles first (copper fills, then their drill holes in
    // the background color), so the outline pass stays legible on top.
    gl.bindVertexArray(this.triVao);
    for (const [id, range] of this.ranges) {
      if (range.triCount > 0) {
        gl.uniform4fv(this.lineColorLoc, this.colorFor(id, range.color, overlay));
        gl.drawArrays(gl.TRIANGLES, range.triFirst, range.triCount);
      }
      if (range.holeCount > 0) {
        gl.uniform4fv(this.lineColorLoc, BACKGROUND);
        gl.drawArrays(gl.TRIANGLES, range.holeFirst, range.holeCount);
      }
    }
    gl.bindVertexArray(null);

    // Per-node line draws over the cached concatenated buffer.
    gl.bindVertexArray(this.lineVao);
    for (const [id, range] of this.ranges) {
      if (range.count === 0) continue;
      gl.uniform4fv(this.lineColorLoc, this.colorFor(id, range.color, overlay));
      gl.drawArrays(gl.LINES, range.first, range.count);
    }
    gl.bindVertexArray(null);

    // Ghost (tool preview) — semi-transparent dynamic batch.
    const ghost = overlay.ghost;
    if (ghost && ghost.lines.length >= 4) {
      const mm = new Float32Array(ghost.lines.length);
      for (let i = 0; i < ghost.lines.length; i++) mm[i] = (ghost.lines[i] ?? 0) * NM_TO_MM;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ghostVbo);
      gl.bufferData(gl.ARRAY_BUFFER, mm, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(this.ghostVao);
      gl.uniform4fv(this.lineColorLoc, COLORS.ghost);
      gl.drawArrays(gl.LINES, 0, mm.length / 2);
      gl.bindVertexArray(null);
    }

    // Text — only when zoomed in enough to read it.
    if (camera.showText() && this.textProgram && this.textVertexCount > 0) {
      gl.useProgram(this.textProgram);
      gl.uniformMatrix3fv(this.textTransformLoc, false, transform);
      gl.uniform4fv(this.textColorLoc, COLORS.text);
      this.atlas.bind(gl, 0);
      gl.uniform1i(this.textAtlasLoc, 0);
      gl.bindVertexArray(this.textVao);
      gl.drawArrays(gl.TRIANGLES, 0, this.textVertexCount);
      gl.bindVertexArray(null);
    }
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    for (const buf of [
      this.lineVbo,
      this.triVbo,
      this.gridVbo,
      this.ghostVbo,
      this.ratsnestVbo,
      this.textVbo,
    ]) {
      if (buf) gl.deleteBuffer(buf);
    }
    this.gl = null;
    this.canvas = null;
  }
}
