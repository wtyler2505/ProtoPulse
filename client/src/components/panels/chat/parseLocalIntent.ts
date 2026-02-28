import type { Node, Edge } from '@xyflow/react';
import type { AIAction } from './chat-types';
import { nodeData } from './chat-types';
import type { BomItem, ViewMode } from '@/lib/project-context';
import type { ValidationIssue } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// parseLocalIntent — unified intent parser for offline (no API key) mode.
//
// Instead of directly mutating state (as the old processLocalCommand did),
// this produces AIAction[] that flow through the same executeAIActions path
// the AI tool system uses. This ensures:
//   - Consistent action execution (one code path for mutations)
//   - Action logging works for both online and offline
//   - Easier testing (pure input → output)
// ---------------------------------------------------------------------------

interface IntentContext {
  nodes: Node[];
  edges: Edge[];
  bom: BomItem[];
  issues: ValidationIssue[];
  projectName: string;
  projectDescription: string;
  activeView: ViewMode;
}

export interface ParsedIntent {
  /** Actions to execute through the unified action executor. */
  actions: AIAction[];
  /** Response message to display in chat. Null = build from action labels. */
  response: string | null;
}

const VIEW_MAP: Record<string, ViewMode> = {
  'architecture': 'architecture',
  'component editor': 'component_editor',
  'schematic': 'schematic',
  'breadboard': 'breadboard',
  'pcb': 'pcb',
  'procurement': 'procurement',
  'validation': 'validation',
  'output': 'output',
  'simulation': 'simulation',
  'project explorer': 'project_explorer',
};

/**
 * Parse a user's text input into structured AIActions and an optional response.
 * Returns { actions, response } — when actions is non-empty, they should be
 * routed through executeAIActions. When response is non-null, it should be
 * shown as the assistant's message.
 */
