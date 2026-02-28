import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useValidation } from '@/lib/contexts/validation-context';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { useHistory } from '@/lib/contexts/history-context';
import { useOutput } from '@/lib/contexts/output-context';
import { buildCSV, downloadBlob } from '@/lib/csv';
import type { BomItem } from '@/lib/project-context';
import { ACTION_LABELS } from '../constants';
import type { AIAction, GenComponent, GenConnection } from '../chat-types';
import { nodeData, edgeData } from '../chat-types';

// ---------------------------------------------------------------------------
// Subcircuit template definitions — kept outside the hook to avoid
// re-creating on every render.
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

const TUTORIALS: Record<string, string[]> = {
  getting_started: [
    'Welcome to ProtoPulse! Let me guide you through the basics.',
    '1. The Architecture View is your main workspace — drag and connect components to build your system.',
    '2. Use the AI chat (that\'s me!) to add components, run validations, or get design advice.',
    '3. Try saying "add an ESP32 MCU" to place your first component.',
    '4. Check the Procurement tab to manage your Bill of Materials.',
    '5. Use Validation to check your design for common issues.',
  ],
  power_design: [
    'Power Design Tutorial',
    '1. Start with your input power source (USB, battery, wall adapter).',
    '2. Add voltage regulators to generate required rails (3.3V, 1.8V, etc.).',
    '3. Always add bulk + bypass capacitors near regulators.',
    '4. Consider power sequencing for multi-rail designs.',
    '5. Run "power budget analysis" to verify current capacity.',
  ],
  pcb_layout: [
    'PCB Layout Best Practices',
    '1. Place high-speed components first, keep traces short.',
    '2. Use ground planes on inner layers for noise reduction.',
    '3. Route power traces wider than signal traces.',
    '4. Keep analog and digital sections separated.',
    '5. Add test points for debugging prototype boards.',
  ],
  bom_management: [
    'BOM Management Guide',
    '1. Every component on your diagram should have a BOM entry.',
    '2. Use "optimize BOM" to find cost savings.',
    '3. Check lead times before ordering — some parts take months!',
    '4. Consider second-source alternatives for critical parts.',
    '5. Export your BOM as CSV for procurement teams.',
  ],
  validation: [
    'Design Validation Guide',
    '1. Run validation regularly as you add components.',
    '2. Fix errors (red) first — they can cause board failures.',
    '3. Warnings (yellow) are important but non-critical.',
    '4. Use "auto-fix" to automatically add missing components.',
    '5. Run DFM check before sending to fabrication.',
  ],
};

const PARAMETRIC_SEARCH_DB: Record<string, Array<{ pn: string; mfr: string; price: number; desc: string }>> = {
  mcu: [
    { pn: 'STM32F103C8T6', mfr: 'ST', price: 2.50, desc: 'ARM Cortex-M3, 72MHz, 64KB Flash' },
    { pn: 'ATMEGA328P-AU', mfr: 'Microchip', price: 1.80, desc: 'AVR 8-bit, 20MHz, 32KB Flash' },
    { pn: 'RP2040', mfr: 'Raspberry Pi', price: 0.80, desc: 'Dual Cortex-M0+, 133MHz, 264KB RAM' },
  ],
  sensor: [
    { pn: 'BME280', mfr: 'Bosch', price: 2.50, desc: 'Temp/Humidity/Pressure' },
    { pn: 'MPU-6050', mfr: 'TDK', price: 1.90, desc: '6-axis IMU (Accel + Gyro)' },
    { pn: 'BH1750', mfr: 'ROHM', price: 0.85, desc: 'Ambient Light Sensor I2C' },
  ],
  regulator: [
    { pn: 'AMS1117-3.3', mfr: 'AMS', price: 0.12, desc: '3.3V LDO 1A SOT-223' },
    { pn: 'AP2112K-3.3', mfr: 'Diodes Inc', price: 0.20, desc: '3.3V LDO 600mA SOT-23-5' },
    { pn: 'TPS63020', mfr: 'TI', price: 2.80, desc: 'Buck-Boost 3.3V 96% eff' },
  ],
  capacitor: [
    { pn: 'GRM188R71C104KA01', mfr: 'Murata', price: 0.01, desc: '100nF 16V X7R 0603' },
    { pn: 'GRM21BR61C106KE15', mfr: 'Murata', price: 0.05, desc: '10uF 16V X5R 0805' },
  ],
};

const SUGGEST_ALT_DB: Record<string, Array<{ pn: string; mfr: string; price: number; note: string }>> = {
  'ESP32': [
    { pn: 'ESP32-C3-MINI-1', mfr: 'Espressif', price: 1.80, note: 'Lower cost, single-core RISC-V, BLE only' },
    { pn: 'RP2040', mfr: 'Raspberry Pi', price: 0.80, note: 'Dual-core Cortex-M0+, no wireless' },
    { pn: 'nRF52840', mfr: 'Nordic', price: 3.10, note: 'BLE 5.0, better power efficiency' },
  ],
  'SX1262': [
    { pn: 'RFM95W', mfr: 'HopeRF', price: 3.50, note: 'Budget LoRa module, slightly lower performance' },
    { pn: 'LLCC68', mfr: 'Semtech', price: 2.80, note: 'Cost-optimized LoRa, lower power' },
  ],
  'SHT40': [
    { pn: 'HDC1080', mfr: 'TI', price: 1.20, note: 'Lower cost, slightly less accurate' },
    { pn: 'BME280', mfr: 'Bosch', price: 2.50, note: 'Adds pressure sensing, widely available' },
  ],
};

const TYPE_PROMPTS: Record<string, string> = {
  iot: 'Focus on low power, wireless connectivity, sensor integration, battery life optimization',
  wearable: 'Prioritize small form factor, ultra-low power, flexible PCB, biocompatible materials',
  industrial: 'Emphasize reliability, wide temp range (-40C to 85C), robust connectors, surge protection',
  automotive: 'Apply ASIL standards, AEC-Q qualified components, wide voltage input (6-36V), EMC compliance',
  consumer: 'Focus on cost optimization, ease of assembly, compact design, user-friendly interfaces',
  medical: 'Prioritize safety (IEC 60601), biocompatibility, isolation, ultra-low noise analog',
  rf: 'Focus on impedance matching, shielding, filter design, spurious emission compliance',
  power: 'Emphasize efficiency, thermal management, wide input range, protection circuits',
};

