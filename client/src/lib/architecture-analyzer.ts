/**
 * Architecture Analyzer (CAPX-FFI-64).
 *
 * Reverse-engineers and documents existing circuit designs using purely
 * heuristic, keyword-based analysis — no AI API calls required. Detects
 * subsystems, common circuit patterns, signal flow, and generates
 * beginner-friendly educational notes and improvement suggestions.
 */

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface AnalysisNode {
  id: string;
  label: string;
  type?: string;
  properties?: Record<string, string>;
}

export interface AnalysisEdge {
  source: string;
  target: string;
  label?: string;
}

export interface AnalysisBomItem {
  name: string;
  category?: string;
  value?: string;
  quantity: number;
}

export interface DesignAnalysisInput {
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
  bomItems?: AnalysisBomItem[];
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type SubsystemCategory =
  | 'power'
  | 'sensing'
  | 'control'
  | 'communication'
  | 'actuation'
  | 'protection'
  | 'user-interface'
  | 'unknown';

export interface Subsystem {
  name: string;
  category: SubsystemCategory;
  nodeIds: string[];
  description: string;
}

export interface ComponentRole {
  nodeId: string;
  label: string;
  role: string;
  subsystem: string;
}

export interface DetectedPattern {
  name: string;
  description: string;
  nodeIds: string[];
  confidence: number; // 0-1
}

export interface PowerInfo {
  sources: string[];
  regulators: string[];
  voltageDomains: string[];
  distribution: string;
}

export interface DesignSuggestion {
  priority: 'high' | 'medium' | 'low';
  category: string;
  suggestion: string;
  reason: string;
}

export type ComplexityLevel = 'simple' | 'moderate' | 'complex';

export interface DesignAnalysisReport {
  summary: string;
  designType: string;
  complexity: ComplexityLevel;
  subsystems: Subsystem[];
  signalFlow: string[];
  powerArchitecture: PowerInfo;
  componentRoles: ComponentRole[];
  detectedPatterns: DetectedPattern[];
  suggestions: DesignSuggestion[];
  educationalNotes: string[];
}

// ---------------------------------------------------------------------------
// Keyword classification tables
// ---------------------------------------------------------------------------

const SUBSYSTEM_KEYWORDS: Record<SubsystemCategory, string[]> = {
  power: [
    'regulator', 'ldo', 'buck', 'boost', 'battery', 'power', 'supply',
    'lm78', 'lm317', 'lm2596', 'ams1117', 'vreg', 'dc-dc', 'converter',
    'charger', 'psu', '7805', '7812', '7905',
  ],
  sensing: [
    'sensor', 'temp', 'accel', 'gyro', 'humidity', 'pressure', 'adc',
    'analog', 'thermocouple', 'thermistor', 'ldr', 'photoresistor',
    'ir sensor', 'ultrasonic', 'hc-sr04', 'bme280', 'bmp280', 'dht',
    'mpu6050', 'ina219', 'hall', 'current sense', 'voltage sense',
  ],
  control: [
    'mcu', 'arduino', 'esp32', 'stm32', 'processor', 'controller',
    'atmega', 'pic', 'raspberry', 'teensy', 'esp8266', 'nodemcu',
    'samd', 'nrf52', 'rp2040', 'pico', 'fpga', 'cpld', 'microcontroller',
  ],
  communication: [
    'uart', 'spi', 'i2c', 'wifi', 'ble', 'bluetooth', 'can', 'usb',
    'antenna', 'transceiver', 'nrf24', 'lora', 'zigbee', 'rf module',
    'rs485', 'rs232', 'ethernet', 'modem', 'gps', 'gsm', 'sim800',
  ],
  actuation: [
    'motor', 'driver', 'servo', 'relay', 'solenoid', 'led',
    'speaker', 'buzzer', 'stepper', 'l298', 'l293', 'drv8825', 'a4988',
    'h-bridge', 'esc', 'pwm driver', 'neopixel', 'ws2812', 'pump',
    'valve', 'actuator', 'heater', 'fan',
  ],
  protection: [
    'fuse', 'diode', 'tvs', 'esd', 'mov', 'ptc', 'varistor',
    'polyfuse', 'surge', 'clamp', 'schottky', 'zener', 'crowbar',
    'overvoltage', 'overcurrent', 'protection',
  ],
  'user-interface': [
    'button', 'switch', 'encoder', 'potentiometer', 'lcd', 'oled',
    'keypad', 'touchscreen', 'joystick', 'rotary', 'knob', 'slider',
    'tft', 'e-ink', 'indicator', 'bargraph', '7-segment', 'ssd1306',
    'hd44780', 'st7735', 'ili9341',
  ],
  unknown: [],
};

/** Identify keywords that indicate a resistor component. */
const RESISTOR_KEYWORDS = ['resistor', 'ohm', 'ω', 'Ω', 'res', 'r1', 'r2', 'r3', 'r4'];

/** Identify keywords that indicate a capacitor component. */
const CAPACITOR_KEYWORDS = [
  'capacitor', 'cap', 'farad', 'μf', 'uf', 'pf', 'nf', 'c1', 'c2', 'c3',
  'decoupling', 'bypass', 'bulk',
];

/** Identify keywords that indicate a transistor / MOSFET. */
const TRANSISTOR_KEYWORDS = [
  'transistor', 'mosfet', 'bjt', 'fet', 'npn', 'pnp', 'n-channel', 'p-channel',
  'irf', '2n2222', '2n3904', '2n3906', 'bc547', 'irlz44', 'irfz44',
];

/** Identify keywords that indicate a ground node. */
const GROUND_KEYWORDS = ['gnd', 'ground', 'vss', '0v'];

/** Identify keywords that indicate a power/VCC node. */
const POWER_KEYWORDS = ['vcc', 'vdd', 'v+', '5v', '3.3v', '3v3', '12v', '24v', 'vin', 'vout', 'power', 'supply', 'battery', 'regulator', 'vreg', 'ldo', 'lm317', 'lm78', 'buck', 'boost'];

/** Identify keywords that indicate an IC or chip. */
const IC_KEYWORDS = ['ic', 'chip', 'op-amp', 'opamp', 'comparator', 'timer', '555', 'lm358', 'ne555'];

// ---------------------------------------------------------------------------
// Design type classification based on subsystem dominance
// ---------------------------------------------------------------------------

const DESIGN_TYPE_MAP: Array<{ subsystems: SubsystemCategory[]; type: string }> = [
  { subsystems: ['actuation', 'control'], type: 'Motor Controller' },
  { subsystems: ['communication', 'control'], type: 'IoT Device' },
  { subsystems: ['sensing', 'control'], type: 'Sensor Hub' },
  { subsystems: ['user-interface', 'control'], type: 'Interactive Device' },
  { subsystems: ['sensing', 'communication'], type: 'Remote Sensor' },
  { subsystems: ['power'], type: 'Power Supply' },
  { subsystems: ['actuation'], type: 'Actuator Circuit' },
  { subsystems: ['protection', 'power'], type: 'Protected Power Supply' },
  { subsystems: ['control'], type: 'Embedded System' },
];

// ---------------------------------------------------------------------------
// ArchitectureAnalyzer
// ---------------------------------------------------------------------------

export class ArchitectureAnalyzer {
  /**
   * Analyze a design and produce a comprehensive analysis report.
   */
  analyze(input: DesignAnalysisInput): DesignAnalysisReport {
    const { nodes, edges, bomItems } = input;

    if (nodes.length === 0) {
      return this.emptyReport();
    }

    const adjacency = this.buildAdjacency(nodes, edges);
    const nodeCategories = this.classifyNodes(nodes);
    const subsystems = this.detectSubsystems(nodes, nodeCategories);
    const componentRoles = this.assignComponentRoles(nodes, nodeCategories, subsystems);
    const detectedPatterns = this.detectPatterns(nodes, edges, nodeCategories, adjacency);
    const signalFlow = this.traceSignalFlow(nodes, edges, nodeCategories, adjacency);
    const powerArchitecture = this.analyzePowerArchitecture(nodes, nodeCategories, edges);
    const complexity = this.assessComplexity(nodes);
    const designType = this.classifyDesignType(subsystems);
    const suggestions = this.generateSuggestions(nodes, edges, nodeCategories, adjacency, detectedPatterns, bomItems);
    const educationalNotes = this.generateEducationalNotes(detectedPatterns, subsystems, powerArchitecture);
    const summary = this.generateSummary(nodes, subsystems, complexity, designType, detectedPatterns);

    return {
      summary,
      designType,
      complexity,
      subsystems,
      signalFlow,
      powerArchitecture,
      componentRoles,
      detectedPatterns,
      suggestions,
      educationalNotes,
    };
  }

