/**
 * FMEA (Failure Mode and Effects Analysis) Report Generator
 *
 * Generates a CSV-format FMEA report based on architecture nodes, edges, and
 * existing validation issues. Uses electronics domain knowledge to produce
 * realistic failure modes for each component type.
 *
 * Pure function library. No Express routes, no side effects.
 */

import type { ArchNodeData, ArchEdgeData, ValidationIssueData, ExportResult } from './types';
import { csvRow, sanitizeFilename } from './types';

// ---------------------------------------------------------------------------
// FMEA data structures
// ---------------------------------------------------------------------------

interface FmeaEntry {
  item: string;
  function: string;
  failureMode: string;
  effect: string;
  severity: number;
  cause: string;
  occurrence: number;
  currentControls: string;
  detection: number;
  rpn: number;
  recommendedAction: string;
}

interface FmeaInput {
  projectName: string;
  nodes: ArchNodeData[];
  edges: ArchEdgeData[];
  issues: ValidationIssueData[];
}

// ---------------------------------------------------------------------------
// Component type classification
// ---------------------------------------------------------------------------

type ComponentCategory =
  | 'power'
  | 'mcu'
  | 'sensor'
  | 'connector'
  | 'passive'
  | 'communication'
  | 'memory'
  | 'actuator'
  | 'display'
  | 'protection'
  | 'generic';

const CATEGORY_KEYWORDS: Record<ComponentCategory, string[]> = {
  power: ['power', 'regulator', 'converter', 'ldo', 'buck', 'boost', 'battery', 'supply', 'psu', 'vreg', 'dcdc', 'charger', 'pmic'],
  mcu: ['mcu', 'microcontroller', 'processor', 'cpu', 'fpga', 'soc', 'dsp', 'controller', 'arduino', 'esp32', 'stm32', 'pic', 'avr'],
  sensor: ['sensor', 'adc', 'accelerometer', 'gyroscope', 'temperature', 'humidity', 'pressure', 'light', 'proximity', 'imu', 'thermocouple', 'encoder'],
  connector: ['connector', 'header', 'usb', 'uart', 'spi', 'i2c', 'jtag', 'debug', 'socket', 'terminal', 'jack', 'plug', 'port'],
  passive: ['resistor', 'capacitor', 'inductor', 'crystal', 'oscillator', 'ferrite', 'fuse', 'thermistor', 'varistor', 'filter'],
  communication: ['radio', 'wifi', 'bluetooth', 'ble', 'lora', 'zigbee', 'can', 'ethernet', 'modem', 'transceiver', 'rf', 'antenna'],
  memory: ['memory', 'flash', 'eeprom', 'sram', 'dram', 'sd', 'emmc', 'nand', 'nor', 'rom', 'storage'],
  actuator: ['motor', 'driver', 'relay', 'solenoid', 'servo', 'stepper', 'pwm', 'speaker', 'buzzer', 'led', 'pump', 'valve'],
  display: ['display', 'lcd', 'oled', 'epaper', 'tft', 'screen', 'indicator', 'segment'],
  protection: ['esd', 'tvs', 'diode', 'zener', 'clamp', 'surge', 'protection', 'optocoupler', 'isolator'],
  generic: [],
};

