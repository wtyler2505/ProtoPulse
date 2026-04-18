/**
 * Circuit DSL code generation and explanation tools.
 *
 * @module ai-tools/circuit/code-dsl
 */

import { z } from 'zod';
import type { ToolRegistry } from '../registry';

/** Component keywords mapped to DSL builder calls. */
const COMPONENT_KEYWORDS: Record<string, { fn: string; defaultValue?: string }> = {
  resistor: { fn: 'resistor', defaultValue: '10k' },
  led: { fn: 'led' },
  capacitor: { fn: 'capacitor', defaultValue: '100n' },
  inductor: { fn: 'inductor', defaultValue: '10u' },
  diode: { fn: 'diode' },
  transistor: { fn: 'transistor' },
  bjt: { fn: 'transistor' },
  mosfet: { fn: 'mosfet' },
  opamp: { fn: 'opamp' },
  'op-amp': { fn: 'opamp' },
  voltage: { fn: 'voltageSource', defaultValue: '5V' },
  battery: { fn: 'voltageSource', defaultValue: '9V' },
  switch: { fn: 'switch' },
  relay: { fn: 'relay' },
  fuse: { fn: 'fuse' },
  crystal: { fn: 'crystal' },
  potentiometer: { fn: 'potentiometer', defaultValue: '10k' },
  speaker: { fn: 'speaker' },
  motor: { fn: 'motor' },
  sensor: { fn: 'sensor' },
};

/**
 * Generate a Circuit DSL code skeleton from a natural-language description.
 *
 * Scans the description for known component keywords and produces a
 * `circuit()` + component declarations + `connect()` + `export()` template
 * with comments explaining each section.
 */
function generateCircuitCodeTemplate(description: string): string {
  const lower = description.toLowerCase();
  const found: Array<{ name: string; fn: string; defaultValue?: string; ref: string }> = [];
  const refCounters: Record<string, number> = {};

  for (const [keyword, info] of Object.entries(COMPONENT_KEYWORDS)) {
    if (lower.includes(keyword)) {
      const prefix = info.fn.charAt(0).toUpperCase();
      refCounters[prefix] = (refCounters[prefix] ?? 0) + 1;
      found.push({
        name: keyword,
        fn: info.fn,
        defaultValue: info.defaultValue,
        ref: `${prefix}${refCounters[prefix]}`,
      });
    }
  }

  // If nothing matched, provide a minimal template
  if (found.length === 0) {
    return [
      `// Circuit: ${description}`,
      `// Add components and connections below`,
      ``,
      `const design = circuit('${description}')`,
      `  // .resistor('R1', '10k')`,
      `  // .led('D1')`,
      `  // .connect('R1.pin2', 'D1.anode')`,
      `  .export();`,
    ].join('\n');
  }

  const lines: string[] = [
    `// Circuit: ${description}`,
    `// Generated template — edit values and connections as needed`,
    ``,
    `const design = circuit('${description}')`,
    ``,
    `  // --- Components ---`,
  ];

  for (const comp of found) {
    const valueArg = comp.defaultValue ? `, '${comp.defaultValue}'` : '';
    lines.push(`  .${comp.fn}('${comp.ref}'${valueArg})`);
  }

  lines.push(``);
  lines.push(`  // --- Connections ---`);
  lines.push(`  // Connect component pins: .connect('REF.pin', 'REF.pin')`);

  if (found.length >= 2) {
    lines.push(`  // Example:`);
    lines.push(`  // .connect('${found[0].ref}.pin2', '${found[1].ref}.pin1')`);
  }

  lines.push(``);
  lines.push(`  // --- Power rails ---`);
  lines.push(`  // .net('VCC', 'power', '5V')`);
  lines.push(`  // .net('GND', 'ground')`);
  lines.push(``);
  lines.push(`  .export();`);

  return lines.join('\n');
}

/**
 * Parse Circuit DSL code and produce a human-readable explanation.
 *
 * Uses regex to identify components, nets, and connections, then
 * summarises the circuit in plain language.
 */
