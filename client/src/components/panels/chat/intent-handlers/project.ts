import type { IntentHandler } from './types';

export const renameProjectHandler: IntentHandler = {
  match(lower) {
    return lower.includes('rename project to') || lower.includes('rename project');
  },

  handle(msgText) {
    const lower = msgText.toLowerCase().trim();
    const nameMatch = lower.match(/rename project (?:to\s+)?(.+)/);
    if (nameMatch) {
      const newName = nameMatch[1].trim();
      return {
        actions: [{ type: 'rename_project', name: newName }],
        response: `[ACTION] Renamed project to '${newName}'.\n\nThe sidebar and project settings have been updated.`,
      };
    }
    return { actions: [], response: null };
  },
};

export const updateDescriptionHandler: IntentHandler = {
  match(lower) {
    return lower.includes('set description to') || lower.includes('update description');
  },

  handle(msgText) {
    const lower = msgText.toLowerCase().trim();
    const descMatch = lower.match(/(?:set|update) description (?:to\s+)?(.+)/);
    if (descMatch) {
      const newDesc = descMatch[1].trim();
      return {
        actions: [{ type: 'update_description', description: newDesc }],
        response: `[ACTION] Updated project description to '${newDesc}'.`,
      };
    }
    return { actions: [], response: null };
  },
};
