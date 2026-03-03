import type { ViewMode } from '@/lib/project-context';
import type { IntentHandler } from './types';

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

const NAV_TRIGGERS = ['switch to', 'go to', 'show', 'open'];

export const navigationHandler: IntentHandler = {
  match(lower) {
    if (!NAV_TRIGGERS.some((t) => lower.includes(t))) {
      return false;
    }
    return Object.keys(VIEW_MAP).some((key) => lower.includes(key));
  },

  handle(_msgText, _ctx) {
    const lower = _msgText.toLowerCase().trim();
    for (const [key, view] of Object.entries(VIEW_MAP)) {
      if (NAV_TRIGGERS.some((t) => lower.includes(t)) && lower.includes(key)) {
        const viewLabel = key.charAt(0).toUpperCase() + key.slice(1);
        return {
          actions: [{ type: 'switch_view', view }],
          response: `[ACTION] Switched to ${viewLabel} view.\n\nYou can manage your ${key} here.`,
        };
      }
    }
    // Should not reach here since match() already validated, but satisfy return type.
    return { actions: [], response: null };
  },
};
