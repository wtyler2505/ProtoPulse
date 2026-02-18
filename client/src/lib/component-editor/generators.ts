import type { Shape, RectShape, CircleShape, PathShape, Connector } from '@shared/component-types';
import { nanoid } from 'nanoid';

export interface GeneratorResult {
  shapes: Shape[];
  connectors: Connector[];
}

export interface GeneratorConfig {
  type: 'dip' | 'soic' | 'qfp' | 'header' | 'resistor' | 'capacitor';
  pinCount?: number;
  pitch?: number;
  rows?: number;
  cols?: number;
  bodyWidth?: number;
  bodySize?: number;
  mountingType?: 'tht' | 'smd';
}

function makeCirclePad(cx: number, cy: number, r: number, fill: string = '#c0c0c0', stroke: string = '#888'): CircleShape {
  return {
    id: nanoid(),
    type: 'circle',
    x: cx - r,
    y: cy - r,
    width: r * 2,
    height: r * 2,
    cx,
    cy,
    rotation: 0,
    style: { fill, stroke, strokeWidth: 0.5 },
  };
}

function makeRect(x: number, y: number, w: number, h: number, fill: string = '#555', stroke: string = '#888', rx?: number): RectShape {
  return {
    id: nanoid(),
    type: 'rect',
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    rx,
    style: { fill, stroke, strokeWidth: 1 },
  };
}

function makeRectPad(x: number, y: number, w: number, h: number, fill: string = '#c0c0c0'): RectShape {
  return {
    id: nanoid(),
    type: 'rect',
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    style: { fill, stroke: '#888', strokeWidth: 0.3 },
  };
}

function makeConnector(name: string, shapeId: string, termX: number, termY: number, padType: 'tht' | 'smd' = 'tht'): Connector {
  return {
    id: nanoid(),
    name,
    connectorType: 'male',
    shapeIds: { breadboard: [shapeId], schematic: [shapeId], pcb: [shapeId] },
    terminalPositions: {
      breadboard: { x: termX, y: termY },
      schematic: { x: termX, y: termY },
      pcb: { x: termX, y: termY },
    },
    padSpec: padType === 'tht'
      ? { type: 'tht', shape: 'circle', diameter: 1.6, drill: 0.8 }
      : { type: 'smd', shape: 'rect', width: 0.6, height: 1.2 },
  };
}

export function generateDIP(pinCount: number, pinSpacing: number = 2.54, rowSpacing: number = 7.62): GeneratorResult {
  const pinsPerSide = Math.floor(pinCount / 2);
  const shapes: Shape[] = [];
  const connectors: Connector[] = [];

  const bodyHeight = (pinsPerSide - 1) * pinSpacing + pinSpacing;
  const bodyWidth = rowSpacing - 1.5;
  const bodyX = -bodyWidth / 2;
  const bodyY = -bodyHeight / 2;

  shapes.push(makeRect(bodyX, bodyY, bodyWidth, bodyHeight, '#333', '#666', 1));

  const notchSize = 1.2;
  const notch: PathShape = {
    id: nanoid(),
    type: 'path',
    x: -notchSize / 2,
    y: bodyY - 0.1,
    width: notchSize,
    height: notchSize / 2,
    rotation: 0,
    d: `M ${-notchSize / 2} ${bodyY} A ${notchSize / 2} ${notchSize / 2} 0 0 1 ${notchSize / 2} ${bodyY}`,
    style: { fill: 'none', stroke: '#888', strokeWidth: 0.5 },
  };
  shapes.push(notch);

  const pin1Marker = makeCirclePad(bodyX + 1.5, bodyY + 1.5, 0.5, '#fff', '#fff');
  shapes.push(pin1Marker);

  const leftX = -rowSpacing / 2;
  const rightX = rowSpacing / 2;
  const startY = -(pinsPerSide - 1) * pinSpacing / 2;

  for (let i = 0; i < pinsPerSide; i++) {
    const y = startY + i * pinSpacing;
    const padLeft = makeCirclePad(leftX, y, 0.8);
    shapes.push(padLeft);
    connectors.push(makeConnector(String(i + 1), padLeft.id, leftX, y, 'tht'));
  }

  for (let i = 0; i < pinsPerSide; i++) {
    const y = startY + (pinsPerSide - 1 - i) * pinSpacing;
    const padRight = makeCirclePad(rightX, y, 0.8);
    shapes.push(padRight);
    connectors.push(makeConnector(String(pinsPerSide + i + 1), padRight.id, rightX, y, 'tht'));
  }

  return { shapes, connectors };
}

