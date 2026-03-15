/**
 * Lab/Assignment Templates for Educators
 *
 * Pre-built lab assignments with objectives, step-by-step instructions,
 * grading criteria, difficulty ratings, estimated time, and prerequisites.
 * Designed for educators to assign structured hands-on labs and for
 * self-learners to follow guided projects.
 *
 * Usage:
 *   const manager = LabTemplateManager.getInstance();
 *   const labs = manager.listLabs();
 *   const session = manager.startLab('led-circuit-basics');
 *   manager.completeStep('led-circuit-basics', 'step-1');
 *
 * React hook:
 *   const { labs, startLab, completeStep, getProgress, resetLab } = useLabTemplates();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LabDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type LabCategory =
  | 'fundamentals'
  | 'analog'
  | 'digital'
  | 'microcontroller'
  | 'pcb'
  | 'power';

export type GradingCriterionType = 'binary' | 'rubric';

export interface GradingCriterion {
  id: string;
  description: string;
  type: GradingCriterionType;
  points: number;
  rubric?: { label: string; points: number }[];
}

export interface LabStep {
  id: string;
  title: string;
  instructions: string;
  hints?: string[];
  expectedOutcome: string;
  order: number;
}

export interface LabObjective {
  id: string;
  description: string;
}

export interface LabTemplate {
  id: string;
  title: string;
  description: string;
  category: LabCategory;
  difficulty: LabDifficulty;
  estimatedMinutes: number;
  prerequisites: string[];
  objectives: LabObjective[];
  steps: LabStep[];
  gradingCriteria: GradingCriterion[];
  tags: string[];
  version: number;
}

export type LabSessionStatus = 'not-started' | 'in-progress' | 'completed' | 'graded';

export interface StepProgress {
  stepId: string;
  completed: boolean;
  completedAt?: number;
}

export interface GradeResult {
  criterionId: string;
  awarded: number;
  maxPoints: number;
  notes?: string;
}

export interface LabSession {
  labId: string;
  status: LabSessionStatus;
  stepProgress: StepProgress[];
  grades: GradeResult[];
  startedAt: number;
  completedAt?: number;
  gradedAt?: number;
  totalScore?: number;
  maxScore?: number;
}

export interface LabEvent {
  type: 'lab-start' | 'step-complete' | 'lab-complete' | 'lab-grade' | 'lab-reset';
  labId: string;
  stepId?: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-lab-sessions';

type Listener = () => void;

// ---------------------------------------------------------------------------
// Built-in Labs
// ---------------------------------------------------------------------------

function createBuiltInLabs(): LabTemplate[] {
  return [
    {
      id: 'led-circuit-basics',
      title: 'LED Circuit Basics',
      description:
        'Build your first LED circuit. Learn about current-limiting resistors, forward voltage, and basic circuit topology.',
      category: 'fundamentals',
      difficulty: 'beginner',
      estimatedMinutes: 20,
      prerequisites: [],
      objectives: [
        { id: 'obj-1', description: 'Understand why LEDs need current-limiting resistors' },
        { id: 'obj-2', description: 'Calculate the correct resistor value for a given LED and supply voltage' },
        { id: 'obj-3', description: 'Build and validate a working LED circuit in the schematic editor' },
      ],
      steps: [
        {
          id: 'led-step-1',
          title: 'Add a power source',
          instructions:
            'Open the Schematic view and place a DC voltage source set to 5V. This represents your USB or battery supply.',
          hints: ['Use the component library to find "Voltage Source"', 'Set the value to 5V in the properties panel'],
          expectedOutcome: 'A 5V DC source appears on the schematic canvas.',
          order: 0,
        },
        {
          id: 'led-step-2',
          title: 'Place a resistor',
          instructions:
            'Add a resistor in series with the LED. For a typical red LED (Vf=2V, If=20mA) and 5V supply, calculate R = (5 - 2) / 0.02 = 150 ohms.',
          hints: ['R = (Vsupply - Vforward) / Iforward', 'Round up to the nearest standard value: 150Ω or 220Ω'],
          expectedOutcome: 'A resistor with the calculated value is placed on the canvas.',
          order: 1,
        },
        {
          id: 'led-step-3',
          title: 'Place an LED',
          instructions:
            'Add an LED component. Pay attention to polarity — the anode connects to the resistor, the cathode to ground.',
          hints: ['The longer leg (anode) goes to positive', 'The flat side of the LED package marks the cathode'],
          expectedOutcome: 'An LED is placed with correct orientation.',
          order: 2,
        },
        {
          id: 'led-step-4',
          title: 'Complete the circuit',
          instructions:
            'Wire the components: Vsource+ → Resistor → LED anode → LED cathode → GND → Vsource-. Add a ground symbol.',
          hints: ['Every circuit needs a complete loop for current to flow'],
          expectedOutcome: 'All components are connected forming a complete loop.',
          order: 3,
        },
        {
          id: 'led-step-5',
          title: 'Run validation',
          instructions:
            'Switch to the Validation view and run a design rule check. Fix any errors or warnings that appear.',
          hints: ['Look for unconnected pins or missing ground connections'],
          expectedOutcome: 'DRC passes with no errors.',
          order: 4,
        },
      ],
      gradingCriteria: [
        { id: 'gc-1', description: 'Correct resistor value calculated', type: 'binary', points: 20 },
        { id: 'gc-2', description: 'LED polarity is correct', type: 'binary', points: 15 },
        { id: 'gc-3', description: 'Circuit is fully connected (no floating nets)', type: 'binary', points: 25 },
        { id: 'gc-4', description: 'DRC passes with no errors', type: 'binary', points: 20 },
        {
          id: 'gc-5',
          description: 'Schematic neatness and labeling',
          type: 'rubric',
          points: 20,
          rubric: [
            { label: 'No labels, messy layout', points: 5 },
            { label: 'Partial labels, readable', points: 10 },
            { label: 'All components labeled, clean layout', points: 15 },
            { label: 'Professional quality with net names', points: 20 },
          ],
        },
      ],
      tags: ['led', 'resistor', 'ohms-law', 'beginner', 'schematic'],
      version: 1,
    },
    {
      id: 'voltage-divider-lab',
      title: 'Voltage Divider Lab',
      description:
        'Design and simulate voltage dividers. Understand the relationship between resistor ratios and output voltage, and learn about loading effects.',
      category: 'analog',
      difficulty: 'beginner',
      estimatedMinutes: 30,
      prerequisites: ['led-circuit-basics'],
      objectives: [
        { id: 'obj-1', description: 'Calculate voltage divider output using the divider equation' },
        { id: 'obj-2', description: 'Simulate a voltage divider and verify measured vs calculated values' },
        { id: 'obj-3', description: 'Understand loading effects when a load is connected to the divider output' },
      ],
      steps: [
        {
          id: 'vd-step-1',
          title: 'Design the divider',
          instructions:
            'Create a voltage divider with R1=10kΩ (top) and R2=10kΩ (bottom) from a 5V supply. Predict Vout = Vin × R2/(R1+R2) = 2.5V.',
          hints: ['Vout = Vin × R2 / (R1 + R2)', 'Equal resistors give half the input voltage'],
          expectedOutcome: 'Two resistors in series between Vout+ and GND with a center tap labeled Vout.',
          order: 0,
        },
        {
          id: 'vd-step-2',
          title: 'Simulate and measure',
          instructions:
            'Run a DC operating point simulation. Measure the voltage at the center tap. It should read approximately 2.5V.',
          hints: ['Use the Simulation view', 'Add a voltage probe at the center node'],
          expectedOutcome: 'Simulation shows ~2.5V at the divider output.',
          order: 1,
        },
        {
          id: 'vd-step-3',
          title: 'Change the ratio',
          instructions:
            'Change R2 to 20kΩ. Recalculate: Vout = 5 × 20k/(10k+20k) = 3.33V. Re-simulate to verify.',
          hints: ['Larger R2 relative to R1 gives higher output voltage'],
          expectedOutcome: 'Simulation confirms ~3.33V output.',
          order: 2,
        },
        {
          id: 'vd-step-4',
          title: 'Observe loading effect',
          instructions:
            'Add a 10kΩ load resistor across R2 (parallel). The effective R2 becomes 10k||20k = 6.67kΩ. Vout drops to ~2V.',
          hints: [
            'Parallel resistance: R_parallel = (R2 × Rload) / (R2 + Rload)',
            'Loading always reduces the output voltage',
          ],
          expectedOutcome: 'Simulation shows Vout has dropped below the unloaded value.',
          order: 3,
        },
        {
          id: 'vd-step-5',
          title: 'Document findings',
          instructions:
            'Add text annotations to your schematic showing the calculated vs simulated values for each configuration.',
          hints: ['Good documentation is essential for any real design'],
          expectedOutcome: 'Schematic contains annotations with calculated and measured values.',
          order: 4,
        },
      ],
      gradingCriteria: [
        { id: 'gc-1', description: 'Correct divider equation applied', type: 'binary', points: 20 },
        { id: 'gc-2', description: 'Simulation matches calculated values (±5%)', type: 'binary', points: 25 },
        { id: 'gc-3', description: 'Loading effect correctly demonstrated', type: 'binary', points: 25 },
        {
          id: 'gc-4',
          description: 'Documentation quality',
          type: 'rubric',
          points: 30,
          rubric: [
            { label: 'No annotations', points: 0 },
            { label: 'Calculated values listed', points: 10 },
            { label: 'Calculated + simulated values compared', points: 20 },
            { label: 'Full analysis with loading discussion', points: 30 },
          ],
        },
      ],
      tags: ['voltage-divider', 'simulation', 'loading', 'analog', 'resistor'],
      version: 1,
    },
    {
      id: 'arduino-sensor-project',
      title: 'Arduino Sensor Project',
      description:
        'Design a complete Arduino-based sensor system with temperature and light sensing. Covers architecture design, schematic capture, and firmware scaffolding.',
      category: 'microcontroller',
      difficulty: 'intermediate',
      estimatedMinutes: 45,
      prerequisites: ['led-circuit-basics', 'voltage-divider-lab'],
      objectives: [
        { id: 'obj-1', description: 'Create a system architecture with Arduino, sensors, and display' },
        { id: 'obj-2', description: 'Design supporting circuits (voltage dividers, pull-ups) for sensors' },
        { id: 'obj-3', description: 'Generate a BOM and firmware scaffold for the design' },
      ],
      steps: [
        {
          id: 'as-step-1',
          title: 'Plan the architecture',
          instructions:
            'In Architecture view, create blocks for: Arduino Uno, TMP36 temperature sensor, LDR light sensor, 16x2 LCD display, and 5V power supply. Connect them logically.',
          hints: ['TMP36 outputs an analog voltage', 'LDR needs a voltage divider to read in analog'],
          expectedOutcome: 'Architecture diagram with all blocks connected.',
          order: 0,
        },
        {
          id: 'as-step-2',
          title: 'Design the TMP36 circuit',
          instructions:
            'In Schematic view, wire the TMP36: Vcc to 5V, GND to GND, Vout to Arduino A0. Add a 0.1µF decoupling capacitor close to the TMP36 power pins.',
          hints: ['Decoupling caps reduce noise on the power rail', 'TMP36 outputs 10mV/°C with 500mV offset at 0°C'],
          expectedOutcome: 'TMP36 circuit with decoupling capacitor connected to Arduino A0.',
          order: 1,
        },
        {
          id: 'as-step-3',
          title: 'Design the LDR circuit',
          instructions:
            'Create a voltage divider with the LDR and a 10kΩ fixed resistor. Connect the midpoint to Arduino A1. The LDR resistance changes with light intensity.',
          hints: ['LDR resistance decreases with more light', 'This is a sensor application of the voltage divider'],
          expectedOutcome: 'LDR voltage divider connected to Arduino A1.',
          order: 2,
        },
        {
          id: 'as-step-4',
          title: 'Add the LCD connections',
          instructions:
            'Wire the 16x2 LCD in 4-bit mode: RS to D12, E to D11, D4-D7 to D5-D2. Add a 10kΩ potentiometer for contrast adjustment.',
          hints: ['4-bit mode uses fewer Arduino pins', 'The potentiometer adjusts Vo (contrast) on the LCD'],
          expectedOutcome: 'LCD wired in 4-bit mode with contrast pot.',
          order: 3,
        },
        {
          id: 'as-step-5',
          title: 'Generate BOM and firmware',
          instructions:
            'Switch to Procurement view and verify all components are listed. Then use the Export panel to generate a firmware scaffold.',
          hints: ['Check that quantities and values are correct', 'The firmware scaffold gives you a starting point'],
          expectedOutcome: 'BOM lists all components; firmware scaffold compiles.',
          order: 4,
        },
        {
          id: 'as-step-6',
          title: 'Run full validation',
          instructions:
            'Run validation to check for any design issues. Ensure all pins are connected, power is properly distributed, and no DRC violations remain.',
          hints: ['Unconnected pins are the most common issue'],
          expectedOutcome: 'Validation passes with no errors.',
          order: 5,
        },
      ],
      gradingCriteria: [
        { id: 'gc-1', description: 'Architecture diagram complete and logical', type: 'binary', points: 15 },
        { id: 'gc-2', description: 'TMP36 circuit with decoupling capacitor', type: 'binary', points: 15 },
        { id: 'gc-3', description: 'LDR voltage divider correctly designed', type: 'binary', points: 15 },
        { id: 'gc-4', description: 'LCD wired in 4-bit mode', type: 'binary', points: 15 },
        { id: 'gc-5', description: 'BOM is complete and accurate', type: 'binary', points: 10 },
        { id: 'gc-6', description: 'DRC passes with no errors', type: 'binary', points: 10 },
        {
          id: 'gc-7',
          description: 'Overall design quality',
          type: 'rubric',
          points: 20,
          rubric: [
            { label: 'Functional but messy', points: 5 },
            { label: 'Clean layout, partial labels', points: 10 },
            { label: 'Well-organized, fully labeled', points: 15 },
            { label: 'Professional with clear signal flow', points: 20 },
          ],
        },
      ],
      tags: ['arduino', 'sensor', 'temperature', 'ldr', 'lcd', 'firmware'],
      version: 1,
    },
    {
      id: 'pcb-design-intro',
      title: 'PCB Design Intro',
      description:
        'Take a simple circuit from schematic to PCB layout. Learn about footprints, placement, routing, design rules, and manufacturing output.',
      category: 'pcb',
      difficulty: 'intermediate',
      estimatedMinutes: 40,
      prerequisites: ['led-circuit-basics'],
      objectives: [
        { id: 'obj-1', description: 'Assign footprints to schematic components' },
        { id: 'obj-2', description: 'Place components on a PCB board outline' },
        { id: 'obj-3', description: 'Route traces and run DRC for manufacturing readiness' },
      ],
      steps: [
        {
          id: 'pcb-step-1',
          title: 'Start with a schematic',
          instructions:
            'Create or load a simple circuit (e.g., the LED circuit from the first lab). Make sure every component has a footprint assigned in its properties.',
          hints: ['Common footprints: 0805 for SMD resistors, 5mm for through-hole LEDs'],
          expectedOutcome: 'Schematic with all footprints assigned.',
          order: 0,
        },
        {
          id: 'pcb-step-2',
          title: 'Set up the board',
          instructions:
            'Switch to PCB view. Define a board outline (e.g., 30mm × 20mm rectangle). Set design rules: 0.2mm min trace width, 0.2mm min clearance.',
          hints: ['Start with a small board for simple circuits', 'JLCPCB minimum clearance is 0.127mm'],
          expectedOutcome: 'Board outline visible with design rules configured.',
          order: 1,
        },
        {
          id: 'pcb-step-3',
          title: 'Place components',
          instructions:
            'Arrange components on the board. Place the connector/power input near the edge. Keep signal paths short. Use the ratsnest to guide placement.',
          hints: [
            'Place components that connect to each other close together',
            'Keep bypass caps next to IC power pins',
          ],
          expectedOutcome: 'All components placed within the board outline.',
          order: 2,
        },
        {
          id: 'pcb-step-4',
          title: 'Route traces',
          instructions:
            'Route traces between components following the ratsnest. Use wider traces for power (0.5mm+) and standard width for signals (0.2mm).',
          hints: ['Avoid 90° angles — use 45° bends', 'Route power traces first, then signals'],
          expectedOutcome: 'All nets routed with no unfinished connections.',
          order: 3,
        },
        {
          id: 'pcb-step-5',
          title: 'Run DRC',
          instructions:
            'Run the PCB Design Rule Check. Fix any clearance violations, unrouted nets, or minimum width violations.',
          hints: ['DRC checks physical manufacturability', 'Pay attention to drill size constraints'],
          expectedOutcome: 'DRC passes with zero violations.',
          order: 4,
        },
        {
          id: 'pcb-step-6',
          title: 'Generate manufacturing files',
          instructions:
            'Export Gerber files using the Export panel. Generate drill files and a pick-and-place file. Review the output.',
          hints: ['Gerber files are the industry standard for PCB fabrication'],
          expectedOutcome: 'Gerber and drill files generated successfully.',
          order: 5,
        },
      ],
      gradingCriteria: [
        { id: 'gc-1', description: 'All footprints correctly assigned', type: 'binary', points: 15 },
        { id: 'gc-2', description: 'Board outline defined with appropriate size', type: 'binary', points: 10 },
        { id: 'gc-3', description: 'Component placement is logical and compact', type: 'binary', points: 15 },
        { id: 'gc-4', description: 'All nets routed with appropriate trace widths', type: 'binary', points: 20 },
        { id: 'gc-5', description: 'DRC passes with no violations', type: 'binary', points: 20 },
        {
          id: 'gc-6',
          description: 'Manufacturing output quality',
          type: 'rubric',
          points: 20,
          rubric: [
            { label: 'Gerbers generated but not reviewed', points: 5 },
            { label: 'Gerbers reviewed, minor issues', points: 10 },
            { label: 'Complete output set, all layers correct', points: 15 },
            { label: 'Production-ready with drill + pick-place', points: 20 },
          ],
        },
      ],
      tags: ['pcb', 'footprint', 'routing', 'drc', 'gerber', 'manufacturing'],
      version: 1,
    },
    {
      id: 'power-supply-design',
      title: 'Power Supply Design',
      description:
        'Design a regulated 3.3V power supply from a 9V battery. Learn about voltage regulators, filter capacitors, thermal considerations, and power budgeting.',
      category: 'power',
      difficulty: 'advanced',
      estimatedMinutes: 50,
      prerequisites: ['led-circuit-basics', 'voltage-divider-lab'],
      objectives: [
        { id: 'obj-1', description: 'Select an appropriate voltage regulator for the application' },
        { id: 'obj-2', description: 'Design input/output filtering and protection' },
        { id: 'obj-3', description: 'Perform thermal analysis and verify the design under load' },
      ],
      steps: [
        {
          id: 'ps-step-1',
          title: 'Define requirements',
          instructions:
            'Input: 9V battery. Output: 3.3V regulated, 500mA max. Create an architecture block diagram showing the power path: Battery → Protection → Regulator → Filtered Output.',
          hints: ['Always start with requirements before choosing parts'],
          expectedOutcome: 'Architecture diagram with power path blocks.',
          order: 0,
        },
        {
          id: 'ps-step-2',
          title: 'Select the regulator',
          instructions:
            'Choose an LDO regulator (e.g., AMS1117-3.3). Key specs: dropout voltage < 1.3V (9V-3.3V=5.7V, plenty of headroom), output current ≥ 500mA, low quiescent current.',
          hints: [
            'LDO = Low Dropout Regulator',
            'Dropout voltage is the minimum Vin-Vout for regulation',
            'Power dissipation = (Vin - Vout) × Iout',
          ],
          expectedOutcome: 'Regulator selected with key specifications noted.',
          order: 1,
        },
        {
          id: 'ps-step-3',
          title: 'Design input protection',
          instructions:
            'Add reverse polarity protection (a series Schottky diode or P-MOSFET). Add a 100µF electrolytic input capacitor for bulk energy storage and a 0.1µF ceramic for high-frequency filtering.',
          hints: [
            'Schottky diodes have lower forward voltage drop than standard diodes',
            'Input caps reduce ripple and supply transient current demands',
          ],
          expectedOutcome: 'Input stage with protection diode and capacitors.',
          order: 2,
        },
        {
          id: 'ps-step-4',
          title: 'Design output filtering',
          instructions:
            'Add the datasheet-recommended output capacitors: typically 22µF tantalum or ceramic + 0.1µF ceramic. Check ESR requirements in the regulator datasheet.',
          hints: [
            'ESR (Equivalent Series Resistance) affects regulator stability',
            'Tantalum caps have low ESR but are polarity-sensitive',
          ],
          expectedOutcome: 'Output capacitors placed per datasheet recommendations.',
          order: 3,
        },
        {
          id: 'ps-step-5',
          title: 'Add power indicator and enable',
          instructions:
            'Add a power-on LED with current-limiting resistor on the 3.3V output. Optionally add an enable switch.',
          hints: ['For 3.3V with a green LED (Vf~2.2V): R = (3.3-2.2)/10mA = 110Ω → use 120Ω'],
          expectedOutcome: 'Power LED indicator on output rail.',
          order: 4,
        },
        {
          id: 'ps-step-6',
          title: 'Thermal analysis',
          instructions:
            'Calculate worst-case power dissipation: P = (9V - 3.3V) × 0.5A = 2.85W. Determine if a heatsink is needed based on the regulator thermal resistance (junction-to-ambient).',
          hints: [
            'Tj = Ta + (θja × P) — junction temp must stay below max (usually 125°C)',
            'SOT-223 package: θja ≈ 90°C/W → Tj = 25 + (90 × 2.85) = 281°C — HEATSINK REQUIRED',
            'Consider a TO-220 package or switching regulator for high dissipation',
          ],
          expectedOutcome: 'Thermal calculation completed; heatsink requirement identified.',
          order: 5,
        },
        {
          id: 'ps-step-7',
          title: 'Simulate and validate',
          instructions:
            'Run DC simulation to verify 3.3V output. Run transient simulation with a load step (0→500mA) to check output stability and transient response.',
          hints: ['Watch for output voltage dip during load steps', 'Larger output caps improve transient response'],
          expectedOutcome: 'Simulation confirms stable 3.3V output under load.',
          order: 6,
        },
      ],
      gradingCriteria: [
        { id: 'gc-1', description: 'Regulator selected with appropriate specs', type: 'binary', points: 10 },
        { id: 'gc-2', description: 'Reverse polarity protection implemented', type: 'binary', points: 10 },
        { id: 'gc-3', description: 'Input filtering adequate', type: 'binary', points: 10 },
        { id: 'gc-4', description: 'Output capacitors per datasheet requirements', type: 'binary', points: 10 },
        { id: 'gc-5', description: 'Thermal calculation performed correctly', type: 'binary', points: 15 },
        { id: 'gc-6', description: 'Simulation verifies output voltage', type: 'binary', points: 15 },
        {
          id: 'gc-7',
          description: 'Overall design robustness',
          type: 'rubric',
          points: 30,
          rubric: [
            { label: 'Basic regulator circuit, no protection', points: 5 },
            { label: 'Protection + filtering, no thermal analysis', points: 15 },
            { label: 'Full design with thermal + simulation', points: 25 },
            { label: 'Production-ready with all edge cases addressed', points: 30 },
          ],
        },
      ],
      tags: ['power-supply', 'regulator', 'ldo', 'thermal', 'capacitor', 'protection'],
      version: 1,
    },
  ];
}

// ---------------------------------------------------------------------------
// Manager (singleton + subscribe pattern)
// ---------------------------------------------------------------------------

export class LabTemplateManager {
  private static instance: LabTemplateManager | null = null;

  private labs: Map<string, LabTemplate> = new Map();
  private sessions: Map<string, LabSession> = new Map();
  private listeners: Set<Listener> = new Set();

  private constructor() {
    for (const lab of createBuiltInLabs()) {
      this.labs.set(lab.id, lab);
    }
    this.loadSessions();
  }

  static getInstance(): LabTemplateManager {
    if (!LabTemplateManager.instance) {
      LabTemplateManager.instance = new LabTemplateManager();
    }
    return LabTemplateManager.instance;
  }

  static resetForTesting(): void {
    LabTemplateManager.instance = null;
  }

  // ---- Persistence -------------------------------------------------------

  private loadSessions(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, LabSession>;
        for (const [id, session] of Object.entries(parsed)) {
          this.sessions.set(id, session);
        }
      }
    } catch {
      // Corrupted storage — start fresh
    }
  }

  private persistSessions(): void {
    const obj: Record<string, LabSession> = {};
    for (const [id, session] of Array.from(this.sessions.entries())) {
      obj[id] = session;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  }

  // ---- Subscribe ---------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }

  // ---- Lab CRUD ----------------------------------------------------------

  listLabs(): LabTemplate[] {
    return Array.from(this.labs.values());
  }

  getLab(id: string): LabTemplate | undefined {
    return this.labs.get(id);
  }

  getLabsByCategory(category: LabCategory): LabTemplate[] {
    return this.listLabs().filter((lab) => lab.category === category);
  }

  getLabsByDifficulty(difficulty: LabDifficulty): LabTemplate[] {
    return this.listLabs().filter((lab) => lab.difficulty === difficulty);
  }

  searchLabs(query: string): LabTemplate[] {
    const lower = query.toLowerCase();
    return this.listLabs().filter(
      (lab) =>
        lab.title.toLowerCase().includes(lower) ||
        lab.description.toLowerCase().includes(lower) ||
        lab.tags.some((tag) => tag.toLowerCase().includes(lower)),
    );
  }

  registerLab(lab: LabTemplate): void {
    if (this.labs.has(lab.id)) {
      throw new Error(`Lab "${lab.id}" already exists`);
    }
    this.labs.set(lab.id, lab);
    this.notify();
  }

  // ---- Prerequisites -----------------------------------------------------

  checkPrerequisites(labId: string): { met: boolean; missing: string[] } {
    const lab = this.labs.get(labId);
    if (!lab) {
      return { met: false, missing: [] };
    }
    const missing: string[] = [];
    for (const prereqId of lab.prerequisites) {
      const session = this.sessions.get(prereqId);
      if (!session || (session.status !== 'completed' && session.status !== 'graded')) {
        missing.push(prereqId);
      }
    }
    return { met: missing.length === 0, missing };
  }

  // ---- Session management ------------------------------------------------

  startLab(labId: string): LabSession {
    const lab = this.labs.get(labId);
    if (!lab) {
      throw new Error(`Lab "${labId}" not found`);
    }

    const existing = this.sessions.get(labId);
    if (existing && existing.status === 'in-progress') {
      return existing;
    }

    const session: LabSession = {
      labId,
      status: 'in-progress',
      stepProgress: lab.steps.map((step) => ({
        stepId: step.id,
        completed: false,
      })),
      grades: [],
      startedAt: Date.now(),
    };
    this.sessions.set(labId, session);
    this.persistSessions();
    this.notify();
    return session;
  }

  getSession(labId: string): LabSession | undefined {
    return this.sessions.get(labId);
  }

  getAllSessions(): Map<string, LabSession> {
    return new Map(this.sessions);
  }

  completeStep(labId: string, stepId: string): void {
    const session = this.sessions.get(labId);
    if (!session) {
      throw new Error(`No active session for lab "${labId}"`);
    }

    const stepProgress = session.stepProgress.find((sp) => sp.stepId === stepId);
    if (!stepProgress) {
      throw new Error(`Step "${stepId}" not found in lab "${labId}"`);
    }

    if (stepProgress.completed) {
      return; // Already completed, idempotent
    }

    stepProgress.completed = true;
    stepProgress.completedAt = Date.now();

    // Auto-complete lab when all steps are done
    const allDone = session.stepProgress.every((sp) => sp.completed);
    if (allDone) {
      session.status = 'completed';
      session.completedAt = Date.now();
    }

    this.persistSessions();
    this.notify();
  }

  getProgress(labId: string): { completed: number; total: number; percent: number } {
    const session = this.sessions.get(labId);
    if (!session) {
      return { completed: 0, total: 0, percent: 0 };
    }
    const total = session.stepProgress.length;
    const completed = session.stepProgress.filter((sp) => sp.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percent };
  }

  // ---- Grading -----------------------------------------------------------

  gradeLab(labId: string, grades: GradeResult[]): void {
    const session = this.sessions.get(labId);
    if (!session) {
      throw new Error(`No session for lab "${labId}"`);
    }
    if (session.status !== 'completed' && session.status !== 'in-progress') {
      throw new Error(`Lab "${labId}" is not in a gradable state`);
    }

    const lab = this.labs.get(labId);
    if (!lab) {
      throw new Error(`Lab "${labId}" not found`);
    }

    // Validate grades against criteria
    for (const grade of grades) {
      const criterion = lab.gradingCriteria.find((gc) => gc.id === grade.criterionId);
      if (!criterion) {
        throw new Error(`Unknown grading criterion "${grade.criterionId}" for lab "${labId}"`);
      }
      if (grade.awarded < 0 || grade.awarded > criterion.points) {
        throw new Error(
          `Grade for "${grade.criterionId}" must be between 0 and ${criterion.points}, got ${grade.awarded}`,
        );
      }
    }

    session.grades = grades;
    session.status = 'graded';
    session.gradedAt = Date.now();
    session.totalScore = grades.reduce((sum, g) => sum + g.awarded, 0);
    session.maxScore = lab.gradingCriteria.reduce((sum, gc) => sum + gc.points, 0);

    this.persistSessions();
    this.notify();
  }

  // ---- Reset -------------------------------------------------------------

  resetLab(labId: string): void {
    this.sessions.delete(labId);
    this.persistSessions();
    this.notify();
  }

  resetAllSessions(): void {
    this.sessions.clear();
    this.persistSessions();
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export function useLabTemplates() {
  const [, forceUpdate] = useState(0);

  const manager = LabTemplateManager.getInstance();

  useEffect(() => {
    return manager.subscribe(() => {
      forceUpdate((n) => n + 1);
    });
  }, [manager]);

  const labs = useCallback(() => manager.listLabs(), [manager]);

  const getLab = useCallback((id: string) => manager.getLab(id), [manager]);

  const getLabsByCategory = useCallback((cat: LabCategory) => manager.getLabsByCategory(cat), [manager]);

  const getLabsByDifficulty = useCallback((diff: LabDifficulty) => manager.getLabsByDifficulty(diff), [manager]);

  const searchLabs = useCallback((query: string) => manager.searchLabs(query), [manager]);

  const startLab = useCallback((id: string) => manager.startLab(id), [manager]);

  const getSession = useCallback((id: string) => manager.getSession(id), [manager]);

  const completeStep = useCallback(
    (labId: string, stepId: string) => manager.completeStep(labId, stepId),
    [manager],
  );

  const getProgress = useCallback((id: string) => manager.getProgress(id), [manager]);

  const gradeLab = useCallback(
    (labId: string, grades: GradeResult[]) => manager.gradeLab(labId, grades),
    [manager],
  );

  const resetLab = useCallback((id: string) => manager.resetLab(id), [manager]);

  const checkPrerequisites = useCallback((id: string) => manager.checkPrerequisites(id), [manager]);

  return {
    labs,
    getLab,
    getLabsByCategory,
    getLabsByDifficulty,
    searchLabs,
    startLab,
    getSession,
    completeStep,
    getProgress,
    gradeLab,
    resetLab,
    checkPrerequisites,
  };
}
