import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { db } from '../db';
import { storage } from '../storage';
import { asyncHandler, HttpError, parseIdParam, payloadLimit } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { logger } from '../logger';
import { validateSession } from '../auth';
import {
  projects,
  architectureNodes,
  architectureEdges,
  bomItems,
  validationIssues,
  chatMessages,
  historyItems,
  componentParts,
  circuitDesigns,
  circuitInstances,
  circuitNets,
  circuitWires,
  simulationResults,
  aiActions,
} from '@shared/schema';
import type {
  InsertArchitectureNode,
  InsertArchitectureEdge,
  InsertHistoryItem,
  InsertComponentPart,
  InsertCircuitDesign,
  InsertCircuitInstance,
  InsertCircuitNet,
  InsertCircuitWire,
  InsertSimulationResult,
  InsertAiAction,
} from '@shared/schema';

const CURRENT_EXPORT_VERSION = 1;

// 10 MB max for import payloads
const IMPORT_PAYLOAD_MAX = 10 * 1024 * 1024;

// Zod schema for validating imported project data
const importSchema = z.object({
  _exportVersion: z.literal(1),
  _exportedAt: z.string(),
  project: z.object({
    name: z.string().min(1),
    description: z.string().optional().default(''),
  }),
  architectureNodes: z.array(z.object({
    nodeId: z.string(),
    nodeType: z.string(),
    label: z.string(),
    positionX: z.number(),
    positionY: z.number(),
    data: z.unknown().optional().nullable(),
  })).default([]),
  architectureEdges: z.array(z.object({
    edgeId: z.string(),
    source: z.string(),
    target: z.string(),
    label: z.string().optional().nullable(),
    animated: z.boolean().optional().nullable(),
    style: z.unknown().optional().nullable(),
    signalType: z.string().optional().nullable(),
    voltage: z.string().optional().nullable(),
    busWidth: z.number().int().optional().nullable(),
    netName: z.string().optional().nullable(),
  })).default([]),
  bomItems: z.array(z.object({
    partNumber: z.string(),
    manufacturer: z.string(),
    description: z.string(),
    quantity: z.number().int().min(0),
    unitPrice: z.string(),
    totalPrice: z.string(),
    supplier: z.string(),
    stock: z.number().int().min(0),
    status: z.string(),
    leadTime: z.string().optional().nullable(),
  })).default([]),
  validationIssues: z.array(z.object({
    severity: z.enum(['error', 'warning', 'info']),
    message: z.string(),
    componentId: z.string().optional().nullable(),
    suggestion: z.string().optional().nullable(),
  })).default([]),
  chatMessages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    mode: z.string().optional().nullable(),
  })).default([]),
  historyItems: z.array(z.object({
    action: z.string(),
    user: z.string(),
  })).default([]),
  componentParts: z.array(z.object({
    nodeId: z.string().optional().nullable(),
    meta: z.unknown().default({}),
    connectors: z.unknown().default([]),
    buses: z.unknown().default([]),
    views: z.unknown().default({}),
    constraints: z.unknown().default([]),
  })).default([]),
  circuitDesigns: z.array(z.object({
    name: z.string(),
    description: z.string().optional().nullable(),
    settings: z.unknown().default({}),
    instances: z.array(z.object({
      referenceDesignator: z.string(),
      schematicX: z.number(),
      schematicY: z.number(),
      schematicRotation: z.number().default(0),
      breadboardX: z.number().optional().nullable(),
      breadboardY: z.number().optional().nullable(),
      breadboardRotation: z.number().optional().nullable(),
      pcbX: z.number().optional().nullable(),
      pcbY: z.number().optional().nullable(),
      pcbRotation: z.number().optional().nullable(),
      pcbSide: z.string().optional().nullable(),
      properties: z.unknown().default({}),
    })).default([]),
    nets: z.array(z.object({
      name: z.string(),
      netType: z.string().default('signal'),
      voltage: z.string().optional().nullable(),
      busWidth: z.number().int().optional().nullable(),
      segments: z.unknown().default([]),
      labels: z.unknown().default([]),
      style: z.unknown().default({}),
      wires: z.array(z.object({
        view: z.string(),
        points: z.unknown().default([]),
        layer: z.string().optional().nullable(),
        width: z.number().default(1.0),
        color: z.string().optional().nullable(),
        wireType: z.string().optional().nullable(),
      })).default([]),
    })).default([]),
    simulationResults: z.array(z.object({
      analysisType: z.string(),
      config: z.unknown().default({}),
      results: z.unknown().default({}),
      status: z.string().default('completed'),
      engineUsed: z.string().optional().nullable(),
      elapsedMs: z.number().int().optional().nullable(),
      sizeBytes: z.number().int().optional().nullable(),
      error: z.string().optional().nullable(),
    })).default([]),
  })).default([]),
  aiActions: z.array(z.object({
    chatMessageId: z.string().optional().nullable(),
    toolName: z.string(),
    parameters: z.unknown().default({}),
    result: z.unknown().default({}),
    status: z.string().default('completed'),
  })).default([]),
});

