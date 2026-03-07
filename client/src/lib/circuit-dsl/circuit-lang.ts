/**
 * Circuit DSL language support — starter templates and snippet library.
 *
 * Used by the CodeEditor component for initial code and snippet insertion.
 */

// ---------------------------------------------------------------------------
// Starter template — default code for new circuit code views
// ---------------------------------------------------------------------------

export const STARTER_TEMPLATE = `// ProtoPulse Circuit DSL
const c = circuit("My Circuit");

// Add components
const R1 = c.resistor({ value: "10k" });

// Add power rails
const vcc = c.net("VCC", { voltage: 5 });
const gnd = c.net("GND", { ground: true });

// Connect
c.connect(vcc, R1.pin(1));
c.connect(R1.pin(2), gnd);

// Export (required — produces the circuit)
c.export();
`;

// ---------------------------------------------------------------------------
// Snippet templates
// ---------------------------------------------------------------------------

export interface SnippetTemplate {
  readonly label: string;
  readonly description: string;
  readonly code: string;
}

export const SNIPPET_TEMPLATES: Record<string, SnippetTemplate> = {
  'voltage-divider': {
    label: 'Voltage Divider',
    description: 'Two resistors forming a voltage divider with VCC, GND, and VOUT nets.',
    code: `// Voltage Divider
const c = circuit("Voltage Divider");

const R1 = c.resistor({ value: "10k" });
const R2 = c.resistor({ value: "10k" });

const vcc = c.net("VCC", { voltage: 5 });
const gnd = c.net("GND", { ground: true });
const vout = c.net("VOUT");

// R1 from VCC to VOUT, R2 from VOUT to GND
c.connect(vcc, R1.pin(1));
c.connect(R1.pin(2), vout);
c.connect(vout, R2.pin(1));
c.connect(R2.pin(2), gnd);

c.export();
`,
  },

  'led-circuit': {
    label: 'LED Circuit',
    description: 'LED with a current-limiting resistor connected to VCC and GND.',
    code: `// LED with Current-Limiting Resistor
const c = circuit("LED Circuit");

const R1 = c.resistor({ value: "220" });
const D1 = c.led({});

const vcc = c.net("VCC", { voltage: 5 });
const gnd = c.net("GND", { ground: true });

// VCC -> R1 -> LED -> GND
c.connect(vcc, R1.pin(1));
c.connect(R1.pin(2), D1.pin("anode"));
c.connect(D1.pin("cathode"), gnd);

c.export();
`,
  },

  'h-bridge': {
    label: 'H-Bridge Motor Driver',
    description: 'Four transistors forming an H-bridge for bidirectional motor control.',
    code: `// H-Bridge Motor Driver
const c = circuit("H-Bridge");

// Four switching transistors
const Q1 = c.npn({ refdes: "Q1" });
const Q2 = c.npn({ refdes: "Q2" });
const Q3 = c.npn({ refdes: "Q3" });
const Q4 = c.npn({ refdes: "Q4" });

const vcc = c.net("VCC", { voltage: 12 });
const gnd = c.net("GND", { ground: true });
const motorA = c.net("MOTOR_A");
const motorB = c.net("MOTOR_B");

// High-side: Q1 and Q3 from VCC
c.connect(vcc, Q1.pin("collector"));
c.connect(Q1.pin("emitter"), motorA);
c.connect(vcc, Q3.pin("collector"));
c.connect(Q3.pin("emitter"), motorB);

// Low-side: Q2 and Q4 to GND
c.connect(motorA, Q2.pin("collector"));
c.connect(Q2.pin("emitter"), gnd);
c.connect(motorB, Q4.pin("collector"));
c.connect(Q4.pin("emitter"), gnd);

c.export();
`,
  },

  'op-amp-inverting': {
    label: 'Inverting Op-Amp',
    description: 'Op-amp in inverting amplifier configuration with input and feedback resistors.',
    code: `// Inverting Op-Amp Amplifier
const c = circuit("Inverting Amplifier");

const U1 = c.opamp({ refdes: "U1" });
const Rin = c.resistor({ value: "10k", refdes: "Rin" });
const Rf = c.resistor({ value: "100k", refdes: "Rf" });

const vcc = c.net("VCC", { voltage: 12 });
const vee = c.net("VEE", { voltage: -12 });
const gnd = c.net("GND", { ground: true });
const vin = c.net("VIN");
const vout = c.net("VOUT");

// Power supply
c.connect(vcc, U1.pin("V+"));
c.connect(vee, U1.pin("V-"));

// Non-inverting input to ground
c.connect(gnd, U1.pin("IN+"));

// Input through Rin to inverting input
c.connect(vin, Rin.pin(1));
c.connect(Rin.pin(2), U1.pin("IN-"));

// Feedback resistor from output to inverting input
c.connect(U1.pin("OUT"), Rf.pin(1));
c.connect(Rf.pin(2), U1.pin("IN-"));

// Output
c.connect(U1.pin("OUT"), vout);

c.export();
`,
  },
};