export function generateSOIC(pinCount: number, pitch: number = 1.27, bodyWidth: number = 3.9): GeneratorResult {
  const pinsPerSide = Math.floor(pinCount / 2);
  const shapes: Shape[] = [];
  const connectors: Connector[] = [];

  const bodyHeight = (pinsPerSide - 1) * pitch + pitch;
  const bodyX = -bodyWidth / 2;
  const bodyY = -bodyHeight / 2;

  shapes.push(makeRect(bodyX, bodyY, bodyWidth, bodyHeight, '#333', '#555', 0.5));

  const pin1Marker = makeCirclePad(bodyX + 0.8, bodyY + 0.8, 0.3, '#fff', '#fff');
  shapes.push(pin1Marker);

  const padWidth = 1.0;
  const padHeight = 0.5;
  const padExtend = bodyWidth / 2 + padWidth / 2 + 0.3;
  const startY = -(pinsPerSide - 1) * pitch / 2;

  for (let i = 0; i < pinsPerSide; i++) {
    const y = startY + i * pitch - padHeight / 2;
    const pad = makeRectPad(-padExtend - padWidth / 2, y, padWidth, padHeight);
    shapes.push(pad);
    connectors.push(makeConnector(String(i + 1), pad.id, -padExtend, startY + i * pitch, 'smd'));
  }

  for (let i = 0; i < pinsPerSide; i++) {
    const y = startY + (pinsPerSide - 1 - i) * pitch - padHeight / 2;
    const pad = makeRectPad(padExtend - padWidth / 2, y, padWidth, padHeight);
    shapes.push(pad);
    connectors.push(makeConnector(String(pinsPerSide + i + 1), pad.id, padExtend, startY + (pinsPerSide - 1 - i) * pitch, 'smd'));
  }

  return { shapes, connectors };
}

export function generateQFP(pinCount: number, pitch: number = 0.5, bodySize: number = 7): GeneratorResult {
  const pinsPerSide = Math.floor(pinCount / 4);
  const shapes: Shape[] = [];
  const connectors: Connector[] = [];

  const halfBody = bodySize / 2;
  shapes.push(makeRect(-halfBody, -halfBody, bodySize, bodySize, '#333', '#555', 0.5));

  const pin1Marker = makeCirclePad(-halfBody + 1, -halfBody + 1, 0.3, '#fff', '#fff');
  shapes.push(pin1Marker);

  const padW = 1.2;
  const padH = 0.3;
  const padOffset = halfBody + padW / 2 + 0.2;
  const startPos = -(pinsPerSide - 1) * pitch / 2;
  let pinNum = 1;

  for (let i = 0; i < pinsPerSide; i++) {
    const pos = startPos + i * pitch;
    const pad = makeRectPad(-padOffset - padW / 2, pos - padH / 2, padW, padH);
    shapes.push(pad);
    connectors.push(makeConnector(String(pinNum++), pad.id, -padOffset, pos, 'smd'));
  }

  for (let i = 0; i < pinsPerSide; i++) {
    const pos = startPos + i * pitch;
    const pad = makeRectPad(pos - padH / 2, padOffset - padW / 2, padH, padW);
    shapes.push(pad);
    connectors.push(makeConnector(String(pinNum++), pad.id, pos, padOffset, 'smd'));
  }

  for (let i = 0; i < pinsPerSide; i++) {
    const pos = startPos + (pinsPerSide - 1 - i) * pitch;
    const pad = makeRectPad(padOffset - padW / 2, pos - padH / 2, padW, padH);
    shapes.push(pad);
    connectors.push(makeConnector(String(pinNum++), pad.id, padOffset, pos, 'smd'));
  }

  for (let i = 0; i < pinsPerSide; i++) {
    const pos = startPos + (pinsPerSide - 1 - i) * pitch;
    const pad = makeRectPad(pos - padH / 2, -padOffset - padW / 2, padH, padW);
    shapes.push(pad);
    connectors.push(makeConnector(String(pinNum++), pad.id, pos, -padOffset, 'smd'));
  }

  return { shapes, connectors };
}

