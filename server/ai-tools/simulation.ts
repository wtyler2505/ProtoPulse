/**
 * Simulation tools — configure, trigger, and retrieve simulation results.
 *
 * Provides AI tools for managing circuit simulation workflows: setting up
 * simulation parameters (DC, AC, transient), triggering client-side solvers,
 * and retrieving stored simulation results from the database.
 *
 * The actual simulation engines live client-side (`client/src/lib/simulation/`).
 * These tools configure simulation parameters and store/retrieve results via
 * the storage layer. The client picks up stored configs and runs the solvers.
 *
 * @module ai-tools/simulation
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import { clientAction } from './registry';

/**
 * Register all simulation tools with the given registry.
 *
 * Tools registered (5 total):
 *
 * **Analysis triggers (client-dispatched):**
 * - `run_dc_analysis`   — Configure and trigger DC operating point analysis.
 * - `run_ac_analysis`   — Configure and trigger AC frequency sweep.
 * - `run_transient`     — Configure and trigger transient time-domain simulation.
 *
 * **Result management (server-side):**
 * - `get_sim_results`     — Retrieve stored simulation results from the database.
 * - `set_sim_parameters`  — Store simulation configuration as a named scenario.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerSimulationTools(registry: ToolRegistry): void {
  /**
   * run_dc_analysis — Configure and trigger DC operating point analysis.
   *
   * Validates that the circuit design exists and has components, then dispatches
   * a client action to run the DC solver. The client will execute the analysis
   * using the MNA-based circuit solver and store results back via the API.
   */
  registry.register({
    name: 'run_dc_analysis',
    description:
      'Run a DC operating point analysis on a circuit design. Returns node voltages and branch currents at the DC steady state. The circuit must have at least one component and one source.',
    category: 'simulation',
    parameters: z.object({
      circuitDesignId: z.number().int().positive().describe('Circuit design ID to analyze'),
    }),
    requiresConfirmation: false,
    modelPreference: 'standard',
    execute: async (params, ctx) => {
      const design = await ctx.storage.getCircuitDesign(params.circuitDesignId);
      if (!design) {
        return { success: false, message: `Circuit design ${params.circuitDesignId} not found` };
      }
      if (design.projectId !== ctx.projectId) {
        return { success: false, message: 'Circuit design does not belong to this project' };
      }

      const instances = await ctx.storage.getCircuitInstances(params.circuitDesignId);
      if (instances.length === 0) {
        return {
          success: false,
          message: 'Circuit has no components. Add components and connections before running simulation.',
        };
      }

      return clientAction('run_dc_analysis', {
        circuitDesignId: params.circuitDesignId,
        analysisType: 'dc',
      });
    },
  });

  /**
   * run_ac_analysis — Configure and trigger AC frequency sweep.
   *
   * Validates the circuit, then dispatches a client action to run the AC
   * small-signal analysis across the specified frequency range.
   */
  registry.register({
    name: 'run_ac_analysis',
    description:
      'Run an AC frequency sweep analysis on a circuit design. Returns magnitude and phase response across a frequency range. Useful for filter design, amplifier bandwidth analysis, and impedance characterization.',
    category: 'simulation',
    parameters: z.object({
      circuitDesignId: z.number().int().positive().describe('Circuit design ID to analyze'),
      startFreq: z.number().positive().optional().default(1).describe('Start frequency in Hz (default: 1 Hz)'),
      stopFreq: z
        .number()
        .positive()
        .optional()
        .default(1e6)
        .describe('Stop frequency in Hz (default: 1 MHz)'),
      points: z
        .number()
        .int()
        .positive()
        .min(2)
        .max(10000)
        .optional()
        .default(100)
        .describe('Number of frequency points (default: 100, max: 10000)'),
    }),
    requiresConfirmation: false,
    modelPreference: 'standard',
    execute: async (params, ctx) => {
      const design = await ctx.storage.getCircuitDesign(params.circuitDesignId);
      if (!design) {
        return { success: false, message: `Circuit design ${params.circuitDesignId} not found` };
      }
      if (design.projectId !== ctx.projectId) {
        return { success: false, message: 'Circuit design does not belong to this project' };
      }

      const instances = await ctx.storage.getCircuitInstances(params.circuitDesignId);
      if (instances.length === 0) {
        return {
          success: false,
          message: 'Circuit has no components. Add components and connections before running AC analysis.',
        };
      }

      if (params.startFreq >= params.stopFreq) {
        return { success: false, message: 'Start frequency must be less than stop frequency' };
      }

      return clientAction('run_ac_analysis', {
        circuitDesignId: params.circuitDesignId,
        analysisType: 'ac',
        startFreq: params.startFreq,
        stopFreq: params.stopFreq,
        points: params.points,
      });
    },
  });

  /**
   * run_transient — Configure and trigger transient time-domain simulation.
   *
   * Validates the circuit, then dispatches a client action to run the transient
   * simulation with the specified duration and timestep.
   */
  registry.register({
    name: 'run_transient',
    description:
      'Run a transient (time-domain) simulation on a circuit design. Returns voltage and current waveforms over time. Useful for analyzing startup behavior, switching circuits, and signal integrity.',
    category: 'simulation',
    parameters: z.object({
      circuitDesignId: z.number().int().positive().describe('Circuit design ID to analyze'),
      duration: z
        .number()
        .positive()
        .max(10)
        .optional()
        .default(0.01)
        .describe('Simulation duration in seconds (default: 10ms, max: 10s)'),
      timestep: z
        .number()
        .positive()
        .optional()
        .default(1e-5)
        .describe('Time step in seconds (default: 10µs)'),
    }),
    requiresConfirmation: false,
    modelPreference: 'standard',
    execute: async (params, ctx) => {
      const design = await ctx.storage.getCircuitDesign(params.circuitDesignId);
      if (!design) {
        return { success: false, message: `Circuit design ${params.circuitDesignId} not found` };
      }
      if (design.projectId !== ctx.projectId) {
        return { success: false, message: 'Circuit design does not belong to this project' };
      }

      const instances = await ctx.storage.getCircuitInstances(params.circuitDesignId);
      if (instances.length === 0) {
        return {
          success: false,
          message: 'Circuit has no components. Add components and connections before running transient simulation.',
        };
      }

      if (params.timestep >= params.duration) {
        return { success: false, message: 'Timestep must be smaller than the simulation duration' };
      }

      return clientAction('run_transient', {
        circuitDesignId: params.circuitDesignId,
        analysisType: 'transient',
        duration: params.duration,
        timestep: params.timestep,
      });
    },
  });

  /**
   * get_sim_results — Retrieve stored simulation results from the database.
   *
   * Executes server-side: fetches simulation results via `storage.getSimulationResults()`
   * and optionally filters by analysis type.
   */
  registry.register({
    name: 'get_sim_results',
    description:
      'Retrieve stored simulation results for a circuit design. Returns the most recent results, optionally filtered by analysis type (dc, ac, transient).',
    category: 'simulation',
    parameters: z.object({
      circuitDesignId: z.number().int().positive().describe('Circuit design ID'),
      analysisType: z
        .enum(['dc', 'ac', 'transient'])
        .optional()
        .describe('Filter by analysis type. If omitted, returns all types.'),
    }),
    requiresConfirmation: false,
    modelPreference: 'fast',
    execute: async (params, ctx) => {
      const design = await ctx.storage.getCircuitDesign(params.circuitDesignId);
      if (!design) {
        return { success: false, message: `Circuit design ${params.circuitDesignId} not found` };
      }
      if (design.projectId !== ctx.projectId) {
        return { success: false, message: 'Circuit design does not belong to this project' };
      }

      let results = await ctx.storage.getSimulationResults(params.circuitDesignId);

      if (params.analysisType) {
        results = results.filter((r) => r.analysisType === params.analysisType);
      }

      if (results.length === 0) {
        const typeMsg = params.analysisType ? ` of type "${params.analysisType}"` : '';
        return {
          success: true,
          message: `No simulation results${typeMsg} found for circuit ${params.circuitDesignId}. Run a simulation first.`,
          data: { results: [] },
        };
      }

      const summaries = results.map((r) => ({
        id: r.id,
        analysisType: r.analysisType,
        status: r.status,
        engineUsed: r.engineUsed,
        elapsedMs: r.elapsedMs,
        error: r.error,
        createdAt: r.createdAt,
        config: r.config,
        results: r.results,
      }));

      return {
        success: true,
        message: `Found ${results.length} simulation result(s) for circuit ${params.circuitDesignId}.`,
        data: { results: summaries },
      };
    },
  });

  /**
   * set_sim_parameters — Store simulation configuration as a named scenario.
   *
   * Executes server-side: creates a simulation scenario record via
   * `storage.createSimulationScenario()` that persists the simulation
   * configuration for later retrieval or re-run.
   */
  registry.register({
    name: 'set_sim_parameters',
    description:
      'Save a simulation configuration as a named scenario. This stores the analysis type, frequency range, duration, and other parameters so they can be reused later.',
    category: 'simulation',
    parameters: z.object({
      circuitDesignId: z.number().int().positive().describe('Circuit design ID'),
      name: z.string().min(1).max(200).describe('Scenario name (e.g., "1kHz filter sweep", "startup transient")'),
      description: z.string().max(1000).optional().describe('Optional description of the scenario'),
      parameters: z
        .object({
          analysisType: z.enum(['dc', 'ac', 'transient']).describe('Type of analysis'),
          startFreq: z.number().positive().optional().describe('AC start frequency (Hz)'),
          stopFreq: z.number().positive().optional().describe('AC stop frequency (Hz)'),
          points: z.number().int().positive().optional().describe('Number of frequency points'),
          duration: z.number().positive().optional().describe('Transient duration (seconds)'),
          timestep: z.number().positive().optional().describe('Transient timestep (seconds)'),
        })
        .passthrough()
        .describe('Simulation parameters including analysisType and type-specific settings'),
    }),
    requiresConfirmation: false,
    modelPreference: 'fast',
    execute: async (params, ctx) => {
      const design = await ctx.storage.getCircuitDesign(params.circuitDesignId);
      if (!design) {
        return { success: false, message: `Circuit design ${params.circuitDesignId} not found` };
      }
      if (design.projectId !== ctx.projectId) {
        return { success: false, message: 'Circuit design does not belong to this project' };
      }

      const scenario = await ctx.storage.createSimulationScenario({
        projectId: ctx.projectId,
        circuitId: params.circuitDesignId,
        name: params.name,
        description: params.description ?? null,
        config: params.parameters,
      });

      return {
        success: true,
        message: `Saved simulation scenario "${params.name}" (id: ${scenario.id}) for circuit ${params.circuitDesignId}.`,
        data: { scenarioId: scenario.id, name: params.name },
      };
    },
  });
}
