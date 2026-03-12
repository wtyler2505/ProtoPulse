import type { ActionHandler } from './types';

// ---------------------------------------------------------------------------
// Tutorials database
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Parametric search database
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const saveDesignDecision: ActionHandler = (action, ctx) => {
  ctx.history.addToHistory(`Decision: ${action.decision} — ${action.rationale}`, 'AI');
  ctx.output.addOutputLog(`[AI] Saved design decision: ${action.decision}`);
  ctx.validation.addValidationIssue({
    severity: 'info',
    message: `Design Decision: ${action.decision}`,
    suggestion: `Rationale: ${action.rationale}`,
  });
};

const analyzeImage: ActionHandler = (action, ctx) => {
  ctx.history.addToHistory(`Image analysis: ${action.description}`, 'AI');
  ctx.output.addOutputLog(`[AI] Analyzed image: ${action.description}`);
};

const visionAnalysis: ActionHandler = (action, ctx) => {
  ctx.output.addOutputLog(`[AI] Vision analysis complete: ${action.message || 'Component identified'}`);
  ctx.history.addToHistory(`Vision analysis: ${action.message}`, 'AI');
  
  const data = action.data as Record<string, unknown> | undefined;
  if (data?.suggestedBOM) {
    const bom = data.suggestedBOM as Record<string, unknown>;
    ctx.validation.addValidationIssue({
      severity: 'info',
      message: `Vision suggested part: ${bom.partNumber} (${bom.manufacturer})`,
      suggestion: `Add identified component to design. Description: ${bom.description}`,
    });
  }
};

const circuitExtraction: ActionHandler = (action, ctx) => {
  const data = action.data as Record<string, unknown> | undefined;
  ctx.output.addOutputLog(`[AI] Circuit extraction complete: ${action.message || 'Circuit diagram interpreted'}`);
  ctx.history.addToHistory(`Circuit extraction from ${data?.inputType || 'image'}`, 'AI');
  
  if (data?.description) {
    ctx.validation.addValidationIssue({
      severity: 'info',
      message: `Extracted ${data.circuitType || 'circuit'}: ${data.description}`,
      suggestion: 'The AI is now generating the schematic nodes and connections from this analysis.',
    });
  }
};

const netNameSuggestions: ActionHandler = (action, ctx) => {
  const suggestions = (action.suggestions || []) as Array<{ netId: number, currentName: string, suggestedName: string, rationale: string }>;
  ctx.output.addOutputLog(`[AI] Found ${suggestions.length} net naming suggestions.`);
  
  suggestions.forEach(s => {
    ctx.validation.addValidationIssue({
      severity: 'info',
      message: `Suggest renaming net "${s.currentName}" to "${s.suggestedName}"`,
      suggestion: s.rationale,
    });
  });
};

const tracePathSuggestion: ActionHandler = (action, ctx) => {
  ctx.output.addOutputLog(`[AI] Routing copilot has suggested a path for net ID ${action.netId}.`);
  ctx.validation.addValidationIssue({
    severity: 'info',
    message: `Routing suggestion available for net ${action.netId}`,
    suggestion: `Use the suggested ${action.layer} layer path to route this connection.`,
  });
};

const hardwareDebugGuide: ActionHandler = (action, ctx) => {
  ctx.output.addOutputLog(`[AI] Hardware debug assistant has analyzed your design.`);
  ctx.history.addToHistory('Hardware debug analysis complete.', 'AI');
  
  const debugData = action.data as Record<string, unknown> | undefined;
  const risks = (debugData?.risks as Record<string, unknown[]> | undefined) ?? {};
  if (risks.power?.length > 0) {
    ctx.validation.addValidationIssue({
      severity: 'warning',
      message: `Hardware Debug: ${risks.power.length} power delivery risks detected`,
      suggestion: 'Review power rail stability and sequencing before prototype bring-up.',
    });
  }
};

const setExplainMode: ActionHandler = (action, ctx) => {
  const enabled = !!action.enabled;
  ctx.output.addOutputLog(`[AI] Explain Mode ${enabled ? 'ENABLED' : 'DISABLED'}.`);
  ctx.history.addToHistory(`Explain mode ${enabled ? 'on' : 'off'}`, 'AI');
  ctx.validation.addValidationIssue({
    severity: 'info',
    message: `AI Explain Mode: ${enabled ? 'Active' : 'Inactive'}`,
    suggestion: enabled ? 'The AI will now provide simpler, educational explanations.' : 'The AI has returned to standard technical language.',
  });
};

const parametricSearch: ActionHandler = (action, ctx) => {
  const results = PARAMETRIC_SEARCH_DB[action.category!] || [
    { pn: 'GENERIC-001', mfr: 'Various', price: 0.10, desc: `${action.category} component` },
  ];

  results.forEach((r) => {
    ctx.validation.addValidationIssue({
      severity: 'info',
      message: `${action.category} match: ${r.pn} (${r.mfr}) — $${r.price.toFixed(2)} — ${r.desc}`,
      suggestion: `Specs: ${Object.entries(action.specs || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || 'general search'}`,
    });
  });

  ctx.arch.setActiveView('procurement');
  ctx.history.addToHistory(`Parametric search: ${action.category}`, 'AI');
  ctx.output.addOutputLog(`[AI] Parametric search: ${results.length} ${action.category} components found`);
};

const startTutorial: ActionHandler = (action, ctx) => {
  const steps = TUTORIALS[action.topic!] || TUTORIALS.getting_started;
  steps.forEach((step, i) => {
    setTimeout(() => ctx.output.addOutputLog(`[TUTORIAL] ${step}`), i * 500);
  });
  ctx.history.addToHistory(`Started tutorial: ${action.topic}`, 'AI');
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const miscHandlers: Record<string, ActionHandler> = {
  save_design_decision: saveDesignDecision,
  analyze_image: analyzeImage,
  vision_analysis: visionAnalysis,
  circuit_extraction: circuitExtraction,
  net_name_suggestions: netNameSuggestions,
  trace_path_suggestion: tracePathSuggestion,
  hardware_debug_guide: hardwareDebugGuide,
  set_explain_mode: setExplainMode,
  parametric_search: parametricSearch,
  start_tutorial: startTutorial,
};