export function generateHeader(cols: number, rows: number = 1, pitch: number = 2.54): GeneratorResult {
  const shapes: Shape[] = [];
  const connectors: Connector[] = [];

  const totalW = cols * pitch;
  const totalH = rows * pitch;
  const bodyX = -totalW / 2;
  const bodyY = -totalH / 2;

  shapes.push(makeRect(bodyX, bodyY, totalW, totalH, '#222', '#555', 0.5));

  let pinNum = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = bodyX + c * pitch + pitch / 2;
      const cy = bodyY + r * pitch + pitch / 2;
      const pad = makeCirclePad(cx, cy, 0.8);
      shapes.push(pad);
      connectors.push(makeConnector(String(pinNum++), pad.id, cx, cy, 'tht'));
    }
  }

  const pin1Marker = makeCirclePad(bodyX + pitch / 2, bodyY - 0.8, 0.3, '#fff', '#fff');
  shapes.push(pin1Marker);

  return { shapes, connectors };
}

export function generateResistor(type: 'tht' | 'smd' = 'tht'): GeneratorResult {
  const shapes: Shape[] = [];
  const connectors: Connector[] = [];

  if (type === 'tht') {
    const bodyW = 6;
    const bodyH = 2.2;
    const leadLen = 3;
    shapes.push(makeRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, '#8B6914', '#666', 1));

    const leadLeft: PathShape = {
      id: nanoid(),
      type: 'path',
      x: -bodyW / 2 - leadLen,
      y: 0,
      width: leadLen,
      height: 0,
      rotation: 0,
      d: `M ${-bodyW / 2 - leadLen} 0 L ${-bodyW / 2} 0`,
      style: { stroke: '#999', strokeWidth: 0.5 },
    };
    shapes.push(leadLeft);

    const leadRight: PathShape = {
      id: nanoid(),
      type: 'path',
      x: bodyW / 2,
      y: 0,
      width: leadLen,
      height: 0,
      rotation: 0,
      d: `M ${bodyW / 2} 0 L ${bodyW / 2 + leadLen} 0`,
      style: { stroke: '#999', strokeWidth: 0.5 },
    };
    shapes.push(leadRight);

    const pad1 = makeCirclePad(-bodyW / 2 - leadLen, 0, 0.8);
    shapes.push(pad1);
    connectors.push(makeConnector('1', pad1.id, -bodyW / 2 - leadLen, 0, 'tht'));

    const pad2 = makeCirclePad(bodyW / 2 + leadLen, 0, 0.8);
    shapes.push(pad2);
    connectors.push(makeConnector('2', pad2.id, bodyW / 2 + leadLen, 0, 'tht'));
  } else {
    const bodyW = 1.6;
    const bodyH = 0.8;
    const padW = 0.5;

    shapes.push(makeRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, '#333', '#555'));

    const pad1 = makeRectPad(-bodyW / 2 - padW, -bodyH / 2, padW, bodyH, '#c0c0c0');
    shapes.push(pad1);
    connectors.push(makeConnector('1', pad1.id, -bodyW / 2 - padW / 2, 0, 'smd'));

    const pad2 = makeRectPad(bodyW / 2, -bodyH / 2, padW, bodyH, '#c0c0c0');
    shapes.push(pad2);
    connectors.push(makeConnector('2', pad2.id, bodyW / 2 + padW / 2, 0, 'smd'));
  }

  const pin1Marker = makeCirclePad(
    type === 'tht' ? -6 / 2 - 3 : -1.6 / 2 - 0.5,
    type === 'tht' ? -1.5 : -0.8,
    0.2,
    '#fff',
    '#fff'
  );
  shapes.push(pin1Marker);

  return { shapes, connectors };
}