// ---------------------------------------------------------------------------
// Helper: typical current draw per component type (mA) for power budget.
// ---------------------------------------------------------------------------
const TYPICAL_CURRENT_MA: Record<string, number> = {
  mcu: 80, sensor: 5, comm: 120, memory: 30, actuator: 200, ic: 20,
  connector: 0, passive: 0, module: 50,
};

// ---------------------------------------------------------------------------
// Helper: type ordering for hierarchical layout.
// ---------------------------------------------------------------------------
const LAYOUT_TYPE_ORDER: Record<string, number> = {
  power: 0, mcu: 1, comm: 2, sensor: 3, connector: 4,
  memory: 5, actuator: 6, ic: 7, passive: 8, module: 9,
};

/**
 * Hook that returns a function to execute AI-generated actions against the
 * project state.  Each action type corresponds to a mutation on the relevant
 * domain context.
 *
 * **Accumulator pattern**: The returned callback copies the current state
 * arrays (`nodes`, `edges`, `bom`, `issues`) into local mutable accumulators
 * before entering the action loop. Every case reads from and writes to the
 * accumulators, then a single `setNodes(currentNodes)` / `setEdges(currentEdges)`
 * call at the end commits all changes atomically. This prevents the stale-
 * closure bug where multi-action sequences would silently drop earlier
 * mutations.
 */
