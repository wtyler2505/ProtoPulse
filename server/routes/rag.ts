import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { payloadLimit, HttpError } from './utils';

// ---------------------------------------------------------------------------
// In-memory document store (server-side RAG documents)
// ---------------------------------------------------------------------------

interface RAGServerDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  createdAt: string;
}

const documents = new Map<string, RAGServerDocument>();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(102400), // 100KB max
  source: z.string().min(1).max(500).default('user-upload'),
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerRAGRoutes(app: Express): void {
  // Upload a document
  app.post(
    '/api/rag/documents',
    payloadLimit(150 * 1024), // 150KB payload limit (100KB content + JSON overhead)
    async (_req, res) => {
      const parsed = createDocumentSchema.safeParse(_req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const doc: RAGServerDocument = {
        id,
        title: parsed.data.title,
        content: parsed.data.content,
        source: parsed.data.source,
        createdAt: new Date().toISOString(),
      };

      documents.set(id, doc);
      res.status(201).json(doc);
    },
  );

  // List all documents
  app.get(
    '/api/rag/documents',
    async (_req, res) => {
      const docs = Array.from(documents.values()).map((d) => ({
        id: d.id,
        title: d.title,
        source: d.source,
        createdAt: d.createdAt,
        contentLength: d.content.length,
      }));
      res.json({ data: docs, total: docs.length });
    },
  );

  // Delete a document
  app.delete(
    '/api/rag/documents/:id',
    async (req, res) => {
      const docId = String(req.params.id);
      if (!documents.has(docId)) {
        throw new HttpError('Document not found', 404);
      }

      documents.delete(docId);
      res.status(204).end();
    },
  );
}

// Exposed for testing
export function clearRAGDocuments(): void {
  documents.clear();
}

export function getRAGDocumentCount(): number {
  return documents.size;
}