export function generateCapacitor(type: 'tht' | 'smd' = 'tht'): GeneratorResult {
  const shapes: Shape[] = [];
  const connectors: Connector[] = [];

  if (type === 'tht') {
    const bodyR = 2.5;
    const leadLen = 3;

    const body = makeCirclePad(0, 0, bodyR, '#1a5276', '#2980b9');
    body.style!.strokeWidth = 1;
    shapes.push(body);

    const leadLeft: PathShape = {
      id: nanoid(),
      type: 'path',
      x: -leadLen - bodyR,
      y: 0,
      width: leadLen,
      height: 0,
      rotation: 0,
      d: `M ${-bodyR - leadLen} 0 L ${-bodyR} 0`,
      style: { stroke: '#999', strokeWidth: 0.5 },
    };
    shapes.push(leadLeft);

    const leadRight: PathShape = {
      id: nanoid(),
      type: 'path',
      x: bodyR,
      y: 0,
      width: leadLen,
      height: 0,
      rotation: 0,
      d: `M ${bodyR} 0 L ${bodyR + leadLen} 0`,
      style: { stroke: '#999', strokeWidth: 0.5 },
    };
    shapes.push(leadRight);

    const pad1 = makeCirclePad(-bodyR - leadLen, 0, 0.8);
    shapes.push(pad1);
    connectors.push(makeConnector('1', pad1.id, -bodyR - leadLen, 0, 'tht'));

    const pad2 = makeCirclePad(bodyR + leadLen, 0, 0.8);
    shapes.push(pad2);
    connectors.push(makeConnector('2', pad2.id, bodyR + leadLen, 0, 'tht'));

    const plusMark: PathShape = {
      id: nanoid(),
      type: 'path',
      x: -bodyR + 0.5,
      y: -1,
      width: 1,
      height: 1,
      rotation: 0,
      d: `M ${-bodyR + 0.5} ${-0.5} L ${-bodyR + 1.5} ${-0.5} M ${-bodyR + 1} ${-1} L ${-bodyR + 1} 0`,
      style: { stroke: '#fff', strokeWidth: 0.3 },
    };
    shapes.push(plusMark);
  } else {
    const bodyW = 2.0;
    const bodyH = 1.2;
    const padW = 0.5;

    shapes.push(makeRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, '#1a5276', '#2980b9'));

    const pad1 = makeRectPad(-bodyW / 2 - padW, -bodyH / 2, padW, bodyH, '#c0c0c0');
    shapes.push(pad1);
    connectors.push(makeConnector('1', pad1.id, -bodyW / 2 - padW / 2, 0, 'smd'));

    const pad2 = makeRectPad(bodyW / 2, -bodyH / 2, padW, bodyH, '#c0c0c0');
    shapes.push(pad2);
    connectors.push(makeConnector('2', pad2.id, bodyW / 2 + padW / 2, 0, 'smd'));
  }

  const pin1Marker = makeCirclePad(
    type === 'tht' ? -2.5 - 3 : -2.0 / 2 - 0.5,
    type === 'tht' ? -1.5 : -1.0,
    0.2,
    '#fff',
    '#fff'
  );
  shapes.push(pin1Marker);

  return { shapes, connectors };
}

export function generate(config: GeneratorConfig): GeneratorResult {
  switch (config.type) {
    case 'dip':
      return generateDIP(config.pinCount ?? 8, config.pitch ?? 2.54, config.bodyWidth ?? 7.62);
    case 'soic':
      return generateSOIC(config.pinCount ?? 8, config.pitch ?? 1.27, config.bodyWidth ?? 3.9);
    case 'qfp':
      return generateQFP(config.pinCount ?? 32, config.pitch ?? 0.5, config.bodySize ?? 7);
    case 'header':
      return generateHeader(config.cols ?? 4, config.rows ?? 1, config.pitch ?? 2.54);
    case 'resistor':
      return generateResistor(config.mountingType ?? 'tht');
    case 'capacitor':
      return generateCapacitor(config.mountingType ?? 'tht');
    default:
      return { shapes: [], connectors: [] };
  }
}
