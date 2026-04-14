/**
 * Tests for knowledge vault HTTP routes.
 *
 * Exercises the /api/vault/search, /api/vault/note/:slug, /api/vault/mocs
 * endpoints against the real Ars Contexta vault (no mocks — integration
 * style, since the vault on disk is the authoritative test fixture).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { registerKnowledgeVaultRoutes } from '../routes/knowledge-vault';
import { resetVaultIndexForTests } from '../lib/vault-context';

let app: Express;

beforeAll(() => {
  resetVaultIndexForTests();
  app = express();
  registerKnowledgeVaultRoutes(app);
});

describe('GET /api/vault/search', () => {
  it('returns results for a valid technical query', async () => {
    const res = await request(app).get('/api/vault/search?q=esp32%20gpio&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.query).toBe('esp32 gpio');
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.results[0]).toHaveProperty('slug');
    expect(res.body.results[0]).toHaveProperty('title');
    expect(res.body.results[0]).toHaveProperty('score');
  });

  it('rejects missing q param with 400', async () => {
    const res = await request(app).get('/api/vault/search');
    expect(res.status).toBe(400);
  });

  it('rejects limit > 25 with 400', async () => {
    const res = await request(app).get('/api/vault/search?q=test&limit=100');
    expect(res.status).toBe(400);
  });

  it('returns empty results for gibberish', async () => {
    const res = await request(app).get('/api/vault/search?q=xyzqqqzzz-nonsense');
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.count).toBe(0);
  });
});

describe('GET /api/vault/note/:slug', () => {
  it('returns a known MOC note', async () => {
    const res = await request(app).get('/api/vault/note/eda-fundamentals');
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('eda-fundamentals');
    expect(res.body.type).toBe('moc');
    expect(res.body.body).toBeDefined();
    expect(typeof res.body.body).toBe('string');
  });

  it('returns 404 for unknown slug', async () => {
    const res = await request(app).get('/api/vault/note/this-note-does-not-exist-xyz');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/vault/mocs', () => {
  it('returns list of MOCs with metadata', async () => {
    const res = await request(app).get('/api/vault/mocs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.mocs)).toBe(true);
    expect(res.body.count).toBeGreaterThan(5);
    expect(res.body.mocs[0]).toHaveProperty('slug');
    expect(res.body.mocs[0]).toHaveProperty('linkCount');
  });
});
