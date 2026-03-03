import type { Node, Edge } from '@xyflow/react';
import { nodeData, edgeData } from '../../chat-types';
import type { GenComponent, GenConnection } from '../../chat-types';
import type { ActionHandler } from './types';

// ---------------------------------------------------------------------------
// Subcircuit template definitions
// ---------------------------------------------------------------------------

interface SubcircuitNode {
  label: string;
  type: string;
  desc: string;
  dx: number;
  dy: number;
}

interface SubcircuitEdge {
  src: number;
  tgt: number;
  label: string;
  signal?: string;
}

interface SubcircuitTemplate {
  nodes: SubcircuitNode[];
  edges: SubcircuitEdge[];
}

const SUBCIRCUIT_TEMPLATES: Record<string, SubcircuitTemplate> = {
  power_supply_ldo: {
    nodes: [
      { label: 'LDO Regulator', type: 'power', desc: 'AMS1117-3.3 LDO', dx: 0, dy: 0 },
      { label: 'Input Cap', type: 'passive', desc: '10uF Ceramic', dx: -150, dy: 0 },
      { label: 'Output Cap', type: 'passive', desc: '22uF Ceramic', dx: 150, dy: 0 },
    ],
    edges: [
      { src: 1, tgt: 0, label: 'VIN', signal: 'power' },
      { src: 0, tgt: 2, label: 'VOUT', signal: 'power' },
    ],
  },
  usb_interface: {
    nodes: [
      { label: 'USB-C Connector', type: 'connector', desc: 'USB Type-C', dx: 0, dy: 0 },
      { label: 'ESD Protection', type: 'ic', desc: 'USBLC6-2SC6', dx: 150, dy: -60 },
      { label: 'USB-UART Bridge', type: 'ic', desc: 'CP2102N', dx: 300, dy: 0 },
    ],
    edges: [
      { src: 0, tgt: 1, label: 'D+/D-', signal: 'USB' },
      { src: 1, tgt: 2, label: 'D+/D-', signal: 'USB' },
    ],
  },
  spi_flash: {
    nodes: [
      { label: 'SPI Flash', type: 'memory', desc: 'W25Q128 16MB', dx: 0, dy: 0 },
      { label: 'Decoupling Cap', type: 'passive', desc: '100nF Ceramic', dx: 0, dy: 100 },
    ],
    edges: [{ src: 0, tgt: 1, label: 'VCC', signal: 'power' }],
  },
  i2c_sensors: {
    nodes: [
      { label: 'I2C Temp Sensor', type: 'sensor', desc: 'TMP117 +/-0.1C', dx: 0, dy: 0 },
      { label: 'I2C Accel', type: 'sensor', desc: 'LIS3DH 3-axis', dx: 200, dy: 0 },
      { label: 'I2C Pull-ups', type: 'passive', desc: '4.7k SDA/SCL', dx: 100, dy: -80 },
    ],
    edges: [
      { src: 2, tgt: 0, label: 'I2C', signal: 'I2C' },
      { src: 2, tgt: 1, label: 'I2C', signal: 'I2C' },
    ],
  },
  uart_debug: {
    nodes: [
      { label: 'Debug Header', type: 'connector', desc: 'UART 3-pin', dx: 0, dy: 0 },
      { label: 'Level Shifter', type: 'ic', desc: 'TXB0102', dx: 150, dy: 0 },
    ],
    edges: [{ src: 0, tgt: 1, label: 'TX/RX', signal: 'UART' }],
  },
  battery_charger: {
    nodes: [
      { label: 'Charger IC', type: 'power', desc: 'MCP73831', dx: 0, dy: 0 },
      { label: 'Battery', type: 'power', desc: 'Li-Po 3.7V', dx: 200, dy: 0 },
      { label: 'Charge LED', type: 'passive', desc: 'Red LED + 1k', dx: 0, dy: 100 },
    ],
    edges: [
      { src: 0, tgt: 1, label: 'BAT', signal: 'power' },
      { src: 0, tgt: 2, label: 'STAT', signal: 'GPIO' },
    ],
  },
  motor_driver: {
    nodes: [
      { label: 'H-Bridge', type: 'actuator', desc: 'DRV8833', dx: 0, dy: 0 },
      { label: 'Motor A', type: 'actuator', desc: 'DC Motor', dx: 200, dy: -60 },
      { label: 'Motor B', type: 'actuator', desc: 'DC Motor', dx: 200, dy: 60 },
      { label: 'Flyback Diodes', type: 'passive', desc: 'SS14 x4', dx: -150, dy: 0 },
    ],
    edges: [
      { src: 0, tgt: 1, label: 'OUT_A', signal: 'power' },
      { src: 0, tgt: 2, label: 'OUT_B', signal: 'power' },
      { src: 3, tgt: 0, label: 'Protection', signal: 'power' },
    ],
  },
  led_driver: {
    nodes: [
      { label: 'LED Driver', type: 'ic', desc: 'TLC5947 24-ch', dx: 0, dy: 0 },
      { label: 'RGB LEDs', type: 'actuator', desc: 'WS2812B Strip', dx: 200, dy: 0 },
      { label: 'Current Resistor', type: 'passive', desc: 'Iref 2k', dx: 0, dy: 100 },
    ],
    edges: [
      { src: 0, tgt: 1, label: 'PWM', signal: 'SPI' },
      { src: 2, tgt: 0, label: 'IREF', signal: 'analog' },
    ],
  },
  adc_frontend: {
    nodes: [
      { label: 'ADC', type: 'ic', desc: 'ADS1115 16-bit', dx: 0, dy: 0 },
      { label: 'Anti-alias Filter', type: 'passive', desc: 'RC LPF 1kHz', dx: -150, dy: 0 },
      { label: 'Ref Voltage', type: 'power', desc: 'REF3030 3.0V', dx: 0, dy: 100 },
    ],
    edges: [
      { src: 1, tgt: 0, label: 'AIN', signal: 'analog' },
      { src: 2, tgt: 0, label: 'VREF', signal: 'power' },
    ],
  },
  dac_output: {
    nodes: [
      { label: 'DAC', type: 'ic', desc: 'MCP4725 12-bit', dx: 0, dy: 0 },
      { label: 'Output Buffer', type: 'ic', desc: 'OPA340 Op-Amp', dx: 200, dy: 0 },
    ],
    edges: [{ src: 0, tgt: 1, label: 'VOUT', signal: 'analog' }],
  },
};

