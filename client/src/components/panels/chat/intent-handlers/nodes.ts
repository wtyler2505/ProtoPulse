import { nodeData } from '../chat-types';
import type { IntentHandler } from './types';

export const addNodeHandler: IntentHandler = {
  match(lower) {
    const addNodeMatch = lower.match(/add\s+(mcu|sensor|power|comm|connector)?\s*(?:component|node|block)?\s*(?:called|named)?\s*(.+)/i);
    if (addNodeMatch) {
      return true;
    }
    return (
      lower.includes('add') &&
      (lower.includes('mcu') ||
        lower.includes('sensor') ||
        lower.includes('power') ||
        lower.includes('comm') ||
        lower.includes('connector') ||
        lower.includes('node') ||
        lower.includes('component'))
    );
  },

  handle(msgText) {
    const lower = msgText.toLowerCase().trim();
    const addNodeMatch = lower.match(/add\s+(mcu|sensor|power|comm|connector)?\s*(?:component|node|block)?\s*(?:called|named)?\s*(.+)/i);

    let nodeType = 'mcu';
    let nodeName = 'New Component';

    if (addNodeMatch) {
      nodeType = addNodeMatch[1] || 'mcu';
      nodeName = addNodeMatch[2]?.trim() || 'New Component';
    } else {
      if (lower.includes('mcu')) {
        nodeType = 'mcu';
        nodeName = 'MCU Node';
      } else if (lower.includes('sensor')) {
        nodeType = 'sensor';
        nodeName = 'Sensor Node';
      } else if (lower.includes('power')) {
        nodeType = 'power';
        nodeName = 'Power Node';
      } else if (lower.includes('comm')) {
        nodeType = 'comm';
        nodeName = 'Comm Node';
      } else if (lower.includes('connector')) {
        nodeType = 'connector';
        nodeName = 'Connector Node';
      } else {
        nodeName = 'New Component';
      }
    }

    if (nodeName.toLowerCase() === 'mcu node' && lower.includes('add mcu node')) {
      nodeName = 'ESP32-S3';
      nodeType = 'mcu';
    }

    return {
      actions: [
        { type: 'add_node', label: nodeName, nodeType, description: `${nodeType.toUpperCase()} component` },
        { type: 'switch_view', view: 'architecture' as const },
      ],
      response: `[ACTION] Added new ${nodeType.toUpperCase()} node '${nodeName}' to the architecture.\n\nI've placed it on the canvas. You can drag it to reposition, then connect it to other components.`,
    };
  },
};

export const removeNodeHandler: IntentHandler = {
  match(lower) {
    return (lower.includes('remove') || lower.includes('delete')) && (lower.includes('node') || lower.includes('component'));
  },

  handle(msgText, ctx) {
    const lower = msgText.toLowerCase().trim();
    const { nodes } = ctx;
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
      return {
        actions: [],
        response: `Could not find node matching '${targetName}'. Available nodes: ${nodes.map((n) => nodeData(n).label).join(', ') || 'none'}.`,
      };
    }

    // Matched the broad pattern but no specific name was parsed — fall through.
    return { actions: [], response: null };
  },
};
