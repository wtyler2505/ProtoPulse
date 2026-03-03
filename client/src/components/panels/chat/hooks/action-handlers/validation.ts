import { nodeData, edgeData } from '../../chat-types';
import type { ActionHandler } from './types';

// ---------------------------------------------------------------------------
// Helper: typical current draw per component type (mA) for power budget.
// ---------------------------------------------------------------------------
const TYPICAL_CURRENT_MA: Record<string, number> = {
  mcu: 80, sensor: 5, comm: 120, memory: 30, actuator: 200, ic: 20,
  connector: 0, passive: 0, module: 50,
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const runValidation: ActionHandler = (_action, ctx) => {
  ctx.validation.runValidation();
  ctx.history.addToHistory('Ran design validation', 'AI');
  ctx.output.addOutputLog('[AI] Ran design validation');
};

const clearValidation: ActionHandler = (_action, ctx) => {
  ctx.state.currentIssues.forEach((issue) => ctx.validation.deleteValidationIssue(issue.id));
  ctx.state.currentIssues = [];
  ctx.history.addToHistory('Cleared validation issues', 'AI');
  ctx.output.addOutputLog('[AI] Cleared all validation issues');
};

const addValidationIssue: ActionHandler = (action, ctx) => {
  ctx.validation.addValidationIssue({
    severity: action.severity!,
    message: action.message!,
    componentId: action.componentId,
    suggestion: action.suggestion,
  });
  ctx.history.addToHistory(`Added validation: ${action.message}`, 'AI');
  ctx.output.addOutputLog(`[AI] Added validation issue: ${action.message}`);
};

const powerBudgetAnalysis: ActionHandler = (_action, ctx) => {
  const powerNodes = ctx.state.currentNodes.filter((n) => nodeData(n).type === 'power');
  const consumers = ctx.state.currentNodes.filter((n) => nodeData(n).type !== 'power');
  const pbIssues: Array<{ severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string }> = [];

  let totalPower = 0;
  consumers.forEach((n) => {
    totalPower += TYPICAL_CURRENT_MA[nodeData(n).type] || 10;
  });

  pbIssues.push({
    severity: 'info',
    message: `Power Budget: Est. ${totalPower}mA total across ${consumers.length} active components. ${powerNodes.length} power source(s) detected.`,
    suggestion: `Verify power supply can deliver >=${Math.ceil(totalPower * 1.2)}mA (20% headroom).`,
  });

  if (totalPower > 500) {
    pbIssues.push({
      severity: 'warning',
      message: `High power consumption (${totalPower}mA). Consider low-power modes or additional power sources.`,
      suggestion: 'Add sleep mode configuration or secondary power supply.',
    });
  }

  pbIssues.forEach((issue) => ctx.validation.addValidationIssue(issue));
  ctx.arch.setActiveView('validation');
  ctx.history.addToHistory('Power budget analysis', 'AI');
  ctx.output.addOutputLog(`[AI] Power budget: ${totalPower}mA across ${consumers.length} consumers`);
};

const voltageDomainCheck: ActionHandler = (_action, ctx) => {
  const voltageIssues: Array<{ severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string }> = [];

  ctx.state.currentEdges.forEach((e) => {
    const voltage = edgeData(e)?.voltage || e.label;
    if (voltage && (String(voltage).includes('5V') || String(voltage).includes('3.3V') || String(voltage).includes('1.8V'))) {
      const srcN = ctx.state.currentNodes.find((n) => n.id === e.source);
      const tgtN = ctx.state.currentNodes.find((n) => n.id === e.target);
      if (srcN && tgtN) {
        const srcEdges = ctx.state.currentEdges.filter((ed) => ed.source === srcN.id || ed.target === srcN.id);
        const tgtEdges = ctx.state.currentEdges.filter((ed) => ed.source === tgtN.id || ed.target === tgtN.id);
        const srcVoltages = srcEdges.map((ed) => edgeData(ed)?.voltage || ed.label).filter(Boolean);
        const tgtVoltages = tgtEdges.map((ed) => edgeData(ed)?.voltage || ed.label).filter(Boolean);
        const has5V = srcVoltages.some((v) => String(v).includes('5V')) || tgtVoltages.some((v) => String(v).includes('5V'));
        const has3V3 = srcVoltages.some((v) => String(v).includes('3.3V')) || tgtVoltages.some((v) => String(v).includes('3.3V'));
        if (has5V && has3V3) {
          voltageIssues.push({
            severity: 'warning',
            message: `Voltage domain crossing: ${nodeData(srcN).label} <-> ${nodeData(tgtN).label} bridges 5V and 3.3V domains`,
            componentId: String(nodeData(srcN).label ?? ''),
            suggestion: 'Add a level shifter (e.g., TXB0108) between voltage domains.',
          });
        }
      }
    }
  });

  if (voltageIssues.length === 0) {
    voltageIssues.push({
      severity: 'info',
      message: 'No voltage domain mismatches detected.',
      suggestion: 'All connections appear to be within compatible voltage domains.',
    });
  }

  voltageIssues.forEach((issue) => ctx.validation.addValidationIssue(issue));
  ctx.arch.setActiveView('validation');
  ctx.history.addToHistory('Voltage domain check', 'AI');
  ctx.output.addOutputLog(`[AI] Voltage domain check: ${voltageIssues.length} findings`);
};

const autoFixValidation: ActionHandler = (_action, ctx) => {
  let fixCount = 0;
  const fixNodes: Array<{ id: string; type: 'custom'; position: { x: number; y: number }; data: { label: string; type: string; description: string } }> = [];

  ctx.state.currentIssues.forEach((issue, idx) => {
    const msg = issue.message.toLowerCase();
    if (msg.includes('decoupling') || msg.includes('capacitor')) {
      fixNodes.push({
        id: crypto.randomUUID(),
        type: 'custom' as const,
        position: { x: 100 + Math.random() * 600, y: 450 + idx * 80 },
        data: { label: `Decoupling Cap ${idx + 1}`, type: 'passive', description: '100nF + 10uF ceramic' },
      });
      fixCount++;
    } else if (msg.includes('pull-up') || msg.includes('pullup') || msg.includes('pull up')) {
      fixNodes.push({
        id: crypto.randomUUID(),
        type: 'custom' as const,
        position: { x: 100 + Math.random() * 600, y: 450 + idx * 80 },
        data: { label: `Pull-up Resistors ${idx + 1}`, type: 'passive', description: '4.7k' },
      });
      fixCount++;
    } else if (msg.includes('esd') || msg.includes('protection')) {
      fixNodes.push({
        id: crypto.randomUUID(),
        type: 'custom' as const,
        position: { x: 100 + Math.random() * 600, y: 450 + idx * 80 },
        data: { label: `ESD Protection ${idx + 1}`, type: 'ic', description: 'TVS Diode Array' },
      });
      fixCount++;
    }
  });

  if (fixNodes.length > 0) {
    ctx.state.currentNodes = [...ctx.state.currentNodes, ...fixNodes];
    ctx.state.nodesDirty = true;
  }

  ctx.arch.setActiveView('architecture');
  ctx.history.addToHistory(`Auto-fixed ${fixCount} validation issues`, 'AI');
  ctx.output.addOutputLog(`[AI] Auto-fixed ${fixCount} issues, added ${fixNodes.length} components`);
};

const dfmCheck: ActionHandler = (_action, ctx) => {
  const dfmIssues: Array<{ severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string }> = [];

  ctx.state.currentNodes.forEach((n) => {
    const nd = nodeData(n);
    const nodeLabel = nd.label?.toLowerCase() || '';
    const type = nd.type?.toLowerCase() || '';

    if (nodeLabel.includes('qfn') || nodeLabel.includes('bga') || nodeLabel.includes('wlcsp')) {
      dfmIssues.push({
        severity: 'warning',
        message: `${nd.label} uses a fine-pitch package requiring advanced assembly`,
        componentId: nd.label,
        suggestion: 'Consider QFP or larger-pitch alternative for easier prototyping.',
      });
    }
    if (type === 'passive' && (nodeLabel.includes('0201') || nodeLabel.includes('01005'))) {
      dfmIssues.push({
        severity: 'warning',
        message: `${nd.label} uses tiny package (0201/01005) — difficult for hand assembly`,
        componentId: nd.label,
        suggestion: 'Use 0402 or 0603 package for easier hand soldering.',
      });
    }
  });

  dfmIssues.push({
    severity: 'info',
    message: `DFM check complete: ${ctx.state.currentNodes.length} components analyzed, ${dfmIssues.length} findings.`,
    suggestion: 'Review component packages and ensure compatibility with your assembly process.',
  });

  dfmIssues.forEach((issue) => ctx.validation.addValidationIssue(issue));
  ctx.arch.setActiveView('validation');
  ctx.history.addToHistory('DFM check', 'AI');
  ctx.output.addOutputLog(`[AI] DFM check: ${dfmIssues.length} findings`);
};

const thermalAnalysis: ActionHandler = (_action, ctx) => {
  const thermalIssues: Array<{ severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string }> = [];

  ctx.state.currentNodes.forEach((n) => {
    const nd = nodeData(n);
    const type = nd.type?.toLowerCase() || '';
    const nodeLabel = nd.label?.toLowerCase() || '';
    let dissipation = 0;

    if (type === 'power') { dissipation = 0.5; }
    else if (type === 'mcu') { dissipation = 0.3; }
    else if (type === 'comm') { dissipation = 0.4; }
    else if (type === 'actuator') { dissipation = 1.0; }
    else if (nodeLabel.includes('ldo') || nodeLabel.includes('regulator')) { dissipation = 0.8; }

    if (dissipation > 0.4) {
      thermalIssues.push({
        severity: 'warning',
        message: `${nd.label}: estimated ${dissipation}W dissipation — may require thermal management`,
        componentId: nd.label,
        suggestion: `Add thermal vias, copper pour, or heatsink. Ensure adequate airflow (thetaJA < ${Math.round(80 / dissipation)}C/W).`,
      });
    }
  });

  const totalDissipation = ctx.state.currentNodes.reduce((sum: number, n) => {
    const type = nodeData(n).type?.toLowerCase() || '';
    if (type === 'power') { return sum + 0.5; }
    if (type === 'mcu') { return sum + 0.3; }
    if (type === 'comm') { return sum + 0.4; }
    if (type === 'actuator') { return sum + 1.0; }
    return sum + 0.05;
  }, 0);

  thermalIssues.push({
    severity: 'info',
    message: `Total estimated power dissipation: ${totalDissipation.toFixed(2)}W across ${ctx.state.currentNodes.length} components.`,
    suggestion: `Board temperature rise ~${(totalDissipation * 30).toFixed(0)}C above ambient (estimated for 50x50mm 2-layer PCB).`,
  });

  thermalIssues.forEach((issue) => ctx.validation.addValidationIssue(issue));
  ctx.arch.setActiveView('validation');
  ctx.history.addToHistory('Thermal analysis', 'AI');
  ctx.output.addOutputLog(`[AI] Thermal analysis: ${totalDissipation.toFixed(2)}W total, ${thermalIssues.length} findings`);
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const validationHandlers: Record<string, ActionHandler> = {
  run_validation: runValidation,
  clear_validation: clearValidation,
  add_validation_issue: addValidationIssue,
  power_budget_analysis: powerBudgetAnalysis,
  voltage_domain_check: voltageDomainCheck,
  auto_fix_validation: autoFixValidation,
  dfm_check: dfmCheck,
  thermal_analysis: thermalAnalysis,
};
