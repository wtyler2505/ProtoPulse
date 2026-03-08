/**
 * Generative design AI tools — circuit candidate generation and tradeoff analysis.
 *
 * Registers two tools:
 * - `generate_circuit_candidates` — Generate N CircuitIR candidates from a text description + constraints
 * - `explain_design_tradeoffs` — Analyze fitness results and explain why candidates score differently
 *
 * @module ai-tools/generative
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';

// ---------------------------------------------------------------------------
// Component templates for candidate generation
// ---------------------------------------------------------------------------

interface ComponentTemplate {
  partId: string;
  refPrefix: string;
  defaultValue?: string;
  pins: Record<string, string>;
}

const COMPONENT_TEMPLATES: Record<string, ComponentTemplate[]> = {
  led: [
    { partId: 'resistor', refPrefix: 'R', defaultValue: '330', pins: { pin1: 'VCC', pin2: 'N1' } },
    { partId: 'led', refPrefix: 'D', pins: { anode: 'N1', cathode: 'GND' } },
  ],
  driver: [
    { partId: 'resistor', refPrefix: 'R', defaultValue: '10k', pins: { pin1: 'VCC', pin2: 'N1' } },
    { partId: 'transistor', refPrefix: 'Q', pins: { base: 'N1', collector: 'VCC', emitter: 'N2' } },
    { partId: 'resistor', refPrefix: 'R', defaultValue: '100', pins: { pin1: 'N2', pin2: 'GND' } },
  ],
  voltage: [
    { partId: 'resistor', refPrefix: 'R', defaultValue: '10k', pins: { pin1: 'VCC', pin2: 'VOUT' } },
    { partId: 'resistor', refPrefix: 'R', defaultValue: '10k', pins: { pin1: 'VOUT', pin2: 'GND' } },
  ],
  power: [
    { partId: 'capacitor', refPrefix: 'C', defaultValue: '100u', pins: { pin1: 'VIN', pin2: 'GND' } },
    { partId: 'regulator', refPrefix: 'U', pins: { vin: 'VIN', vout: 'VOUT', gnd: 'GND' } },
    { partId: 'capacitor', refPrefix: 'C', defaultValue: '10u', pins: { pin1: 'VOUT', pin2: 'GND' } },
  ],
  sensor: [
    { partId: 'resistor', refPrefix: 'R', defaultValue: '4.7k', pins: { pin1: 'VCC', pin2: 'SDA' } },
    { partId: 'resistor', refPrefix: 'R', defaultValue: '4.7k', pins: { pin1: 'VCC', pin2: 'SCL' } },
    { partId: 'sensor', refPrefix: 'U', pins: { vcc: 'VCC', gnd: 'GND', sda: 'SDA', scl: 'SCL' } },
    { partId: 'capacitor', refPrefix: 'C', defaultValue: '100n', pins: { pin1: 'VCC', pin2: 'GND' } },
  ],
  default: [
    { partId: 'resistor', refPrefix: 'R', defaultValue: '10k', pins: { pin1: 'VCC', pin2: 'OUT' } },
  ],
};

/** Simple seeded PRNG for reproducible candidate generation. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Resistor E12 values for random selection. */
const RESISTOR_VALUES = ['100', '220', '330', '470', '1k', '2.2k', '4.7k', '10k', '22k', '47k', '100k'];
const CAP_VALUES = ['100p', '1n', '10n', '100n', '1u', '10u', '100u', '470u'];

interface GeneratedCandidate {
  meta: { name: string; version: string };
  components: Array<{
    id: string;
    refdes: string;
    partId: string;
    value?: string;
    pins: Record<string, string>;
  }>;
  nets: Array<{ id: string; name: string; type: 'signal' | 'power' | 'ground' }>;
  wires: Array<{ id: string; netId: string; points: Array<{ x: number; y: number }> }>;
}

