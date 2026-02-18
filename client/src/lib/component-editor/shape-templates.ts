import type { Shape, RectShape, CircleShape, PathShape, TextShape } from '@shared/component-types';
import { nanoid } from 'nanoid';

export interface ShapeTemplate {
  id: string;
  name: string;
  category: 'ic' | 'passive' | 'mechanical' | 'misc';
  description: string;
  generate: () => Shape[];
}

const icBody: ShapeTemplate = {
  id: 'ic-body',
  name: 'IC Body',
  category: 'ic',
  description: 'Standard IC body rectangle with pin 1 notch and label',
  generate: (): Shape[] => [
    {
      id: nanoid(),
      type: 'rect',
      x: -5,
      y: -3,
      width: 10,
      height: 6,
      rotation: 0,
      style: {
        fill: '#4a4a4a',
        stroke: '#888888',
        strokeWidth: 0.3,
      },
    } as RectShape,
    {
      id: nanoid(),
      type: 'circle',
      x: -4.2,
      y: -2.2,
      cx: -4.2,
      cy: -2.2,
      width: 0.8,
      height: 0.8,
      rotation: 0,
      style: {
        fill: '#cccccc',
        stroke: 'none',
      },
    } as CircleShape,
    {
      id: nanoid(),
      type: 'text',
      x: 0,
      y: 0,
      width: 6,
      height: 2,
      rotation: 0,
      text: 'IC',
      style: {
        fill: '#e0e0e0',
        fontSize: 2.5,
        fontFamily: 'monospace',
        textAnchor: 'middle',
      },
    } as TextShape,
  ],
};

const headerBody: ShapeTemplate = {
  id: 'header-body',
  name: 'Header Body',
  category: 'ic',
  description: 'Pin header body (1x4, 2.54mm pitch)',
  generate: (): Shape[] => [
    {
      id: nanoid(),
      type: 'rect',
      x: -1.27,
      y: -5.08,
      width: 2.54,
      height: 10.16,
      rotation: 0,
      style: {
        fill: '#3a3a3a',
        stroke: '#777777',
        strokeWidth: 0.25,
      },
    } as RectShape,
    ...Array.from({ length: 4 }, (_, i) => ({
      id: nanoid(),
      type: 'circle' as const,
      x: 0,
      y: -3.81 + i * 2.54,
      cx: 0,
      cy: -3.81 + i * 2.54,
      width: 1.2,
      height: 1.2,
      rotation: 0,
      style: {
        fill: '#c0a030',
        stroke: '#e0c040',
        strokeWidth: 0.15,
      },
    } as CircleShape)),
  ],
};

const resistorBody: ShapeTemplate = {
  id: 'resistor-body',
  name: 'Resistor',
  category: 'passive',
  description: 'Axial resistor body with lead lines',
  generate: (): Shape[] => [
    {
      id: nanoid(),
      type: 'rect',
      x: -3,
      y: -1.25,
      width: 6,
      height: 2.5,
      rotation: 0,
      style: {
        fill: '#8b7355',
        stroke: '#a08060',
        strokeWidth: 0.25,
      },
    } as RectShape,
    {
      id: nanoid(),
      type: 'path',
      x: -6,
      y: -0.15,
      width: 3,
      height: 0.3,
      rotation: 0,
      d: 'M -6 0 L -3 0',
      style: {
        fill: 'none',
        stroke: '#aaaaaa',
        strokeWidth: 0.3,
      },
    } as PathShape,
    {
      id: nanoid(),
      type: 'path',
      x: 3,
      y: -0.15,
      width: 3,
      height: 0.3,
      rotation: 0,
      d: 'M 3 0 L 6 0',
      style: {
        fill: 'none',
        stroke: '#aaaaaa',
        strokeWidth: 0.3,
      },
    } as PathShape,
  ],
};

const capacitorBody: ShapeTemplate = {
  id: 'capacitor-body',
  name: 'Capacitor',
  category: 'passive',
  description: 'Electrolytic capacitor with polarity marker',
  generate: (): Shape[] => [
    {
      id: nanoid(),
      type: 'circle',
      x: -2.5,
      y: -2.5,
      cx: 0,
      cy: 0,
      width: 5,
      height: 5,
      rotation: 0,
      style: {
        fill: '#2a4a6a',
        stroke: '#5599cc',
        strokeWidth: 0.3,
      },
    } as CircleShape,
    {
      id: nanoid(),
      type: 'path',
      x: -0.8,
      y: -1.8,
      width: 1.6,
      height: 0.3,
      rotation: 0,
      d: 'M -0.8 -1.2 L 0.8 -1.2',
      style: {
        fill: 'none',
        stroke: '#e0e0e0',
        strokeWidth: 0.25,
      },
    } as PathShape,
    {
      id: nanoid(),
      type: 'path',
      x: -0.15,
      y: -2,
      width: 0.3,
      height: 1.6,
      rotation: 0,
      d: 'M 0 -2 L 0 -0.4',
      style: {
        fill: 'none',
        stroke: '#e0e0e0',
        strokeWidth: 0.25,
      },
    } as PathShape,
  ],
};

