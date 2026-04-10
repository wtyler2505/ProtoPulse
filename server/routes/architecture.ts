import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage, VersionConflictError } from '../storage';
import { insertArchitectureNodeSchema, insertArchitectureEdgeSchema } from '@shared/schema';
import { payloadLimit, parseIdParam, paginationSchema } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { setCacheHeaders } from '../lib/cache-headers';

/** Parse the If-Match header value into a version number, or undefined if absent/invalid. */
function parseIfMatch(header: string | undefined): number | undefined {
  if (!header) { return undefined; }
  const match = /^"?(\d+)"?$/.exec(header.trim());
  return match ? Number(match[1]) : undefined;
}

export function registerArchitectureRoutes(app: Express): void {
  // --- Architecture Nodes ---

  app.get(
    '/api/projects/:id/nodes',
    requireProjectOwnership,
    setCacheHeaders('project_data'),
    async (req, res) => {
      const opts = paginationSchema.safeParse(req.query);
      const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
      const nodes = await storage.getNodes(parseIdParam(req.params.id), pagination);
      res.json({ data: nodes, total: nodes.length });
    },
  );

  app.post(
    '/api/projects/:id/nodes',
    requireProjectOwnership,
    payloadLimit(32 * 1024),
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = insertArchitectureNodeSchema.omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const node = await storage.createNode({ ...parsed.data, projectId });
      res.setHeader('ETag', `"${node.version}"`);
      res.status(201).json(node);
    },
  );

  app.patch(
    '/api/projects/:id/nodes/:nodeId',
    requireProjectOwnership,
    payloadLimit(32 * 1024),
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const nodeId = parseIdParam(req.params.nodeId);
      const parsed = insertArchitectureNodeSchema.partial().omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const expectedVersion = parseIfMatch(req.headers['if-match'] as string | undefined);
      try {
        const updated = await storage.updateNode(nodeId, projectId, parsed.data, expectedVersion);
        if (!updated) {
          return res.status(404).json({ message: 'Node not found' });
        }
        res.setHeader('ETag', `"${updated.version}"`);
        res.json(updated);
      } catch (e) {
        if (e instanceof VersionConflictError) {
          return res.status(409).json({
            error: 'Conflict',
            message: 'Resource was modified by another request. Re-fetch and retry.',
            currentVersion: e.currentVersion,
          });
        }
        throw e;
      }
    },
  );

  app.put(
    '/api/projects/:id/nodes',
    requireProjectOwnership,
    payloadLimit(512 * 1024),
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const nodesArray = z.array(insertArchitectureNodeSchema.omit({ projectId: true })).safeParse(req.body);
      if (!nodesArray.success) {
        return res.status(400).json({ message: fromZodError(nodesArray.error).toString() });
      }
      const nodes = await storage.replaceNodes(
        projectId,
        nodesArray.data.map((n) => ({ ...n, projectId })),
      );
      res.json(nodes);
    },
  );

  // --- Architecture Edges ---

  app.get(
    '/api/projects/:id/edges',
    requireProjectOwnership,
    setCacheHeaders('project_data'),
    async (req, res) => {
      const opts = paginationSchema.safeParse(req.query);
      const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
      const edges = await storage.getEdges(parseIdParam(req.params.id), pagination);
      res.json({ data: edges, total: edges.length });
    },
  );

  app.post(
    '/api/projects/:id/edges',
    requireProjectOwnership,
    payloadLimit(32 * 1024),
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = insertArchitectureEdgeSchema.omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const edge = await storage.createEdge({ ...parsed.data, projectId });
      res.setHeader('ETag', `"${edge.version}"`);
      res.status(201).json(edge);
    },
  );

  app.patch(
    '/api/projects/:id/edges/:edgeId',
    requireProjectOwnership,
    payloadLimit(32 * 1024),
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const edgeId = parseIdParam(req.params.edgeId);
      const parsed = insertArchitectureEdgeSchema.partial().omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const expectedVersion = parseIfMatch(req.headers['if-match'] as string | undefined);
      try {
        const updated = await storage.updateEdge(edgeId, projectId, parsed.data, expectedVersion);
        if (!updated) {
          return res.status(404).json({ message: 'Edge not found' });
        }
        res.setHeader('ETag', `"${updated.version}"`);
        res.json(updated);
      } catch (e) {
        if (e instanceof VersionConflictError) {
          return res.status(409).json({
            error: 'Conflict',
            message: 'Resource was modified by another request. Re-fetch and retry.',
            currentVersion: e.currentVersion,
          });
        }
        throw e;
      }
    },
  );

  app.put(
    '/api/projects/:id/edges',
    requireProjectOwnership,
    payloadLimit(512 * 1024),
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const edgesArray = z.array(insertArchitectureEdgeSchema.omit({ projectId: true })).safeParse(req.body);
      if (!edgesArray.success) {
        return res.status(400).json({ message: fromZodError(edgesArray.error).toString() });
      }
      const edges = await storage.replaceEdges(
        projectId,
        edgesArray.data.map((e) => ({ ...e, projectId })),
      );
      res.json(edges);
    },
  );
}