/** Score a candidate using simple heuristics (server-side lightweight version). */
function quickScore(candidate: GeneratedCandidate, budgetUsd?: number, maxPowerWatts?: number): number {
  const compCount = candidate.components.length;
  const compScore = compCount <= 10 ? 1.0 : Math.max(0, 1.0 - (compCount - 10) / 20);

  const costEstimate = candidate.components.reduce((sum, c) => {
    const costs: Record<string, number> = {
      resistor: 0.02, capacitor: 0.05, led: 0.1, transistor: 0.15,
      mosfet: 0.25, opamp: 0.5, regulator: 0.6, sensor: 0.8, diode: 0.08,
    };
    return sum + (costs[c.partId] ?? 0.5);
  }, 0);
  const budget = budgetUsd ?? 25;
  const costScore = costEstimate <= budget ? 1.0 : Math.max(0, 2.0 - costEstimate / budget);

  const powerEstimate = candidate.components.reduce((sum, c) => {
    const powers: Record<string, number> = {
      resistor: 0.01, capacitor: 0, led: 0.06, transistor: 0.05,
      mosfet: 0.1, regulator: 0.2, motor: 1.0, sensor: 0.05,
    };
    return sum + (powers[c.partId] ?? 0.05);
  }, 0);
  const maxPow = maxPowerWatts ?? 5;
  const powerScore = powerEstimate <= maxPow ? 1.0 : Math.max(0, 2.0 - powerEstimate / maxPow);

  return compScore * 0.3 + costScore * 0.4 + powerScore * 0.3;
}

function selectTemplate(description: string): ComponentTemplate[] {
  const lower = description.toLowerCase();
  for (const [keyword, templates] of Object.entries(COMPONENT_TEMPLATES)) {
    if (keyword !== 'default' && lower.includes(keyword)) {
      return templates;
    }
  }
  return COMPONENT_TEMPLATES['default'];
}

function generateCandidates(
  description: string,
  count: number,
  budgetUsd?: number,
  maxPowerWatts?: number,
): { candidates: GeneratedCandidate[]; fitnessScores: Array<{ overall: number }> } {
  const rng = mulberry32(description.length * 31 + count * 7);
  const baseTemplates = selectTemplate(description);

  const candidates: GeneratedCandidate[] = [];
  const fitnessScores: Array<{ overall: number }> = [];

  for (let i = 0; i < count; i++) {
    const refCounters: Record<string, number> = {};
    const netNames = new Set<string>();
    const components: GeneratedCandidate['components'] = [];

    // Build from template with variation
    for (const template of baseTemplates) {
      refCounters[template.refPrefix] = (refCounters[template.refPrefix] ?? 0) + 1;
      const refNum = refCounters[template.refPrefix];
      const refdes = `${template.refPrefix}${refNum}`;

      // Randomize value
      let value = template.defaultValue;
      if (value && template.partId === 'resistor' && rng() > 0.3) {
        value = RESISTOR_VALUES[Math.floor(rng() * RESISTOR_VALUES.length)];
      } else if (value && template.partId === 'capacitor' && rng() > 0.3) {
        value = CAP_VALUES[Math.floor(rng() * CAP_VALUES.length)];
      }

      // Collect net names
      for (const netName of Object.values(template.pins)) {
        netNames.add(netName);
      }

      const comp: GeneratedCandidate['components'][number] = {
        id: `gen-${i}-${refdes.toLowerCase()}`,
        refdes,
        partId: template.partId,
        pins: { ...template.pins },
      };
      if (value !== undefined) {
        comp.value = value;
      }
      components.push(comp);
    }

    // Optionally add bypass cap for variation
    if (rng() > 0.5 - i * 0.1) {
      refCounters['C'] = (refCounters['C'] ?? 0) + 1;
      const bypassComp: GeneratedCandidate['components'][number] = {
        id: `gen-${i}-byp`,
        refdes: `C${refCounters['C']}`,
        partId: 'capacitor',
        value: '100n',
        pins: { pin1: 'VCC', pin2: 'GND' },
      };
      components.push(bypassComp);
      netNames.add('VCC');
      netNames.add('GND');
    }

    // Build nets
    const nets: GeneratedCandidate['nets'] = [];
    for (const name of Array.from(netNames)) {
      const type = name === 'GND' ? 'ground' as const
        : (name === 'VCC' || name === 'VIN' || name === 'VOUT') ? 'power' as const
        : 'signal' as const;
      nets.push({
        id: `net-${i}-${name.toLowerCase()}`,
        name,
        type,
      });
    }

    const candidate: GeneratedCandidate = {
      meta: { name: `Candidate ${i + 1}: ${description}`, version: '1.0.0' },
      components,
      nets,
      wires: [],
    };

    candidates.push(candidate);
    fitnessScores.push({ overall: quickScore(candidate, budgetUsd, maxPowerWatts) });
  }

  return { candidates, fitnessScores };
}

// ---------------------------------------------------------------------------
// Tradeoff explanation generator
// ---------------------------------------------------------------------------

interface CandidateSummary {
  name: string;
  componentCount: number;
  estimatedCost: number;
  fitnessScore: number;
}