// ---------------------------------------------------------------------------
// Helper: type ordering for hierarchical layout.
// ---------------------------------------------------------------------------
const LAYOUT_TYPE_ORDER: Record<string, number> = {
  power: 0, mcu: 1, comm: 2, sensor: 3, connector: 4,
  memory: 5, actuator: 6, ic: 7, passive: 8, module: 9,
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const addNode: ActionHandler = (action, ctx) => {
  const newNode: Node = {
    id: crypto.randomUUID(),
    type: 'custom' as const,
    position: {
      x: action.positionX || 200 + Math.random() * 400,
      y: action.positionY || 100 + Math.random() * 300,
    },
    data: {
      label: action.label,
      type: action.nodeType || 'generic',
      description: action.description || '',
    },
  };
  ctx.state.currentNodes = [...ctx.state.currentNodes, newNode];
  ctx.state.nodesDirty = true;
  ctx.arch.setActiveView('architecture');
  ctx.history.addToHistory(`Added ${action.nodeType || 'component'}: ${action.label}`, 'AI');
  ctx.output.addOutputLog(`[AI] Added node: ${action.label}`);
};

const removeNode: ActionHandler = (action, ctx) => {
  const nodeToRemove = ctx.state.currentNodes.find(
    (n) => nodeData(n).label.toLowerCase() === action.nodeLabel!.toLowerCase(),
  );
  if (nodeToRemove) {
    ctx.state.currentNodes = ctx.state.currentNodes.filter((n) => n.id !== nodeToRemove.id);
    ctx.state.currentEdges = ctx.state.currentEdges.filter(
      (e) => e.source !== nodeToRemove.id && e.target !== nodeToRemove.id,
    );
    ctx.state.nodesDirty = true;
    ctx.state.edgesDirty = true;
    ctx.history.addToHistory(`Removed node: ${action.nodeLabel}`, 'AI');
    ctx.output.addOutputLog(`[AI] Removed node: ${action.nodeLabel}`);
  }
};

const updateNode: ActionHandler = (action, ctx) => {
  const nodeToUpdate = ctx.state.currentNodes.find(
    (n) => nodeData(n).label.toLowerCase() === action.nodeLabel!.toLowerCase(),
  );
  if (nodeToUpdate) {
    const nd = nodeData(nodeToUpdate);
    ctx.state.currentNodes = ctx.state.currentNodes.map((n) =>
      n.id === nodeToUpdate.id
        ? {
            ...n,
            data: {
              ...n.data,
              label: action.newLabel || nd.label,
              type: action.newType || nd.type,
              description: action.newDescription || nd.description,
            },
          }
        : n,
    );
    ctx.state.nodesDirty = true;
    ctx.history.addToHistory(`Updated node: ${action.nodeLabel}`, 'AI');
    ctx.output.addOutputLog(`[AI] Updated node: ${action.nodeLabel}`);
  }
};

const addAnnotation: ActionHandler = (action, ctx) => {
  const annotNode = ctx.state.currentNodes.find(
    (n) => nodeData(n).label.toLowerCase().includes(action.nodeLabel!.toLowerCase()),
  );
  if (annotNode) {
    ctx.state.currentNodes = ctx.state.currentNodes.map((n) =>
      n.id === annotNode.id
        ? { ...n, data: { ...n.data, annotation: action.note, annotationColor: action.color || 'yellow' } }
        : n,
    );
    ctx.state.nodesDirty = true;
  }
  ctx.history.addToHistory(`Annotation on ${action.nodeLabel}: ${action.note}`, 'AI');
  ctx.output.addOutputLog(`[AI] Added annotation to ${action.nodeLabel}`);
};

const setPinMap: ActionHandler = (action, ctx) => {
  const pinNode = ctx.state.currentNodes.find(
    (n) => nodeData(n).label.toLowerCase().includes(action.nodeLabel!.toLowerCase()),
  );
  if (pinNode) {
    ctx.state.currentNodes = ctx.state.currentNodes.map((n) =>
      n.id === pinNode.id ? { ...n, data: { ...n.data, pins: action.pins } } : n,
    );
    ctx.state.nodesDirty = true;
    ctx.history.addToHistory(`Set pin map for ${action.nodeLabel}`, 'AI');
    ctx.output.addOutputLog(`[AI] Set ${Object.keys(action.pins!).length} pin assignments for ${action.nodeLabel}`);
  }
};

const autoAssignPins: ActionHandler = (action, ctx) => {
  const targetNode = ctx.state.currentNodes.find(
    (n) => nodeData(n).label.toLowerCase().includes(action.nodeLabel!.toLowerCase()),
  );
  if (targetNode) {
    const connectedEdges = ctx.state.currentEdges.filter(
      (e) => e.source === targetNode.id || e.target === targetNode.id,
    );
    const autoPins: Record<string, string> = {};
    connectedEdges.forEach((e, i) => {
      const otherNode = ctx.state.currentNodes.find(
        (n) => n.id === (e.source === targetNode.id ? e.target : e.source),
      );
      const pinName = String(e.label || '') || edgeData(e)?.signalType || `PIN_${i}`;
      autoPins[pinName] = String(otherNode ? nodeData(otherNode).label : '') || `GPIO${i}`;
    });
    ctx.state.currentNodes = ctx.state.currentNodes.map((n) =>
      n.id === targetNode.id ? { ...n, data: { ...n.data, pins: autoPins } } : n,
    );
    ctx.state.nodesDirty = true;
    ctx.history.addToHistory(`Auto-assigned pins for ${action.nodeLabel}`, 'AI');
    ctx.output.addOutputLog(`[AI] Auto-assigned ${Object.keys(autoPins).length} pins for ${action.nodeLabel}`);
  }
};

const connectNodes: ActionHandler = (action, ctx) => {
  const sourceNode = ctx.state.currentNodes.find(
    (n) => nodeData(n).label.toLowerCase().includes(action.sourceLabel!.toLowerCase()),
  );
  const targetNode = ctx.state.currentNodes.find(
    (n) => nodeData(n).label.toLowerCase().includes(action.targetLabel!.toLowerCase()),
  );
  if (sourceNode && targetNode) {
    const newEdge: Edge = {
      id: crypto.randomUUID(),
      source: sourceNode.id,
      target: targetNode.id,
      label: action.edgeLabel || action.busType || 'Data',
      animated: true,
      data: {
        signalType: action.signalType || undefined,
        voltage: action.voltage || undefined,
        busWidth: action.busWidth || undefined,
        netName: action.netName || undefined,
      },
    };
    ctx.state.currentEdges = [...ctx.state.currentEdges, newEdge];
    ctx.state.edgesDirty = true;
    ctx.history.addToHistory(`Connected ${nodeData(sourceNode).label} → ${nodeData(targetNode).label}`, 'AI');
    ctx.output.addOutputLog(`[AI] Connected ${nodeData(sourceNode).label} → ${nodeData(targetNode).label}`);
  }
};

const removeEdge: ActionHandler = (action, ctx) => {
  const srcNode = ctx.state.currentNodes.find(
    (n) => nodeData(n).label.toLowerCase().includes(action.sourceLabel!.toLowerCase()),
  );
  const tgtNode = ctx.state.currentNodes.find(
    (n) => nodeData(n).label.toLowerCase().includes(action.targetLabel!.toLowerCase()),
  );
  if (srcNode && tgtNode) {
    ctx.state.currentEdges = ctx.state.currentEdges.filter(
      (e) => !(e.source === srcNode.id && e.target === tgtNode.id),
    );
    ctx.state.edgesDirty = true;
    ctx.history.addToHistory(`Removed edge: ${action.sourceLabel} → ${action.targetLabel}`, 'AI');
    ctx.output.addOutputLog(`[AI] Removed edge: ${action.sourceLabel} → ${action.targetLabel}`);
  }
};

const assignNetName: ActionHandler = (action, ctx) => {
  const src = ctx.state.currentNodes.find(
    (n) => nodeData(n).label.toLowerCase().includes(action.sourceLabel!.toLowerCase()),
  );
  const tgt = ctx.state.currentNodes.find(
    (n) => nodeData(n).label.toLowerCase().includes(action.targetLabel!.toLowerCase()),
  );
  if (src && tgt) {
    ctx.state.currentEdges = ctx.state.currentEdges.map((e) =>
      e.source === src.id && e.target === tgt.id
        ? { ...e, data: { ...e.data, netName: action.netName }, label: action.netName }
        : e,
    );
    ctx.state.edgesDirty = true;
    ctx.history.addToHistory(`Named net: ${action.netName}`, 'AI');
    ctx.output.addOutputLog(`[AI] Assigned net name '${action.netName}' to ${action.sourceLabel} -> ${action.targetLabel}`);
  }
};

const clearCanvas: ActionHandler = (_action, ctx) => {
  ctx.state.currentNodes = [];
  ctx.state.currentEdges = [];
  ctx.state.nodesDirty = true;
  ctx.state.edgesDirty = true;
  ctx.history.addToHistory('Cleared all architecture nodes', 'AI');
  ctx.output.addOutputLog('[AI] Cleared all nodes and edges');
};

const generateArchitecture: ActionHandler = (action, ctx) => {
  const genNodes = (action.components || []).map((comp: GenComponent, idx: number) => ({
    id: `gen-${crypto.randomUUID()}-${idx}`,
    type: 'custom' as const,
    position: { x: comp.positionX, y: comp.positionY },
    data: { label: comp.label, type: comp.nodeType, description: comp.description },
  }));
  const genEdges = (action.connections || []).map((conn: GenConnection, idx: number) => {
    const srcGen = genNodes.find((n) => n.data.label === conn.sourceLabel);
    const tgtGen = genNodes.find((n) => n.data.label === conn.targetLabel);
    return {
      id: `gen-e-${crypto.randomUUID()}-${idx}`,
      source: srcGen?.id || '',
      target: tgtGen?.id || '',
      label: conn.label,
      animated: true,
    };
  }).filter((e) => e.source && e.target);

  ctx.state.currentNodes = genNodes;
  ctx.state.currentEdges = genEdges;
  ctx.state.nodesDirty = true;
  ctx.state.edgesDirty = true;
  ctx.arch.setActiveView('architecture');
  ctx.history.addToHistory(`Generated architecture with ${genNodes.length} components`, 'AI');
  ctx.output.addOutputLog(`[AI] Generated architecture: ${genNodes.length} components, ${genEdges.length} connections`);
};

const autoLayout: ActionHandler = (action, ctx) => {
  if (ctx.state.currentNodes.length === 0) { return; }
  const layoutType = action.layout || 'hierarchical';
  let arranged: Node[];

  if (layoutType === 'grid') {
    const cols = Math.ceil(Math.sqrt(ctx.state.currentNodes.length));
    arranged = ctx.state.currentNodes.map((n, i) => ({
      ...n,
      position: { x: 100 + (i % cols) * 220, y: 100 + Math.floor(i / cols) * 180 },
    }));
  } else if (layoutType === 'circular') {
    const cx = 400, cy = 300, r = 200;
    arranged = ctx.state.currentNodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / ctx.state.currentNodes.length - Math.PI / 2;
      return { ...n, position: { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) } };
    });
  } else if (layoutType === 'force') {
    const spacing = 250;
    arranged = ctx.state.currentNodes.map((n, i) => ({
      ...n,
      position: {
        x: 100 + (i % 3) * spacing + (Math.random() * 40 - 20),
        y: 100 + Math.floor(i / 3) * spacing + (Math.random() * 40 - 20),
      },
    }));
  } else {
    // hierarchical (default)
    const sorted = [...ctx.state.currentNodes].sort(
      (a, b) => (LAYOUT_TYPE_ORDER[nodeData(a).type] ?? 5) - (LAYOUT_TYPE_ORDER[nodeData(b).type] ?? 5),
    );
    let col = 0;
    let lastType = '';
    let row = 0;
    arranged = sorted.map((n) => {
      const nd = nodeData(n);
      if (nd.type !== lastType) { col++; row = 0; lastType = nd.type; }
      row++;
      return { ...n, position: { x: 80 + col * 220, y: 60 + row * 160 } };
    });
  }

  ctx.state.currentNodes = arranged;
  ctx.state.nodesDirty = true;
  ctx.arch.setActiveView('architecture');
  ctx.history.addToHistory(`Auto-arranged layout (${layoutType})`, 'AI');
  ctx.output.addOutputLog(`[AI] Auto-arranged ${ctx.state.currentNodes.length} nodes using ${layoutType} layout`);
};

