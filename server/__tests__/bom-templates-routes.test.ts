/**
 * Tests for BOM template routes (Phase 7.6).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';

const {
  mockGetTemplates,
  mockGetTemplateWithItems,
  mockCreateTemplate,
  mockAddItems,
  mockUpdateTemplate,
  mockDeleteTemplate,
  mockIsProjectOwner,
  mockGetStock,
  mockUpsertStock,
} = vi.hoisted(() => ({
  mockGetTemplates: vi.fn(),
  mockGetTemplateWithItems: vi.fn(),
  mockCreateTemplate: vi.fn(),
  mockAddItems: vi.fn(),
  mockUpdateTemplate: vi.fn(),
  mockDeleteTemplate: vi.fn(),
  mockIsProjectOwner: vi.fn(),
  mockGetStock: vi.fn(),
  mockUpsertStock: vi.fn(),
}));

vi.mock('../storage', () => ({
  bomTemplateStorage: {
    getTemplates: mockGetTemplates,
    getTemplateWithItems: mockGetTemplateWithItems,
    createTemplate: mockCreateTemplate,
    addItems: mockAddItems,
    updateTemplate: mockUpdateTemplate,
    deleteTemplate: mockDeleteTemplate,
  },
  partsStorage: {
    getStock: mockGetStock,
    upsertStock: mockUpsertStock,
  },
  storage: {
    isProjectOwner: mockIsProjectOwner,
  },
  StorageError: class StorageError extends Error {},
}));

vi.mock('../auth', () => ({
  validateSession: vi.fn().mockImplementation((req: Record<string, unknown>, _res: Record<string, unknown>, next: () => void) => {
    req.session = { userId: 1, sessionId: 'test-session' };
    next();
  }),
}));

vi.mock('../db', () => ({ db: {} }));
vi.mock('../parts-ingress', () => ({ ingressPart: vi.fn() }));
vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { registerBomTemplateRoutes } from '../routes/bom-templates';

function makeApp() {
  const app = express();
  app.use(express.json());
  registerBomTemplateRoutes(app);
  return app;
}

async function listen(app: ReturnType<typeof express>) {
  return new Promise<{ url: string; close: () => void }>((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

const SAMPLE_TEMPLATE = {
  id: 'tmpl-1',
  userId: 1,
  name: 'My Resistor Kit',
  description: 'Standard resistors',
  tags: ['resistors'],
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const PART_ID = '11111111-1111-1111-1111-111111111111';

describe('BOM Template Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTemplates.mockResolvedValue([SAMPLE_TEMPLATE]);
    mockCreateTemplate.mockResolvedValue(SAMPLE_TEMPLATE);
    mockAddItems.mockResolvedValue(2);
    mockGetTemplateWithItems.mockResolvedValue({
      ...SAMPLE_TEMPLATE,
      items: [{ id: 'item-1', templateId: 'tmpl-1', partId: PART_ID, quantityNeeded: 10, unitPrice: '0.01', supplier: 'LCSC', notes: null, partTitle: '10K Resistor', partMpn: 'RC0402' }],
    });
    mockUpdateTemplate.mockResolvedValue(SAMPLE_TEMPLATE);
    mockDeleteTemplate.mockResolvedValue(true);
    mockIsProjectOwner.mockResolvedValue(true);
    mockGetStock.mockResolvedValue(undefined);
    mockUpsertStock.mockResolvedValue({ id: 'stock-1' });
  });

  it('GET /api/bom-templates returns user templates', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/bom-templates`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('My Resistor Kit');
    } finally {
      close();
    }
  });

  it('POST /api/bom-templates creates a template with items', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/bom-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'My Resistor Kit',
          items: [
            { partId: PART_ID, quantityNeeded: 10, unitPrice: 0.01, supplier: 'LCSC' },
          ],
        }),
      });
      expect(res.status).toBe(201);
      expect(mockCreateTemplate).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Resistor Kit', userId: 1 }));
      expect(mockAddItems).toHaveBeenCalled();
    } finally {
      close();
    }
  });

  it('POST /api/bom-templates returns 400 for empty items', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/bom-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Empty', items: [] }),
      });
      expect(res.status).toBe(400);
    } finally {
      close();
    }
  });

  it('GET /api/bom-templates/:id returns template with items', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/bom-templates/tmpl-1`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].partTitle).toBe('10K Resistor');
    } finally {
      close();
    }
  });

  it('DELETE /api/bom-templates/:id soft-deletes template', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/bom-templates/tmpl-1`, { method: 'DELETE' });
      expect(res.status).toBe(204);
      expect(mockDeleteTemplate).toHaveBeenCalledWith('tmpl-1', 1);
    } finally {
      close();
    }
  });

  it('POST /api/bom-templates/:id/apply creates stock rows', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/bom-templates/tmpl-1/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 1 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.created).toBe(1);
      expect(mockUpsertStock).toHaveBeenCalled();
    } finally {
      close();
    }
  });

  it('POST /api/bom-templates/:id/apply returns 403 for non-owner', async () => {
    mockIsProjectOwner.mockResolvedValue(false);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/bom-templates/tmpl-1/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 1 }),
      });
      expect(res.status).toBe(403);
    } finally {
      close();
    }
  });

  it('POST /api/bom-templates/:id/apply skips existing stock', async () => {
    mockGetStock.mockResolvedValue({ id: 'existing' });
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/bom-templates/tmpl-1/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 1 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.created).toBe(0);
      expect(body.skipped).toBe(1);
    } finally {
      close();
    }
  });
});