function generateExplanation(code: string): string {
  const lines: string[] = [];

  // Extract circuit name
  const circuitMatch = /circuit\(['"]([^'"]+)['"]\)/.exec(code);
  if (circuitMatch) {
    lines.push(`Circuit: "${circuitMatch[1]}"`);
    lines.push('');
  }

  // Extract components — patterns like .resistor('R1', '10k') or .led('D1')
  const componentPattern = /\.(\w+)\(\s*'([^']+)'(?:\s*,\s*'([^']+)')?\s*\)/g;
  const components: Array<{ type: string; ref: string; value?: string }> = [];
  const knownFunctions = new Set(Object.values(COMPONENT_KEYWORDS).map((v) => v.fn));
  let match: RegExpExecArray | null;

  while ((match = componentPattern.exec(code)) !== null) {
    const [, fnName, ref, value] = match;
    if (knownFunctions.has(fnName)) {
      components.push({ type: fnName, ref, value });
    }
  }

  if (components.length > 0) {
    lines.push(`Components (${components.length}):`);
    for (const comp of components) {
      const valueStr = comp.value ? ` = ${comp.value}` : '';
      lines.push(`  - ${comp.ref}: ${comp.type}${valueStr}`);
    }
    lines.push('');
  }

  // Extract nets — .net('VCC', 'power', '5V')
  const netPattern = /\.net\(\s*'([^']+)'\s*(?:,\s*'([^']+)')?\s*(?:,\s*'([^']+)')?\s*\)/g;
  const nets: Array<{ name: string; type?: string; voltage?: string }> = [];

  while ((match = netPattern.exec(code)) !== null) {
    const [, name, type, voltage] = match;
    nets.push({ name, type, voltage });
  }

  if (nets.length > 0) {
    lines.push('Power rails / nets:');
    for (const net of nets) {
      const typeStr = net.type ? ` (${net.type})` : '';
      const voltStr = net.voltage ? ` @ ${net.voltage}` : '';
      lines.push(`  - ${net.name}${typeStr}${voltStr}`);
    }
    lines.push('');
  }

  // Extract connections — .connect('R1.pin2', 'D1.anode')
  const connectPattern = /\.connect\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g;
  const connections: Array<{ from: string; to: string }> = [];

  while ((match = connectPattern.exec(code)) !== null) {
    connections.push({ from: match[1], to: match[2] });
  }

  if (connections.length > 0) {
    lines.push(`Connections (${connections.length}):`);
    for (const conn of connections) {
      lines.push(`  - ${conn.from} --> ${conn.to}`);
    }
    lines.push('');
  }

  if (lines.length === 0) {
    return 'Could not identify any components, nets, or connections in the provided code. The code may use a format that is not recognized by the parser.';
  }

  // Summary
  const summary: string[] = [];
  if (components.length > 0) {
    summary.push(`${components.length} component${components.length !== 1 ? 's' : ''}`);
  }
  if (nets.length > 0) {
    summary.push(`${nets.length} net${nets.length !== 1 ? 's' : ''}`);
  }
  if (connections.length > 0) {
    summary.push(`${connections.length} connection${connections.length !== 1 ? 's' : ''}`);
  }
  lines.push(`Summary: This circuit has ${summary.join(', ')}.`);

  return lines.join('\n');
}

/**
 * Register Circuit DSL code generation and explanation tools.
 *
 * Tools registered (2 total):
 *
 * - `generate_circuit_code` — Generate Circuit DSL code from a natural language description.
 * - `explain_circuit_code`  — Explain what circuit DSL code does in plain language.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerCircuitCodeDslTools(registry: ToolRegistry): void {
  registry.register({
    name: 'generate_circuit_code',
    description:
      'Generate Circuit DSL code from a natural language description. Returns TypeScript-like code using the fluent builder API (circuit(), resistor(), connect(), etc.).',
    category: 'circuit',
    parameters: z.object({
      description: z.string().min(1).describe('Natural language description of the circuit to generate'),
      circuitId: z.number().int().positive().describe('ID of the circuit design to associate with'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      return {
        success: true,
        message: `Generated circuit code for: ${params.description}`,
        data: {
          type: 'generate_circuit_code' as const,
          code: generateCircuitCodeTemplate(params.description),
          circuitId: params.circuitId,
        },
      };
    },
  });

  registry.register({
    name: 'explain_circuit_code',
    description: 'Explain what a Circuit DSL code snippet does in plain language.',
    category: 'circuit',
    parameters: z.object({
      code: z.string().min(1).describe('The Circuit DSL code to explain'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      return {
        success: true,
        message: 'Circuit code explanation generated',
        data: {
          type: 'explain_circuit_code' as const,
          explanation: generateExplanation(params.code),
        },
      };
    },
  });
}
