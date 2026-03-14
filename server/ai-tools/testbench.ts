/**
 * Testbench tools — AI-assisted simulation test planning from circuit topology.
 *
 * Analyzes circuit instances, nets, and component properties to recommend
 * simulation setups, explain test points, and generate step-by-step test
 * sequences. These tools help makers understand what to simulate and why,
 * bridging the gap between "I built a circuit" and "how do I verify it works."
 *
 * All three tools execute server-side: they fetch circuit data from the storage
 * layer and return structured recommendations for the AI to format.
 *
 * @module ai-tools/testbench
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import type { ToolResult, ToolSource } from './types';

// ---------------------------------------------------------------------------
// Topology classification helpers
// ---------------------------------------------------------------------------

/** Net role inferred from name / type / voltage metadata. */
interface NetClassification {
  name: string;
  netId: number;
  role: 'power' | 'ground' | 'signal' | 'clock' | 'analog' | 'bus' | 'unknown';
  voltage: string | null;
  connectedInstanceCount: number;
}

/** Instance role inferred from partId / refDes / properties. */
interface InstanceClassification {
  refDes: string | null;
  partId: number | null;
  instanceId: number;
  role: 'source' | 'passive' | 'active' | 'connector' | 'unknown';
}

/** Recommended simulation setup. */
interface SimRecommendation {
  analysisType: 'dc' | 'ac' | 'transient';
  reason: string;
  priority: 'high' | 'medium' | 'low';
  suggestedSources: string[];
  suggestedProbes: string[];
  expectedBehavior: string;
}

/** A single step in a test sequence. */
interface TestStep {
  stepNumber: number;
  action: string;
  expectedResult: string;
  nets: string[];
  analysisType: 'dc' | 'ac' | 'transient' | 'visual';
}

// ---------------------------------------------------------------------------
// Classification logic
// ---------------------------------------------------------------------------

const POWER_PATTERNS = /^(vcc|vdd|v\+|vin|vout|vsup|vbat|\+\d+v|\d+v\d*)/i;
const GROUND_PATTERNS = /^(gnd|vss|v-|ground|agnd|dgnd|pgnd|0v)/i;
const CLOCK_PATTERNS = /^(clk|clock|sck|sclk|xtal|osc)/i;
const BUS_PATTERNS = /^(sda|scl|mosi|miso|cs|ss|tx|rx|d\d+|a\d+)/i;

function classifyNet(
  net: { id: number; name: string; netType: string | null; voltage: string | null },
  wireCount: number,
): NetClassification {
  const name = net.name;
  let role: NetClassification['role'] = 'unknown';

  if (GROUND_PATTERNS.test(name) || net.netType === 'ground') {
    role = 'ground';
  } else if (POWER_PATTERNS.test(name) || net.netType === 'power') {
    role = 'power';
  } else if (CLOCK_PATTERNS.test(name)) {
    role = 'clock';
  } else if (BUS_PATTERNS.test(name)) {
    role = 'bus';
  } else if (net.netType === 'signal') {
    role = 'signal';
  } else if (net.netType === 'analog') {
    role = 'analog';
  }

  return {
    name,
    netId: net.id,
    role,
    voltage: net.voltage,
    connectedInstanceCount: wireCount,
  };
}

function classifyInstance(inst: {
  id: number;
  referenceDesignator: string | null;
  partId: number | null;
}): InstanceClassification {
  const refDes = inst.referenceDesignator ?? '';
  let role: InstanceClassification['role'] = 'unknown';

  if (/^[JPXW]/i.test(refDes)) {
    role = 'connector';
  } else if (/^[VI]/i.test(refDes)) {
    role = 'source';
  } else if (/^[RCL]/i.test(refDes)) {
    role = 'passive';
  } else if (/^[UQDT]/i.test(refDes)) {
    role = 'active';
  }

  return {
    refDes: inst.referenceDesignator,
    partId: inst.partId,
    instanceId: inst.id,
    role,
  };
}