function classifyComponent(label: string, nodeType: string): ComponentCategory {
  const searchText = `${label} ${nodeType}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ComponentCategory, string[]][]) {
    if (category === 'generic') { continue; }
    if (keywords.some((kw) => searchText.includes(kw))) {
      return category;
    }
  }
  return 'generic';
}

// ---------------------------------------------------------------------------
// Failure mode templates by component category
// ---------------------------------------------------------------------------

interface FailureModeTemplate {
  failureMode: string;
  effect: string;
  baseSeverity: number;
  cause: string;
  baseOccurrence: number;
  controls: string;
  baseDetection: number;
  action: string;
}

const FAILURE_TEMPLATES: Record<ComponentCategory, FailureModeTemplate[]> = {
  power: [
    {
      failureMode: 'Output voltage drift/regulation failure',
      effect: 'Downstream components operate outside voltage specification; potential damage or malfunction',
      baseSeverity: 8,
      cause: 'Thermal stress, aging, inadequate decoupling capacitors',
      baseOccurrence: 3,
      controls: 'Voltage monitoring in design validation',
      baseDetection: 4,
      action: 'Add output voltage monitoring; verify thermal derating; add redundant decoupling',
    },
    {
      failureMode: 'Complete power loss (open circuit)',
      effect: 'System non-functional; all downstream subsystems lose power',
      baseSeverity: 10,
      cause: 'Component failure, solder joint fracture, overcurrent',
      baseOccurrence: 2,
      controls: 'Power-on self-test; power-good indicator',
      baseDetection: 3,
      action: 'Add power-good monitoring; consider redundant supply path; add fuse protection',
    },
    {
      failureMode: 'Excessive output ripple/noise',
      effect: 'Noise coupling into analog circuits; ADC measurement errors; EMI issues',
      baseSeverity: 6,
      cause: 'Inadequate filtering, ESR degradation in output capacitors',
      baseOccurrence: 4,
      controls: 'Oscilloscope measurement during prototype validation',
      baseDetection: 5,
      action: 'Verify capacitor ESR ratings; add LC post-filter; use low-noise regulator variant',
    },
  ],
  mcu: [
    {
      failureMode: 'Firmware hang / watchdog timeout',
      effect: 'System unresponsive; loss of control outputs; safety risk in control applications',
      baseSeverity: 8,
      cause: 'Software bug, stack overflow, interrupt priority inversion, EMI',
      baseOccurrence: 4,
      controls: 'Watchdog timer; firmware code review',
      baseDetection: 4,
      action: 'Implement hardware watchdog; add stack overflow detection; perform EMC testing',
    },
    {
      failureMode: 'Clock failure / frequency drift',
      effect: 'Communication timing errors; incorrect sampling rates; protocol failures',
      baseSeverity: 7,
      cause: 'Crystal aging, temperature excursion, PCB layout parasitics',
      baseOccurrence: 2,
      controls: 'Clock monitoring; communication checksums',
      baseDetection: 5,
      action: 'Use temperature-compensated oscillator; add clock fail detection; verify crystal load capacitors',
    },
    {
      failureMode: 'GPIO latch-up / ESD damage',
      effect: 'Pin non-functional; excessive current draw; potential permanent damage',
      baseSeverity: 7,
      cause: 'ESD event, voltage overshoot on I/O pins, improper hot-plug handling',
      baseOccurrence: 3,
      controls: 'ESD protection components; design review',
      baseDetection: 6,
      action: 'Add ESD protection on external-facing pins; verify absolute maximum ratings',
    },
  ],
  sensor: [
    {
      failureMode: 'Measurement drift / calibration loss',
      effect: 'Inaccurate readings; system makes decisions on incorrect data',
      baseSeverity: 7,
      cause: 'Temperature cycling, aging, mechanical stress on PCB',
      baseOccurrence: 4,
      controls: 'Factory calibration; periodic recalibration',
      baseDetection: 5,
      action: 'Implement runtime calibration check; add reference measurement; specify recalibration interval',
    },
    {
      failureMode: 'Communication bus failure (no response)',
      effect: 'Sensor data unavailable; system operates without feedback',
      baseSeverity: 7,
      cause: 'I2C/SPI bus contention, address conflict, signal integrity',
      baseOccurrence: 3,
      controls: 'Bus timeout detection; error counters',
      baseDetection: 4,
      action: 'Add bus pull-ups per specification; verify signal integrity; implement retry logic with fallback',
    },
    {
      failureMode: 'Complete sensor failure (stuck output)',
      effect: 'Stale data fed to system; potential unsafe operating condition',
      baseSeverity: 8,
      cause: 'Component defect, mechanical shock, moisture ingress',
      baseOccurrence: 2,
      controls: 'Plausibility check on sensor readings',
      baseDetection: 5,
      action: 'Add plausibility monitoring; consider redundant sensor; implement safe-state fallback',
    },
  ],
  connector: [
    {
      failureMode: 'Intermittent contact / high resistance connection',
      effect: 'Signal degradation; data errors; power drops under load',
      baseSeverity: 6,
      cause: 'Vibration, thermal cycling, contact corrosion, insufficient mating force',
      baseOccurrence: 4,
      controls: 'Mechanical stress testing; visual inspection',
      baseDetection: 6,
      action: 'Specify connector with higher mating cycles; add strain relief; use conformal coating',
    },
    {
      failureMode: 'Pin misalignment / reverse insertion',
      effect: 'Short circuit; component damage; reversed polarity',
      baseSeverity: 9,
      cause: 'Mechanical misalignment, lack of keying, assembly error',
      baseOccurrence: 3,
      controls: 'Polarized connector; assembly instructions',
      baseDetection: 4,
      action: 'Use keyed/polarized connectors; add reverse polarity protection; mark pin 1 clearly',
    },
  ],
  passive: [
    {
      failureMode: 'Parameter drift outside tolerance',
      effect: 'Circuit behavior shifts; filter cutoff changes; bias point drift',
      baseSeverity: 5,
      cause: 'Temperature coefficient, aging, voltage coefficient',
      baseOccurrence: 3,
      controls: 'Component derating; tolerance analysis',
      baseDetection: 6,
      action: 'Use tighter tolerance components in critical paths; perform worst-case analysis',
    },
    {
      failureMode: 'Open circuit failure',
      effect: 'Circuit path broken; dependent subsystem non-functional',
      baseSeverity: 7,
      cause: 'Thermal stress, solder joint crack, overvoltage',
      baseOccurrence: 2,
      controls: 'Solder joint inspection; functional test',
      baseDetection: 5,
      action: 'Verify power ratings with margin; use automotive-grade components in critical paths',
    },
  ],
  communication: [
    {
      failureMode: 'Link loss / excessive packet errors',
      effect: 'Data transmission interrupted; system cannot communicate with external devices',
      baseSeverity: 7,
      cause: 'Interference, antenna mismatch, distance, multipath fading',
      baseOccurrence: 4,
      controls: 'Link quality monitoring; error rate counters',
      baseDetection: 4,
      action: 'Perform RF site survey; verify antenna impedance matching; implement retry protocol',
    },
    {
      failureMode: 'Protocol desynchronization',
      effect: 'Garbled data; command misinterpretation; system state corruption',
      baseSeverity: 6,
      cause: 'Timing mismatch, buffer overflow, firmware bug',
      baseOccurrence: 3,
      controls: 'CRC/checksum validation; protocol state machine',
      baseDetection: 4,
      action: 'Add message framing with CRC; implement protocol watchdog; use well-tested protocol stack',
    },
  ],
  memory: [
    {
      failureMode: 'Data corruption / bit errors',
      effect: 'Stored configuration or calibration data invalid; system malfunction on next boot',
      baseSeverity: 8,
      cause: 'Write interrupted by power loss, wear leveling failure, radiation',
      baseOccurrence: 3,
      controls: 'CRC on stored data; write verification',
      baseDetection: 4,
      action: 'Implement CRC or ECC on stored data; add power-fail detection before write; use wear leveling',
    },
    {
      failureMode: 'Endurance limit reached (write cycle exhaustion)',
      effect: 'Cannot store new data; configuration updates fail',
      baseSeverity: 6,
      cause: 'Excessive write cycles to same memory location',
      baseOccurrence: 2,
      controls: 'Write cycle tracking; wear leveling algorithm',
      baseDetection: 5,
      action: 'Implement wear leveling; log write cycle count; select memory with adequate endurance rating',
    },
  ],
  actuator: [
    {
      failureMode: 'Actuator stuck / no response',
      effect: 'Physical output frozen in current state; safety risk if in motion control',
      baseSeverity: 8,
      cause: 'Mechanical jam, driver IC failure, broken wire',
      baseOccurrence: 3,
      controls: 'Position/current feedback; timeout detection',
      baseDetection: 4,
      action: 'Add feedback sensor (encoder/current sense); implement stall detection; add manual override',
    },
    {
      failureMode: 'Driver thermal shutdown',
      effect: 'Actuator stops unexpectedly; intermittent operation',
      baseSeverity: 6,
      cause: 'Overload, insufficient heatsinking, ambient temperature',
      baseOccurrence: 3,
      controls: 'Temperature monitoring; derating calculation',
      baseDetection: 5,
      action: 'Verify thermal design with margin; add thermal monitoring; reduce duty cycle or add heatsink',
    },
  ],
  display: [
    {
      failureMode: 'Display blank / no output',
      effect: 'No visual feedback to user; system appears non-functional',
      baseSeverity: 6,
      cause: 'Backlight failure, communication bus error, initialization failure',
      baseOccurrence: 2,
      controls: 'Display initialization check; visual inspection',
      baseDetection: 3,
      action: 'Add display self-test at boot; verify power sequencing; add status LED fallback',
    },
    {
      failureMode: 'Display pixel/segment degradation',
      effect: 'Incorrect or unreadable information displayed; user confusion',
      baseSeverity: 5,
      cause: 'Aging, DC bias accumulation, moisture ingress',
      baseOccurrence: 2,
      controls: 'Visual quality check; AC drive for LCD',
      baseDetection: 3,
      action: 'Use AC driving; specify operating temperature range; add conformal coating',
    },
  ],
  protection: [
    {
      failureMode: 'Protection device degraded / latent failure',
      effect: 'Downstream components unprotected against transients; damage on next surge event',
      baseSeverity: 9,
      cause: 'Previous surge events consumed protection margin; aging',
      baseOccurrence: 2,
      controls: 'ESD/surge testing during validation; replacement schedule',
      baseDetection: 7,
      action: 'Use TVS with adequate surge rating; add visual fuse indicator; specify replacement interval',
    },
    {
      failureMode: 'False triggering / nuisance trips',
      effect: 'System interrupted during normal operation; reduced availability',
      baseSeverity: 5,
      cause: 'Threshold too close to normal operating point; noise coupling',
      baseOccurrence: 3,
      controls: 'Threshold margin analysis; noise filtering',
      baseDetection: 4,
      action: 'Verify protection threshold with adequate margin above normal operation; add filtering',
    },
  ],
  generic: [
    {
      failureMode: 'Component failure (open/short)',
      effect: 'Subsystem function degraded or lost; potential cascading failure',
      baseSeverity: 7,
      cause: 'Manufacturing defect, thermal stress, overstress condition',
      baseOccurrence: 3,
      controls: 'Incoming inspection; functional testing',
      baseDetection: 5,
      action: 'Verify component ratings against operating conditions; add functional test coverage',
    },
    {
      failureMode: 'Solder joint failure',
      effect: 'Intermittent or permanent open circuit; unreliable operation',
      baseSeverity: 6,
      cause: 'Thermal cycling, vibration, insufficient solder paste, poor pad design',
      baseOccurrence: 3,
      controls: 'AOI / X-ray inspection; thermal cycling test',
      baseDetection: 5,
      action: 'Review pad geometry per IPC standards; specify reflow profile; add thermal relief pads',
    },
  ],
};

// ---------------------------------------------------------------------------
// Connectivity analysis helpers
// ---------------------------------------------------------------------------

interface ConnectivityInfo {
  /** Number of edges connected to this node. */
  connectionCount: number;
  /** True if this node is a single point of failure (only path between two graph regions). */
  isSinglePointOfFailure: boolean;
  /** True if this node sits on the path with the most connections (critical path heuristic). */
  isOnCriticalPath: boolean;
  /** Node IDs that depend on this node (connected downstream). */
  dependentNodes: string[];
}

function analyzeConnectivity(
  nodeId: string,
  nodes: ArchNodeData[],
  edges: ArchEdgeData[],
): ConnectivityInfo {
  const connectedEdges = edges.filter((e) => e.source === nodeId || e.target === nodeId);
  const connectionCount = connectedEdges.length;

  // Identify dependent nodes (nodes this one connects to)
  const dependentNodes = connectedEdges.map((e) =>
    e.source === nodeId ? e.target : e.source,
  );

  // Single point of failure: removing this node disconnects the graph.
  // Heuristic: a node is an SPOF if it has 2+ connections and at least one of its
  // neighbors has no other connections to the rest of the graph except through this node.
  const isSinglePointOfFailure = connectionCount >= 2 && dependentNodes.some((depId) => {
    const depEdges = edges.filter(
      (e) => (e.source === depId || e.target === depId) && e.source !== nodeId && e.target !== nodeId,
    );
    return depEdges.length === 0;
  });

  // Critical path heuristic: nodes with above-average connectivity
  const avgConnections = nodes.length > 0
    ? edges.length * 2 / nodes.length
    : 0;
  const isOnCriticalPath = connectionCount > avgConnections;

  return { connectionCount, isSinglePointOfFailure, isOnCriticalPath, dependentNodes };
}

// ---------------------------------------------------------------------------
// Severity/occurrence modifiers based on connectivity & validation issues
// ---------------------------------------------------------------------------

function adjustSeverity(base: number, connectivity: ConnectivityInfo): number {
  let adjusted = base;
  if (connectivity.isSinglePointOfFailure) {
    adjusted = Math.min(10, adjusted + 2);
  } else if (connectivity.isOnCriticalPath) {
    adjusted = Math.min(10, adjusted + 1);
  }
  return adjusted;
}

function adjustOccurrence(base: number, nodeId: string, issues: ValidationIssueData[]): number {
  const nodeIssues = issues.filter((i) => i.componentId === nodeId);
  const errorCount = nodeIssues.filter((i) => i.severity === 'error').length;
  const warningCount = nodeIssues.filter((i) => i.severity === 'warning').length;

  let adjusted = base;
  // Existing errors suggest higher likelihood
  if (errorCount > 0) {
    adjusted = Math.min(10, adjusted + 2);
  } else if (warningCount > 0) {
    adjusted = Math.min(10, adjusted + 1);
  }
  return adjusted;
}

// ---------------------------------------------------------------------------
// FMEA generation
// ---------------------------------------------------------------------------

function generateEntries(input: FmeaInput): FmeaEntry[] {
  const { nodes, edges, issues } = input;
  const entries: FmeaEntry[] = [];

  for (const node of nodes) {
    const category = classifyComponent(node.label, node.nodeType);
    const templates = FAILURE_TEMPLATES[category];
    const connectivity = analyzeConnectivity(node.nodeId, nodes, edges);

    // Derive a short function description
    const functionDesc = deriveFunctionDescription(node, category);

    for (const tmpl of templates) {
      const severity = adjustSeverity(tmpl.baseSeverity, connectivity);
      const occurrence = adjustOccurrence(tmpl.baseOccurrence, node.nodeId, issues);
      const detection = tmpl.baseDetection;
      const rpn = severity * occurrence * detection;

      entries.push({
        item: node.label,
        function: functionDesc,
        failureMode: tmpl.failureMode,
        effect: tmpl.effect,
        severity,
        cause: tmpl.cause,
        occurrence,
        currentControls: tmpl.controls,
        detection,
        rpn,
        recommendedAction: tmpl.action,
      });
    }

    // Add entries for validation issues not covered by templates
    const nodeIssues = issues.filter((i) => i.componentId === node.nodeId);
    for (const issue of nodeIssues) {
      const severity = issue.severity === 'error' ? 8 : issue.severity === 'warning' ? 5 : 3;
      const adjustedSeverity = adjustSeverity(severity, connectivity);
      const rpn = adjustedSeverity * 5 * 6;

      entries.push({
        item: node.label,
        function: functionDesc,
        failureMode: `Validation issue: ${issue.message}`,
        effect: 'Design rule violation detected; may cause functional or reliability issue',
        severity: adjustedSeverity,
        cause: 'Design oversight identified by automated validation',
        occurrence: 5,
        currentControls: 'Automated DRC/ERC validation',
        detection: 6,
        rpn,
        recommendedAction: issue.suggestion ?? 'Review and resolve validation finding before production',
      });
    }
  }

  // Also add entries for validation issues not associated with a specific component
  const orphanIssues = issues.filter(
    (i) => i.componentId === null || !nodes.some((n) => n.nodeId === i.componentId),
  );
  for (const issue of orphanIssues) {
    const severity = issue.severity === 'error' ? 8 : issue.severity === 'warning' ? 5 : 3;
    const rpn = severity * 5 * 6;

    entries.push({
      item: 'System-level',
      function: 'Overall design integrity',
      failureMode: `Validation issue: ${issue.message}`,
      effect: 'Design rule violation; may affect system reliability',
      severity,
      cause: 'Design oversight identified by automated validation',
      occurrence: 5,
      currentControls: 'Automated DRC/ERC validation',
      detection: 6,
      rpn,
      recommendedAction: issue.suggestion ?? 'Review and resolve validation finding',
    });
  }

  // Sort by RPN descending
  entries.sort((a, b) => b.rpn - a.rpn);

  return entries;
}

function deriveFunctionDescription(node: ArchNodeData, category: ComponentCategory): string {
  const descriptions: Record<ComponentCategory, string> = {
    power: 'Provide regulated power to downstream components',
    mcu: 'Execute firmware and control system behavior',
    sensor: 'Measure physical quantity and provide data to system',
    connector: 'Provide external interface connection',
    passive: 'Condition signals or store energy',
    communication: 'Enable data exchange with external systems',
    memory: 'Store persistent data and configuration',
    actuator: 'Convert electrical signals to physical action',
    display: 'Provide visual output to user',
    protection: 'Protect circuits from transient and fault conditions',
    generic: 'Perform designated circuit function',
  };

  return `${node.label}: ${descriptions[category]}`;
}

// ---------------------------------------------------------------------------
// CSV output
// ---------------------------------------------------------------------------

const FMEA_HEADERS = [
  'Item / Function',
  'Potential Failure Mode',
  'Potential Effect(s) of Failure',
  'Severity (S)',
  'Potential Cause(s)',
  'Occurrence (O)',
  'Current Controls',
  'Detection (D)',
  'RPN',
  'Recommended Action',
];

function generateCsvContent(entries: FmeaEntry[], input: FmeaInput): string {
  const lines: string[] = [];

  // Summary header
  const totalComponents = input.nodes.length;
  const highestRpn = entries.length > 0 ? entries[0].rpn : 0;
  const avgRpn = entries.length > 0
    ? Math.round(entries.reduce((sum, e) => sum + e.rpn, 0) / entries.length)
    : 0;
  const criticalItems = entries.filter((e) => e.rpn > 100);
  const now = new Date().toISOString().split('T')[0];

  lines.push(csvRow(['FMEA Report', input.projectName]));
  lines.push(csvRow(['Generated', now]));
  lines.push(csvRow(['Generator', 'ProtoPulse EDA']));
  lines.push(csvRow([]));
  lines.push(csvRow(['Summary']));
  lines.push(csvRow(['Components Analyzed', totalComponents]));
  lines.push(csvRow(['Total Failure Modes', entries.length]));
  lines.push(csvRow(['Highest RPN', highestRpn]));
  lines.push(csvRow(['Average RPN', avgRpn]));
  lines.push(csvRow(['Critical Items (RPN > 100)', criticalItems.length]));

  if (criticalItems.length > 0) {
    lines.push(csvRow([]));
    lines.push(csvRow(['Critical Items Requiring Immediate Attention']));
    for (const item of criticalItems) {
      lines.push(csvRow([`  ${item.item}: ${item.failureMode} (RPN=${item.rpn})`]));
    }
  }

  lines.push(csvRow([]));
  lines.push(csvRow([]));

  // FMEA table header
  lines.push(csvRow(FMEA_HEADERS));

  // FMEA entries grouped by component
  let currentItem = '';
  for (const entry of entries) {
    if (entry.item !== currentItem) {
      currentItem = entry.item;
    }
    lines.push(csvRow([
      entry.function,
      entry.failureMode,
      entry.effect,
      entry.severity,
      entry.cause,
      entry.occurrence,
      entry.currentControls,
      entry.detection,
      entry.rpn,
      entry.recommendedAction,
    ]));
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateFmeaReport(input: FmeaInput): ExportResult {
  const entries = generateEntries(input);
  const content = generateCsvContent(entries, input);

  return {
    content,
    encoding: 'utf8',
    mimeType: 'text/csv',
    filename: `${sanitizeFilename(input.projectName)}_FMEA_Report.csv`,
  };
}