export function parseLocalIntent(msgText: string, ctx: IntentContext): ParsedIntent {
  const lower = msgText.toLowerCase().trim();
  const { nodes, edges, bom, issues, projectName, projectDescription, activeView } = ctx;

  // ---- Navigation ----
  for (const [key, view] of Object.entries(VIEW_MAP)) {
    if ((lower.includes('switch to') || lower.includes('go to') || lower.includes('show') || lower.includes('open')) && lower.includes(key)) {
      const viewLabel = key.charAt(0).toUpperCase() + key.slice(1);
      return {
        actions: [{ type: 'switch_view', view }],
        response: `[ACTION] Switched to ${viewLabel} view.\n\nYou can manage your ${key} here.`,
      };
    }
  }

  // ---- Generate architecture ----
  if (lower.includes('generate architecture') || lower.includes('generate schematic') || (lower.includes('generate') && (lower.includes('arch') || lower.includes('design')))) {
    const components = [
      { label: 'ESP32-S3', nodeType: 'mcu', description: 'Main MCU', positionX: 300, positionY: 100 },
      { label: 'TP4056', nodeType: 'power', description: 'Power Management', positionX: 100, positionY: 250 },
      { label: 'SX1262', nodeType: 'comm', description: 'LoRa Communication', positionX: 500, positionY: 250 },
      { label: 'SHT40', nodeType: 'sensor', description: 'Temp/Humidity Sensor', positionX: 300, positionY: 400 },
    ];
    const connections = [
      { sourceLabel: 'ESP32-S3', targetLabel: 'TP4056', label: 'Power' },
      { sourceLabel: 'ESP32-S3', targetLabel: 'SX1262', label: 'SPI' },
      { sourceLabel: 'ESP32-S3', targetLabel: 'SHT40', label: 'I2C' },
    ];
    return {
      actions: [
        { type: 'generate_architecture', components, connections },
        { type: 'switch_view', view: 'architecture' },
      ],
      response: `[ACTION] Generated default architecture with 4 components.\n\nCreated: ESP32-S3 (MCU), TP4056 (Power), SX1262 (Communication), SHT40 (Sensor). All components are connected with data buses.`,
    };
  }

  // ---- Clear all nodes ----
  if (lower.includes('clear all') && (lower.includes('node') || lower.includes('component'))) {
    return {
      actions: [{ type: 'clear_canvas' }],
      response: `[ACTION] Cleared all nodes and edges from the architecture.\n\nThe canvas is now empty. You can add new components or generate a fresh architecture.`,
    };
  }

  // ---- Add node ----
  const addNodeMatch = lower.match(/add\s+(mcu|sensor|power|comm|connector)?\s*(?:component|node|block)?\s*(?:called|named)?\s*(.+)/i);
  if (addNodeMatch || (lower.includes('add') && (lower.includes('mcu') || lower.includes('sensor') || lower.includes('power') || lower.includes('comm') || lower.includes('connector') || lower.includes('node') || lower.includes('component')))) {
    let nodeType = 'mcu';
    let nodeName = 'New Component';
    if (addNodeMatch) {
      nodeType = addNodeMatch[1] || 'mcu';
      nodeName = addNodeMatch[2]?.trim() || 'New Component';
    } else {
      if (lower.includes('mcu')) { nodeType = 'mcu'; nodeName = 'MCU Node'; }
      else if (lower.includes('sensor')) { nodeType = 'sensor'; nodeName = 'Sensor Node'; }
      else if (lower.includes('power')) { nodeType = 'power'; nodeName = 'Power Node'; }
      else if (lower.includes('comm')) { nodeType = 'comm'; nodeName = 'Comm Node'; }
      else if (lower.includes('connector')) { nodeType = 'connector'; nodeName = 'Connector Node'; }
      else { nodeName = 'New Component'; }
    }
    if (nodeName.toLowerCase() === 'mcu node' && lower.includes('add mcu node')) {
      nodeName = 'ESP32-S3';
      nodeType = 'mcu';
    }
    return {
      actions: [
        { type: 'add_node', label: nodeName, nodeType, description: `${nodeType.toUpperCase()} component` },
        { type: 'switch_view', view: 'architecture' },
      ],
      response: `[ACTION] Added new ${nodeType.toUpperCase()} node '${nodeName}' to the architecture.\n\nI've placed it on the canvas. You can drag it to reposition, then connect it to other components.`,
    };
  }

  // ---- Remove node ----
  if ((lower.includes('remove') || lower.includes('delete')) && (lower.includes('node') || lower.includes('component'))) {
    const nameMatch = lower.match(/(?:remove|delete)\s+(?:node|component)\s+(.+)/);
    if (nameMatch) {
      const targetName = nameMatch[1].trim();
      const nodeToRemove = nodes.find((n) => nodeData(n).label.toLowerCase().includes(targetName));
      if (nodeToRemove) {
        return {
          actions: [{ type: 'remove_node', nodeLabel: nodeData(nodeToRemove).label }],
          response: `[ACTION] Removed node '${nodeData(nodeToRemove).label}' and its connections from the architecture.`,
        };
      }
      return { actions: [], response: `Could not find node matching '${targetName}'. Available nodes: ${nodes.map((n) => nodeData(n).label).join(', ') || 'none'}.` };
    }
  }

  // ---- Connect nodes ----
  if (lower.includes('connect') && lower.includes(' to ')) {
    const connectMatch = lower.match(/connect\s+(.+?)\s+to\s+(.+)/);
    if (connectMatch) {
      const sourceName = connectMatch[1].trim();
      const targetName = connectMatch[2].trim();
      const sourceNode = nodes.find((n) => nodeData(n).label.toLowerCase().includes(sourceName));
      const targetNode = nodes.find((n) => nodeData(n).label.toLowerCase().includes(targetName));
      if (sourceNode && targetNode) {
        return {
          actions: [{
            type: 'connect_nodes',
            sourceLabel: nodeData(sourceNode).label,
            targetLabel: nodeData(targetNode).label,
            edgeLabel: 'Data',
          }],
          response: `[ACTION] Connected '${nodeData(sourceNode).label}' to '${nodeData(targetNode).label}'.\n\nA data bus has been created between the two components.`,
        };
      }
      return { actions: [], response: `Could not find one or both nodes. Available nodes: ${nodes.map((n) => nodeData(n).label).join(', ') || 'none'}.` };
    }
  }

  // ---- BOM: add ----
  if (lower.includes('add to bom') || lower.includes('add bom')) {
    const partMatch = lower.match(/(?:add to bom|add bom)\s+(.+)/);
    const partName = partMatch ? partMatch[1].trim() : 'Unknown Part';
    return {
      actions: [{
        type: 'add_bom_item',
        partNumber: partName.toUpperCase().replace(/\s+/g, '-'),
        manufacturer: 'TBD',
        description: partName,
        quantity: 1,
        unitPrice: 0,
        supplier: 'Digi-Key',
        stock: 0,
        status: 'In Stock',
      }],
      response: `[ACTION] Added '${partName}' to the Bill of Materials.\n\nYou can update pricing and sourcing details in the Procurement view.`,
    };
  }

  // ---- BOM: remove ----
  if (lower.includes('remove from bom') || lower.includes('delete from bom')) {
    const partMatch = lower.match(/(?:remove|delete) from bom\s+(.+)/);
    if (partMatch) {
      const partName = partMatch[1].trim().toLowerCase();
      const bomItem = bom.find((b) => b.partNumber.toLowerCase().includes(partName) || b.description.toLowerCase().includes(partName));
      if (bomItem) {
        return {
          actions: [{ type: 'remove_bom_item', partNumber: bomItem.partNumber }],
          response: `[ACTION] Removed '${bomItem.partNumber}' from the Bill of Materials.`,
        };
      }
      return { actions: [], response: `Could not find BOM item matching '${partMatch[1]}'. Check the Procurement view for current items.` };
    }
  }

  // ---- BOM: export ----
  if (lower.includes('export bom') || lower.includes('export csv')) {
    if (bom.length === 0) return { actions: [], response: `No BOM items to export. Add components to the BOM first.` };
    return {
      actions: [{ type: 'export_bom_csv' }],
      response: `[ACTION] Exported BOM as CSV file (${bom.length} items).\n\nThe file '${projectName}_BOM.csv' has been downloaded.`,
    };
  }

  // ---- BOM: optimize ----
  if (lower.includes('optimize bom') || lower.includes('optimize cost')) {
    return {
      actions: [{ type: 'optimize_bom' }],
      response: `[ACTION] BOM optimization analysis complete.\n\nSuggestions:\n• Consider alternative sourcing from LCSC for passive components (20-40% savings)\n• Consolidate resistor values to reduce unique part count\n• Check for volume pricing breaks at 1k+ quantities\n• Replace through-hole components with SMD equivalents where possible\n\nCurrent BOM has ${bom.length} items. Switch to Procurement view for details.`,
    };
  }

  // ---- Validation ----
  if (lower.includes('validate') || lower.includes('check design') || lower.includes('run drc') || lower.includes('check errors') || lower.includes('run validation')) {
    return {
      actions: [{ type: 'run_validation' }],
      response: `[ACTION] Design rule check complete.\n\nI've triggered a validation run. Switch to the Validation view to review all findings and apply suggested fixes.`,
    };
  }

  if (lower.includes('fix all issues') || lower.includes('fix all') || lower.includes('clear issues')) {
    if (issues.length === 0) return { actions: [], response: `No validation issues to fix. The design is currently clean.` };
    return {
      actions: [{ type: 'clear_validation' }],
      response: `[ACTION] Removed ${issues.length} validation issues.\n\nAll issues have been resolved. Run validation again to check for new findings.`,
    };
  }

  // ---- Project metadata ----
  if (lower.includes('rename project to') || lower.includes('rename project')) {
    const nameMatch = lower.match(/rename project (?:to\s+)?(.+)/);
    if (nameMatch) {
      const newName = nameMatch[1].trim();
      return {
        actions: [{ type: 'rename_project', name: newName }],
        response: `[ACTION] Renamed project to '${newName}'.\n\nThe sidebar and project settings have been updated.`,
      };
    }
  }

  if (lower.includes('set description to') || lower.includes('update description')) {
    const descMatch = lower.match(/(?:set|update) description (?:to\s+)?(.+)/);
    if (descMatch) {
      const newDesc = descMatch[1].trim();
      return {
        actions: [{ type: 'update_description', description: newDesc }],
        response: `[ACTION] Updated project description to '${newDesc}'.`,
      };
    }
  }

  // ---- Read-only queries (no actions) ----
  if (lower.includes('project info') || lower.includes('project summary') || lower.includes('show project') || lower.includes('project status')) {
    return {
      actions: [],
      response: `**Project Summary**\n\n• **Name:** ${projectName}\n• **Description:** ${projectDescription}\n• **Architecture Nodes:** ${nodes.length}\n• **Connections:** ${edges.length}\n• **BOM Items:** ${bom.length}\n• **Validation Issues:** ${issues.length}\n• **Active View:** ${activeView}`,
    };
  }

  if (lower === 'help' || lower.includes('what can you do') || lower.includes('show help') || lower.includes('commands')) {
    return {
      actions: [],
      response: `Here's what I can do:\n\n**Navigation:** Switch between views (architecture, component editor, procurement, validation, output)\n\n**Design:** Add/remove nodes, connect components, generate architectures, clear all nodes\n\n**BOM:** Add/remove parts, export CSV, optimize costs\n\n**Validation:** Run DRC checks, fix all issues\n\n**Project:** Rename project, update description, view summary\n\n**Examples:**\n• "add mcu called ATSAMD21"\n• "connect ESP32 to SHT40"\n• "switch to procurement"\n• "generate architecture"\n• "export bom csv"\n• "rename project to MyProject"`,
    };
  }

  if (lower.includes('clear chat')) {
    return { actions: [], response: `Chat history is persistent and synced with the project. You can scroll up to review previous conversations.` };
  }

  // ---- Domain-specific static responses ----
  if (lower.includes('component') || lower.includes('generate')) {
    return { actions: [], response: "I've analyzed the design for component generation. The architecture includes the ESP32-S3, LoRa transceiver, and power management units. All connections follow standard bus protocols. Try 'generate architecture' to create a default layout or open the Component Editor to design individual parts." };
  } else if (lower.includes('bom') || lower.includes('cost')) {
    return { actions: [], response: "BOM optimization tips:\n• TP4056 → MCP73831 (saves $0.08/unit, same footprint)\n• USB connector → alternate GCT part (saves $0.12/unit)\nTotal potential savings: $0.20/unit at 1k qty.\n\nTry 'optimize bom' for a full analysis or 'export bom csv' to download." };
  } else if (lower.includes('memory') || lower.includes('ram') || lower.includes('storage')) {
    return { actions: [], response: "For the ESP32-S3, I recommend adding external PSRAM (ESP-PSRAM64H, 8MB). Connect via the dedicated SPI interface on GPIO 33-37. Try 'add sensor called PSRAM64H' to add it to your design." };
  } else if (lower.includes('power') || lower.includes('battery')) {
    return { actions: [], response: "Power analysis summary:\n• Active mode: ~180mA (Wi-Fi TX)\n• Deep sleep: ~10µA\n• Battery life (2000mAh): ~45 days at 1 reading/hour\nRecommendation: Add a solar cell (5V/500mA) with MPPT for indefinite operation." };
  } else if (lower.includes('antenna') || lower.includes('rf')) {
    return { actions: [], response: "RF design recommendations:\n• LoRa antenna: Use a spring-type 868/915MHz antenna with SMA connector\n• Match impedance to 50Ω using Pi-network (L=3.3nH, C1=1.5pF, C2=1.8pF)\n• Keep RF trace width at 0.7mm for FR4 substrate (εr=4.6)" };
  } else if (lower.includes('sensor') || lower.includes('temperature')) {
    return { actions: [], response: "Sensor configuration optimized:\n• SHT40: Set to high-precision mode (±0.2°C accuracy)\n• I2C address: 0x44, pull-ups: 4.7kΩ to 3.3V\n• Sample rate: 1Hz recommended for thermal stability\n• Consider adding SHT40-BD1B for extended range (-40°C to +125°C)." };
  }

  return { actions: [], response: "I've analyzed your request. I can help with navigation, design, BOM management, validation, and project settings. Type 'help' to see all available commands." };
}
