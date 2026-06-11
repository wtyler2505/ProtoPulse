import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerSchemaViewerRoutes } from '../routes/schema-viewer';

const mockExecute = vi.fn();

vi.mock('../db', () => ({
  db: {
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  registerSchemaViewerRoutes(app);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr !== null) {
        baseUrl = `http://127.0.0.1:${String(addr.port)}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/schema-viewer/summary', () => {
  it('returns schema summary payload', async () => {
    mockExecute
      .mockResolvedValueOnce({
        rows: [{ schema_name: 'public', table_name: 'projects', row_estimate: '12' }],
      })
      .mockResolvedValueOnce({
        rows: [{ table_name: 'projects', column_name: 'id', data_type: 'integer' }],
      })
      .mockResolvedValueOnce({
        rows: [{
          source_table: 'bom_items',
          source_column: 'project_id',
          target_table: 'projects',
          target_column: 'id',
        }],
      });

    const res = await fetch(`${baseUrl}/api/schema-viewer/summary`);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      tables: Array<{ table: string; rowEstimate: number }>;
      relations: Array<{ sourceTable: string; targetTable: string }>;
    };

    expect(body.ok).toBe(true);
    expect(body.tables[0]?.table).toBe('projects');
    expect(body.tables[0]?.rowEstimate).toBe(12);
    expect(body.relations[0]?.sourceTable).toBe('bom_items');
    expect(body.relations[0]?.targetTable).toBe('projects');
  });
});

