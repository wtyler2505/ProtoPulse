import { useEffect, useRef, useState } from 'react';

import { engNotation, linMap, logMap, logTicks, niceTicks } from './scales.js';

/**
 * Canvas-2D waveform plot — no charting deps. Axes with engineering-
 * notation tick labels, multi-trace with a fixed color cycle, log-x for
 * AC sweeps, legend, and a crosshair cursor with nearest-point readout.
 * All scale math lives in scales.ts (unit-tested); this file only paints.
 */

export interface PlotTrace {
  name: string;
  xs: number[];
  ys: number[];
  color: string;
}

export const TRACE_COLORS = [
  '#58a6ff',
  '#58e88f',
  '#ffc857',
  '#ff5d5d',
  '#c792ea',
  '#4dd0e1',
  '#f78c6c',
  '#9ccc65',
] as const;

export function traceColor(index: number): string {
  return TRACE_COLORS[index % TRACE_COLORS.length] ?? '#58a6ff';
}

interface PlotProps {
  traces: PlotTrace[];
  logX?: boolean;
  xLabel?: string;
  yLabel?: string;
}

const MARGIN = { left: 58, right: 12, top: 12, bottom: 30 };

interface Domain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

function computeDomain(traces: PlotTrace[], logX: boolean): Domain | null {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const t of traces) {
    for (let i = 0; i < t.xs.length; i++) {
      const x = t.xs[i];
      const y = t.ys[i];
      if (x === undefined || y === undefined) continue;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (logX && x <= 0) continue;
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  }
  if (!Number.isFinite(xMin) || !Number.isFinite(yMin)) return null;
  if (xMin === xMax) {
    const pad = Math.abs(xMin) > 0 ? Math.abs(xMin) * 0.1 : 1;
    xMin -= logX ? 0 : pad;
    xMax += pad;
  }
  if (yMin === yMax) {
    const pad = Math.abs(yMin) > 0 ? Math.abs(yMin) * 0.1 : 1;
    yMin -= pad;
    yMax += pad;
  } else {
    const pad = (yMax - yMin) * 0.05;
    yMin -= pad;
    yMax += pad;
  }
  return { xMin, xMax, yMin, yMax };
}