export function useActionExecutor(): (actions: AIAction[]) => string[] {
  const {
    setNodes, setEdges, nodes, edges, pushUndoState, undo, redo,
  } = useArchitecture();
  const { bom, addBomItem, deleteBomItem, updateBomItem } = useBom();
  const { runValidation, addValidationIssue, deleteValidationIssue, issues } = useValidation();
  const {
    setActiveView, projectName, projectDescription, setProjectName, setProjectDescription,
  } = useProjectMeta();
  const { addToHistory } = useHistory();
  const { addOutputLog } = useOutput();

  return useCallback((actions: AIAction[]): string[] => {
    pushUndoState();
    const executedLabels: string[] = [];

    // ---- Local mutable accumulators ----
    // Every case reads/writes these instead of the closure-captured state.
    let currentNodes: Node[] = [...nodes];
    let currentEdges: Edge[] = [...edges];
    let currentBom: BomItem[] = [...bom];
    let currentIssues = [...issues];

    // Track whether nodes/edges/bom were mutated so we only commit if needed.
    let nodesDirty = false;
    let edgesDirty = false;

    for (const action of actions) {
      const label = ACTION_LABELS[action.type] || action.type;
      executedLabels.push(label);

      switch (action.type) {
        // ---------------------------------------------------------------
        // View / Project Meta
        // ---------------------------------------------------------------
        case 'switch_view':
          setActiveView(action.view!);
          addToHistory(`Switched to ${action.view} view`, 'AI');
          addOutputLog(`[AI] Switched to ${action.view} view`);
          break;

        case 'rename_project':
          setProjectName(action.name!);
          addToHistory(`Renamed project to: ${action.name}`, 'AI');
          addOutputLog(`[AI] Renamed project to: ${action.name}`);
          break;

        case 'update_description':
          setProjectDescription(action.description!);
          addToHistory('Updated project description', 'AI');
          addOutputLog(`[AI] Updated description: ${action.description}`);
          break;

        case 'set_project_type': {
          const guidance = TYPE_PROMPTS[action.projectType!] || 'General electronics design guidance';
          setProjectDescription(`${projectDescription} [Type: ${action.projectType}]`);
          addToHistory(`Set project type: ${action.projectType}`, 'AI');
          addOutputLog(`[AI] Project type set to ${action.projectType}. ${guidance}`);
          break;
        }

        // ---------------------------------------------------------------
        // Architecture — Nodes
        // ---------------------------------------------------------------
        case 'add_node': {
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
          currentNodes = [...currentNodes, newNode];
          nodesDirty = true;
          setActiveView('architecture');
          addToHistory(`Added ${action.nodeType || 'component'}: ${action.label}`, 'AI');
          addOutputLog(`[AI] Added node: ${action.label}`);
          break;
        }

        case 'remove_node': {
          const nodeToRemove = currentNodes.find(
            (n) => nodeData(n).label.toLowerCase() === action.nodeLabel!.toLowerCase(),
          );
          if (nodeToRemove) {
            currentNodes = currentNodes.filter((n) => n.id !== nodeToRemove.id);
            currentEdges = currentEdges.filter(
              (e) => e.source !== nodeToRemove.id && e.target !== nodeToRemove.id,
            );
            nodesDirty = true;
            edgesDirty = true;
            addToHistory(`Removed node: ${action.nodeLabel}`, 'AI');
            addOutputLog(`[AI] Removed node: ${action.nodeLabel}`);
          }
          break;
        }

        case 'update_node': {
          const nodeToUpdate = currentNodes.find(
            (n) => nodeData(n).label.toLowerCase() === action.nodeLabel!.toLowerCase(),
          );
          if (nodeToUpdate) {
            const nd = nodeData(nodeToUpdate);
            currentNodes = currentNodes.map((n) =>
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
            nodesDirty = true;
            addToHistory(`Updated node: ${action.nodeLabel}`, 'AI');
            addOutputLog(`[AI] Updated node: ${action.nodeLabel}`);
          }
          break;
        }

        case 'add_annotation': {
          const annotNode = currentNodes.find(
            (n) => nodeData(n).label.toLowerCase().includes(action.nodeLabel!.toLowerCase()),
          );
          if (annotNode) {
            currentNodes = currentNodes.map((n) =>
              n.id === annotNode.id
                ? { ...n, data: { ...n.data, annotation: action.note, annotationColor: action.color || 'yellow' } }
                : n,
            );
            nodesDirty = true;
          }
          addToHistory(`Annotation on ${action.nodeLabel}: ${action.note}`, 'AI');
          addOutputLog(`[AI] Added annotation to ${action.nodeLabel}`);
          break;
        }

        case 'set_pin_map': {
          const pinNode = currentNodes.find(
            (n) => nodeData(n).label.toLowerCase().includes(action.nodeLabel!.toLowerCase()),
          );
          if (pinNode) {
            currentNodes = currentNodes.map((n) =>
              n.id === pinNode.id ? { ...n, data: { ...n.data, pins: action.pins } } : n,
            );
            nodesDirty = true;
            addToHistory(`Set pin map for ${action.nodeLabel}`, 'AI');
            addOutputLog(`[AI] Set ${Object.keys(action.pins!).length} pin assignments for ${action.nodeLabel}`);
          }
          break;
        }

        case 'auto_assign_pins': {
          const targetNode = currentNodes.find(
            (n) => nodeData(n).label.toLowerCase().includes(action.nodeLabel!.toLowerCase()),
          );
          if (targetNode) {
            const connectedEdges = currentEdges.filter(
              (e) => e.source === targetNode.id || e.target === targetNode.id,
            );
            const autoPins: Record<string, string> = {};
            connectedEdges.forEach((e, i) => {
              const otherNode = currentNodes.find(
                (n) => n.id === (e.source === targetNode.id ? e.target : e.source),
              );
              const pinName = String(e.label || '') || edgeData(e)?.signalType || `PIN_${i}`;
              autoPins[pinName] = String(otherNode ? nodeData(otherNode).label : '') || `GPIO${i}`;
            });
            currentNodes = currentNodes.map((n) =>
              n.id === targetNode.id ? { ...n, data: { ...n.data, pins: autoPins } } : n,
            );
            nodesDirty = true;
            addToHistory(`Auto-assigned pins for ${action.nodeLabel}`, 'AI');
            addOutputLog(`[AI] Auto-assigned ${Object.keys(autoPins).length} pins for ${action.nodeLabel}`);
          }
          break;
        }

        // ---------------------------------------------------------------
        // Architecture — Edges
        // ---------------------------------------------------------------
        case 'connect_nodes': {
          const sourceNode = currentNodes.find(
            (n) => nodeData(n).label.toLowerCase().includes(action.sourceLabel!.toLowerCase()),
          );
          const targetNode = currentNodes.find(
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
            currentEdges = [...currentEdges, newEdge];
            edgesDirty = true;
            addToHistory(`Connected ${nodeData(sourceNode).label} → ${nodeData(targetNode).label}`, 'AI');
            addOutputLog(`[AI] Connected ${nodeData(sourceNode).label} → ${nodeData(targetNode).label}`);
          }
          break;
        }

        case 'remove_edge': {
          const srcNode = currentNodes.find(
            (n) => nodeData(n).label.toLowerCase().includes(action.sourceLabel!.toLowerCase()),
          );
          const tgtNode = currentNodes.find(
            (n) => nodeData(n).label.toLowerCase().includes(action.targetLabel!.toLowerCase()),
          );
          if (srcNode && tgtNode) {
            currentEdges = currentEdges.filter(
              (e) => !(e.source === srcNode.id && e.target === tgtNode.id),
            );
            edgesDirty = true;
            addToHistory(`Removed edge: ${action.sourceLabel} → ${action.targetLabel}`, 'AI');
            addOutputLog(`[AI] Removed edge: ${action.sourceLabel} → ${action.targetLabel}`);
          }
          break;
        }

        case 'assign_net_name': {
          const src = currentNodes.find(
            (n) => nodeData(n).label.toLowerCase().includes(action.sourceLabel!.toLowerCase()),
          );
          const tgt = currentNodes.find(
            (n) => nodeData(n).label.toLowerCase().includes(action.targetLabel!.toLowerCase()),
          );
          if (src && tgt) {
            currentEdges = currentEdges.map((e) =>
              e.source === src.id && e.target === tgt.id
                ? { ...e, data: { ...e.data, netName: action.netName }, label: action.netName }
                : e,
            );
            edgesDirty = true;
            addToHistory(`Named net: ${action.netName}`, 'AI');
            addOutputLog(`[AI] Assigned net name '${action.netName}' to ${action.sourceLabel} -> ${action.targetLabel}`);
          }
          break;
        }

        // ---------------------------------------------------------------
        // Architecture — Bulk / Layout
        // ---------------------------------------------------------------
        case 'clear_canvas':
          currentNodes = [];
          currentEdges = [];
          nodesDirty = true;
          edgesDirty = true;
          addToHistory('Cleared all architecture nodes', 'AI');
          addOutputLog('[AI] Cleared all nodes and edges');
          break;

        case 'generate_architecture': {
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

          currentNodes = genNodes;
          currentEdges = genEdges;
          nodesDirty = true;
          edgesDirty = true;
          setActiveView('architecture');
          addToHistory(`Generated architecture with ${genNodes.length} components`, 'AI');
          addOutputLog(`[AI] Generated architecture: ${genNodes.length} components, ${genEdges.length} connections`);
          break;
        }

        case 'auto_layout': {
          if (currentNodes.length === 0) break;
          const layoutType = action.layout || 'hierarchical';
          let arranged: Node[];

          if (layoutType === 'grid') {
            const cols = Math.ceil(Math.sqrt(currentNodes.length));
            arranged = currentNodes.map((n, i) => ({
              ...n,
              position: { x: 100 + (i % cols) * 220, y: 100 + Math.floor(i / cols) * 180 },
            }));
          } else if (layoutType === 'circular') {
            const cx = 400, cy = 300, r = 200;
            arranged = currentNodes.map((n, i) => {
              const angle = (2 * Math.PI * i) / currentNodes.length - Math.PI / 2;
              return { ...n, position: { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) } };
            });
          } else if (layoutType === 'force') {
            const spacing = 250;
            arranged = currentNodes.map((n, i) => ({
              ...n,
              position: {
                x: 100 + (i % 3) * spacing + (Math.random() * 40 - 20),
                y: 100 + Math.floor(i / 3) * spacing + (Math.random() * 40 - 20),
              },
            }));
          } else {
            // hierarchical (default)
            const sorted = [...currentNodes].sort(
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

          currentNodes = arranged;
          nodesDirty = true;
          setActiveView('architecture');
          addToHistory(`Auto-arranged layout (${layoutType})`, 'AI');
          addOutputLog(`[AI] Auto-arranged ${currentNodes.length} nodes using ${layoutType} layout`);
          break;
        }

        case 'add_subcircuit': {
          const tmpl = SUBCIRCUIT_TEMPLATES[action.template!];
          if (!tmpl) break;
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
          currentNodes = [...currentNodes, ...newNodes];
          currentEdges = [...currentEdges, ...newEdges];
          nodesDirty = true;
          edgesDirty = true;
          setActiveView('architecture');
          addToHistory(`Added sub-circuit: ${action.template}`, 'AI');
          addOutputLog(`[AI] Added ${action.template} sub-circuit (${newNodes.length} components)`);
          break;
        }

        // ---------------------------------------------------------------
        // BOM
        // ---------------------------------------------------------------
        case 'add_bom_item': {
          const newBomItem: Omit<BomItem, 'id'> = {
            partNumber: action.partNumber!,
            manufacturer: action.manufacturer!,
            description: action.description!,
            quantity: action.quantity || 1,
            unitPrice: action.unitPrice || 0,
            totalPrice: (action.quantity || 1) * (action.unitPrice || 0),
            supplier: (action.supplier as BomItem['supplier']) || 'Unknown',
            stock: 0,
            status: (action.status as BomItem['status']) || 'In Stock',
          };
          addBomItem(newBomItem);
          // Update accumulator so subsequent actions in the same batch see this item.
          // Placeholder id — the server assigns the real one on persist.
          const placeholderEntry: BomItem = { id: crypto.randomUUID(), ...newBomItem };
          currentBom = [...currentBom, placeholderEntry];
          addToHistory(`Added BOM item: ${action.partNumber}`, 'AI');
          addOutputLog(`[AI] Added BOM item: ${action.partNumber}`);
          break;
        }

        case 'remove_bom_item': {
          const bomItem = currentBom.find(
            (b) => b.partNumber.toLowerCase().includes(action.partNumber!.toLowerCase()),
          );
          if (bomItem) {
            deleteBomItem(bomItem.id);
            currentBom = currentBom.filter((b) => b.id !== bomItem.id);
            addToHistory(`Removed BOM item: ${action.partNumber}`, 'AI');
            addOutputLog(`[AI] Removed BOM item: ${action.partNumber}`);
          }
          break;
        }

        case 'update_bom_item': {
          const bomToUpdate = currentBom.find(
            (b) => b.partNumber.toLowerCase().includes(action.partNumber!.toLowerCase()),
          );
          if (bomToUpdate && updateBomItem) {
            updateBomItem(bomToUpdate.id, action.updates!);
            addToHistory(`Updated BOM item: ${action.partNumber}`, 'AI');
            addOutputLog(`[AI] Updated BOM: ${action.partNumber}`);
          }
          break;
        }

        // Phase 6: Generic server-generated file download handler
        case 'download_file': {
          const filename = action.filename as string | undefined;
          const content = action.content as string | undefined;
          const encoding = action.encoding as string | undefined;
          const mimeType = action.mimeType as string | undefined;
          if (!filename || !content) break;
          let blob: Blob;
          if (encoding === 'base64') {
            const binary = atob(content);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
          } else {
            blob = new Blob([content], { type: mimeType || 'text/plain' });
          }
          downloadBlob(blob, filename);
          addToHistory(`Exported: ${filename}`, 'AI');
          addOutputLog(`[AI] Downloaded: ${filename}`);
          break;
        }

        case 'export_bom_csv': {
          if (currentBom.length > 0) {
            try {
              const headers = ['Part Number', 'Manufacturer', 'Description', 'Quantity', 'Unit Price', 'Total Price', 'Supplier', 'Status'];
              const rows = currentBom.map((item) => [
                item.partNumber, item.manufacturer, item.description,
                item.quantity, item.unitPrice, item.totalPrice,
                item.supplier, item.status,
              ]);
              const csv = buildCSV(headers, rows);
              downloadBlob(new Blob([csv], { type: 'text/csv' }), `${projectName}_BOM.csv`);
              addToHistory('Exported BOM as CSV', 'AI');
              addOutputLog('[AI] Exported BOM as CSV');
            } catch (err) {
              console.warn('Export failed:', err);
            }
          }
          break;
        }

        case 'add_datasheet_link': {
          const dsItem = currentBom.find(
            (b) => b.partNumber.toLowerCase().includes(action.partNumber!.toLowerCase()),
          );
          if (dsItem) {
            updateBomItem(dsItem.id, { leadTime: action.url });
            addToHistory(`Added datasheet for ${action.partNumber}`, 'AI');
            addOutputLog(`[AI] Linked datasheet for ${action.partNumber}: ${action.url}`);
          }
          break;
        }

        case 'optimize_bom': {
          const totalCost = currentBom.reduce((sum: number, b) => sum + (b.unitPrice * b.quantity), 0);
          const supplierCounts: Record<string, number> = {};
          currentBom.forEach((b) => { supplierCounts[b.supplier] = (supplierCounts[b.supplier] || 0) + 1; });
          const primarySupplier = Object.entries(supplierCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'Unknown';

          addValidationIssue({
            severity: 'info',
            message: `BOM Summary: ${currentBom.length} items, $${totalCost.toFixed(2)} total cost, ${Object.keys(supplierCounts).length} suppliers`,
            suggestion: `Consolidate to ${primarySupplier} where possible to reduce shipping costs and simplify procurement.`,
          });

          const expensiveItems = [...currentBom].sort((a, b) => (b.unitPrice * b.quantity) - (a.unitPrice * a.quantity)).slice(0, 3);
          expensiveItems.forEach((item) => {
            addValidationIssue({
              severity: 'info',
              message: `Cost driver: ${item.partNumber} — $${(item.unitPrice * item.quantity).toFixed(2)} (${((item.unitPrice * item.quantity / totalCost) * 100).toFixed(0)}% of BOM)`,
              componentId: item.partNumber,
              suggestion: 'Consider alternative parts or volume pricing to reduce cost.',
            });
          });

          setActiveView('procurement');
          addToHistory('BOM optimization analysis', 'AI');
          addOutputLog(`[AI] BOM analysis: $${totalCost.toFixed(2)} total, ${currentBom.length} items`);
          break;
        }

        case 'pricing_lookup': {
          const pricingItem = currentBom.find(
            (b) => b.partNumber.toLowerCase().includes(action.partNumber!.toLowerCase()),
          );
          if (pricingItem) {
            const distributors = [
              { name: 'Digi-Key', price: pricingItem.unitPrice * (0.95 + Math.random() * 0.15), stock: Math.floor(Math.random() * 5000), leadTime: `${Math.floor(Math.random() * 4) + 1} weeks` },
              { name: 'Mouser', price: pricingItem.unitPrice * (0.9 + Math.random() * 0.2), stock: Math.floor(Math.random() * 3000), leadTime: `${Math.floor(Math.random() * 3) + 1} weeks` },
              { name: 'LCSC', price: pricingItem.unitPrice * (0.7 + Math.random() * 0.3), stock: Math.floor(Math.random() * 50000), leadTime: `${Math.floor(Math.random() * 6) + 2} weeks` },
            ];
            addValidationIssue({
              severity: 'info',
              message: `Pricing for ${action.partNumber}: ${distributors.map((d) => `${d.name}: $${d.price.toFixed(2)} (${d.stock} in stock, ${d.leadTime})`).join(' | ')}`,
              suggestion: `Best price: ${distributors.sort((a, b) => a.price - b.price)[0].name} at $${distributors.sort((a, b) => a.price - b.price)[0].price.toFixed(2)}`,
            });
          }
          setActiveView('procurement');
          addToHistory(`Pricing lookup: ${action.partNumber}`, 'AI');
          addOutputLog(`[AI] Checked pricing for ${action.partNumber}`);
          break;
        }

        case 'suggest_alternatives': {
          const original = currentBom.find(
            (b) => b.partNumber.toLowerCase().includes(action.partNumber!.toLowerCase()),
          );
          if (original) {
            const key = Object.keys(SUGGEST_ALT_DB).find(
              (k) => original.partNumber.toLowerCase().includes(k.toLowerCase()),
            );
            const alts = key
              ? SUGGEST_ALT_DB[key]
              : [
                  { pn: `${original.partNumber}-ALT1`, mfr: original.manufacturer, price: original.unitPrice * 0.85, note: 'Generic equivalent, lower cost' },
                  { pn: `${original.partNumber}-ALT2`, mfr: 'Alternative Mfr', price: original.unitPrice * 0.7, note: 'Budget alternative, verify specs' },
                ];

            alts.forEach((alt) => {
              addValidationIssue({
                severity: 'info',
                message: `Alternative for ${original.partNumber}: ${alt.pn} (${alt.mfr}) — $${alt.price.toFixed(2)} — ${alt.note}`,
                componentId: original.partNumber,
                suggestion: `Switch to save $${(original.unitPrice - alt.price).toFixed(2)} per unit (${action.reason || 'general'} optimization).`,
              });
            });
          }
          setActiveView('procurement');
          addToHistory(`Suggested alternatives for ${action.partNumber}`, 'AI');
          addOutputLog(`[AI] Found alternatives for ${action.partNumber}`);
          break;
        }

        case 'check_lead_times': {
          currentBom.forEach((item) => {
            const weeks = Math.floor(Math.random() * 12) + 1;
            const status: 'error' | 'warning' | 'info' = weeks <= 2 ? 'info' : weeks <= 8 ? 'warning' : 'error';
            addValidationIssue({
              severity: status,
              message: `${item.partNumber}: Est. ${weeks} week lead time (${item.supplier})${weeks > 8 ? ' — LONG LEAD TIME' : ''}`,
              componentId: item.partNumber,
              suggestion: weeks > 8
                ? 'Consider ordering immediately or finding alternative with shorter lead time.'
                : `Standard lead time. ${item.stock > 0 ? `${item.stock} units in stock.` : 'Verify stock before ordering.'}`,
            });
          });
          setActiveView('procurement');
          addToHistory('Checked lead times', 'AI');
          addOutputLog(`[AI] Checked lead times for ${currentBom.length} BOM items`);
          break;
        }

        // ---------------------------------------------------------------
        // Validation
        // ---------------------------------------------------------------
        case 'run_validation':
          runValidation();
          addToHistory('Ran design validation', 'AI');
          addOutputLog('[AI] Ran design validation');
          break;

        case 'clear_validation':
          currentIssues.forEach((issue) => deleteValidationIssue(issue.id));
          currentIssues = [];
          addToHistory('Cleared validation issues', 'AI');
          addOutputLog('[AI] Cleared all validation issues');
          break;

        case 'add_validation_issue':
          addValidationIssue({
            severity: action.severity!,
            message: action.message!,
            componentId: action.componentId,
            suggestion: action.suggestion,
          });
          addToHistory(`Added validation: ${action.message}`, 'AI');
          addOutputLog(`[AI] Added validation issue: ${action.message}`);
          break;

        case 'power_budget_analysis': {
          const powerNodes = currentNodes.filter((n) => nodeData(n).type === 'power');
          const consumers = currentNodes.filter((n) => nodeData(n).type !== 'power');
          const pbIssues: Array<{ severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string }> = [];

          let totalPower = 0;
          consumers.forEach((n) => {
            totalPower += TYPICAL_CURRENT_MA[nodeData(n).type] || 10;
          });

          pbIssues.push({
            severity: 'info',
            message: `Power Budget: Est. ${totalPower}mA total across ${consumers.length} active components. ${powerNodes.length} power source(s) detected.`,
            suggestion: `Verify power supply can deliver >=${Math.ceil(totalPower * 1.2)}mA (20% headroom).`,
          });

          if (totalPower > 500) {
            pbIssues.push({
              severity: 'warning',
              message: `High power consumption (${totalPower}mA). Consider low-power modes or additional power sources.`,
              suggestion: 'Add sleep mode configuration or secondary power supply.',
            });
          }

          pbIssues.forEach((issue) => addValidationIssue(issue));
          setActiveView('validation');
          addToHistory('Power budget analysis', 'AI');
          addOutputLog(`[AI] Power budget: ${totalPower}mA across ${consumers.length} consumers`);
          break;
        }

        case 'voltage_domain_check': {
          const voltageIssues: Array<{ severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string }> = [];

          currentEdges.forEach((e) => {
            const voltage = edgeData(e)?.voltage || e.label;
            if (voltage && (String(voltage).includes('5V') || String(voltage).includes('3.3V') || String(voltage).includes('1.8V'))) {
              const srcN = currentNodes.find((n) => n.id === e.source);
              const tgtN = currentNodes.find((n) => n.id === e.target);
              if (srcN && tgtN) {
                const srcEdges = currentEdges.filter((ed) => ed.source === srcN.id || ed.target === srcN.id);
                const tgtEdges = currentEdges.filter((ed) => ed.source === tgtN.id || ed.target === tgtN.id);
                const srcVoltages = srcEdges.map((ed) => edgeData(ed)?.voltage || ed.label).filter(Boolean);
                const tgtVoltages = tgtEdges.map((ed) => edgeData(ed)?.voltage || ed.label).filter(Boolean);
                const has5V = srcVoltages.some((v) => String(v).includes('5V')) || tgtVoltages.some((v) => String(v).includes('5V'));
                const has3V3 = srcVoltages.some((v) => String(v).includes('3.3V')) || tgtVoltages.some((v) => String(v).includes('3.3V'));
                if (has5V && has3V3) {
                  voltageIssues.push({
                    severity: 'warning',
                    message: `Voltage domain crossing: ${nodeData(srcN).label} <-> ${nodeData(tgtN).label} bridges 5V and 3.3V domains`,
                    componentId: String(nodeData(srcN).label ?? ''),
                    suggestion: 'Add a level shifter (e.g., TXB0108) between voltage domains.',
                  });
                }
              }
            }
          });

          if (voltageIssues.length === 0) {
            voltageIssues.push({
              severity: 'info',
              message: 'No voltage domain mismatches detected.',
              suggestion: 'All connections appear to be within compatible voltage domains.',
            });
          }

          voltageIssues.forEach((issue) => addValidationIssue(issue));
          setActiveView('validation');
          addToHistory('Voltage domain check', 'AI');
          addOutputLog(`[AI] Voltage domain check: ${voltageIssues.length} findings`);
          break;
        }

        case 'auto_fix_validation': {
          let fixCount = 0;
          const fixNodes: Node[] = [];

          currentIssues.forEach((issue, idx) => {
            const msg = issue.message.toLowerCase();
            if (msg.includes('decoupling') || msg.includes('capacitor')) {
              fixNodes.push({
                id: crypto.randomUUID(),
                type: 'custom' as const,
                position: { x: 100 + Math.random() * 600, y: 450 + idx * 80 },
                data: { label: `Decoupling Cap ${idx + 1}`, type: 'passive', description: '100nF + 10uF ceramic' },
              });
              fixCount++;
            } else if (msg.includes('pull-up') || msg.includes('pullup') || msg.includes('pull up')) {
              fixNodes.push({
                id: crypto.randomUUID(),
                type: 'custom' as const,
                position: { x: 100 + Math.random() * 600, y: 450 + idx * 80 },
                data: { label: `Pull-up Resistors ${idx + 1}`, type: 'passive', description: '4.7k' },
              });
              fixCount++;
            } else if (msg.includes('esd') || msg.includes('protection')) {
              fixNodes.push({
                id: crypto.randomUUID(),
                type: 'custom' as const,
                position: { x: 100 + Math.random() * 600, y: 450 + idx * 80 },
                data: { label: `ESD Protection ${idx + 1}`, type: 'ic', description: 'TVS Diode Array' },
              });
              fixCount++;
            }
          });

          if (fixNodes.length > 0) {
            currentNodes = [...currentNodes, ...fixNodes];
            nodesDirty = true;
          }

          setActiveView('architecture');
          addToHistory(`Auto-fixed ${fixCount} validation issues`, 'AI');
          addOutputLog(`[AI] Auto-fixed ${fixCount} issues, added ${fixNodes.length} components`);
          break;
        }

        case 'dfm_check': {
          const dfmIssues: Array<{ severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string }> = [];

          currentNodes.forEach((n) => {
            const nd = nodeData(n);
            const nodeLabel = nd.label?.toLowerCase() || '';
            const type = nd.type?.toLowerCase() || '';

            if (nodeLabel.includes('qfn') || nodeLabel.includes('bga') || nodeLabel.includes('wlcsp')) {
              dfmIssues.push({
                severity: 'warning',
                message: `${nd.label} uses a fine-pitch package requiring advanced assembly`,
                componentId: nd.label,
                suggestion: 'Consider QFP or larger-pitch alternative for easier prototyping.',
              });
            }
            if (type === 'passive' && (nodeLabel.includes('0201') || nodeLabel.includes('01005'))) {
              dfmIssues.push({
                severity: 'warning',
                message: `${nd.label} uses tiny package (0201/01005) — difficult for hand assembly`,
                componentId: nd.label,
                suggestion: 'Use 0402 or 0603 package for easier hand soldering.',
              });
            }
          });

          dfmIssues.push({
            severity: 'info',
            message: `DFM check complete: ${currentNodes.length} components analyzed, ${dfmIssues.length} findings.`,
            suggestion: 'Review component packages and ensure compatibility with your assembly process.',
          });

          dfmIssues.forEach((issue) => addValidationIssue(issue));
          setActiveView('validation');
          addToHistory('DFM check', 'AI');
          addOutputLog(`[AI] DFM check: ${dfmIssues.length} findings`);
          break;
        }

        case 'thermal_analysis': {
          const thermalIssues: Array<{ severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string }> = [];

          currentNodes.forEach((n) => {
            const nd = nodeData(n);
            const type = nd.type?.toLowerCase() || '';
            const nodeLabel = nd.label?.toLowerCase() || '';
            let dissipation = 0;

            if (type === 'power') dissipation = 0.5;
            else if (type === 'mcu') dissipation = 0.3;
            else if (type === 'comm') dissipation = 0.4;
            else if (type === 'actuator') dissipation = 1.0;
            else if (nodeLabel.includes('ldo') || nodeLabel.includes('regulator')) dissipation = 0.8;

            if (dissipation > 0.4) {
              thermalIssues.push({
                severity: 'warning',
                message: `${nd.label}: estimated ${dissipation}W dissipation — may require thermal management`,
                componentId: nd.label,
                suggestion: `Add thermal vias, copper pour, or heatsink. Ensure adequate airflow (thetaJA < ${Math.round(80 / dissipation)}C/W).`,
              });
            }
          });

          const totalDissipation = currentNodes.reduce((sum: number, n) => {
            const type = nodeData(n).type?.toLowerCase() || '';
            if (type === 'power') return sum + 0.5;
            if (type === 'mcu') return sum + 0.3;
            if (type === 'comm') return sum + 0.4;
            if (type === 'actuator') return sum + 1.0;
            return sum + 0.05;
          }, 0);

          thermalIssues.push({
            severity: 'info',
            message: `Total estimated power dissipation: ${totalDissipation.toFixed(2)}W across ${currentNodes.length} components.`,
            suggestion: `Board temperature rise ~${(totalDissipation * 30).toFixed(0)}C above ambient (estimated for 50x50mm 2-layer PCB).`,
          });

          thermalIssues.forEach((issue) => addValidationIssue(issue));
          setActiveView('validation');
          addToHistory('Thermal analysis', 'AI');
          addOutputLog(`[AI] Thermal analysis: ${totalDissipation.toFixed(2)}W total, ${thermalIssues.length} findings`);
          break;
        }

        // ---------------------------------------------------------------
        // Undo / Redo
        // ---------------------------------------------------------------
        case 'undo':
          undo();
          addToHistory('Undid last action', 'AI');
          addOutputLog('[AI] Undid last action');
          break;

        case 'redo':
          redo();
          addToHistory('Redid action', 'AI');
          addOutputLog('[AI] Redid action');
          break;

        // ---------------------------------------------------------------
        // Sheets (metadata-only — no local state changes)
        // ---------------------------------------------------------------
        case 'create_sheet':
          addToHistory(`Created sheet: ${action.name}`, 'AI');
          addOutputLog(`[AI] Created schematic sheet: ${action.name}`);
          break;

        case 'rename_sheet':
          addToHistory(`Renamed sheet: ${action.newName}`, 'AI');
          addOutputLog(`[AI] Renamed sheet to: ${action.newName}`);
          break;

        case 'move_to_sheet':
          addToHistory(`Moved ${action.nodeLabel} to sheet ${action.sheetId}`, 'AI');
          addOutputLog(`[AI] Moved ${action.nodeLabel} to sheet ${action.sheetId}`);
          break;

        // ---------------------------------------------------------------
        // Tutorials
        // ---------------------------------------------------------------
        case 'start_tutorial': {
          const steps = TUTORIALS[action.topic!] || TUTORIALS.getting_started;
          steps.forEach((step, i) => {
            setTimeout(() => addOutputLog(`[TUTORIAL] ${step}`), i * 500);
          });
          addToHistory(`Started tutorial: ${action.topic}`, 'AI');
          break;
        }

        // ---------------------------------------------------------------
        // Export
        // ---------------------------------------------------------------
        case 'export_kicad': {
          const kicadContent = [
            '(kicad_sch (version 20230121) (generator "protopulse")',
            '  (paper "A4")',
          ];
          currentNodes.forEach((n) => {
            const nd = nodeData(n);
            kicadContent.push(`  (symbol (lib_id "${nd.type}:${nd.label}") (at ${n.position.x / 10} ${n.position.y / 10} 0))`);
            kicadContent.push(`    (property "Reference" "${nd.label}" (at 0 -2 0))`);
            kicadContent.push(`    (property "Value" "${nd.description || nd.type}" (at 0 2 0))`);
            kicadContent.push('  )');
          });
          currentEdges.forEach((e) => {
            const srcN = currentNodes.find((n) => n.id === e.source);
            const tgtN = currentNodes.find((n) => n.id === e.target);
            if (srcN && tgtN) {
              kicadContent.push(`  (wire (pts (xy ${srcN.position.x / 10} ${srcN.position.y / 10}) (xy ${tgtN.position.x / 10} ${tgtN.position.y / 10})))`);
            }
          });
          kicadContent.push(')');

          try {
            downloadBlob(new Blob([kicadContent.join('\n')], { type: 'text/plain' }), `${projectName || 'design'}.kicad_sch`);
          } catch (err) {
            console.warn('KiCad export failed:', err);
          }

          addToHistory('Exported KiCad schematic', 'AI');
          addOutputLog(`[AI] Exported KiCad schematic with ${currentNodes.length} components`);
          break;
        }

        case 'export_spice': {
          const spiceLines = [
            `* SPICE Netlist - ${projectName}`,
            '* Generated by ProtoPulse',
            `* ${new Date().toISOString()}`,
            '',
          ];

          currentNodes.forEach((n, i) => {
            const nd = nodeData(n);
            const type = nd.type || 'generic';
            if (type === 'passive') {
              spiceLines.push(`R${i + 1} net_${n.id}_in net_${n.id}_out 10k ; ${nd.label}`);
            } else if (type === 'power') {
              spiceLines.push(`V${i + 1} net_${n.id}_out 0 3.3 ; ${nd.label}`);
            } else {
              spiceLines.push(`X${i + 1} ${String(nd.label).replace(/[^a-zA-Z0-9]/g, '_')} ; ${nd.description || type}`);
            }
          });

          spiceLines.push('', '.end');

          try {
            downloadBlob(new Blob([spiceLines.join('\n')], { type: 'text/plain' }), `${projectName || 'design'}.cir`);
          } catch (err) {
            console.warn('SPICE export failed:', err);
          }

          addToHistory('Exported SPICE netlist', 'AI');
          addOutputLog(`[AI] Generated SPICE netlist with ${currentNodes.length} components`);
          break;
        }

        case 'preview_gerber': {
          addValidationIssue({
            severity: 'info',
            message: `PCB Preview: ${currentNodes.length} components, estimated board size ${Math.ceil(Math.max(...currentNodes.map((n) => n.position.x), 100) / 50)}cm x ${Math.ceil(Math.max(...currentNodes.map((n) => n.position.y), 100) / 50)}cm, ${currentEdges.length} traces to route.`,
            suggestion: 'For detailed PCB layout, export to KiCad and use the PCB editor. Consider 2-layer board for simple designs, 4-layer for high-speed or dense layouts.',
          });
          setActiveView('output');
          addToHistory('Generated Gerber preview', 'AI');
          addOutputLog(`[AI] PCB layout preview: ${currentNodes.length} components, ${currentEdges.length} connections`);
          break;
        }

        case 'export_design_report': {
          const reportCost = currentBom.reduce((sum: number, b) => sum + (b.unitPrice * b.quantity), 0);
          const errorCount = currentIssues.filter((i) => i.severity === 'error').length;
          const warnCount = currentIssues.filter((i) => i.severity === 'warning').length;

          const report = [
            `# ${projectName} — Design Report`,
            `Generated: ${new Date().toLocaleString()}`,
            '',
            '## Architecture Overview',
            `- Components: ${currentNodes.length}`,
            `- Connections: ${currentEdges.length}`,
            `- Component Types: ${Array.from(new Set(currentNodes.map((n) => nodeData(n).type))).join(', ')}`,
            '',
            '## Bill of Materials',
            `- Total Items: ${currentBom.length}`,
            `- Estimated Cost: $${reportCost.toFixed(2)}`,
            `- Suppliers: ${Array.from(new Set(currentBom.map((b) => b.supplier))).join(', ')}`,
            '',
            '## Validation Status',
            `- Errors: ${errorCount}`,
            `- Warnings: ${warnCount}`,
            `- Total Issues: ${currentIssues.length}`,
            '',
            '## Components',
            ...currentNodes.map((n) => {
              const nd = nodeData(n);
              return `- ${nd.label} (${nd.type}): ${nd.description || 'No description'}`;
            }),
            '',
            '## Recommendations',
            errorCount > 0 ? '- Fix all errors before proceeding to layout' : '- No critical errors',
            warnCount > 0 ? '- Review warnings for potential improvements' : '- No warnings',
            currentNodes.length < 3 ? '- Consider adding more components for a complete design' : '- Design complexity looks reasonable',
          ].join('\n');

          try {
            downloadBlob(new Blob([report], { type: 'text/markdown' }), `${projectName || 'design'}_report.md`);
          } catch (err) {
            console.warn('Report export failed:', err);
          }

          setActiveView('output');
          addToHistory('Generated design report', 'AI');
          addOutputLog(`[AI] Generated design report: ${currentNodes.length} components, $${reportCost.toFixed(2)} BOM cost`);
          break;
        }

        // ---------------------------------------------------------------
        // Design Decisions / Analysis / Image
        // ---------------------------------------------------------------
        case 'save_design_decision':
          addToHistory(`Decision: ${action.decision} — ${action.rationale}`, 'AI');
          addOutputLog(`[AI] Saved design decision: ${action.decision}`);
          addValidationIssue({
            severity: 'info',
            message: `Design Decision: ${action.decision}`,
            suggestion: `Rationale: ${action.rationale}`,
          });
          break;

        case 'analyze_image':
          addToHistory(`Image analysis: ${action.description}`, 'AI');
          addOutputLog(`[AI] Analyzed image: ${action.description}`);
          break;

        case 'parametric_search': {
          const results = PARAMETRIC_SEARCH_DB[action.category!] || [
            { pn: 'GENERIC-001', mfr: 'Various', price: 0.10, desc: `${action.category} component` },
          ];

          results.forEach((r) => {
            addValidationIssue({
              severity: 'info',
              message: `${action.category} match: ${r.pn} (${r.mfr}) — $${r.price.toFixed(2)} — ${r.desc}`,
              suggestion: `Specs: ${Object.entries(action.specs || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || 'general search'}`,
            });
          });

          setActiveView('procurement');
          addToHistory(`Parametric search: ${action.category}`, 'AI');
          addOutputLog(`[AI] Parametric search: ${results.length} ${action.category} components found`);
          break;
        }
      }
    }

    // ---- Commit accumulated state changes ----
    if (nodesDirty) setNodes(currentNodes);
    if (edgesDirty) setEdges(currentEdges);

    return executedLabels;
  }, [
    nodes, edges, bom, issues, projectName, projectDescription,
    setNodes, setEdges, addBomItem, deleteBomItem, updateBomItem,
    runValidation, deleteValidationIssue, addValidationIssue,
    setActiveView, setProjectName, setProjectDescription,
    addToHistory, addOutputLog, pushUndoState, undo, redo,
  ]);
}
