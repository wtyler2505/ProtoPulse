import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerRAGRoutes, clearRAGDocuments, getRAGDocumentCount } from '../routes/rag';

// ---------------------------------------------------------------------------
// Test server setup
// ---------------------------------------------------------------------------

let app: express.Express;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  app = express();
  app.use(express.json({ limit: '150kb' }));
  registerRAGRoutes(app);

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
    server.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
});

beforeEach(() => {
  clearRAGDocuments();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function postDocument(body: Record<string, unknown>): Promise<Response> {
  return fetch(`${baseUrl}/api/rag/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function getDocuments(): Promise<Response> {
  return fetch(`${baseUrl}/api/rag/documents`);
}

async function deleteDocument(id: string): Promise<Response> {
  return fetch(`${baseUrl}/api/rag/documents/${id}`, { method: 'DELETE' });
}

// ===========================================================================
// POST /api/rag/documents
// ===========================================================================

describe('POST /api/rag/documents', () => {
  it('creates a document with valid payload', async () => {
    const res = await postDocument({
      title: 'Test Document',
      content: 'This is some test content about electronics.',
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; title: string; content: string; source: string; createdAt: string };
    expect(body.id).toBeTruthy();
    expect(body.title).toBe('Test Document');
    expect(body.content).toBe('This is some test content about electronics.');
    expect(body.source).toBe('user-upload');
    expect(body.createdAt).toBeTruthy();
  });

  it('creates a document with custom source', async () => {
    const res = await postDocument({
      title: 'Custom Source',
      content: 'Content here.',
      source: 'datasheet',
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { source: string };
    expect(body.source).toBe('datasheet');
  });

  it('rejects empty title', async () => {
    const res = await postDocument({
      title: '',
      content: 'Some content',
    });
    expect(res.status).toBe(400);
  });

  it('rejects empty content', async () => {
    const res = await postDocument({
      title: 'Valid Title',
      content: '',
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing title', async () => {
    const res = await postDocument({
      content: 'Some content',
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing content', async () => {
    const res = await postDocument({
      title: 'Valid Title',
    });
    expect(res.status).toBe(400);
  });

  it('rejects content exceeding 100KB', async () => {
    const res = await postDocument({
      title: 'Large Doc',
      content: 'x'.repeat(102401),
    });
    expect(res.status).toBe(400);
  });

  it('rejects title exceeding 200 chars', async () => {
    const res = await postDocument({
      title: 'T'.repeat(201),
      content: 'Valid content',
    });
    expect(res.status).toBe(400);
  });

  it('accepts content at exactly 100KB', async () => {
    const res = await postDocument({
      title: 'Max Size Doc',
      content: 'x'.repeat(102400),
    });
    expect(res.status).toBe(201);
  });

  it('increments document count', async () => {
    expect(getRAGDocumentCount()).toBe(0);
    await postDocument({ title: 'Doc 1', content: 'Content 1' });
    expect(getRAGDocumentCount()).toBe(1);
    await postDocument({ title: 'Doc 2', content: 'Content 2' });
    expect(getRAGDocumentCount()).toBe(2);
  });
});

// ===========================================================================
// GET /api/rag/documents
// ===========================================================================

describe('GET /api/rag/documents', () => {
  it('returns empty list when no documents', async () => {
    const res = await getDocuments();
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('returns all documents', async () => {
    await postDocument({ title: 'Doc 1', content: 'Content 1' });
    await postDocument({ title: 'Doc 2', content: 'Content 2' });
    const res = await getDocuments();
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: string; title: string }>; total: number };
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('returns document metadata without full content', async () => {
    await postDocument({ title: 'Metadata Test', content: 'Some long content here' });
    const res = await getDocuments();
    const body = await res.json() as { data: Array<{ contentLength: number; title: string }> };
    expect(body.data[0].title).toBe('Metadata Test');
    expect(body.data[0].contentLength).toBe('Some long content here'.length);
    // Full content should NOT be in the list response
    expect((body.data[0] as Record<string, unknown>).content).toBeUndefined();
  });
});

// ===========================================================================
// DELETE /api/rag/documents/:id
// ===========================================================================

describe('DELETE /api/rag/documents/:id', () => {
  it('deletes an existing document', async () => {
    const createRes = await postDocument({ title: 'To Delete', content: 'Content' });
    const created = await createRes.json() as { id: string };

    const res = await deleteDocument(created.id);
    expect(res.status).toBe(204);
    expect(getRAGDocumentCount()).toBe(0);
  });

  it('returns 404 for non-existent document', async () => {
    const res = await deleteDocument('non-existent-id');
    expect(res.status).toBe(404);
  });

  it('cannot delete same document twice', async () => {
    const createRes = await postDocument({ title: 'Delete Twice', content: 'Content' });
    const created = await createRes.json() as { id: string };

    await deleteDocument(created.id);
    const secondDelete = await deleteDocument(created.id);
    expect(secondDelete.status).toBe(404);
  });

  it('only removes the targeted document', async () => {
    const res1 = await postDocument({ title: 'Keep', content: 'Content 1' });
    const res2 = await postDocument({ title: 'Remove', content: 'Content 2' });
    const doc2 = await res2.json() as { id: string };
    await res1.json();

    await deleteDocument(doc2.id);
    expect(getRAGDocumentCount()).toBe(1);

    const listRes = await getDocuments();
    const body = await listRes.json() as { data: Array<{ title: string }> };
    expect(body.data[0].title).toBe('Keep');
  });
});

// ===========================================================================
// clearRAGDocuments (test utility)
// ===========================================================================

describe('clearRAGDocuments', () => {
  it('removes all documents', async () => {
    await postDocument({ title: 'Doc 1', content: 'C1' });
    await postDocument({ title: 'Doc 2', content: 'C2' });
    expect(getRAGDocumentCount()).toBe(2);
    clearRAGDocuments();
    expect(getRAGDocumentCount()).toBe(0);
  });
});