function draw(
  canvas: HTMLCanvasElement,
  traces: PlotTrace[],
  logX: boolean,
  cursor: { x: number; y: number } | null,
  xLabel: string,
  yLabel: string,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, w, h);

  const left = MARGIN.left;
  const right = w - MARGIN.right;
  const top = MARGIN.top;
  const bottom = h - MARGIN.bottom;

  const domain = computeDomain(traces, logX);
  ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
  if (!domain) {
    ctx.fillStyle = '#7a869c';
    ctx.textAlign = 'center';
    ctx.fillText('no traces selected', w / 2, h / 2);
    return;
  }
  const { xMin, xMax, yMin, yMax } = domain;

  const xPix = (v: number): number =>
    logX ? logMap(v, xMin, xMax, left, right) : linMap(v, xMin, xMax, left, right);
  const yPix = (v: number): number => linMap(v, yMin, yMax, bottom, top);

  // ── Grid + ticks ──
  const xTicks = logX ? logTicks(xMin, xMax) : niceTicks(xMin, xMax, 6);
  const yTicks = niceTicks(yMin, yMax, 5);
  ctx.strokeStyle = '#1a2233';
  ctx.fillStyle = '#7a869c';
  ctx.lineWidth = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of xTicks) {
    const px = xPix(t);
    if (!Number.isFinite(px) || px < left - 0.5 || px > right + 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(px, top);
    ctx.lineTo(px, bottom);
    ctx.stroke();
    ctx.fillText(engNotation(t), px, bottom + 4);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const t of yTicks) {
    const py = yPix(t);
    ctx.beginPath();
    ctx.moveTo(left, py);
    ctx.lineTo(right, py);
    ctx.stroke();
    ctx.fillText(engNotation(t), left - 6, py);
  }

  // ── Frame + axis labels ──
  ctx.strokeStyle = '#232b3d';
  ctx.strokeRect(left, top, right - left, bottom - top);
  ctx.fillStyle = '#7a869c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  if (xLabel) ctx.fillText(xLabel, (left + right) / 2, h - 2);
  if (yLabel) {
    ctx.save();
    ctx.translate(10, (top + bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }

  // ── Traces ──
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, right - left, bottom - top);
  ctx.clip();
  for (const trace of traces) {
    ctx.strokeStyle = trace.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < trace.xs.length; i++) {
      const x = trace.xs[i];
      const y = trace.ys[i];
      if (x === undefined || y === undefined) continue;
      const px = xPix(x);
      const py = yPix(y);
      if (!Number.isFinite(px) || !Number.isFinite(py)) {
        started = false;
        continue;
      }
      if (started) {
        ctx.lineTo(px, py);
      } else {
        ctx.moveTo(px, py);
        started = true;
      }
    }
    ctx.stroke();
  }
  ctx.restore();

  // ── Legend ──
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  traces.forEach((trace, i) => {
    const ly = top + 10 + i * 15;
    const lx = right - 120;
    ctx.fillStyle = trace.color;
    ctx.fillRect(lx, ly - 4, 9, 9);
    ctx.fillStyle = '#cdd6e4';
    ctx.fillText(trace.name, lx + 14, ly);
  });

  // ── Crosshair + nearest-point readout ──
  if (cursor && cursor.x >= left && cursor.x <= right && cursor.y >= top && cursor.y <= bottom) {
    const dataX = logX
      ? 10 ** linMap(cursor.x, left, right, Math.log10(xMin), Math.log10(xMax))
      : linMap(cursor.x, left, right, xMin, xMax);

    ctx.strokeStyle = '#3a4661';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cursor.x, top);
    ctx.lineTo(cursor.x, bottom);
    ctx.moveTo(left, cursor.y);
    ctx.lineTo(right, cursor.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const lines: { color: string; text: string }[] = [];
    for (const trace of traces) {
      let bestI = -1;
      let bestD = Infinity;
      for (let i = 0; i < trace.xs.length; i++) {
        const x = trace.xs[i];
        if (x === undefined || (logX && x <= 0)) continue;
        const d = Math.abs(x - dataX);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }
      const x = bestI >= 0 ? trace.xs[bestI] : undefined;
      const y = bestI >= 0 ? trace.ys[bestI] : undefined;
      if (x === undefined || y === undefined) continue;
      const px = xPix(x);
      const py = yPix(y);
      if (Number.isFinite(px) && Number.isFinite(py)) {
        ctx.fillStyle = trace.color;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      lines.push({ color: trace.color, text: `${trace.name}  x=${engNotation(x, 4)}  y=${engNotation(y, 4)}` });
    }

    if (lines.length > 0) {
      const boxW = 12 + Math.max(...lines.map((l) => ctx.measureText(l.text).width)) + 14;
      const boxH = lines.length * 15 + 8;
      const bx = cursor.x + 12 + boxW > right ? cursor.x - 12 - boxW : cursor.x + 12;
      const by = Math.min(cursor.y + 10, bottom - boxH - 2);
      ctx.fillStyle = 'rgba(15, 19, 32, 0.92)';
      ctx.strokeStyle = '#232b3d';
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeRect(bx, by, boxW, boxH);
      lines.forEach((line, i) => {
        const ly = by + 12 + i * 15;
        ctx.fillStyle = line.color;
        ctx.fillRect(bx + 6, ly - 3, 7, 7);
        ctx.fillStyle = '#cdd6e4';
        ctx.fillText(line.text, bx + 18, ly);
      });
    }
  }
}

export function Plot({ traces, logX = false, xLabel = '', yLabel = '' }: PlotProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [resizeSeq, setResizeSeq] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = new ResizeObserver(() => {
      setResizeSeq((s) => s + 1);
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) draw(canvas, traces, logX, cursor, xLabel, yLabel);
  }, [traces, logX, cursor, xLabel, yLabel, resizeSeq]);

  return (
    <canvas
      ref={canvasRef}
      className="plot-canvas"
      role="img"
      aria-label="Simulation waveform plot"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseLeave={() => {
        setCursor(null);
      }}
    />
  );
}
