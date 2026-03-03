import type { ActionHandler } from './types';

// ---------------------------------------------------------------------------
// TYPE_PROMPTS — guidance strings for project type presets.
// ---------------------------------------------------------------------------

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
// Handlers
// ---------------------------------------------------------------------------

const switchView: ActionHandler = (action, ctx) => {
  ctx.arch.setActiveView(action.view!);
  ctx.history.addToHistory(`Switched to ${action.view} view`, 'AI');
  ctx.output.addOutputLog(`[AI] Switched to ${action.view} view`);
};

const renameProject: ActionHandler = (action, ctx) => {
  ctx.meta.setProjectName(action.name!);
  ctx.history.addToHistory(`Renamed project to: ${action.name}`, 'AI');
  ctx.output.addOutputLog(`[AI] Renamed project to: ${action.name}`);
};

const updateDescription: ActionHandler = (action, ctx) => {
  ctx.meta.setProjectDescription(action.description!);
  ctx.history.addToHistory('Updated project description', 'AI');
  ctx.output.addOutputLog(`[AI] Updated description: ${action.description}`);
};

const setProjectType: ActionHandler = (action, ctx) => {
  const guidance = TYPE_PROMPTS[action.projectType!] || 'General electronics design guidance';
  ctx.meta.setProjectDescription(`${ctx.meta.projectDescription} [Type: ${action.projectType}]`);
  ctx.history.addToHistory(`Set project type: ${action.projectType}`, 'AI');
  ctx.output.addOutputLog(`[AI] Project type set to ${action.projectType}. ${guidance}`);
};

const undo: ActionHandler = (_action, ctx) => {
  ctx.arch.undo();
  ctx.history.addToHistory('Undid last action', 'AI');
  ctx.output.addOutputLog('[AI] Undid last action');
};

const redo: ActionHandler = (_action, ctx) => {
  ctx.arch.redo();
  ctx.history.addToHistory('Redid action', 'AI');
  ctx.output.addOutputLog('[AI] Redid action');
};

const createSheet: ActionHandler = (action, ctx) => {
  ctx.history.addToHistory(`Created sheet: ${action.name}`, 'AI');
  ctx.output.addOutputLog(`[AI] Created schematic sheet: ${action.name}`);
};

const renameSheet: ActionHandler = (action, ctx) => {
  ctx.history.addToHistory(`Renamed sheet: ${action.newName}`, 'AI');
  ctx.output.addOutputLog(`[AI] Renamed sheet to: ${action.newName}`);
};

const moveToSheet: ActionHandler = (action, ctx) => {
  ctx.history.addToHistory(`Moved ${action.nodeLabel} to sheet ${action.sheetId}`, 'AI');
  ctx.output.addOutputLog(`[AI] Moved ${action.nodeLabel} to sheet ${action.sheetId}`);
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const navigationHandlers: Record<string, ActionHandler> = {
  switch_view: switchView,
  rename_project: renameProject,
  update_description: updateDescription,
  set_project_type: setProjectType,
  undo,
  redo,
  create_sheet: createSheet,
  rename_sheet: renameSheet,
  move_to_sheet: moveToSheet,
};