export function registerProjectIORoutes(app: Express): void {

  // ---- Export project as JSON file ----

  app.get(
    '/api/projects/:id/export',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);

      const project = await storage.getProject(projectId);
      if (!project) {
        throw new HttpError('Project not found', 404);
      }

      // Gather all project data in parallel
      const [
        nodes,
        edges,
        bom,
        issues,
        messages,
        history,
        parts,
        circuits,
        actions,
      ] = await Promise.all([
        storage.getNodes(projectId),
        storage.getEdges(projectId),
        storage.getBomItems(projectId),
        storage.getValidationIssues(projectId),
        storage.getChatMessages(projectId),
        storage.getHistoryItems(projectId),
        storage.getComponentParts(projectId),
        storage.getCircuitDesigns(projectId),
        storage.getAiActions(projectId),
      ]);

      // For each circuit design, fetch instances, nets, wires, and simulation results
      const circuitData = await Promise.all(
        circuits.map(async (circuit) => {
          const [instances, nets, simResults] = await Promise.all([
            storage.getCircuitInstances(circuit.id),
            storage.getCircuitNets(circuit.id),
            storage.getSimulationResults(circuit.id),
          ]);

          // For each net, fetch its wires
          const netsWithWires = await Promise.all(
            nets.map(async (net) => {
              const wires = await storage.getCircuitWires(circuit.id);
              // Filter wires belonging to this net
              const netWires = wires.filter((w) => w.netId === net.id);
              return {
                name: net.name,
                netType: net.netType,
                voltage: net.voltage,
                busWidth: net.busWidth,
                segments: net.segments,
                labels: net.labels,
                style: net.style,
                wires: netWires.map((w) => ({
                  view: w.view,
                  points: w.points,
                  layer: w.layer,
                  width: w.width,
                  color: w.color,
                  wireType: w.wireType,
                })),
              };
            }),
          );

          return {
            name: circuit.name,
            description: circuit.description,
            settings: circuit.settings,
            instances: instances.map((inst) => ({
              referenceDesignator: inst.referenceDesignator,
              schematicX: inst.schematicX,
              schematicY: inst.schematicY,
              schematicRotation: inst.schematicRotation,
              breadboardX: inst.breadboardX,
              breadboardY: inst.breadboardY,
              breadboardRotation: inst.breadboardRotation,
              pcbX: inst.pcbX,
              pcbY: inst.pcbY,
              pcbRotation: inst.pcbRotation,
              pcbSide: inst.pcbSide,
              properties: inst.properties,
            })),
            nets: netsWithWires,
            simulationResults: simResults.map((sr) => ({
              analysisType: sr.analysisType,
              config: sr.config,
              results: sr.results,
              status: sr.status,
              engineUsed: sr.engineUsed,
              elapsedMs: sr.elapsedMs,
              sizeBytes: sr.sizeBytes,
              error: sr.error,
            })),
          };
        }),
      );

      const exportData = {
        _exportVersion: CURRENT_EXPORT_VERSION,
        _exportedAt: new Date().toISOString(),
        project: {
          name: project.name,
          description: project.description,
        },
        architectureNodes: nodes.map((n) => ({
          nodeId: n.nodeId,
          nodeType: n.nodeType,
          label: n.label,
          positionX: n.positionX,
          positionY: n.positionY,
          data: n.data,
        })),
        architectureEdges: edges.map((e) => ({
          edgeId: e.edgeId,
          source: e.source,
          target: e.target,
          label: e.label,
          animated: e.animated,
          style: e.style,
          signalType: e.signalType,
          voltage: e.voltage,
          busWidth: e.busWidth,
          netName: e.netName,
        })),
        bomItems: bom.map((b) => ({
          partNumber: b.partNumber,
          manufacturer: b.manufacturer,
          description: b.description,
          quantity: b.quantity,
          unitPrice: b.unitPrice,
          totalPrice: b.totalPrice,
          supplier: b.supplier,
          stock: b.stock,
          status: b.status,
          leadTime: b.leadTime,
        })),
        validationIssues: issues.map((i) => ({
          severity: i.severity,
          message: i.message,
          componentId: i.componentId,
          suggestion: i.suggestion,
        })),
        chatMessages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          mode: m.mode,
        })),
        historyItems: history.map((h) => ({
          action: h.action,
          user: h.user,
        })),
        componentParts: parts.map((p) => ({
          nodeId: p.nodeId,
          meta: p.meta,
          connectors: p.connectors,
          buses: p.buses,
          views: p.views,
          constraints: p.constraints,
        })),
        circuitDesigns: circuitData,
        aiActions: actions.map((a) => ({
          chatMessageId: a.chatMessageId,
          toolName: a.toolName,
          parameters: a.parameters,
          result: a.result,
          status: a.status,
        })),
      };

      // Sanitize the project name for the filename
      const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="project-${safeName}.json"`);
      res.json(exportData);
    }),
  );

  // ---- Import project from JSON ----

  app.post(
    '/api/projects/import',
    payloadLimit(IMPORT_PAYLOAD_MAX),
    asyncHandler(async (req, res) => {
      const sessionId = req.headers['x-session-id'] as string | undefined;
      if (!sessionId) {
        throw new HttpError('Authentication required', 401);
      }

      const session = await validateSession(sessionId);
      if (!session) {
        throw new HttpError('Invalid or expired session', 401);
      }

      const parsed = importSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(fromZodError(parsed.error).toString(), 400);
      }

      const data = parsed.data;

      logger.info('project-io:import:start', { name: data.project.name });

      // Use a transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // 1. Create the project
        const [newProject] = await tx
          .insert(projects)
          .values({
            name: data.project.name,
            description: data.project.description,
            ownerId: session.userId,
          })
          .returning();

        const projectId = newProject.id;

        // 2. Insert architecture nodes
        if (data.architectureNodes.length > 0) {
          const nodeInserts: InsertArchitectureNode[] = data.architectureNodes.map((n) => ({
            projectId,
            nodeId: n.nodeId,
            nodeType: n.nodeType,
            label: n.label,
            positionX: n.positionX,
            positionY: n.positionY,
            data: n.data as Record<string, unknown> | null | undefined,
          }));
          await tx.insert(architectureNodes).values(nodeInserts);
        }

        // 3. Insert architecture edges
        if (data.architectureEdges.length > 0) {
          const edgeInserts: InsertArchitectureEdge[] = data.architectureEdges.map((e) => ({
            projectId,
            edgeId: e.edgeId,
            source: e.source,
            target: e.target,
            label: e.label ?? undefined,
            animated: e.animated ?? undefined,
            style: e.style as Record<string, unknown> | null | undefined,
            signalType: e.signalType ?? undefined,
            voltage: e.voltage ?? undefined,
            busWidth: e.busWidth ?? undefined,
            netName: e.netName ?? undefined,
          }));
          await tx.insert(architectureEdges).values(edgeInserts);
        }

        // 4. Insert BOM items
        if (data.bomItems.length > 0) {
          const bomInserts = data.bomItems.map((b) => ({
            projectId,
            partNumber: b.partNumber,
            manufacturer: b.manufacturer,
            description: b.description,
            quantity: b.quantity,
            unitPrice: b.unitPrice,
            totalPrice: b.totalPrice,
            supplier: b.supplier,
            stock: b.stock,
            status: b.status,
            leadTime: b.leadTime ?? undefined,
          }));
          await tx.insert(bomItems).values(bomInserts);
        }

        // 5. Insert validation issues
        if (data.validationIssues.length > 0) {
          const issueInserts = data.validationIssues.map((i) => ({
            projectId,
            severity: i.severity as 'error' | 'warning' | 'info',
            message: i.message,
            componentId: i.componentId ?? undefined,
            suggestion: i.suggestion ?? undefined,
          }));
          await tx.insert(validationIssues).values(issueInserts);
        }

        // 6. Insert chat messages
        if (data.chatMessages.length > 0) {
          const msgInserts = data.chatMessages.map((m) => ({
            projectId,
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
            mode: m.mode ?? undefined,
          }));
          await tx.insert(chatMessages).values(msgInserts);
        }

        // 7. Insert history items
        if (data.historyItems.length > 0) {
          const histInserts: InsertHistoryItem[] = data.historyItems.map((h) => ({
            projectId,
            action: h.action,
            user: h.user,
          }));
          await tx.insert(historyItems).values(histInserts);
        }

        // 8. Insert component parts (build a map of old index -> new id for circuit instance linking)
        const componentPartIdMap = new Map<number, number>();
        if (data.componentParts.length > 0) {
          const partInserts: InsertComponentPart[] = data.componentParts.map((p) => ({
            projectId,
            nodeId: p.nodeId ?? undefined,
            meta: p.meta as Record<string, unknown>,
            connectors: p.connectors as unknown[],
            buses: p.buses as unknown[],
            views: p.views as Record<string, unknown>,
            constraints: p.constraints as unknown[],
          }));
          const insertedParts = await tx.insert(componentParts).values(partInserts).returning();
          insertedParts.forEach((part, idx) => {
            componentPartIdMap.set(idx, part.id);
          });
        }

        // 9. Insert circuit designs with their nested data
        for (const circuit of data.circuitDesigns) {
          const [newCircuit] = await tx
            .insert(circuitDesigns)
            .values({
              projectId,
              name: circuit.name,
              description: circuit.description ?? undefined,
              settings: circuit.settings as Record<string, unknown>,
            } satisfies InsertCircuitDesign)
            .returning();

          const circuitId = newCircuit.id;

          // Insert instances
          if (circuit.instances.length > 0) {
            const instInserts: InsertCircuitInstance[] = circuit.instances.map((inst) => ({
              circuitId,
              referenceDesignator: inst.referenceDesignator,
              schematicX: inst.schematicX,
              schematicY: inst.schematicY,
              schematicRotation: inst.schematicRotation,
              breadboardX: inst.breadboardX ?? undefined,
              breadboardY: inst.breadboardY ?? undefined,
              breadboardRotation: inst.breadboardRotation ?? undefined,
              pcbX: inst.pcbX ?? undefined,
              pcbY: inst.pcbY ?? undefined,
              pcbRotation: inst.pcbRotation ?? undefined,
              pcbSide: inst.pcbSide ?? undefined,
              properties: inst.properties as Record<string, unknown>,
            }));
            await tx.insert(circuitInstances).values(instInserts);
          }

          // Insert nets and their wires
          for (const net of circuit.nets) {
            const [newNet] = await tx
              .insert(circuitNets)
              .values({
                circuitId,
                name: net.name,
                netType: net.netType,
                voltage: net.voltage ?? undefined,
                busWidth: net.busWidth ?? undefined,
                segments: net.segments as unknown[],
                labels: net.labels as unknown[],
                style: net.style as Record<string, unknown>,
              } satisfies InsertCircuitNet)
              .returning();

            if (net.wires.length > 0) {
              const wireInserts: InsertCircuitWire[] = net.wires.map((w) => ({
                circuitId,
                netId: newNet.id,
                view: w.view,
                points: w.points as unknown[],
                layer: w.layer ?? undefined,
                width: w.width,
                color: w.color ?? undefined,
                wireType: w.wireType ?? undefined,
              }));
              await tx.insert(circuitWires).values(wireInserts);
            }
          }

          // Insert simulation results
          if (circuit.simulationResults.length > 0) {
            const simInserts: InsertSimulationResult[] = circuit.simulationResults.map((sr) => ({
              circuitId,
              analysisType: sr.analysisType,
              config: sr.config as Record<string, unknown>,
              results: sr.results as Record<string, unknown>,
              status: sr.status,
              engineUsed: sr.engineUsed ?? undefined,
              elapsedMs: sr.elapsedMs ?? undefined,
              sizeBytes: sr.sizeBytes ?? undefined,
              error: sr.error ?? undefined,
            }));
            await tx.insert(simulationResults).values(simInserts);
          }
        }

        // 10. Insert AI actions
        if (data.aiActions.length > 0) {
          const actionInserts: InsertAiAction[] = data.aiActions.map((a) => ({
            projectId,
            chatMessageId: a.chatMessageId ?? undefined,
            toolName: a.toolName,
            parameters: a.parameters as Record<string, unknown>,
            result: a.result as Record<string, unknown>,
            status: a.status,
          }));
          await tx.insert(aiActions).values(actionInserts);
        }

        return newProject;
      });

      logger.info('project-io:import:complete', { projectId: result.id, name: result.name });

      res.status(201).json({ projectId: result.id, name: result.name });
    }),
  );
}
