import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { payloadLimit, parseIdParam, HttpError } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { gatherCircuitData, DEFAULT_BOARD_WIDTH, DEFAULT_BOARD_HEIGHT } from '../circuit-routes/utils';

const VALID_FABRICATORS = ['jlcpcb', 'pcbway', 'oshpark', 'pcbgogo', 'seeed'] as const;
const VALID_STATUSES = ['draft', 'dfm-check', 'quoting', 'ready', 'submitted', 'processing', 'shipped', 'delivered', 'error'] as const;

const createOrderSchema = z.object({
  fabricatorId: z.enum(VALID_FABRICATORS),
  boardSpec: z.record(z.unknown()),
  quantity: z.number().int().min(1).max(100000).default(5),
  turnaround: z.enum(['standard', 'express', 'rush']).default('standard'),
  status: z.enum(VALID_STATUSES).default('draft'),
  quoteData: z.record(z.unknown()).nullish(),
  fabOrderNumber: z.string().max(100).nullish(),
  trackingNumber: z.string().max(100).nullish(),
  notes: z.string().max(5000).nullish(),
});

const updateOrderSchema = z.object({
  fabricatorId: z.enum(VALID_FABRICATORS).optional(),
  boardSpec: z.record(z.unknown()).optional(),
  quantity: z.number().int().min(1).max(100000).optional(),
  turnaround: z.enum(['standard', 'express', 'rush']).optional(),
  status: z.enum(VALID_STATUSES).optional(),
  quoteData: z.record(z.unknown()).nullish(),
  fabOrderNumber: z.string().max(100).nullish(),
  trackingNumber: z.string().max(100).nullish(),
  notes: z.string().max(5000).nullish(),
});

