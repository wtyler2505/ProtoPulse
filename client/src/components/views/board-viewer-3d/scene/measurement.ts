export type MeasurePoint3D = [number, number, number];

export interface WebGLMeasureSegment {
  id: string;
  start: MeasurePoint3D;
  end: MeasurePoint3D;
  distanceMm: number;
}

export function getMeasurementDistanceMm(start: MeasurePoint3D, end: MeasurePoint3D): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function getMeasurementMidpoint(start: MeasurePoint3D, end: MeasurePoint3D): MeasurePoint3D {
  return [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2];
}

export function formatMeasurementDistance(distanceMm: number): string {
  return `${distanceMm.toFixed(2)} mm`;
}
