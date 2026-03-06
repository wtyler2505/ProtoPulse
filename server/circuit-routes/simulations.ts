import type { Express } from 'express';
import type { IStorage } from '../storage';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { asyncHandler, parseIdParam, payloadLimit, gatherCircuitData } from './utils';
import { requireProjectOwnership } from '../routes/auth-middleware';

const simulateSchema = z.object({
  analysisType: z.enum(['op', 'tran', 'ac', 'dc']),
  transient: z.object({
    startTime: z.number().min(0),
    stopTime: z.number().positive(),
    timeStep: z.number().positive(),
  }).optional(),
  ac: z.object({
    startFreq: z.number().positive(),
    stopFreq: z.number().positive(),
    numPoints: z.number().int().positive().max(10000),
    sweepType: z.enum(['dec', 'lin', 'oct']),
  }).optional(),
  dcSweep: z.object({
    sourceName: z.string().min(1),
    startValue: z.number(),
    stopValue: z.number(),
    stepValue: z.number(),
  }).optional(),
  temperature: z.number().optional(),
});

export function registerCircuitSimulationRoutes(app: Express, storage: IStorage): void {
  // POST /api/projects/:projectId/circuits/:circuitId/simulate
  app.post('/api/projects/:projectId/circuits/:circuitId/simulate', requireProjectOwnership, payloadLimit(64 * 1024), asyncHandler(async (req, res) => {
    const _projectId = parseIdParam(req.params.projectId);
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = simulateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }

    const circuit = await storage.getCircuitDesign(circuitId);
    if (!circuit) { return res.status(404).json({ message: 'Circuit design not found' }); }

    const data = await gatherCircuitData(storage, circuitId);
    if (!data) { return res.status(404).json({ message: 'Circuit data not found' }); }

    // Generate SPICE netlist
    const { exportSpiceNetlist } = await import('../export/spice-exporter');
    const spiceResult = exportSpiceNetlist({
      circuitName: circuit.name,
      instances: data.instances,
      nets: data.nets,
      parts: data.parts,
      config: {
        analysis: parsed.data.analysisType,
        transient: parsed.data.transient,
        ac: parsed.data.ac,
        dcSweep: parsed.data.dcSweep,
        temperature: parsed.data.temperature,
      },
    });

    // Run simulation
    const { runSimulation } = await import('../simulation');
    const result = await runSimulation({
      netlist: spiceResult.netlist,
      analysisType: parsed.data.analysisType,
      timeout: 30000,
    });

    // Store simulation result (Phase 13.13 -- result size management)
    const resultData = {
      nodeVoltages: result.nodeVoltages,
      branchCurrents: result.branchCurrents,
      traces: result.traces,
    };
    const resultJson = JSON.stringify(resultData);
    const sizeBytes = Buffer.byteLength(resultJson, 'utf-8');

    const stored = await storage.createSimulationResult({
      circuitId,
      analysisType: parsed.data.analysisType,
      config: parsed.data as Record<string, unknown>,
      results: resultData as Record<string, unknown>,
      status: result.success ? 'completed' : 'failed',
      engineUsed: result.engineUsed,
      elapsedMs: result.elapsedMs,
      sizeBytes,
      error: result.error || null,
    });

    // Auto-cleanup: keep max 5 results per circuit
    await storage.cleanupSimulationResults(circuitId, 5);

    res.json({
      id: stored.id,
      success: result.success,
      analysisType: result.analysisType,
      engineUsed: result.engineUsed,
      elapsedMs: result.elapsedMs,
      sizeBytes,
      nodeVoltages: result.nodeVoltages,
      branchCurrents: result.branchCurrents,
      traces: result.traces,
      netlistWarnings: spiceResult.warnings,
      error: result.error,
    });
  }));

  // GET /api/projects/:projectId/circuits/:circuitId/simulations -- list stored results
  app.get('/api/projects/:projectId/circuits/:circuitId/simulations', requireProjectOwnership, asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const results = await storage.getSimulationResults(circuitId);

    // Return summaries (without full result data to save bandwidth)
    const summaries = results.map(r => ({
      id: r.id,
      analysisType: r.analysisType,
      status: r.status,
      engineUsed: r.engineUsed,
      elapsedMs: r.elapsedMs,
      sizeBytes: r.sizeBytes,
      error: r.error,
      createdAt: r.createdAt,
    }));

    res.json({ data: summaries, total: summaries.length });
  }));

  // GET /api/projects/:projectId/circuits/:circuitId/simulations/:simId -- get full result
  app.get('/api/projects/:projectId/circuits/:circuitId/simulations/:simId', requireProjectOwnership, asyncHandler(async (req, res) => {
    const simId = parseIdParam(req.params.simId);
    const result = await storage.getSimulationResult(simId);
    if (!result) { return res.status(404).json({ message: 'Simulation result not found' }); }
    res.json(result);
  }));

  // DELETE /api/projects/:projectId/circuits/:circuitId/simulations/:simId -- delete result
  app.delete('/api/projects/:projectId/circuits/:circuitId/simulations/:simId', requireProjectOwnership, asyncHandler(async (req, res) => {
    const simId = parseIdParam(req.params.simId);
    const deleted = await storage.deleteSimulationResult(simId);
    if (!deleted) { return res.status(404).json({ message: 'Simulation result not found' }); }
    res.status(204).end();
  }));

  // GET /api/projects/:projectId/circuits/:circuitId/simulation/capabilities
  app.get('/api/projects/:projectId/circuits/:circuitId/simulation/capabilities', requireProjectOwnership, asyncHandler(async (_req, res) => {
    const { getSimulationCapabilities } = await import('../simulation');
    const caps = await getSimulationCapabilities();
    res.json(caps);
  }));

  // POST /api/projects/:projectId/export/spice -- SPICE netlist export
  app.post('/api/projects/:projectId/export/spice', requireProjectOwnership, payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const circuits = await storage.getCircuitDesigns(projectId);
    if (circuits.length === 0) { return res.status(404).json({ message: 'No circuit designs found' }); }

    const analysisType = (req.body.analysisType as string) || 'op';
    const data = await gatherCircuitData(storage, circuits[0].id);
    if (!data) { return res.status(404).json({ message: 'Circuit data not found' }); }

    const { exportSpiceNetlist } = await import('../export/spice-exporter');
    const result = exportSpiceNetlist({
      circuitName: circuits[0].name,
      instances: data.instances,
      nets: data.nets,
      parts: data.parts,
      config: {
        analysis: analysisType as 'op' | 'tran' | 'ac' | 'dc',
        transient: req.body.transient,
        ac: req.body.ac,
        dcSweep: req.body.dcSweep,
        temperature: req.body.temperature,
      },
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.netlist);
  }));

  // POST /api/projects/:projectId/circuits/:circuitId/analyze/power -- power estimation (13.10)
  app.post('/api/projects/:projectId/circuits/:circuitId/analyze/power', requireProjectOwnership, payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const circuit = await storage.getCircuitDesign(circuitId);
    if (!circuit) { return res.status(404).json({ message: 'Circuit design not found' }); }

    const data = await gatherCircuitData(storage, circuitId);
    if (!data) { return res.status(404).json({ message: 'Circuit data not found' }); }

    // Generate netlist and run DC OP
    const { exportSpiceNetlist } = await import('../export/spice-exporter');
    const spiceResult = exportSpiceNetlist({
      circuitName: circuit.name,
      instances: data.instances,
      nets: data.nets,
      parts: data.parts,
      config: { analysis: 'op' },
    });

    const { runSimulation } = await import('../simulation');
    const simResult = await runSimulation({
      netlist: spiceResult.netlist,
      analysisType: 'op',
      timeout: 10000,
    });

    if (!simResult.success || !simResult.nodeVoltages) {
      return res.status(422).json({
        message: 'DC operating point simulation failed — cannot estimate power',
        error: simResult.error,
      });
    }

    // Calculate per-component power
    const powerBreakdown: Array<{
      refDes: string;
      partName: string;
      voltage: number;
      current: number;
      power: number;
    }> = [];

    let totalPower = 0;

    for (const inst of data.instances) {
      const part = data.parts.find(p => p.id === inst.partId);
      const meta = (part?.meta ?? {}) as Record<string, string>;
      const refDes = inst.referenceDesignator;

      // Look for branch current by common naming patterns
      const currentKey = Object.keys(simResult.branchCurrents || {}).find(
        k => k.toLowerCase().includes(refDes.toLowerCase()),
      );

      if (currentKey && simResult.branchCurrents) {
        const current = simResult.branchCurrents[currentKey];
        const absCurrent = Math.abs(current);

        powerBreakdown.push({
          refDes,
          partName: meta.title || 'Unknown',
          voltage: 0, // Would need node resolution for exact value
          current: absCurrent,
          power: 0, // Will be computed below
        });
      }
    }

    // Sum voltage source power (actual power delivery)
    const voltageSources = Object.entries(simResult.branchCurrents || {})
      .filter(([k]) => k.startsWith('v'));

    for (const [key, current] of voltageSources) {
      // Find voltage source value from netlist
      const vMatch = new RegExp(`^(V\\S+)\\s+\\S+\\s+\\S+\\s+(?:DC\\s+)?([-\\d.eE+]+)`, 'im')
        .exec(spiceResult.netlist.split('\n').find(l => l.toLowerCase().startsWith(key.split('#')[0])) || '');
      if (vMatch) {
        const voltage = parseFloat(vMatch[2]);
        const power = Math.abs(voltage * current);
        totalPower += power;

        const existing = powerBreakdown.find(p =>
          key.toLowerCase().includes(p.refDes.toLowerCase()),
        );
        if (existing) {
          existing.voltage = voltage;
          existing.current = Math.abs(current);
          existing.power = power;
        }
      }
    }

    res.json({
      totalPower,
      unit: 'W',
      breakdown: powerBreakdown,
      engineUsed: simResult.engineUsed,
      warnings: spiceResult.warnings,
    });
  }));

  // POST /api/projects/:projectId/circuits/:circuitId/analyze/signal-integrity (13.12)
  app.post('/api/projects/:projectId/circuits/:circuitId/analyze/signal-integrity', requireProjectOwnership, payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const circuit = await storage.getCircuitDesign(circuitId);
    if (!circuit) { return res.status(404).json({ message: 'Circuit design not found' }); }

    const data = await gatherCircuitData(storage, circuitId);
    if (!data) { return res.status(404).json({ message: 'Circuit data not found' }); }

    const warnings: Array<{
      severity: 'info' | 'warning' | 'error';
      rule: string;
      message: string;
      netName?: string;
      refDes?: string;
    }> = [];

    // Check for high-speed signals (> 10 MHz) on long traces
    const pcbWires = data.wires.filter(w => w.view === 'pcb');

    // Check for unmatched impedance on bus signals
    for (const net of data.nets) {
      const netType = net.netType as string;
      const segments = (net.segments ?? []) as Array<{
        fromInstanceId: number; fromPin: string;
        toInstanceId: number; toPin: string;
      }>;

      // Flag high-fanout nets (> 4 connections)
      if (segments.length > 4) {
        warnings.push({
          severity: 'warning',
          rule: 'high-fanout',
          message: `Net "${net.name}" has ${segments.length} connections — consider buffering or adding series termination`,
          netName: net.name,
        });
      }

      // Flag bus nets without proper termination hints
      if (netType === 'bus') {
        warnings.push({
          severity: 'info',
          rule: 'bus-termination',
          message: `Bus net "${net.name}" — verify series/parallel termination for signal integrity`,
          netName: net.name,
        });
      }
    }

    // Check for thin traces on power nets
    for (const wire of pcbWires) {
      const net = data.nets.find(n => n.id === wire.netId);
      if (net && (net.netType === 'power' || net.netType === 'ground')) {
        if (wire.width < 0.5) {
          warnings.push({
            severity: 'warning',
            rule: 'thin-power-trace',
            message: `Power net "${net.name}" has a ${wire.width.toFixed(2)}mm trace — recommend >= 0.5mm for current capacity`,
            netName: net.name,
          });
        }
      }
    }

    // Check for components without bypass capacitors
    const icInstances = data.instances.filter(inst => {
      const part = data.parts.find(p => p.id === inst.partId);
      const meta = (part?.meta ?? {}) as Record<string, string>;
      const family = (meta.family || '').toLowerCase();
      return family === 'ic' || family === 'microcontroller' || family === 'fpga' || family === 'module';
    });

    const capInstances = data.instances.filter(inst => {
      const part = data.parts.find(p => p.id === inst.partId);
      const meta = (part?.meta ?? {}) as Record<string, string>;
      return (meta.family || '').toLowerCase() === 'capacitor';
    });

    for (const ic of icInstances) {
      // Check if any capacitor shares a power net with this IC
      const icNets = new Set<number>();
      for (const net of data.nets) {
        const segments = (net.segments ?? []) as Array<{
          fromInstanceId: number; toInstanceId: number;
        }>;
        if (segments.some(s => s.fromInstanceId === ic.id || s.toInstanceId === ic.id)) {
          if (net.netType === 'power' || net.netType === 'ground') {
            icNets.add(net.id);
          }
        }
      }

      let hasBypassCap = false;
      for (const cap of capInstances) {
        for (const net of data.nets) {
          const segments = (net.segments ?? []) as Array<{
            fromInstanceId: number; toInstanceId: number;
          }>;
          if (icNets.has(net.id) &&
              segments.some(s => s.fromInstanceId === cap.id || s.toInstanceId === cap.id)) {
            hasBypassCap = true;
            break;
          }
        }
        if (hasBypassCap) { break; }
      }

      if (!hasBypassCap) {
        warnings.push({
          severity: 'warning',
          rule: 'missing-bypass-cap',
          message: `${ic.referenceDesignator} has no nearby bypass capacitor on its power pins`,
          refDes: ic.referenceDesignator,
        });
      }
    }

    res.json({
      warnings,
      totalWarnings: warnings.filter(w => w.severity === 'warning').length,
      totalErrors: warnings.filter(w => w.severity === 'error').length,
      totalInfo: warnings.filter(w => w.severity === 'info').length,
    });
  }));
}
