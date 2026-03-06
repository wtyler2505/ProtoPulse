import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { asyncHandler, payloadLimit, parseIdParam, HttpError } from './utils';
import { requireProjectOwnership } from './auth-middleware';

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
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const orders = await storage.getOrders(projectId);
      res.json({ data: orders, total: orders.length });
    }),
  );

  // Get single order
  app.get(
    '/api/projects/:projectId/orders/:orderId',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const orderId = parseIdParam(req.params.orderId);
      const order = await storage.getOrder(orderId);
      if (!order || order.projectId !== projectId) {
        throw new HttpError('Order not found', 404);
      }
      res.json(order);
    }),
  );

  // Create new order
  app.post(
    '/api/projects/:projectId/orders',
    requireProjectOwnership,
    payloadLimit(64 * 1024),
    asyncHandler(async (req, res) => {
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
    }),
  );

  // Update order
  app.put(
    '/api/projects/:projectId/orders/:orderId',
    requireProjectOwnership,
    payloadLimit(64 * 1024),
    asyncHandler(async (req, res) => {
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
    }),
  );

  // Submit order (transition status to 'submitted')
  app.post(
    '/api/projects/:projectId/orders/:orderId/submit',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
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
    }),
  );

  // Delete order
  app.delete(
    '/api/projects/:projectId/orders/:orderId',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
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
    }),
  );
}