function buildRecommendations(
  nets: NetClassification[],
  instances: InstanceClassification[],
): SimRecommendation[] {
  const recs: SimRecommendation[] = [];

  const powerNets = nets.filter((n) => n.role === 'power');
  const signalNets = nets.filter((n) => n.role === 'signal' || n.role === 'analog');
  const clockNets = nets.filter((n) => n.role === 'clock');
  const busNets = nets.filter((n) => n.role === 'bus');
  const sources = instances.filter((i) => i.role === 'source');
  const passives = instances.filter((i) => i.role === 'passive');
  const actives = instances.filter((i) => i.role === 'active');

  // DC analysis: always recommended if there are power nets or sources
  if (powerNets.length > 0 || sources.length > 0) {
    recs.push({
      analysisType: 'dc',
      reason: `Circuit has ${powerNets.length} power net(s) and ${sources.length} source(s). DC operating point confirms correct bias voltages and quiescent currents.`,
      priority: 'high',
      suggestedSources: sources.map((s) => s.refDes ?? `Instance#${s.instanceId}`),
      suggestedProbes: powerNets.map((n) => n.name),
      expectedBehavior:
        powerNets
          .filter((n) => n.voltage)
          .map((n) => `${n.name} should read ${n.voltage}`)
          .join('; ') || 'Verify all power rails are at expected voltage levels.',
    });
  }

  // AC analysis: recommended if there are reactive passives or analog/signal nets
  if (passives.length > 0 && (signalNets.length > 0 || clockNets.length > 0)) {
    recs.push({
      analysisType: 'ac',
      reason: `Circuit has ${passives.length} passive(s) and ${signalNets.length + clockNets.length} signal/clock net(s). AC sweep reveals frequency response, bandwidth, and resonance.`,
      priority: signalNets.length > 0 ? 'high' : 'medium',
      suggestedSources: signalNets.length > 0
        ? signalNets.slice(0, 3).map((n) => n.name)
        : clockNets.slice(0, 3).map((n) => n.name),
      suggestedProbes: [...signalNets, ...clockNets].slice(0, 5).map((n) => n.name),
      expectedBehavior: 'Check for expected passband, stopband, gain, and phase margins.',
    });
  }

  // Transient analysis: recommended if clocks, buses, or switching elements exist
  if (clockNets.length > 0 || busNets.length > 0 || actives.length > 0) {
    recs.push({
      analysisType: 'transient',
      reason: `Circuit has ${clockNets.length} clock net(s), ${busNets.length} bus net(s), and ${actives.length} active device(s). Transient simulation shows startup, switching, and timing behavior.`,
      priority: clockNets.length > 0 ? 'high' : 'medium',
      suggestedSources: clockNets.length > 0
        ? clockNets.slice(0, 3).map((n) => n.name)
        : busNets.slice(0, 3).map((n) => n.name),
      suggestedProbes: [...clockNets, ...busNets, ...signalNets].slice(0, 5).map((n) => n.name),
      expectedBehavior: 'Verify rise/fall times, propagation delays, and signal integrity.',
    });
  }

  // Fallback: if no specific recommendations, suggest DC as baseline
  if (recs.length === 0 && instances.length > 0) {
    recs.push({
      analysisType: 'dc',
      reason: 'No specific topology features detected. DC analysis is the baseline for any circuit.',
      priority: 'low',
      suggestedSources: instances.slice(0, 3).map((i) => i.refDes ?? `Instance#${i.instanceId}`),
      suggestedProbes: nets.slice(0, 5).map((n) => n.name),
      expectedBehavior: 'Verify that all node voltages and branch currents are within expected ranges.',
    });
  }

  return recs;
}