const mountingHole: ShapeTemplate = {
  id: 'mounting-hole',
  name: 'Mounting Hole',
  category: 'mechanical',
  description: 'Standard mounting hole (3.2mm) with drill',
  generate: (): Shape[] => [
    {
      id: nanoid(),
      type: 'circle',
      x: -1.6,
      y: -1.6,
      cx: 0,
      cy: 0,
      width: 3.2,
      height: 3.2,
      rotation: 0,
      style: {
        fill: 'none',
        stroke: '#aaaaaa',
        strokeWidth: 0.4,
      },
    } as CircleShape,
    {
      id: nanoid(),
      type: 'circle',
      x: -1.5,
      y: -1.5,
      cx: 0,
      cy: 0,
      width: 3.0,
      height: 3.0,
      rotation: 0,
      style: {
        fill: 'none',
        stroke: '#666666',
        strokeWidth: 0.2,
        opacity: 0.7,
      },
    } as CircleShape,
  ],
};

const testPoint: ShapeTemplate = {
  id: 'test-point',
  name: 'Test Point',
  category: 'misc',
  description: 'Small filled test point with label',
  generate: (): Shape[] => [
    {
      id: nanoid(),
      type: 'circle',
      x: -0.5,
      y: -0.5,
      cx: 0,
      cy: 0,
      width: 1,
      height: 1,
      rotation: 0,
      style: {
        fill: '#ff4444',
        stroke: '#ff6666',
        strokeWidth: 0.15,
      },
    } as CircleShape,
    {
      id: nanoid(),
      type: 'text',
      x: 0,
      y: 1.5,
      width: 3,
      height: 1.5,
      rotation: 0,
      text: 'TP',
      style: {
        fill: '#e0e0e0',
        fontSize: 1.5,
        fontFamily: 'monospace',
        textAnchor: 'middle',
      },
    } as TextShape,
  ],
};

const groundSymbol: ShapeTemplate = {
  id: 'ground-symbol',
  name: 'Ground Symbol',
  category: 'misc',
  description: 'Standard ground symbol',
  generate: (): Shape[] => [
    {
      id: nanoid(),
      type: 'path',
      x: -1.5,
      y: -2,
      width: 3,
      height: 4,
      rotation: 0,
      d: 'M 0 -2 L 0 0 M -1.5 0 L 1.5 0 M -1 0.6 L 1 0.6 M -0.5 1.2 L 0.5 1.2',
      style: {
        fill: 'none',
        stroke: '#44cc44',
        strokeWidth: 0.3,
      },
    } as PathShape,
  ],
};

const vccSymbol: ShapeTemplate = {
  id: 'vcc-symbol',
  name: 'VCC Symbol',
  category: 'misc',
  description: 'Power supply VCC arrow symbol',
  generate: (): Shape[] => [
    {
      id: nanoid(),
      type: 'path',
      x: -1,
      y: -2,
      width: 2,
      height: 4,
      rotation: 0,
      d: 'M 0 2 L 0 -0.5 M -1 -0.5 L 0 -2 L 1 -0.5',
      style: {
        fill: 'none',
        stroke: '#ff4444',
        strokeWidth: 0.3,
      },
    } as PathShape,
    {
      id: nanoid(),
      type: 'text',
      x: 0,
      y: -2.8,
      width: 4,
      height: 1.5,
      rotation: 0,
      text: 'VCC',
      style: {
        fill: '#ff6666',
        fontSize: 1.5,
        fontFamily: 'monospace',
        textAnchor: 'middle',
      },
    } as TextShape,
  ],
};

export const SHAPE_TEMPLATES: ShapeTemplate[] = [
  icBody,
  headerBody,
  resistorBody,
  capacitorBody,
  mountingHole,
  testPoint,
  groundSymbol,
  vccSymbol,
];

export function getTemplatesByCategory(category: ShapeTemplate['category']): ShapeTemplate[] {
  return SHAPE_TEMPLATES.filter(t => t.category === category);
}
