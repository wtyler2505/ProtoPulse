import type { IntentHandler } from './types';

export const projectInfoHandler: IntentHandler = {
  match(lower) {
    return (
      lower.includes('project info') ||
      lower.includes('project summary') ||
      lower.includes('show project') ||
      lower.includes('project status')
    );
  },

  handle(_msgText, ctx) {
    const { projectName, projectDescription, nodes, edges, bom, issues, activeView } = ctx;
    return {
      actions: [],
      response: `**Project Summary**\n\n• **Name:** ${projectName}\n• **Description:** ${projectDescription}\n• **Architecture Nodes:** ${nodes.length}\n• **Connections:** ${edges.length}\n• **BOM Items:** ${bom.length}\n• **Validation Issues:** ${issues.length}\n• **Active View:** ${activeView}`,
    };
  },
};

export const helpHandler: IntentHandler = {
  match(lower) {
    return lower === 'help' || lower.includes('what can you do') || lower.includes('show help') || lower.includes('commands');
  },

  handle() {
    return {
      actions: [],
      response: `Here's what I can do:\n\n**Navigation:** Switch between views (architecture, component editor, procurement, validation, output)\n\n**Design:** Add/remove nodes, connect components, generate architectures, clear all nodes\n\n**BOM:** Add/remove parts, export CSV, optimize costs\n\n**Validation:** Run DRC checks, fix all issues\n\n**Project:** Rename project, update description, view summary\n\n**Examples:**\n• "add mcu called ATSAMD21"\n• "connect ESP32 to SHT40"\n• "switch to procurement"\n• "generate architecture"\n• "export bom csv"\n• "rename project to MyProject"`,
    };
  },
};

export const clearChatHandler: IntentHandler = {
  match(lower) {
    return lower.includes('clear chat');
  },

  handle() {
    return {
      actions: [],
      response: `Chat history is persistent and synced with the project. You can scroll up to review previous conversations.`,
    };
  },
};