  // -------------------------------------------------------------------------
  // Adjacency
  // -------------------------------------------------------------------------

  private buildAdjacency(
    nodes: AnalysisNode[],
    edges: AnalysisEdge[],
  ): Map<string, Set<string>> {
    const adj = new Map<string, Set<string>>();
    for (const node of nodes) {
      adj.set(node.id, new Set<string>());
    }
    for (const edge of edges) {
      if (!adj.has(edge.source)) { adj.set(edge.source, new Set<string>()); }
      if (!adj.has(edge.target)) { adj.set(edge.target, new Set<string>()); }
      adj.get(edge.source)!.add(edge.target);
      adj.get(edge.target)!.add(edge.source);
    }
    return adj;
  }

  // -------------------------------------------------------------------------
  // Node classification
  // -------------------------------------------------------------------------

  private classifyNodes(nodes: AnalysisNode[]): Map<string, SubsystemCategory> {
    const categories = new Map<string, SubsystemCategory>();

    for (const node of nodes) {
      const combined = `${node.label} ${node.type ?? ''} ${this.propsToString(node.properties)}`.toLowerCase();
      let bestCategory: SubsystemCategory = 'unknown';
      let bestScore = 0;

      const categoryKeys = Object.keys(SUBSYSTEM_KEYWORDS) as SubsystemCategory[];
      for (const category of categoryKeys) {
        if (category === 'unknown') { continue; }
        const keywords = SUBSYSTEM_KEYWORDS[category];
        let score = 0;
        for (const keyword of keywords) {
          if (combined.includes(keyword)) {
            score += 1;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestCategory = category;
        }
      }

      categories.set(node.id, bestCategory);
    }

    return categories;
  }

  private propsToString(props?: Record<string, string>): string {
    if (!props) { return ''; }
    return Array.from(Object.entries(props)).map(([k, v]) => `${k} ${v}`).join(' ');
  }

  // -------------------------------------------------------------------------
  // Subsystem detection
  // -------------------------------------------------------------------------

  private detectSubsystems(
    nodes: AnalysisNode[],
    categories: Map<string, SubsystemCategory>,
  ): Subsystem[] {
    const groups = new Map<SubsystemCategory, AnalysisNode[]>();

    for (const node of nodes) {
      const cat = categories.get(node.id) ?? 'unknown';
      if (!groups.has(cat)) { groups.set(cat, []); }
      groups.get(cat)!.push(node);
    }

    const subsystems: Subsystem[] = [];

    Array.from(groups.entries()).forEach(([category, groupNodes]) => {
      if (groupNodes.length === 0) { return; }

      const name = this.subsystemName(category);
      const nodeIds = groupNodes.map((n) => n.id);
      const labels = groupNodes.map((n) => n.label).join(', ');
      const description = this.subsystemDescription(category, labels);

      subsystems.push({ name, category, nodeIds, description });
    });

    return subsystems.sort((a, b) => a.name.localeCompare(b.name));
  }

  private subsystemName(category: SubsystemCategory): string {
    const names: Record<SubsystemCategory, string> = {
      power: 'Power Management',
      sensing: 'Sensor Array',
      control: 'Control Unit',
      communication: 'Communication Module',
      actuation: 'Actuator System',
      protection: 'Protection Circuit',
      'user-interface': 'User Interface',
      unknown: 'Unclassified Components',
    };
    return names[category];
  }

  private subsystemDescription(category: SubsystemCategory, labels: string): string {
    const templates: Record<SubsystemCategory, string> = {
      power: `Power supply and regulation components: ${labels}`,
      sensing: `Sensors and analog input components: ${labels}`,
      control: `Central processing and control: ${labels}`,
      communication: `Communication interfaces and modules: ${labels}`,
      actuation: `Output drivers and actuators: ${labels}`,
      protection: `Circuit protection components: ${labels}`,
      'user-interface': `User input/output components: ${labels}`,
      unknown: `Other components: ${labels}`,
    };
    return templates[category];
  }

  // -------------------------------------------------------------------------
  // Component role assignment
  // -------------------------------------------------------------------------

  private assignComponentRoles(
    nodes: AnalysisNode[],
    categories: Map<string, SubsystemCategory>,
    subsystems: Subsystem[],
  ): ComponentRole[] {
    return nodes.map((node) => {
      const category = categories.get(node.id) ?? 'unknown';
      const subsystem = subsystems.find((s) => s.nodeIds.includes(node.id));
      return {
        nodeId: node.id,
        label: node.label,
        role: this.inferRole(node, category),
        subsystem: subsystem?.name ?? 'Unclassified',
      };
    });
  }

  private inferRole(node: AnalysisNode, category: SubsystemCategory): string {
    const lower = `${node.label} ${node.type ?? ''}`.toLowerCase();

    // Control
    if (this.matchesAny(lower, ['arduino', 'esp32', 'stm32', 'mcu', 'processor', 'atmega', 'teensy', 'pico', 'rp2040'])) {
      return 'Main controller — runs firmware and coordinates other components';
    }

    // Power
    if (this.matchesAny(lower, ['regulator', 'ldo', 'lm78', 'lm317', 'ams1117', '7805'])) {
      return 'Voltage regulator — converts input voltage to a stable output level';
    }
    if (this.matchesAny(lower, ['battery'])) {
      return 'Power source — provides electrical energy to the circuit';
    }
    if (this.matchesAny(lower, ['buck', 'boost', 'dc-dc', 'converter'])) {
      return 'DC-DC converter — efficiently converts between voltage levels';
    }

    // Sensing
    if (this.matchesAny(lower, ['sensor', 'temp', 'humidity', 'pressure', 'accel', 'gyro'])) {
      return 'Sensor — measures physical quantities and converts to electrical signals';
    }
    if (this.matchesAny(lower, ['adc', 'analog'])) {
      return 'Analog-to-digital conversion — translates analog signals to digital values';
    }

    // Communication
    if (this.matchesAny(lower, ['wifi', 'ble', 'bluetooth', 'nrf24', 'lora'])) {
      return 'Wireless communication — enables remote data exchange';
    }
    if (this.matchesAny(lower, ['uart', 'spi', 'i2c', 'can', 'rs485'])) {
      return 'Communication interface — connects to other devices or modules';
    }

    // Actuation
    if (this.matchesAny(lower, ['motor'])) {
      return 'Motor — converts electrical energy to mechanical motion';
    }
    if (this.matchesAny(lower, ['driver', 'l298', 'l293', 'drv8825', 'a4988'])) {
      return 'Motor driver — amplifies control signals to drive motors';
    }
    if (this.matchesAny(lower, ['display', 'oled', 'lcd', 'tft'])) {
      return 'Display — shows information to the user';
    }
    if (this.matchesAny(lower, ['led'])) {
      return 'LED — visual indicator or illumination';
    }
    if (this.matchesAny(lower, ['relay'])) {
      return 'Relay — electrically controlled switch for high-power loads';
    }
    if (this.matchesAny(lower, ['servo'])) {
      return 'Servo motor — precise angular position control';
    }

    // Protection
    if (this.matchesAny(lower, ['fuse', 'ptc', 'polyfuse'])) {
      return 'Fuse — protects the circuit from overcurrent';
    }
    if (this.matchesAny(lower, ['tvs', 'esd', 'mov', 'varistor'])) {
      return 'Transient voltage suppressor — protects against voltage spikes';
    }
    if (this.matchesAny(lower, ['zener'])) {
      return 'Zener diode — provides voltage reference or overvoltage clamp';
    }

    // User interface
    if (this.matchesAny(lower, ['button', 'switch'])) {
      return 'User input — allows user interaction with the circuit';
    }
    if (this.matchesAny(lower, ['encoder', 'potentiometer', 'knob'])) {
      return 'Variable input — provides adjustable control parameter';
    }

    // Passive components
    if (this.matchesAny(lower, RESISTOR_KEYWORDS)) {
      return 'Resistor — limits current or divides voltage';
    }
    if (this.matchesAny(lower, CAPACITOR_KEYWORDS)) {
      return 'Capacitor — stores energy and filters noise';
    }

    // Generic category-based fallback
    const fallbacks: Record<SubsystemCategory, string> = {
      power: 'Power component',
      sensing: 'Sensor component',
      control: 'Control component',
      communication: 'Communication component',
      actuation: 'Output/actuator component',
      protection: 'Protection component',
      'user-interface': 'User interface component',
      unknown: 'General component',
    };

    return fallbacks[category];
  }

  // -------------------------------------------------------------------------
  // Pattern detection
  // -------------------------------------------------------------------------

  private detectPatterns(
    nodes: AnalysisNode[],
    edges: AnalysisEdge[],
    categories: Map<string, SubsystemCategory>,
    adjacency: Map<string, Set<string>>,
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const nodeMap = new Map<string, AnalysisNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    this.detectVoltageDivider(nodes, edges, nodeMap, adjacency, patterns);
    this.detectHBridge(nodes, nodeMap, adjacency, patterns);
    this.detectDecouplingCap(nodes, edges, nodeMap, adjacency, categories, patterns);
    this.detectPullUpDown(nodes, edges, nodeMap, adjacency, patterns);
    this.detectRcFilter(nodes, edges, nodeMap, adjacency, patterns);
    this.detectVoltageRegulatorPattern(nodes, edges, nodeMap, adjacency, categories, patterns);

    return patterns;
  }

  /**
   * Voltage divider: Two resistors in series where one connects to a power
   * node and the other connects to a ground node.
   */
  private detectVoltageDivider(
    _nodes: AnalysisNode[],
    edges: AnalysisEdge[],
    nodeMap: Map<string, AnalysisNode>,
    adjacency: Map<string, Set<string>>,
    patterns: DetectedPattern[],
  ): void {
    const resistors = Array.from(nodeMap.values()).filter((n) => this.isResistor(n));

    for (let i = 0; i < resistors.length; i++) {
      for (let j = i + 1; j < resistors.length; j++) {
        const r1 = resistors[i];
        const r2 = resistors[j];
        const r1Neighbors = adjacency.get(r1.id) ?? new Set<string>();
        const r2Neighbors = adjacency.get(r2.id) ?? new Set<string>();

        // Check if r1 and r2 are connected to each other
        if (!r1Neighbors.has(r2.id)) { continue; }

        // Check if one side reaches power and the other reaches ground
        const r1OtherNeighbors = Array.from(r1Neighbors).filter((id) => id !== r2.id);
        const r2OtherNeighbors = Array.from(r2Neighbors).filter((id) => id !== r1.id);

        const r1HasPower = r1OtherNeighbors.some((id) => this.isPowerNode(nodeMap.get(id)));
        const r2HasGround = r2OtherNeighbors.some((id) => this.isGroundNode(nodeMap.get(id)));
        const r1HasGround = r1OtherNeighbors.some((id) => this.isGroundNode(nodeMap.get(id)));
        const r2HasPower = r2OtherNeighbors.some((id) => this.isPowerNode(nodeMap.get(id)));

        if ((r1HasPower && r2HasGround) || (r2HasPower && r1HasGround)) {
          // Check we don't have a duplicate that already contains both
          const duplicate = patterns.some(
            (p) => p.name === 'Voltage Divider' && p.nodeIds.includes(r1.id) && p.nodeIds.includes(r2.id),
          );
          if (!duplicate) {
            // Calculate confidence based on edge labels suggesting voltage
            let confidence = 0.7;
            const relevantEdges = edges.filter(
              (e) => (e.source === r1.id || e.target === r1.id || e.source === r2.id || e.target === r2.id),
            );
            if (relevantEdges.some((e) => e.label && /volt|v\b|signal/i.test(e.label))) {
              confidence = 0.9;
            }

            patterns.push({
              name: 'Voltage Divider',
              description: `Resistors ${r1.label} and ${r2.label} form a voltage divider between power and ground`,
              nodeIds: [r1.id, r2.id],
              confidence,
            });
          }
        }
      }
    }
  }

  /**
   * H-bridge: 4 transistors/MOSFETs connected around a motor.
   */
  private detectHBridge(
    _nodes: AnalysisNode[],
    nodeMap: Map<string, AnalysisNode>,
    adjacency: Map<string, Set<string>>,
    patterns: DetectedPattern[],
  ): void {
    const transistors = Array.from(nodeMap.values()).filter((n) => this.isTransistor(n));
    const motors = Array.from(nodeMap.values()).filter((n) => this.isMotor(n));

    if (transistors.length < 4 || motors.length < 1) { return; }

    // Look for a motor that has >= 4 transistors within its neighborhood (distance 1 or 2)
    for (const motor of motors) {
      const motorNeighbors = adjacency.get(motor.id) ?? new Set<string>();
      const nearbyTransistors: AnalysisNode[] = [];

      for (const transistor of transistors) {
        const tNeighbors = adjacency.get(transistor.id) ?? new Set<string>();
        // Direct connection to motor, or shares a neighbor with motor
        if (motorNeighbors.has(transistor.id) || this.setsOverlap(motorNeighbors, tNeighbors)) {
          nearbyTransistors.push(transistor);
        }
      }

      if (nearbyTransistors.length >= 4) {
        const bridgeNodes = nearbyTransistors.slice(0, 4);
        patterns.push({
          name: 'H-Bridge',
          description: `Transistors ${bridgeNodes.map((n) => n.label).join(', ')} form an H-bridge around ${motor.label}`,
          nodeIds: [motor.id, ...bridgeNodes.map((n) => n.id)],
          confidence: 0.8,
        });
      }
    }
  }

  /**
   * Decoupling capacitor: A capacitor connected to an IC's power pin and ground.
   */
  private detectDecouplingCap(
    _nodes: AnalysisNode[],
    _edges: AnalysisEdge[],
    nodeMap: Map<string, AnalysisNode>,
    adjacency: Map<string, Set<string>>,
    categories: Map<string, SubsystemCategory>,
    patterns: DetectedPattern[],
  ): void {
    const capacitors = Array.from(nodeMap.values()).filter((n) => this.isCapacitor(n));
    const ics = Array.from(nodeMap.values()).filter((n) => {
      const cat = categories.get(n.id);
      return cat === 'control' || this.isIC(n);
    });

    for (const cap of capacitors) {
      const capNeighbors = adjacency.get(cap.id) ?? new Set<string>();

      for (const ic of ics) {
        if (!capNeighbors.has(ic.id)) { continue; }

        // Check if cap also connects to ground or power
        const hasGroundOrPower = Array.from(capNeighbors).some((id) => {
          const neighbor = nodeMap.get(id);
          return this.isGroundNode(neighbor) || this.isPowerNode(neighbor);
        });

        if (hasGroundOrPower) {
          patterns.push({
            name: 'Decoupling Capacitor',
            description: `${cap.label} provides decoupling for ${ic.label}, filtering high-frequency noise on the power supply`,
            nodeIds: [cap.id, ic.id],
            confidence: 0.85,
          });
        }
      }
    }
  }

  /**
   * Pull-up or pull-down resistor: A single resistor between a signal line
   * and VCC (pull-up) or GND (pull-down).
   */
  private detectPullUpDown(
    _nodes: AnalysisNode[],
    _edges: AnalysisEdge[],
    nodeMap: Map<string, AnalysisNode>,
    adjacency: Map<string, Set<string>>,
    patterns: DetectedPattern[],
  ): void {
    const resistors = Array.from(nodeMap.values()).filter((n) => this.isResistor(n));

    for (const res of resistors) {
      const neighbors = adjacency.get(res.id) ?? new Set<string>();
      if (neighbors.size !== 2) { continue; }

      const neighborIds = Array.from(neighbors);
      const n1 = nodeMap.get(neighborIds[0]);
      const n2 = nodeMap.get(neighborIds[1]);
      if (!n1 || !n2) { continue; }

      const hasPower = this.isPowerNode(n1) || this.isPowerNode(n2);
      const hasGround = this.isGroundNode(n1) || this.isGroundNode(n2);
      const signal = hasPower ? (this.isPowerNode(n1) ? n2 : n1) : (this.isGroundNode(n1) ? n2 : n1);

      // Only match if one side is power/ground and the other is a signal-like node (not ground/power)
      if (hasPower && !this.isGroundNode(signal) && !this.isPowerNode(signal)) {
        patterns.push({
          name: 'Pull-Up Resistor',
          description: `${res.label} pulls the signal line toward VCC when no other driver is active`,
          nodeIds: [res.id, signal.id],
          confidence: 0.75,
        });
      } else if (hasGround && !this.isPowerNode(signal) && !this.isGroundNode(signal)) {
        patterns.push({
          name: 'Pull-Down Resistor',
          description: `${res.label} pulls the signal line toward ground when no other driver is active`,
          nodeIds: [res.id, signal.id],
          confidence: 0.75,
        });
      }
    }
  }

  /**
   * RC filter: A resistor and capacitor in series or parallel, forming a
   * low-pass or high-pass filter.
   */
  private detectRcFilter(
    _nodes: AnalysisNode[],
    _edges: AnalysisEdge[],
    nodeMap: Map<string, AnalysisNode>,
    adjacency: Map<string, Set<string>>,
    patterns: DetectedPattern[],
  ): void {
    const resistors = Array.from(nodeMap.values()).filter((n) => this.isResistor(n));
    const capacitors = Array.from(nodeMap.values()).filter((n) => this.isCapacitor(n));

    for (const res of resistors) {
      const resNeighbors = adjacency.get(res.id) ?? new Set<string>();

      for (const cap of capacitors) {
        if (!resNeighbors.has(cap.id)) { continue; }

        // Determine filter direction — if cap goes to ground, low-pass; else high-pass
        const capNeighbors = adjacency.get(cap.id) ?? new Set<string>();
        const capToGround = Array.from(capNeighbors).some((id) => this.isGroundNode(nodeMap.get(id)));

        const filterType = capToGround ? 'low-pass' : 'high-pass';

        patterns.push({
          name: 'RC Filter',
          description: `${res.label} and ${cap.label} form an RC ${filterType} filter`,
          nodeIds: [res.id, cap.id],
          confidence: 0.65,
        });
      }
    }
  }

  /**
   * Voltage regulator pattern: A regulator IC with input and output caps.
   */
  private detectVoltageRegulatorPattern(
    _nodes: AnalysisNode[],
    _edges: AnalysisEdge[],
    nodeMap: Map<string, AnalysisNode>,
    adjacency: Map<string, Set<string>>,
    categories: Map<string, SubsystemCategory>,
    patterns: DetectedPattern[],
  ): void {
    const regulators = Array.from(nodeMap.values()).filter((n) => {
      const lower = `${n.label} ${n.type ?? ''}`.toLowerCase();
      return this.matchesAny(lower, ['regulator', 'ldo', 'lm78', 'lm317', 'ams1117', '7805', '7812', 'vreg']);
    });

    for (const reg of regulators) {
      const regNeighbors = adjacency.get(reg.id) ?? new Set<string>();
      const neighborCaps = Array.from(regNeighbors)
        .map((id) => nodeMap.get(id))
        .filter((n): n is AnalysisNode => n !== undefined && this.isCapacitor(n));

      if (neighborCaps.length >= 1) {
        patterns.push({
          name: 'Voltage Regulator Circuit',
          description: `${reg.label} with ${neighborCaps.length === 1 ? 'a filter capacitor' : 'input/output capacitors'} (${neighborCaps.map((c) => c.label).join(', ')})`,
          nodeIds: [reg.id, ...neighborCaps.map((c) => c.id)],
          confidence: neighborCaps.length >= 2 ? 0.9 : 0.7,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Signal flow analysis
  // -------------------------------------------------------------------------

  private traceSignalFlow(
    nodes: AnalysisNode[],
    _edges: AnalysisEdge[],
    categories: Map<string, SubsystemCategory>,
    adjacency: Map<string, Set<string>>,
  ): string[] {
    // Build a simplified flow description based on subsystem connectivity
    // Start from input nodes (sensors, user-interface, power) and trace toward outputs (actuation, display)

    const inputNodes = nodes.filter((n) => {
      const cat = categories.get(n.id);
      return cat === 'sensing' || cat === 'user-interface' || cat === 'power';
    });

    const controlNodes = nodes.filter((n) => categories.get(n.id) === 'control');
    const outputNodes = nodes.filter((n) => {
      const cat = categories.get(n.id);
      return cat === 'actuation' || (cat === 'communication');
    });

    const flows: string[] = [];

    // Trace from inputs through controllers to outputs using BFS
    for (const input of inputNodes) {
      const reachable = this.bfsReachable(input.id, adjacency);

      for (const controller of controlNodes) {
        if (!reachable.has(controller.id)) { continue; }

        for (const output of outputNodes) {
          const controllerReachable = this.bfsReachable(controller.id, adjacency);
          if (controllerReachable.has(output.id)) {
            flows.push(`${input.label} → ${controller.label} → ${output.label}`);
          }
        }

        // If no output but controller is reachable from input
        if (outputNodes.length === 0) {
          flows.push(`${input.label} → ${controller.label}`);
        }
      }

      // Direct input to output (no controller)
      if (controlNodes.length === 0) {
        for (const output of outputNodes) {
          if (reachable.has(output.id)) {
            flows.push(`${input.label} → ${output.label}`);
          }
        }
      }
    }

    // Deduplicate
    return flows.filter((v, i, a) => a.indexOf(v) === i);
  }

  private bfsReachable(startId: string, adjacency: Map<string, Set<string>>): Set<string> {
    const visited = new Set<string>();
    const queue = [startId];
    visited.add(startId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current) ?? new Set<string>();
      Array.from(neighbors).forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }

    return visited;
  }

  // -------------------------------------------------------------------------
  // Power architecture
  // -------------------------------------------------------------------------

  private analyzePowerArchitecture(
    nodes: AnalysisNode[],
    categories: Map<string, SubsystemCategory>,
    edges: AnalysisEdge[],
  ): PowerInfo {
    const sources: string[] = [];
    const regulators: string[] = [];
    const voltageDomains: string[] = [];

    for (const node of nodes) {
      const lower = `${node.label} ${node.type ?? ''}`.toLowerCase();

      if (this.matchesAny(lower, ['battery', 'supply', 'vin', 'dc input', 'power input', 'solar', 'usb power'])) {
        sources.push(node.label);
      }

      if (this.matchesAny(lower, ['regulator', 'ldo', 'buck', 'boost', 'lm78', 'lm317', 'ams1117', '7805', '7812', 'dc-dc'])) {
        regulators.push(node.label);
      }

      // Extract voltage domains from labels and edge labels
      const voltageMatch = lower.match(/(\d+\.?\d*)\s*v/);
      if (voltageMatch && categories.get(node.id) === 'power') {
        const domain = `${voltageMatch[1]}V`;
        if (!voltageDomains.includes(domain)) {
          voltageDomains.push(domain);
        }
      }
    }

    // Also check edge labels for voltage info
    for (const edge of edges) {
      if (edge.label) {
        const voltageMatch = edge.label.match(/(\d+\.?\d*)\s*[vV]/);
        if (voltageMatch) {
          const domain = `${voltageMatch[1]}V`;
          if (!voltageDomains.includes(domain)) {
            voltageDomains.push(domain);
          }
        }
      }
    }

    // If no explicit sources found, look for VCC/power nodes
    if (sources.length === 0) {
      for (const node of nodes) {
        if (this.isPowerNode(node)) {
          sources.push(node.label);
        }
      }
    }

    let distribution = 'Unknown power distribution';
    if (regulators.length > 0 && sources.length > 0) {
      distribution = `Power flows from ${sources.join(', ')} through ${regulators.join(', ')}`;
      if (voltageDomains.length > 0) {
        distribution += ` providing ${voltageDomains.join(', ')} rails`;
      }
    } else if (sources.length > 0) {
      distribution = `Direct power from ${sources.join(', ')}`;
    } else if (voltageDomains.length > 0) {
      distribution = `${voltageDomains.join(', ')} voltage rails detected`;
    }

    return { sources, regulators, voltageDomains, distribution };
  }

  // -------------------------------------------------------------------------
  // Complexity assessment
  // -------------------------------------------------------------------------

  private assessComplexity(nodes: AnalysisNode[]): ComplexityLevel {
    if (nodes.length < 5) { return 'simple'; }
    if (nodes.length <= 15) { return 'moderate'; }
    return 'complex';
  }

  // -------------------------------------------------------------------------
  // Design type classification
  // -------------------------------------------------------------------------

  private classifyDesignType(subsystems: Subsystem[]): string {
    const activeCats = subsystems
      .filter((s) => s.category !== 'unknown')
      .map((s) => s.category);

    if (activeCats.length === 0) { return 'General Circuit'; }

    // Check design type map in priority order
    for (const mapping of DESIGN_TYPE_MAP) {
      if (mapping.subsystems.every((cat) => activeCats.includes(cat))) {
        return mapping.type;
      }
    }

    // Fallback to dominant subsystem
    const counts = new Map<SubsystemCategory, number>();
    for (const sub of subsystems) {
      if (sub.category !== 'unknown') {
        counts.set(sub.category, (counts.get(sub.category) ?? 0) + sub.nodeIds.length);
      }
    }

    let dominant: SubsystemCategory = 'unknown';
    let maxCount = 0;
    Array.from(counts.entries()).forEach(([cat, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominant = cat;
      }
    });

    const typeNames: Record<SubsystemCategory, string> = {
      power: 'Power Supply',
      sensing: 'Sensor Circuit',
      control: 'Embedded System',
      communication: 'Communication Module',
      actuation: 'Actuator Circuit',
      protection: 'Protection Circuit',
      'user-interface': 'Interactive Device',
      unknown: 'General Circuit',
    };

    return typeNames[dominant];
  }

  // -------------------------------------------------------------------------
  // Suggestion generation
  // -------------------------------------------------------------------------

  private generateSuggestions(
    nodes: AnalysisNode[],
    edges: AnalysisEdge[],
    categories: Map<string, SubsystemCategory>,
    adjacency: Map<string, Set<string>>,
    patterns: DetectedPattern[],
    bomItems?: AnalysisBomItem[],
  ): DesignSuggestion[] {
    const suggestions: DesignSuggestion[] = [];

    // 1. Missing decoupling capacitors on ICs
    const ics = nodes.filter((n) => {
      const cat = categories.get(n.id);
      return cat === 'control' || this.isIC(n);
    });

    const hasDecouplingPattern = patterns.some((p) => p.name === 'Decoupling Capacitor');

    for (const ic of ics) {
      const neighbors = adjacency.get(ic.id) ?? new Set<string>();
      const neighborNodes = Array.from(neighbors).map((id) => nodes.find((n) => n.id === id)).filter(Boolean) as AnalysisNode[];
      const hasCap = neighborNodes.some((n) => this.isCapacitor(n));

      if (!hasCap && !hasDecouplingPattern) {
        suggestions.push({
          priority: 'high',
          category: 'Best Practice',
          suggestion: `Add a decoupling capacitor (100nF) near ${ic.label}`,
          reason: 'Every IC should have a decoupling capacitor close to its power pins to filter high-frequency noise and prevent erratic behavior',
        });
      }
    }

    // 2. Unconnected nodes (orphans)
    for (const node of nodes) {
      const neighbors = adjacency.get(node.id) ?? new Set<string>();
      if (neighbors.size === 0 && edges.length > 0) {
        suggestions.push({
          priority: 'medium',
          category: 'Connectivity',
          suggestion: `${node.label} is not connected to any other component`,
          reason: 'Unconnected components may indicate an incomplete design or missing wiring',
        });
      }
    }

    // 3. No protection on power input
    const hasPowerSource = nodes.some((n) => {
      const lower = `${n.label} ${n.type ?? ''}`.toLowerCase();
      return this.matchesAny(lower, ['battery', 'supply', 'vin', 'power input', 'dc input']);
    });
    const hasProtection = nodes.some((n) => categories.get(n.id) === 'protection');

    if (hasPowerSource && !hasProtection) {
      suggestions.push({
        priority: 'high',
        category: 'Protection',
        suggestion: 'Add reverse polarity protection (diode or P-MOSFET) on the power input',
        reason: 'Without reverse polarity protection, connecting power backwards can destroy components',
      });
    }

    // 4. Motor without flyback diode
    const motors = nodes.filter((n) => this.isMotor(n));
    for (const motor of motors) {
      const motorNeighbors = adjacency.get(motor.id) ?? new Set<string>();
      const hasDiode = Array.from(motorNeighbors).some((id) => {
        const neighbor = nodes.find((n) => n.id === id);
        if (!neighbor) { return false; }
        const lower = `${neighbor.label} ${neighbor.type ?? ''}`.toLowerCase();
        return this.matchesAny(lower, ['diode', 'flyback', 'schottky', '1n4148', '1n4007']);
      });

      if (!hasDiode) {
        suggestions.push({
          priority: 'high',
          category: 'Protection',
          suggestion: `Add a flyback diode across ${motor.label}`,
          reason: 'Inductive loads like motors create voltage spikes when switched off that can damage transistors and ICs',
        });
      }
    }

    // 5. BOM quantity mismatches (if BOM provided)
    if (bomItems && bomItems.length > 0) {
      const bomCount = bomItems.reduce((sum, item) => sum + item.quantity, 0);
      if (bomCount < nodes.length) {
        suggestions.push({
          priority: 'low',
          category: 'BOM',
          suggestion: 'BOM item count is less than the number of schematic components',
          reason: 'Some components in the design may not be accounted for in the bill of materials',
        });
      }
    }

    // 6. No controller in a complex design
    const hasController = nodes.some((n) => categories.get(n.id) === 'control');
    if (!hasController && nodes.length > 5) {
      suggestions.push({
        priority: 'medium',
        category: 'Architecture',
        suggestion: 'Consider adding a microcontroller to coordinate the components',
        reason: 'Designs with many components often benefit from programmable control for flexibility and debugging',
      });
    }

    return suggestions;
  }

  // -------------------------------------------------------------------------
  // Educational notes
  // -------------------------------------------------------------------------

  private generateEducationalNotes(
    patterns: DetectedPattern[],
    subsystems: Subsystem[],
    powerArchitecture: PowerInfo,
  ): string[] {
    const notes: string[] = [];

    // Pattern-specific notes
    for (const pattern of patterns) {
      switch (pattern.name) {
        case 'Voltage Divider':
          notes.push(
            'Voltage Divider: Two resistors in series divide a higher voltage into a lower one. ' +
            'The output voltage is determined by the ratio of the two resistor values: Vout = Vin * R2 / (R1 + R2). ' +
            'Common uses include level shifting (e.g., 5V to 3.3V for an ESP32) and creating reference voltages.',
          );
          break;
        case 'H-Bridge':
          notes.push(
            'H-Bridge: Four transistors arranged in an "H" pattern that allow a motor to be driven in both directions. ' +
            'By activating opposite pairs of transistors, current flows through the motor in different directions. ' +
            'Important: never activate both transistors on the same side (shoot-through) as this creates a short circuit!',
          );
          break;
        case 'Decoupling Capacitor':
          notes.push(
            'Decoupling Capacitor: A small capacitor (typically 100nF) placed very close to an IC\'s power pins. ' +
            'It acts as a tiny local energy reservoir, smoothing out rapid current demands and filtering high-frequency noise. ' +
            'Without decoupling caps, ICs can behave erratically — it\'s one of the most important best practices in circuit design.',
          );
          break;
        case 'Pull-Up Resistor':
          notes.push(
            'Pull-Up Resistor: A resistor connected between a signal line and VCC. ' +
            'It ensures the line reads as HIGH when no other device is actively pulling it LOW. ' +
            'Common with I2C buses, buttons (active-low), and open-drain outputs. Typical values: 4.7kΩ to 10kΩ.',
          );
          break;
        case 'Pull-Down Resistor':
          notes.push(
            'Pull-Down Resistor: A resistor connected between a signal line and ground. ' +
            'It ensures the line reads as LOW when no other device is driving it HIGH. ' +
            'Useful for preventing floating inputs on microcontroller pins.',
          );
          break;
        case 'RC Filter':
          notes.push(
            'RC Filter: A resistor and capacitor combination that filters signals based on frequency. ' +
            'A low-pass filter (capacitor to ground) passes low frequencies and blocks high ones — great for smoothing noisy signals. ' +
            'The cutoff frequency is fc = 1 / (2π × R × C).',
          );
          break;
        case 'Voltage Regulator Circuit':
          notes.push(
            'Voltage Regulator: Converts one voltage to a stable lower voltage. Input and output capacitors are essential — ' +
            'the input cap prevents oscillation and the output cap improves transient response. ' +
            'Check the regulator\'s datasheet for recommended capacitor values.',
          );
          break;
      }
    }

    // Subsystem-level notes
    const hasPower = subsystems.some((s) => s.category === 'power');
    const hasControl = subsystems.some((s) => s.category === 'control');
    const hasSensing = subsystems.some((s) => s.category === 'sensing');
    const hasCommunication = subsystems.some((s) => s.category === 'communication');

    if (hasPower && powerArchitecture.regulators.length > 0) {
      notes.push(
        'Power Design Tip: When using voltage regulators, ensure the input voltage is within the regulator\'s operating range. ' +
        'Linear regulators (like LM7805) dissipate excess voltage as heat — if the voltage drop is large, consider a switching regulator for better efficiency.',
      );
    }

    if (hasControl && hasSensing) {
      notes.push(
        'Sensor Integration: When connecting sensors to a microcontroller, check voltage compatibility. ' +
        'Many sensors are 3.3V while Arduino boards use 5V — you may need level shifters or voltage dividers.',
      );
    }

    if (hasCommunication) {
      notes.push(
        'Communication Tip: For I2C, add pull-up resistors (4.7kΩ) on SDA and SCL lines if not already present on a breakout board. ' +
        'For SPI, keep wire lengths short. For UART, ensure both sides agree on baud rate.',
      );
    }

    // Deduplicate
    const uniqueNotes = new Set(notes);
    return Array.from(uniqueNotes);
  }

  // -------------------------------------------------------------------------
  // Summary generation
  // -------------------------------------------------------------------------

  private generateSummary(
    nodes: AnalysisNode[],
    subsystems: Subsystem[],
    complexity: ComplexityLevel,
    designType: string,
    patterns: DetectedPattern[],
  ): string {
    const activeSubsystems = subsystems.filter((s) => s.category !== 'unknown');
    const subsystemNames = activeSubsystems.map((s) => s.name.toLowerCase());

    let summary = `This is a ${complexity} ${designType.toLowerCase()} design with ${nodes.length} component${nodes.length !== 1 ? 's' : ''}`;

    if (activeSubsystems.length > 0) {
      summary += `, organized into ${activeSubsystems.length} subsystem${activeSubsystems.length !== 1 ? 's' : ''} (${subsystemNames.join(', ')})`;
    }

    if (patterns.length > 0) {
      const patternNames = patterns.map((p) => p.name.toLowerCase()).filter((v, i, a) => a.indexOf(v) === i);
      summary += `. Detected patterns: ${patternNames.join(', ')}`;
    }

    summary += '.';
    return summary;
  }

  // -------------------------------------------------------------------------
  // Empty report
  // -------------------------------------------------------------------------

  private emptyReport(): DesignAnalysisReport {
    return {
      summary: 'Empty design — no components to analyze.',
      designType: 'Empty',
      complexity: 'simple',
      subsystems: [],
      signalFlow: [],
      powerArchitecture: {
        sources: [],
        regulators: [],
        voltageDomains: [],
        distribution: 'No power architecture detected',
      },
      componentRoles: [],
      detectedPatterns: [],
      suggestions: [],
      educationalNotes: ['Start by adding components to your design. A basic circuit needs at least a power source, a load, and connections between them.'],
    };
  }

  // -------------------------------------------------------------------------
  // Classification helpers
  // -------------------------------------------------------------------------

  private matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some((kw) => text.includes(kw));
  }

  private isResistor(node: AnalysisNode): boolean {
    const lower = `${node.label} ${node.type ?? ''}`.toLowerCase();
    return this.matchesAny(lower, RESISTOR_KEYWORDS);
  }

  private isCapacitor(node: AnalysisNode): boolean {
    const lower = `${node.label} ${node.type ?? ''}`.toLowerCase();
    return this.matchesAny(lower, CAPACITOR_KEYWORDS);
  }

  private isTransistor(node: AnalysisNode): boolean {
    const lower = `${node.label} ${node.type ?? ''}`.toLowerCase();
    return this.matchesAny(lower, TRANSISTOR_KEYWORDS);
  }

  private isMotor(node: AnalysisNode): boolean {
    const lower = `${node.label} ${node.type ?? ''}`.toLowerCase();
    return this.matchesAny(lower, ['motor', 'servo', 'stepper']);
  }

  private isGroundNode(node?: AnalysisNode): boolean {
    if (!node) { return false; }
    const lower = `${node.label} ${node.type ?? ''}`.toLowerCase();
    return this.matchesAny(lower, GROUND_KEYWORDS);
  }

  private isPowerNode(node?: AnalysisNode): boolean {
    if (!node) { return false; }
    const lower = `${node.label} ${node.type ?? ''}`.toLowerCase();
    return this.matchesAny(lower, POWER_KEYWORDS);
  }

  private isIC(node: AnalysisNode): boolean {
    const lower = `${node.label} ${node.type ?? ''}`.toLowerCase();
    return this.matchesAny(lower, IC_KEYWORDS) || this.matchesAny(lower, ['arduino', 'esp32', 'stm32', 'atmega']);
  }

  private setsOverlap(a: Set<string>, b: Set<string>): boolean {
    return Array.from(a).some((item) => b.has(item));
  }
}
