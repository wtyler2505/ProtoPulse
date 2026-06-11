import type { ERCViolation } from '@shared/circuit-types';

export interface SchematicCanvasProps {
  circuitId: number;
  ercViolations?: ERCViolation[];
  highlightedViolationId?: string | null;
  onEnterSheet?: (id: number) => void;
}