const addSubcircuit: ActionHandler = (action, ctx) => {
  const tmpl = SUBCIRCUIT_TEMPLATES[action.template!];
  if (!tmpl) { return; }
  const baseX = action.positionX || 200 + Math.random() * 300;
  const baseY = action.positionY || 100 + Math.random() * 200;
  const batchId = crypto.randomUUID().substring(0, 8);
  const newNodes = tmpl.nodes.map((n, i) => ({
    id: `sc-${batchId}-${i}`,
    type: 'custom' as const,
    position: { x: baseX + n.dx, y: baseY + n.dy },
    data: { label: n.label, type: n.type, description: n.desc },
  }));
  const newEdges = tmpl.edges.map((e, i) => ({
    id: `sce-${batchId}-${i}`,
    source: newNodes[e.src].id,
    target: newNodes[e.tgt].id,
    label: e.label,
    animated: true,
    data: { signalType: e.signal },
  }));
  ctx.state.currentNodes = [...ctx.state.currentNodes, ...newNodes];
  ctx.state.currentEdges = [...ctx.state.currentEdges, ...newEdges];
  ctx.state.nodesDirty = true;
  ctx.state.edgesDirty = true;
  ctx.arch.setActiveView('architecture');
  ctx.history.addToHistory(`Added sub-circuit: ${action.template}`, 'AI');
  ctx.output.addOutputLog(`[AI] Added ${action.template} sub-circuit (${newNodes.length} components)`);
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const architectureHandlers: Record<string, ActionHandler> = {
  add_node: addNode,
  remove_node: removeNode,
  update_node: updateNode,
  add_annotation: addAnnotation,
  set_pin_map: setPinMap,
  auto_assign_pins: autoAssignPins,
  connect_nodes: connectNodes,
  remove_edge: removeEdge,
  assign_net_name: assignNetName,
  clear_canvas: clearCanvas,
  generate_architecture: generateArchitecture,
  auto_layout: autoLayout,
  add_subcircuit: addSubcircuit,
};
