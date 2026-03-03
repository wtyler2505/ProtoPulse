import { nodeData } from '../chat-types';
import type { IntentHandler } from './types';

export const connectNodesHandler: IntentHandler = {
  match(lower) {
    return lower.includes('connect') && lower.includes(' to ');
  },

  handle(msgText, ctx) {
    const lower = msgText.toLowerCase().trim();
    const { nodes } = ctx;
    const connectMatch = lower.match(/connect\s+(.+?)\s+to\s+(.+)/);

    if (connectMatch) {
      const sourceName = connectMatch[1].trim();
      const targetName = connectMatch[2].trim();
      const sourceNode = nodes.find((n) => nodeData(n).label.toLowerCase().includes(sourceName));
      const targetNode = nodes.find((n) => nodeData(n).label.toLowerCase().includes(targetName));

      if (sourceNode && targetNode) {
        return {
          actions: [
            {
              type: 'connect_nodes',
              sourceLabel: nodeData(sourceNode).label,
              targetLabel: nodeData(targetNode).label,
              edgeLabel: 'Data',
            },
          ],
          response: `[ACTION] Connected '${nodeData(sourceNode).label}' to '${nodeData(targetNode).label}'.\n\nA data bus has been created between the two components.`,
        };
      }
      return {
        actions: [],
        response: `Could not find one or both nodes. Available nodes: ${nodes.map((n) => nodeData(n).label).join(', ') || 'none'}.`,
      };
    }

    return { actions: [], response: null };
  },
};
