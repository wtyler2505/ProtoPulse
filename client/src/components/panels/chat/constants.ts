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
    { id: 'claude-sonnet-4-5-20250514', label: 'Claude 4.5 Sonnet' },
    { id: 'claude-sonnet-4-6-20250514', label: 'Claude 4.6 Sonnet' },
    { id: 'claude-sonnet-4-20250514', label: 'Claude 4 Sonnet' },
    { id: 'claude-opus-4-20250514', label: 'Claude 4 Opus' },
    { id: 'claude-opus-4-6-20250514', label: 'Claude 4.6 Opus' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude 4.5 Haiku' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ],
};

export type RoutingStrategy = 'user' | 'auto' | 'quality' | 'speed' | 'cost';

export const ROUTING_STRATEGIES: Array<{ id: RoutingStrategy; label: string; description: string }> = [
  { id: 'user', label: 'Manual', description: 'Use the model you select above' },
  { id: 'auto', label: 'Auto', description: 'Picks model based on message complexity' },
  { id: 'quality', label: 'Quality', description: 'Always uses the most capable model' },
  { id: 'speed', label: 'Speed', description: 'Always uses the fastest model' },
  { id: 'cost', label: 'Cost', description: 'Always uses the most affordable model' },
];

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
  // Phase 6: New export tools
  download_file: 'Downloaded file',
  export_gerber: 'Exported Gerber',
  export_kicad_netlist: 'Exported KiCad netlist',
  export_csv_netlist: 'Exported CSV netlist',
  export_pick_and_place: 'Exported pick & place',
  export_eagle: 'Exported Eagle',
  export_fritzing_project: 'Exported Fritzing',
  export_tinkercad_project: 'Exported TinkerCad',
};