function buildTestSequence(
  nets: NetClassification[],
  instances: InstanceClassification[],
  recommendations: SimRecommendation[],
): TestStep[] {
  const steps: TestStep[] = [];
  let stepNum = 1;

  // Step 1: Visual inspection
  steps.push({
    stepNumber: stepNum++,
    action: 'Visually inspect the schematic for unconnected pins, missing power connections, and incorrect component values.',
    expectedResult: 'All components should be properly connected with no floating inputs or undriven nets.',
    nets: [],
    analysisType: 'visual',
  });

  // Steps for each recommendation
  for (const rec of recommendations) {
    const probeList = rec.suggestedProbes.slice(0, 5);

    if (rec.analysisType === 'dc') {
      steps.push({
        stepNumber: stepNum++,
        action: `Run DC operating point analysis. Place voltage probes on: ${probeList.join(', ')}.`,
        expectedResult: rec.expectedBehavior,
        nets: probeList,
        analysisType: 'dc',
      });

      // Add current check if sources exist
      if (rec.suggestedSources.length > 0) {
        steps.push({
          stepNumber: stepNum++,
          action: `Verify current draw from sources: ${rec.suggestedSources.join(', ')}. Check that total current is within source ratings.`,
          expectedResult: 'Current draw should be within component specifications and source capacity.',
          nets: probeList,
          analysisType: 'dc',
        });
      }
    }

    if (rec.analysisType === 'ac') {
      steps.push({
        stepNumber: stepNum++,
        action: `Run AC frequency sweep from 1 Hz to 1 MHz. Apply small-signal source at input, probe output at: ${probeList.join(', ')}.`,
        expectedResult: rec.expectedBehavior,
        nets: probeList,
        analysisType: 'ac',
      });
    }

    if (rec.analysisType === 'transient') {
      steps.push({
        stepNumber: stepNum++,
        action: `Run transient simulation for 10ms. Monitor waveforms on: ${probeList.join(', ')}.`,
        expectedResult: rec.expectedBehavior,
        nets: probeList,
        analysisType: 'transient',
      });
    }
  }

  // Final integration step
  if (instances.length > 2) {
    steps.push({
      stepNumber: stepNum++,
      action: 'Run end-to-end functional verification: apply expected inputs and verify that all outputs settle to correct values.',
      expectedResult: 'Circuit should produce correct output signals within specification.',
      nets: nets.filter((n) => n.role === 'signal' || n.role === 'analog').slice(0, 5).map((n) => n.name),
      analysisType: 'transient',
    });
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register all testbench tools with the given registry.
 *
 * Tools registered (3 total, category: simulation):
 *
 * - `suggest_testbench`      — Analyze circuit topology and recommend simulation setups.
 * - `explain_test_point`     — Explain what to expect at a specific net and why it matters.
 * - `generate_test_sequence` — Create a step-by-step test procedure for circuit verification.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerTestbenchTools(registry: ToolRegistry): void {
  /**
   * suggest_testbench — Analyze circuit topology and recommend simulation setups.
   *
   * Fetches all instances, nets, and wires for a circuit design, classifies
   * them by role (power/signal/clock/bus/etc.), and produces prioritized
   * simulation recommendations with suggested sources and probe points.
   */
  registry.register({
    name: 'suggest_testbench',
    description:
      'Analyze a circuit design\'s instances and nets to recommend simulation setups. ' +
      'Returns recommended analysis types (DC/AC/transient) with priority, suggested input sources, ' +
      'probe points, and expected waveform behavior. Use this before running simulations to help ' +
      'the user understand what to simulate and why.',
    category: 'simulation',
    parameters: z.object({
      circuitDesignId: z.number().int().positive().describe('Circuit design ID to analyze'),
    }),
    requiresConfirmation: false,
    modelPreference: 'standard',
    execute: async (params, ctx): Promise<ToolResult> => {
      const design = await ctx.storage.getCircuitDesign(params.circuitDesignId);
      if (!design) {
        return { success: false, message: `Circuit design ${params.circuitDesignId} not found` };
      }
      if (design.projectId !== ctx.projectId) {
        return { success: false, message: 'Circuit design does not belong to this project' };
      }

      const [instances, nets, wires] = await Promise.all([
        ctx.storage.getCircuitInstances(params.circuitDesignId),
        ctx.storage.getCircuitNets(params.circuitDesignId),
        ctx.storage.getCircuitWires(params.circuitDesignId),
      ]);

      if (instances.length === 0) {
        return {
          success: false,
          message: 'Circuit has no components. Add components before requesting testbench suggestions.',
        };
      }

      // Count wires per net for connectivity info
      const wiresPerNet = new Map<number, number>();
      for (const w of wires) {
        if (w.netId !== null) {
          wiresPerNet.set(w.netId, (wiresPerNet.get(w.netId) ?? 0) + 1);
        }
      }

      const classifiedNets = nets.map((n) => classifyNet(n, wiresPerNet.get(n.id) ?? 0));
      const classifiedInstances = instances.map((i) => classifyInstance(i));
      const recommendations = buildRecommendations(classifiedNets, classifiedInstances);

      const sources: ToolSource[] = [
        ...nets.map((n) => ({ type: 'net' as const, label: n.name, id: n.id })),
      ];

      return {
        success: true,
        message:
          `Analyzed circuit "${design.name}" with ${instances.length} component(s) and ${nets.length} net(s). ` +
          `Generated ${recommendations.length} simulation recommendation(s).`,
        data: {
          designName: design.name,
          designId: params.circuitDesignId,
          topology: {
            instanceCount: instances.length,
            netCount: nets.length,
            wireCount: wires.length,
            netsByRole: {
              power: classifiedNets.filter((n) => n.role === 'power').length,
              ground: classifiedNets.filter((n) => n.role === 'ground').length,
              signal: classifiedNets.filter((n) => n.role === 'signal').length,
              clock: classifiedNets.filter((n) => n.role === 'clock').length,
              bus: classifiedNets.filter((n) => n.role === 'bus').length,
              analog: classifiedNets.filter((n) => n.role === 'analog').length,
              unknown: classifiedNets.filter((n) => n.role === 'unknown').length,
            },
            instancesByRole: {
              source: classifiedInstances.filter((i) => i.role === 'source').length,
              passive: classifiedInstances.filter((i) => i.role === 'passive').length,
              active: classifiedInstances.filter((i) => i.role === 'active').length,
              connector: classifiedInstances.filter((i) => i.role === 'connector').length,
              unknown: classifiedInstances.filter((i) => i.role === 'unknown').length,
            },
          },
          recommendations,
          nets: classifiedNets,
          instances: classifiedInstances,
        },
        sources,
      };
    },
  });

  /**
   * explain_test_point — Explain what to expect at a specific net.
   *
   * Looks up a net by name within a circuit design, classifies it, examines
   * connected components, and returns a human-friendly explanation of what
   * signal or voltage to expect and why this test point matters.
   */
  registry.register({
    name: 'explain_test_point',
    description:
      'Given a net name in a circuit design, explain what signal or voltage to expect at that ' +
      'test point and why it matters. Helps makers understand what they should see on an ' +
      'oscilloscope or multimeter at each point in their circuit.',
    category: 'simulation',
    parameters: z.object({
      circuitDesignId: z.number().int().positive().describe('Circuit design ID'),
      netName: z.string().min(1).describe('Name of the net to explain (e.g., "VCC", "SDA", "CLK")'),
    }),
    requiresConfirmation: false,
    modelPreference: 'standard',
    execute: async (params, ctx): Promise<ToolResult> => {
      const design = await ctx.storage.getCircuitDesign(params.circuitDesignId);
      if (!design) {
        return { success: false, message: `Circuit design ${params.circuitDesignId} not found` };
      }
      if (design.projectId !== ctx.projectId) {
        return { success: false, message: 'Circuit design does not belong to this project' };
      }

      const nets = await ctx.storage.getCircuitNets(params.circuitDesignId);
      const matchedNet = nets.find(
        (n) => n.name.toLowerCase() === params.netName.toLowerCase(),
      );

      if (!matchedNet) {
        const available = nets.slice(0, 20).map((n) => n.name);
        return {
          success: false,
          message: `Net "${params.netName}" not found in circuit "${design.name}". Available nets: ${available.join(', ')}`,
          data: { availableNets: available },
        };
      }

      const [wires, instances] = await Promise.all([
        ctx.storage.getCircuitWires(params.circuitDesignId),
        ctx.storage.getCircuitInstances(params.circuitDesignId),
      ]);

      // Count connections on this net
      const netWires = wires.filter((w) => w.netId === matchedNet.id);
      const classification = classifyNet(matchedNet, netWires.length);

      // Build explanation based on role
      const roleExplanations: Record<NetClassification['role'], string> = {
        power: `This is a power rail. It should show a steady DC voltage${matchedNet.voltage ? ` of ${matchedNet.voltage}` : ''}. Ripple or noise on this net can cause downstream issues. Use a multimeter for DC level and an oscilloscope to check for AC ripple.`,
        ground: 'This is a ground reference. It should read 0V relative to the circuit ground. Any voltage offset here indicates a ground loop or high-current return path issue.',
        signal: 'This is a signal net carrying data or control information. The expected waveform depends on the driving source — it could be digital (square wave) or analog (sine, triangle, etc.).',
        clock: 'This is a clock net. It should show a periodic square wave at the designed frequency. Check rise/fall times, duty cycle, and signal integrity (overshoot/undershoot).',
        analog: 'This is an analog signal net. Expected behavior depends on the circuit function — it could carry sensor output, audio, or control voltages. Use an oscilloscope to observe the waveform shape.',
        bus: 'This is a communication bus signal. Expected protocol-specific waveforms (I2C: SDA/SCL with START/STOP conditions; SPI: clock-synchronized data; UART: asynchronous frames). Use a logic analyzer or protocol decoder.',
        unknown: 'This net\'s role could not be automatically determined from its name. Inspect the connected components to understand its function.',
      };

      const classifiedInstances = instances.map((i) => classifyInstance(i));

      return {
        success: true,
        message: `Test point explanation for "${matchedNet.name}" in circuit "${design.name}".`,
        data: {
          netName: matchedNet.name,
          netId: matchedNet.id,
          role: classification.role,
          voltage: matchedNet.voltage,
          netType: matchedNet.netType,
          connectionCount: netWires.length,
          explanation: roleExplanations[classification.role],
          suggestedMeasurement: classification.role === 'power' || classification.role === 'ground'
            ? 'dc_voltage'
            : classification.role === 'clock'
              ? 'oscilloscope_frequency'
              : classification.role === 'bus'
                ? 'logic_analyzer'
                : 'oscilloscope_waveform',
          circuitContext: {
            totalInstances: instances.length,
            totalNets: nets.length,
            instanceRoles: {
              source: classifiedInstances.filter((i) => i.role === 'source').length,
              passive: classifiedInstances.filter((i) => i.role === 'passive').length,
              active: classifiedInstances.filter((i) => i.role === 'active').length,
            },
          },
        },
        sources: [
          { type: 'net' as const, label: matchedNet.name, id: matchedNet.id },
        ],
      };
    },
  });

  /**
   * generate_test_sequence — Create a step-by-step test procedure.
   *
   * Analyzes the circuit topology, generates simulation recommendations,
   * then produces an ordered test sequence covering visual inspection,
   * DC verification, AC sweeps, transient checks, and integration testing.
   */
  registry.register({
    name: 'generate_test_sequence',
    description:
      'Generate a step-by-step test procedure for verifying a circuit design. ' +
      'Analyzes the circuit topology and produces an ordered sequence of tests covering ' +
      'visual inspection, DC bias verification, AC response, transient behavior, and ' +
      'integration checks. Each step includes the action, expected result, relevant nets, ' +
      'and analysis type.',
    category: 'simulation',
    parameters: z.object({
      circuitDesignId: z.number().int().positive().describe('Circuit design ID to generate test sequence for'),
      focus: z
        .enum(['all', 'dc', 'ac', 'transient'])
        .optional()
        .default('all')
        .describe('Focus area for the test sequence (default: all)'),
    }),
    requiresConfirmation: false,
    modelPreference: 'standard',
    execute: async (params, ctx): Promise<ToolResult> => {
      const design = await ctx.storage.getCircuitDesign(params.circuitDesignId);
      if (!design) {
        return { success: false, message: `Circuit design ${params.circuitDesignId} not found` };
      }
      if (design.projectId !== ctx.projectId) {
        return { success: false, message: 'Circuit design does not belong to this project' };
      }

      const [instances, nets, wires] = await Promise.all([
        ctx.storage.getCircuitInstances(params.circuitDesignId),
        ctx.storage.getCircuitNets(params.circuitDesignId),
        ctx.storage.getCircuitWires(params.circuitDesignId),
      ]);

      if (instances.length === 0) {
        return {
          success: false,
          message: 'Circuit has no components. Add components before generating a test sequence.',
        };
      }

      const wiresPerNet = new Map<number, number>();
      for (const w of wires) {
        if (w.netId !== null) {
          wiresPerNet.set(w.netId, (wiresPerNet.get(w.netId) ?? 0) + 1);
        }
      }

      const classifiedNets = nets.map((n) => classifyNet(n, wiresPerNet.get(n.id) ?? 0));
      const classifiedInstances = instances.map((i) => classifyInstance(i));

      let recommendations = buildRecommendations(classifiedNets, classifiedInstances);

      // Filter by focus if specified
      if (params.focus !== 'all') {
        recommendations = recommendations.filter((r) => r.analysisType === params.focus);
      }

      const steps = buildTestSequence(classifiedNets, classifiedInstances, recommendations);

      const sources: ToolSource[] = [
        ...nets.map((n) => ({ type: 'net' as const, label: n.name, id: n.id })),
      ];

      return {
        success: true,
        message:
          `Generated ${steps.length}-step test sequence for circuit "${design.name}" ` +
          `(${instances.length} components, ${nets.length} nets).`,
        data: {
          designName: design.name,
          designId: params.circuitDesignId,
          focus: params.focus,
          stepCount: steps.length,
          steps,
          recommendations,
          topology: {
            instanceCount: instances.length,
            netCount: nets.length,
          },
        },
        sources,
      };
    },
  });
}