function generateTradeoffExplanation(candidates: CandidateSummary[]): string {
  const lines: string[] = [];
  lines.push(`Design Tradeoff Analysis (${candidates.length} candidate${candidates.length !== 1 ? 's' : ''}):`);
  lines.push('');

  // Sort by fitness score descending
  const sorted = [...candidates].sort((a, b) => b.fitnessScore - a.fitnessScore);

  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    const rank = i + 1;
    lines.push(`#${rank}: ${c.name}`);
    lines.push(`  Fitness: ${(c.fitnessScore * 100).toFixed(1)}%`);
    lines.push(`  Components: ${c.componentCount}`);
    lines.push(`  Estimated Cost: $${c.estimatedCost.toFixed(2)}`);

    // Strengths/weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (c.componentCount <= 5) {
      strengths.push('simple design, easy to build');
    } else if (c.componentCount > 15) {
      weaknesses.push('complex design, more assembly time');
    }

    if (c.estimatedCost <= 10) {
      strengths.push('low cost');
    } else if (c.estimatedCost > 30) {
      weaknesses.push('expensive');
    }

    if (c.fitnessScore >= 0.8) {
      strengths.push('high overall fitness');
    } else if (c.fitnessScore < 0.5) {
      weaknesses.push('low fitness score, may need improvement');
    }

    if (strengths.length > 0) {
      lines.push(`  Strengths: ${strengths.join(', ')}`);
    }
    if (weaknesses.length > 0) {
      lines.push(`  Weaknesses: ${weaknesses.join(', ')}`);
    }
    lines.push('');
  }

  // Recommendation
  if (sorted.length >= 2) {
    const best = sorted[0];
    const second = sorted[1];
    lines.push('Recommendation:');
    if (best.fitnessScore - second.fitnessScore > 0.15) {
      lines.push(`  "${best.name}" is the clear winner with significantly higher fitness.`);
    } else {
      lines.push(`  "${best.name}" and "${second.name}" are close. Consider your priorities:`);
      if (best.estimatedCost > second.estimatedCost) {
        lines.push(`  - Choose "${second.name}" if cost is more important.`);
      }
      if (best.componentCount > second.componentCount) {
        lines.push(`  - Choose "${second.name}" if simplicity is more important.`);
      }
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register generative design AI tools.
 *
 * Tools registered (2 total):
 * - `generate_circuit_candidates` — Generate N CircuitIR candidates from description + constraints
 * - `explain_design_tradeoffs`    — Analyze and explain fitness tradeoffs between candidates
 */
export function registerGenerativeTools(registry: ToolRegistry): void {
  registry.register({
    name: 'generate_circuit_candidates',
    description:
      'Generate multiple circuit design candidates from a natural language description. Returns CircuitIR candidates with fitness scores. Use this when the user wants to explore design alternatives or optimize a circuit.',
    category: 'circuit',
    parameters: z.object({
      description: z.string().min(1).describe('Natural language description of the desired circuit'),
      candidateCount: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(6)
        .describe('Number of candidates to generate (default 6)'),
      budgetUsd: z.number().positive().optional().describe('Optional budget constraint in USD'),
      maxPowerWatts: z.number().positive().optional().describe('Optional maximum power constraint in watts'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      const { candidates, fitnessScores } = generateCandidates(
        params.description,
        params.candidateCount,
        params.budgetUsd,
        params.maxPowerWatts,
      );

      return {
        success: true,
        message: `Generated ${candidates.length} circuit candidates for: ${params.description}`,
        data: {
          type: 'generate_circuit_candidates' as const,
          candidates,
          fitnessScores,
        },
      };
    },
  });

  registry.register({
    name: 'explain_design_tradeoffs',
    description:
      'Analyze fitness results from generative design and explain why certain candidates score better. Compares component count, cost, and overall fitness to provide actionable recommendations.',
    category: 'circuit',
    parameters: z.object({
      candidates: z
        .array(
          z.object({
            name: z.string().min(1).describe('Candidate name or label'),
            componentCount: z.number().int().min(0).describe('Number of components'),
            estimatedCost: z.number().min(0).describe('Estimated cost in USD'),
            fitnessScore: z.number().min(0).max(1).describe('Overall fitness score 0-1'),
          }),
        )
        .min(1)
        .describe('Array of candidate summaries to compare'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      const explanation = generateTradeoffExplanation(params.candidates);

      return {
        success: true,
        message: 'Design tradeoff analysis generated',
        data: {
          type: 'explain_design_tradeoffs' as const,
          explanation,
        },
      };
    },
  });
}
