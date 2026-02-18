export const COPY_FEEDBACK_DURATION = 1500;
export const SETTINGS_SAVE_FEEDBACK_DURATION = 2000;
export const LOCAL_COMMAND_DELAY = 500;

export const quickActionDescriptions: Record<string, string> = {
  'Generate Architecture': 'Generate a default system architecture',
  'Optimize BOM': 'Optimize bill of materials cost',
  'Run Validation': 'Run design rule checks',
  'Add MCU Node': 'Add an MCU component to the design',
  'Project Summary': 'Show current project info',
  'Show Help': 'List all available commands',
  'Export BOM CSV': 'Export BOM as CSV file',
};

export const AI_MODELS = {
  anthropic: [
    { id: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
    { id: 'claude-4-6-sonnet-20260101', label: 'Claude 4.6 Sonnet' },
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { id: 'claude-4-6-opus-20260101', label: 'Claude 4.6 Opus' },
    { id: 'claude-haiku-4-5-20250514', label: 'Claude Haiku 4.5' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
};

export const DESTRUCTIVE_ACTIONS = ['clear_canvas', 'remove_node', 'remove_edge', 'clear_validation', 'remove_bom_item'];

export const ACTION_LABELS: Record<string, string> = {
  switch_view: 'Switched view',
  add_node: 'Added component',
  remove_node: 'Removed component',
  update_node: 'Updated component',
  connect_nodes: 'Connected nodes',
  remove_edge: 'Removed connection',
  clear_canvas: 'Cleared canvas',
  generate_architecture: 'Generated architecture',
  add_bom_item: 'Added to BOM',
  remove_bom_item: 'Removed from BOM',
  update_bom_item: 'Updated BOM item',
  run_validation: 'Ran validation',
  clear_validation: 'Cleared issues',
  add_validation_issue: 'Added issue',
  rename_project: 'Renamed project',
  update_description: 'Updated description',
  export_bom_csv: 'Exported CSV',
  undo: 'Undid last action',
  redo: 'Redid action',
  auto_layout: 'Auto-arranged layout',
  add_subcircuit: 'Added sub-circuit',
  assign_net_name: 'Named net',
  create_sheet: 'Created sheet',
  rename_sheet: 'Renamed sheet',
  move_to_sheet: 'Moved to sheet',
  set_pin_map: 'Set pin map',
  auto_assign_pins: 'Auto-assigned pins',
  power_budget_analysis: 'Power budget analysis',
  voltage_domain_check: 'Voltage domain check',
  auto_fix_validation: 'Auto-fixed validation',
  dfm_check: 'DFM check',
  thermal_analysis: 'Thermal analysis',
  pricing_lookup: 'Checked pricing',
  suggest_alternatives: 'Suggested alternatives',
  optimize_bom: 'Optimized BOM',
  check_lead_times: 'Checked lead times',
  parametric_search: 'Parametric search',
  analyze_image: 'Analyzed image',
  save_design_decision: 'Saved decision',
  add_annotation: 'Added annotation',
  start_tutorial: 'Started tutorial',
  export_kicad: 'Exported KiCad',
  export_spice: 'Exported SPICE',
  preview_gerber: 'Gerber preview',
  add_datasheet_link: 'Added datasheet',
  export_design_report: 'Generated report',
  set_project_type: 'Set project type',
};