export function registerOrderingRoutes(app: Express): void {
  // List orders for a project
  app.get(
    '/api/projects/:projectId/orders',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const orders = await storage.getOrders(projectId);
      res.json({ data: orders, total: orders.length });
    },
  );

  // Get single order
  app.get(
    '/api/projects/:projectId/orders/:orderId',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const orderId = parseIdParam(req.params.orderId);
      const order = await storage.getOrder(orderId);
      if (!order || order.projectId !== projectId) {
        throw new HttpError('Order not found', 404);
      }
      res.json(order);
    },
  );

  // Create new order
  app.post(
    '/api/projects/:projectId/orders',
    requireProjectOwnership,
    payloadLimit(64 * 1024),
    async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      const order = await storage.createOrder({
        projectId,
        fabricatorId: parsed.data.fabricatorId,
        boardSpec: parsed.data.boardSpec,
        quantity: parsed.data.quantity,
        turnaround: parsed.data.turnaround,
        status: parsed.data.status,
        quoteData: parsed.data.quoteData ?? null,
        fabOrderNumber: parsed.data.fabOrderNumber ?? null,
        trackingNumber: parsed.data.trackingNumber ?? null,
        notes: parsed.data.notes ?? null,
      });
      res.status(201).json(order);
    },
  );

  // Update order
  app.put(
    '/api/projects/:projectId/orders/:orderId',
    requireProjectOwnership,
    payloadLimit(64 * 1024),
    async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const orderId = parseIdParam(req.params.orderId);

      const parsed = updateOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      // Verify the order belongs to this project
      const existing = await storage.getOrder(orderId);
      if (!existing || existing.projectId !== projectId) {
        throw new HttpError('Order not found', 404);
      }

      const updated = await storage.updateOrder(orderId, parsed.data);
      if (!updated) {
        throw new HttpError('Order not found', 404);
      }
      res.json(updated);
    },
  );

  // Submit order (transition status to 'submitted')
  app.post(
    '/api/projects/:projectId/orders/:orderId/submit',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const orderId = parseIdParam(req.params.orderId);

      const existing = await storage.getOrder(orderId);
      if (!existing || existing.projectId !== projectId) {
        throw new HttpError('Order not found', 404);
      }

      if (existing.status !== 'ready') {
        throw new HttpError(`Cannot submit order with status "${existing.status}". Order must be in "ready" status.`, 400);
      }

      const updated = await storage.updateOrder(orderId, {
        status: 'submitted',
        submittedAt: new Date(),
      });
      if (!updated) {
        throw new HttpError('Order not found', 404);
      }
      res.json(updated);
    },
  );

  // Generate Gerber files and attach to an order
  app.post(
    '/api/projects/:projectId/orders/:orderId/generate-gerbers',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const orderId = parseIdParam(req.params.orderId);

      const existing = await storage.getOrder(orderId);
      if (!existing || existing.projectId !== projectId) {
        throw new HttpError('Order not found', 404);
      }

      // Get the first circuit design for this project
      const circuits = await storage.getCircuitDesigns(projectId);
      if (circuits.length === 0) {
        throw new HttpError('No circuit designs found for this project', 404);
      }

      const data = await gatherCircuitData(storage, circuits[0].id);
      if (!data) {
        throw new HttpError('Circuit data not found', 404);
      }

      // Read board dimensions from circuit settings or use defaults
      const settings = (circuits[0].settings ?? {}) as Record<string, unknown>;
      const boardWidth = typeof settings.pcbBoardWidth === 'number' && settings.pcbBoardWidth > 0
        ? settings.pcbBoardWidth / 10 // SVG units → mm
        : DEFAULT_BOARD_WIDTH;
      const boardHeight = typeof settings.pcbBoardHeight === 'number' && settings.pcbBoardHeight > 0
        ? settings.pcbBoardHeight / 10 // SVG units → mm
        : DEFAULT_BOARD_HEIGHT;

      const { generateGerber } = await import('../export/gerber-generator');
      const pcbWires = data.wires.filter((w) => w.view === 'pcb');

      const gerberOutput = generateGerber({
        boardWidth,
        boardHeight,
        instances: data.instances.map((i) => {
          const part = i.partId != null ? data.partsMap.get(i.partId) : undefined;
          const meta = ((part?.meta ?? {}) as Record<string, unknown>);
          return {
            id: i.id,
            referenceDesignator: i.referenceDesignator,
            pcbX: i.pcbX ?? 0,
            pcbY: i.pcbY ?? 0,
            pcbRotation: i.pcbRotation ?? 0,
            pcbSide: i.pcbSide ?? 'front',
            connectors: ((part?.connectors ?? []) as Array<{ id: string; name: string; padType?: string; padWidth?: number; padHeight?: number }>),
            footprint: (meta.package as string) || '',
          };
        }),
        wires: pcbWires.map((w) => ({
          layer: w.layer ?? 'front',
          points: (w.points ?? []) as Array<{ x: number; y: number }>,
          width: w.width,
        })),
      });

      // Build file ID list from generated layers + drill
      const gerberFileIds: string[] = gerberOutput.layers.map((l) => {
        const filename = `${l.name.replace(/\./g, '_')}.gbr`;
        return filename;
      });
      gerberFileIds.push('drill.drl');

      // Store Gerber data in the order's boardSpec alongside existing spec data
      const existingSpec = (existing.boardSpec ?? {}) as Record<string, unknown>;
      const updatedBoardSpec = {
        ...existingSpec,
        gerberData: {
          layers: gerberOutput.layers.map((l) => ({
            name: l.name,
            type: l.type,
            side: l.side,
            filename: `${l.name.replace(/\./g, '_')}.gbr`,
            content: l.content,
          })),
          drill: {
            filename: 'drill.drl',
            content: gerberOutput.drillFile,
          },
          generatedAt: new Date().toISOString(),
        },
        gerberFileIds,
      };

      const updated = await storage.updateOrder(orderId, {
        boardSpec: updatedBoardSpec,
        status: existing.status === 'draft' ? 'ready' : existing.status,
      });

      if (!updated) {
        throw new HttpError('Failed to update order', 500);
      }

      res.json({
        message: `Generated ${gerberOutput.layers.length} Gerber layers + drill file`,
        gerberFileIds,
        layerCount: gerberOutput.layers.length,
        order: updated,
      });
    },
  );

  // Delete order
  app.delete(
    '/api/projects/:projectId/orders/:orderId',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const orderId = parseIdParam(req.params.orderId);

      // Verify the order belongs to this project before deleting
      const existing = await storage.getOrder(orderId);
      if (!existing || existing.projectId !== projectId) {
        throw new HttpError('Order not found', 404);
      }

      const deleted = await storage.deleteOrder(orderId);
      if (!deleted) {
        throw new HttpError('Order not found', 404);
      }
      res.status(204).end();
    },
  );
}
