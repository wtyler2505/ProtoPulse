/**
 * Public API + Webhook Platform
 *
 * Manages a catalog of 20+ public API endpoints, webhook CRUD with event
 * triggering, HMAC signature generation, delivery tracking with retry,
 * API key generation, and OpenAPI 3.1.0 spec generation.
 * Singleton with localStorage persistence and subscription-based reactivity.
 *
 * Usage:
 *   const api = PublicApiManager.getInstance();
 *   const key = api.generateApiKey({ name: 'My Integration' });
 *   const hook = api.createWebhook({ url: 'https://example.com/hook', events: ['project.updated'] });
 *   api.triggerEvent('project.updated', { projectId: '1' });
 *
 * React hook:
 *   const { endpoints, webhooks, apiKeys, triggerEvent } = usePublicApi();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type EndpointCategory = 'projects' | 'architecture' | 'bom' | 'circuit' | 'simulation' | 'export' | 'ai' | 'admin';
export type WebhookStatus = 'active' | 'paused' | 'disabled';
export type DeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

export interface ApiEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  category: EndpointCategory;
  parameters: ApiParameter[];
  requestBody: ApiSchema | null;
  responses: Record<string, ApiResponse>;
  requiresAuth: boolean;
  rateLimit: number; // requests per minute
  tags: string[];
}

export interface ApiParameter {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  type: string;
  description: string;
  example?: string;
}

export interface ApiSchema {
  type: string;
  properties: Record<string, ApiSchemaProperty>;
  required: string[];
}

export interface ApiSchemaProperty {
  type: string;
  description: string;
  example?: unknown;
  items?: { type: string };
  enum?: string[];
}

export interface ApiResponse {
  description: string;
  schema?: ApiSchema;
}

export interface Webhook {
  id: string;
  url: string;
  secret: string;
  events: string[];
  status: WebhookStatus;
  description: string;
  createdAt: number;
  updatedAt: number;
  lastTriggeredAt: number | null;
  failureCount: number;
  maxRetries: number;
  retryDelayMs: number;
  headers: Record<string, string>;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  status: DeliveryStatus;
  statusCode: number | null;
  responseBody: string | null;
  attemptCount: number;
  maxAttempts: number;
  createdAt: number;
  lastAttemptAt: number | null;
  completedAt: number | null;
  signature: string;
  error: string | null;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string; // first 8 chars for display
  permissions: string[];
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
  isActive: boolean;
  rateLimit: number; // requests per minute
}

export interface CreateWebhookInput {
  url: string;
  events: string[];
  description?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  headers?: Record<string, string>;
}

export interface UpdateWebhookInput {
  url?: string;
  events?: string[];
  status?: WebhookStatus;
  description?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  headers?: Record<string, string>;
}

export interface GenerateApiKeyInput {
  name: string;
  permissions?: string[];
  expiresAt?: number | null;
  rateLimit?: number;
}

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact: { name: string; url: string };
    license: { name: string; url: string };
  };
  servers: Array<{ url: string; description: string }>;
  paths: Record<string, Record<string, unknown>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
  security: Array<Record<string, string[]>>;
  tags: Array<{ name: string; description: string }>;
}

// ---------------------------------------------------------------------------
// Webhook event types
// ---------------------------------------------------------------------------

export const WEBHOOK_EVENTS = [
  'project.created',
  'project.updated',
  'project.deleted',
  'architecture.node.created',
  'architecture.node.updated',
  'architecture.node.deleted',
  'architecture.edge.created',
  'architecture.edge.deleted',
  'bom.item.created',
  'bom.item.updated',
  'bom.item.deleted',
  'circuit.design.created',
  'circuit.design.updated',
  'circuit.instance.placed',
  'circuit.wire.created',
  'simulation.started',
  'simulation.completed',
  'export.completed',
  'validation.drc.completed',
  'ai.action.executed',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_WEBHOOKS = 'protopulse:public-api:webhooks';
const STORAGE_KEY_DELIVERIES = 'protopulse:public-api:deliveries';
const STORAGE_KEY_API_KEYS = 'protopulse:public-api:keys';
const MAX_DELIVERIES = 500;

// ---------------------------------------------------------------------------
// Built-in endpoint catalog
// ---------------------------------------------------------------------------

function buildEndpointCatalog(): ApiEndpoint[] {
  return [
    // Projects
    {
      id: 'list-projects', method: 'GET', path: '/api/projects', summary: 'List projects',
      description: 'Retrieve all projects for the authenticated user', category: 'projects',
      parameters: [
        { name: 'page', in: 'query', required: false, type: 'integer', description: 'Page number', example: '1' },
        { name: 'limit', in: 'query', required: false, type: 'integer', description: 'Items per page', example: '20' },
      ],
      requestBody: null, responses: { '200': { description: 'List of projects' } },
      requiresAuth: true, rateLimit: 60, tags: ['projects'],
    },
    {
      id: 'get-project', method: 'GET', path: '/api/projects/{id}', summary: 'Get project by ID',
      description: 'Retrieve a single project by its unique identifier', category: 'projects',
      parameters: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Project ID' }],
      requestBody: null, responses: { '200': { description: 'Project details' }, '404': { description: 'Not found' } },
      requiresAuth: true, rateLimit: 60, tags: ['projects'],
    },
    {
      id: 'create-project', method: 'POST', path: '/api/projects', summary: 'Create project',
      description: 'Create a new project', category: 'projects', parameters: [],
      requestBody: { type: 'object', properties: { name: { type: 'string', description: 'Project name' }, description: { type: 'string', description: 'Description' } }, required: ['name'] },
      responses: { '201': { description: 'Created project' } }, requiresAuth: true, rateLimit: 30, tags: ['projects'],
    },
    {
      id: 'update-project', method: 'PATCH', path: '/api/projects/{id}', summary: 'Update project',
      description: 'Update project fields', category: 'projects',
      parameters: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Project ID' }],
      requestBody: { type: 'object', properties: { name: { type: 'string', description: 'Project name' }, description: { type: 'string', description: 'Description' } }, required: [] },
      responses: { '200': { description: 'Updated project' } }, requiresAuth: true, rateLimit: 30, tags: ['projects'],
    },
    {
      id: 'delete-project', method: 'DELETE', path: '/api/projects/{id}', summary: 'Delete project',
      description: 'Soft-delete a project', category: 'projects',
      parameters: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Project ID' }],
      requestBody: null, responses: { '204': { description: 'Deleted' } }, requiresAuth: true, rateLimit: 10, tags: ['projects'],
    },
    // Architecture
    {
      id: 'list-nodes', method: 'GET', path: '/api/projects/{id}/architecture/nodes', summary: 'List architecture nodes',
      description: 'Get all nodes in a project architecture', category: 'architecture',
      parameters: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Project ID' }],
      requestBody: null, responses: { '200': { description: 'List of nodes' } }, requiresAuth: true, rateLimit: 60, tags: ['architecture'],
    },
    {
      id: 'create-node', method: 'POST', path: '/api/projects/{id}/architecture/nodes', summary: 'Create architecture node',
      description: 'Add a new block to the architecture diagram', category: 'architecture', parameters: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Project ID' }],
      requestBody: { type: 'object', properties: { label: { type: 'string', description: 'Node label' }, type: { type: 'string', description: 'Node type' } }, required: ['label', 'type'] },
      responses: { '201': { description: 'Created node' } }, requiresAuth: true, rateLimit: 60, tags: ['architecture'],
    },
    // BOM
    {
      id: 'list-bom', method: 'GET', path: '/api/projects/{id}/bom', summary: 'List BOM items',
      description: 'Retrieve the bill of materials for a project', category: 'bom',
      parameters: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Project ID' }],
      requestBody: null, responses: { '200': { description: 'BOM items' } }, requiresAuth: true, rateLimit: 60, tags: ['bom'],
    },
    {
      id: 'create-bom-item', method: 'POST', path: '/api/projects/{id}/bom', summary: 'Add BOM item',
      description: 'Add a new item to the bill of materials', category: 'bom',
      parameters: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Project ID' }],
      requestBody: { type: 'object', properties: { name: { type: 'string', description: 'Component name' }, quantity: { type: 'integer', description: 'Quantity' }, unitPrice: { type: 'number', description: 'Unit price' } }, required: ['name', 'quantity'] },
      responses: { '201': { description: 'Created BOM item' } }, requiresAuth: true, rateLimit: 60, tags: ['bom'],
    },
    {
      id: 'update-bom-item', method: 'PATCH', path: '/api/projects/{id}/bom/{bomId}', summary: 'Update BOM item',
      description: 'Update a BOM item', category: 'bom',
      parameters: [
        { name: 'id', in: 'path', required: true, type: 'string', description: 'Project ID' },
        { name: 'bomId', in: 'path', required: true, type: 'string', description: 'BOM item ID' },
      ],
      requestBody: { type: 'object', properties: { quantity: { type: 'integer', description: 'Quantity' }, unitPrice: { type: 'number', description: 'Unit price' } }, required: [] },
      responses: { '200': { description: 'Updated BOM item' } }, requiresAuth: true, rateLimit: 60, tags: ['bom'],
    },
    // Circuit
    {
      id: 'list-circuit-designs', method: 'GET', path: '/api/projects/{id}/circuits', summary: 'List circuit designs',
      description: 'Get all circuit designs for a project', category: 'circuit',
      parameters: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Project ID' }],
      requestBody: null, responses: { '200': { description: 'Circuit designs' } }, requiresAuth: true, rateLimit: 60, tags: ['circuit'],
    },
    {
      id: 'get-netlist', method: 'GET', path: '/api/circuits/{designId}/netlist', summary: 'Export netlist',
      description: 'Generate netlist for a circuit design', category: 'circuit',
      parameters: [{ name: 'designId', in: 'path', required: true, type: 'string', description: 'Circuit design ID' }],
      requestBody: null, responses: { '200': { description: 'Netlist data' } }, requiresAuth: true, rateLimit: 30, tags: ['circuit'],
    },
    // Simulation
    {
      id: 'run-simulation', method: 'POST', path: '/api/circuits/{designId}/simulate', summary: 'Run simulation',
      description: 'Run a circuit simulation (DC, AC, or transient)', category: 'simulation',
      parameters: [{ name: 'designId', in: 'path', required: true, type: 'string', description: 'Circuit design ID' }],
      requestBody: { type: 'object', properties: { type: { type: 'string', description: 'Simulation type', enum: ['dc', 'ac', 'transient'] } }, required: ['type'] },
      responses: { '200': { description: 'Simulation results' } }, requiresAuth: true, rateLimit: 10, tags: ['simulation'],
    },
    {
      id: 'get-simulation-results', method: 'GET', path: '/api/circuits/{designId}/simulations', summary: 'Get simulation results',
      description: 'Retrieve saved simulation results', category: 'simulation',
      parameters: [{ name: 'designId', in: 'path', required: true, type: 'string', description: 'Circuit design ID' }],
      requestBody: null, responses: { '200': { description: 'Simulation results' } }, requiresAuth: true, rateLimit: 30, tags: ['simulation'],
    },
    // Export
    {
      id: 'export-kicad', method: 'POST', path: '/api/projects/{id}/export/kicad', summary: 'Export to KiCad',
      description: 'Export project to KiCad format', category: 'export',
      parameters: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Project ID' }],
      requestBody: null, responses: { '200': { description: 'KiCad file content' } }, requiresAuth: true, rateLimit: 10, tags: ['export'],
    },
    {
      id: 'export-gerber', method: 'POST', path: '/api/circuits/{designId}/export/gerber', summary: 'Export Gerber files',
      description: 'Generate Gerber manufacturing files', category: 'export',
      parameters: [{ name: 'designId', in: 'path', required: true, type: 'string', description: 'Circuit design ID' }],
      requestBody: null, responses: { '200': { description: 'Gerber ZIP archive' } }, requiresAuth: true, rateLimit: 10, tags: ['export'],
    },
    {
      id: 'export-bom-csv', method: 'GET', path: '/api/projects/{id}/bom/export/csv', summary: 'Export BOM as CSV',
      description: 'Export bill of materials as CSV', category: 'export',
      parameters: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Project ID' }],
      requestBody: null, responses: { '200': { description: 'CSV content' } }, requiresAuth: true, rateLimit: 30, tags: ['export'],
    },
    // AI
    {
      id: 'ai-chat', method: 'POST', path: '/api/projects/{id}/chat', summary: 'Send AI chat message',
      description: 'Send a message to the AI assistant (SSE streaming response)', category: 'ai',
      parameters: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Project ID' }],
      requestBody: { type: 'object', properties: { message: { type: 'string', description: 'User message' }, model: { type: 'string', description: 'AI model to use' } }, required: ['message'] },
      responses: { '200': { description: 'SSE stream of AI response' } }, requiresAuth: true, rateLimit: 10, tags: ['ai'],
    },
    // Admin
    {
      id: 'health-check', method: 'GET', path: '/api/health', summary: 'Health check',
      description: 'Check API health and service status', category: 'admin', parameters: [],
      requestBody: null, responses: { '200': { description: 'Health status' } }, requiresAuth: false, rateLimit: 120, tags: ['admin'],
    },
    {
      id: 'validate-design', method: 'POST', path: '/api/projects/{id}/validate', summary: 'Run DRC validation',
      description: 'Execute design rule checks on the project', category: 'admin',
      parameters: [{ name: 'id', in: 'path', required: true, type: 'string', description: 'Project ID' }],
      requestBody: null, responses: { '200': { description: 'Validation results' } }, requiresAuth: true, rateLimit: 10, tags: ['admin'],
    },
  ];
}

// ---------------------------------------------------------------------------
// HMAC helpers
// ---------------------------------------------------------------------------

function generateHmacSignature(payload: string, secret: string): string {
  // Simple HMAC-SHA256 simulation for client-side
  // Uses a simple hash combining secret + payload for deterministic signatures
  let hash = 0;
  const combined = `${secret}:${payload}`;
  for (let i = 0; i < combined.length; i++) {
    const ch = combined.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `sha256=${hex}${'0'.repeat(Math.max(0, 64 - hex.length))}`;
}

function generateRandomKey(): string {
  const segments: string[] = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomUUID().replace(/-/g, '').slice(0, 8));
  }
  return `pp_${segments.join('_')}`;
}

function generateSecret(): string {
  return `whsec_${crypto.randomUUID().replace(/-/g, '')}`;
}

// ---------------------------------------------------------------------------
// PublicApiManager
// ---------------------------------------------------------------------------

export class PublicApiManager {
  private static instance: PublicApiManager | null = null;

  private endpoints: ApiEndpoint[];
  private webhooks: Webhook[] = [];
  private deliveries: WebhookDelivery[] = [];
  private apiKeys: ApiKey[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.endpoints = buildEndpointCatalog();
    this.load();
  }

  static getInstance(): PublicApiManager {
    if (!PublicApiManager.instance) {
      PublicApiManager.instance = new PublicApiManager();
    }
    return PublicApiManager.instance;
  }

  static resetForTesting(): void {
    PublicApiManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private load(): void {
    try {
      const webhooksJson = localStorage.getItem(STORAGE_KEY_WEBHOOKS);
      if (webhooksJson) {
        this.webhooks = JSON.parse(webhooksJson) as Webhook[];
      }
      const deliveriesJson = localStorage.getItem(STORAGE_KEY_DELIVERIES);
      if (deliveriesJson) {
        this.deliveries = JSON.parse(deliveriesJson) as WebhookDelivery[];
      }
      const keysJson = localStorage.getItem(STORAGE_KEY_API_KEYS);
      if (keysJson) {
        // Audit #60: the raw `key` secret is NEVER persisted (see save()). Rehydrated
        // records have `key: ''` — they're metadata-only and cannot be used for
        // validation after a reload. Consumers must copy the key at generation time
        // (GitHub/Stripe "we won't show it again" pattern).
        const stored = JSON.parse(keysJson) as Array<Omit<ApiKey, 'key'>>;
        this.apiKeys = stored.map((k) => ({ ...k, key: '' }));
      }
    } catch {
      this.webhooks = [];
      this.deliveries = [];
      this.apiKeys = [];
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY_WEBHOOKS, JSON.stringify(this.webhooks));
    localStorage.setItem(STORAGE_KEY_DELIVERIES, JSON.stringify(this.deliveries));
    // Audit #60: strip the raw `key` secret before persistence. The full key is
    // returned once from generateApiKey() (GitHub/Stripe "copy now" pattern) and
    // lives only in caller memory. Metadata (id, name, prefix, permissions, etc.)
    // is safe to persist — the prefix alone cannot authenticate a request.
    const redacted = this.apiKeys.map(({ key: _key, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY_API_KEYS, JSON.stringify(redacted));
  }

  // -----------------------------------------------------------------------
  // Endpoint catalog
  // -----------------------------------------------------------------------

  getAllEndpoints(): ApiEndpoint[] {
    return [...this.endpoints];
  }

  getEndpoint(id: string): ApiEndpoint | null {
    return this.endpoints.find((e) => e.id === id) ?? null;
  }

  getEndpointsByCategory(category: EndpointCategory): ApiEndpoint[] {
    return this.endpoints.filter((e) => e.category === category);
  }

  searchEndpoints(query: string): ApiEndpoint[] {
    const q = query.toLowerCase();
    return this.endpoints.filter(
      (e) =>
        e.summary.toLowerCase().includes(q) ||
        e.path.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  // -----------------------------------------------------------------------
  // Webhooks — CRUD
  // -----------------------------------------------------------------------

  createWebhook(input: CreateWebhookInput): Webhook {
    if (!input.url || !input.url.startsWith('https://')) {
      throw new Error('Webhook URL must use HTTPS');
    }
    if (!input.events || input.events.length === 0) {
      throw new Error('At least one event is required');
    }
    const invalidEvents = input.events.filter((e) => !(WEBHOOK_EVENTS as readonly string[]).includes(e));
    if (invalidEvents.length > 0) {
      throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
    }

    const now = Date.now();
    const webhook: Webhook = {
      id: crypto.randomUUID(),
      url: input.url,
      secret: generateSecret(),
      events: [...input.events],
      status: 'active',
      description: input.description ?? '',
      createdAt: now,
      updatedAt: now,
      lastTriggeredAt: null,
      failureCount: 0,
      maxRetries: input.maxRetries ?? 3,
      retryDelayMs: input.retryDelayMs ?? 60000,
      headers: input.headers ?? {},
    };

    this.webhooks.push(webhook);
    this.save();
    this.notify();
    return webhook;
  }

  getWebhook(id: string): Webhook | null {
    return this.webhooks.find((w) => w.id === id) ?? null;
  }

  getAllWebhooks(): Webhook[] {
    return [...this.webhooks];
  }

  updateWebhook(id: string, updates: UpdateWebhookInput): Webhook {
    const idx = this.webhooks.findIndex((w) => w.id === id);
    if (idx === -1) {
      throw new Error(`Webhook not found: ${id}`);
    }
    if (updates.url !== undefined && !updates.url.startsWith('https://')) {
      throw new Error('Webhook URL must use HTTPS');
    }
    if (updates.events !== undefined) {
      const invalidEvents = updates.events.filter((e) => !(WEBHOOK_EVENTS as readonly string[]).includes(e));
      if (invalidEvents.length > 0) {
        throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
      }
    }

    this.webhooks[idx] = {
      ...this.webhooks[idx],
      ...updates,
      updatedAt: Date.now(),
    };
    this.save();
    this.notify();
    return this.webhooks[idx];
  }

  deleteWebhook(id: string): void {
    const idx = this.webhooks.findIndex((w) => w.id === id);
    if (idx === -1) {
      throw new Error(`Webhook not found: ${id}`);
    }
    this.webhooks.splice(idx, 1);
    // Remove associated deliveries
    this.deliveries = this.deliveries.filter((d) => d.webhookId !== id);
    this.save();
    this.notify();
  }

  pauseWebhook(id: string): Webhook {
    return this.updateWebhook(id, { status: 'paused' });
  }

  resumeWebhook(id: string): Webhook {
    return this.updateWebhook(id, { status: 'active' });
  }

  disableWebhook(id: string): Webhook {
    return this.updateWebhook(id, { status: 'disabled' });
  }

  // -----------------------------------------------------------------------
  // Event triggering
  // -----------------------------------------------------------------------

  triggerEvent(event: string, payload: Record<string, unknown>): WebhookDelivery[] {
    if (!(WEBHOOK_EVENTS as readonly string[]).includes(event)) {
      throw new Error(`Invalid event: ${event}`);
    }

    const matchingWebhooks = this.webhooks.filter(
      (w) => w.status === 'active' && w.events.includes(event),
    );

    const deliveries: WebhookDelivery[] = matchingWebhooks.map((webhook) => {
      const deliveryPayload = {
        event,
        timestamp: Date.now(),
        data: payload,
      };
      const payloadStr = JSON.stringify(deliveryPayload);
      const signature = generateHmacSignature(payloadStr, webhook.secret);

      const delivery: WebhookDelivery = {
        id: crypto.randomUUID(),
        webhookId: webhook.id,
        event,
        payload: deliveryPayload,
        status: 'pending',
        statusCode: null,
        responseBody: null,
        attemptCount: 0,
        maxAttempts: webhook.maxRetries + 1,
        createdAt: Date.now(),
        lastAttemptAt: null,
        completedAt: null,
        signature,
        error: null,
      };

      this.deliveries.push(delivery);

      // Update webhook last triggered
      const whIdx = this.webhooks.findIndex((w) => w.id === webhook.id);
      if (whIdx !== -1) {
        this.webhooks[whIdx] = {
          ...this.webhooks[whIdx],
          lastTriggeredAt: Date.now(),
        };
      }

      return delivery;
    });

    // Trim deliveries if too many
    if (this.deliveries.length > MAX_DELIVERIES) {
      this.deliveries = this.deliveries.slice(-MAX_DELIVERIES);
    }

    this.save();
    this.notify();
    return deliveries;
  }

  // -----------------------------------------------------------------------
  // Delivery tracking
  // -----------------------------------------------------------------------

  getDelivery(id: string): WebhookDelivery | null {
    return this.deliveries.find((d) => d.id === id) ?? null;
  }

  getDeliveriesForWebhook(webhookId: string): WebhookDelivery[] {
    return this.deliveries.filter((d) => d.webhookId === webhookId);
  }

  getRecentDeliveries(limit: number = 50): WebhookDelivery[] {
    return this.deliveries.slice(-limit).reverse();
  }

  markDeliverySuccess(deliveryId: string, statusCode: number, responseBody?: string): WebhookDelivery {
    const idx = this.deliveries.findIndex((d) => d.id === deliveryId);
    if (idx === -1) {
      throw new Error(`Delivery not found: ${deliveryId}`);
    }
    this.deliveries[idx] = {
      ...this.deliveries[idx],
      status: 'success',
      statusCode,
      responseBody: responseBody ?? null,
      attemptCount: this.deliveries[idx].attemptCount + 1,
      lastAttemptAt: Date.now(),
      completedAt: Date.now(),
    };
    this.save();
    this.notify();
    return this.deliveries[idx];
  }

  markDeliveryFailed(deliveryId: string, error: string, statusCode?: number): WebhookDelivery {
    const idx = this.deliveries.findIndex((d) => d.id === deliveryId);
    if (idx === -1) {
      throw new Error(`Delivery not found: ${deliveryId}`);
    }
    const delivery = this.deliveries[idx];
    const newAttemptCount = delivery.attemptCount + 1;
    const shouldRetry = newAttemptCount < delivery.maxAttempts;

    this.deliveries[idx] = {
      ...delivery,
      status: shouldRetry ? 'retrying' : 'failed',
      statusCode: statusCode ?? null,
      attemptCount: newAttemptCount,
      lastAttemptAt: Date.now(),
      completedAt: shouldRetry ? null : Date.now(),
      error,
    };

    // Increment webhook failure count
    if (!shouldRetry) {
      const whIdx = this.webhooks.findIndex((w) => w.id === delivery.webhookId);
      if (whIdx !== -1) {
        this.webhooks[whIdx] = {
          ...this.webhooks[whIdx],
          failureCount: this.webhooks[whIdx].failureCount + 1,
        };
      }
    }

    this.save();
    this.notify();
    return this.deliveries[idx];
  }

  retryDelivery(deliveryId: string): WebhookDelivery {
    const idx = this.deliveries.findIndex((d) => d.id === deliveryId);
    if (idx === -1) {
      throw new Error(`Delivery not found: ${deliveryId}`);
    }
    const delivery = this.deliveries[idx];
    if (delivery.status !== 'failed' && delivery.status !== 'retrying') {
      throw new Error('Can only retry failed or retrying deliveries');
    }
    this.deliveries[idx] = {
      ...delivery,
      status: 'pending',
      error: null,
      maxAttempts: delivery.maxAttempts + 1, // grant one more attempt
    };
    this.save();
    this.notify();
    return this.deliveries[idx];
  }

  // -----------------------------------------------------------------------
  // API Keys
  // -----------------------------------------------------------------------

  generateApiKey(input: GenerateApiKeyInput): ApiKey {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('API key name is required');
    }

    const key = generateRandomKey();
    const apiKey: ApiKey = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      key,
      prefix: key.slice(0, 11), // pp_ + 8 chars
      permissions: input.permissions ?? ['read', 'write'],
      createdAt: Date.now(),
      lastUsedAt: null,
      expiresAt: input.expiresAt ?? null,
      isActive: true,
      rateLimit: input.rateLimit ?? 60,
    };

    this.apiKeys.push(apiKey);
    this.save();
    this.notify();
    return apiKey;
  }

  getApiKey(id: string): ApiKey | null {
    return this.apiKeys.find((k) => k.id === id) ?? null;
  }

  getAllApiKeys(): ApiKey[] {
    return [...this.apiKeys];
  }

  revokeApiKey(id: string): ApiKey {
    const idx = this.apiKeys.findIndex((k) => k.id === id);
    if (idx === -1) {
      throw new Error(`API key not found: ${id}`);
    }
    this.apiKeys[idx] = {
      ...this.apiKeys[idx],
      isActive: false,
    };
    this.save();
    this.notify();
    return this.apiKeys[idx];
  }

  deleteApiKey(id: string): void {
    const idx = this.apiKeys.findIndex((k) => k.id === id);
    if (idx === -1) {
      throw new Error(`API key not found: ${id}`);
    }
    this.apiKeys.splice(idx, 1);
    this.save();
    this.notify();
  }

  validateApiKey(key: string): ApiKey | null {
    const apiKey = this.apiKeys.find((k) => k.key === key && k.isActive);
    if (!apiKey) {
      return null;
    }
    if (apiKey.expiresAt && Date.now() > apiKey.expiresAt) {
      return null;
    }
    // Update last used
    const idx = this.apiKeys.findIndex((k) => k.id === apiKey.id);
    if (idx !== -1) {
      this.apiKeys[idx] = {
        ...this.apiKeys[idx],
        lastUsedAt: Date.now(),
      };
      this.save();
    }
    return this.apiKeys[idx];
  }

  // -----------------------------------------------------------------------
  // OpenAPI spec generation
  // -----------------------------------------------------------------------

  generateOpenApiSpec(): OpenApiSpec {
    const paths: Record<string, Record<string, unknown>> = {};

    this.endpoints.forEach((endpoint) => {
      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }
      const method = endpoint.method.toLowerCase();
      const operation: Record<string, unknown> = {
        summary: endpoint.summary,
        description: endpoint.description,
        operationId: endpoint.id,
        tags: endpoint.tags,
        responses: {} as Record<string, unknown>,
      };

      if (endpoint.parameters.length > 0) {
        operation['parameters'] = endpoint.parameters.map((p) => ({
          name: p.name,
          in: p.in,
          required: p.required,
          schema: { type: p.type },
          description: p.description,
          ...(p.example !== undefined ? { example: p.example } : {}),
        }));
      }

      if (endpoint.requestBody) {
        operation['requestBody'] = {
          required: true,
          content: {
            'application/json': {
              schema: endpoint.requestBody,
            },
          },
        };
      }

      const responses: Record<string, unknown> = {};
      Array.from(Object.entries(endpoint.responses)).forEach(([code, resp]) => {
        responses[code] = {
          description: resp.description,
          ...(resp.schema
            ? {
                content: {
                  'application/json': { schema: resp.schema },
                },
              }
            : {}),
        };
      });
      operation['responses'] = responses;

      if (endpoint.requiresAuth) {
        operation['security'] = [{ apiKey: [] }];
      }

      paths[endpoint.path][method] = operation;
    });

    // Collect unique tags
    const tagSet = new Set<string>();
    this.endpoints.forEach((e) => {
      e.tags.forEach((t) => {
        tagSet.add(t);
      });
    });
    const tags = Array.from(tagSet).map((t) => ({
      name: t,
      description: `${t.charAt(0).toUpperCase()}${t.slice(1)} operations`,
    }));

    return {
      openapi: '3.1.0',
      info: {
        title: 'ProtoPulse API',
        version: '1.0.0',
        description: 'Public API for the ProtoPulse EDA platform',
        contact: { name: 'ProtoPulse', url: 'https://protopulse.dev' },
        license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
      },
      servers: [
        { url: 'http://localhost:5000', description: 'Local development' },
      ],
      paths,
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
            description: 'API key for authentication',
          },
        },
        schemas: {},
      },
      security: [{ apiKey: [] }],
      tags,
    };
  }

  // -----------------------------------------------------------------------
  // HMAC signature (public for verification)
  // -----------------------------------------------------------------------

  computeSignature(payload: string, secret: string): string {
    return generateHmacSignature(payload, secret);
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  getWebhookStats(): {
    totalWebhooks: number;
    activeWebhooks: number;
    totalDeliveries: number;
    successRate: number;
    recentFailures: number;
  } {
    const total = this.webhooks.length;
    const active = this.webhooks.filter((w) => w.status === 'active').length;
    const totalDeliveries = this.deliveries.length;
    const successCount = this.deliveries.filter((d) => d.status === 'success').length;
    const successRate = totalDeliveries > 0 ? successCount / totalDeliveries : 0;
    const oneDayAgo = Date.now() - 86400000;
    const recentFailures = this.deliveries.filter(
      (d) => d.status === 'failed' && d.completedAt !== null && d.completedAt > oneDayAgo,
    ).length;

    return { totalWebhooks: total, activeWebhooks: active, totalDeliveries, successRate, recentFailures };
  }

  clearAll(): void {
    this.webhooks = [];
    this.deliveries = [];
    this.apiKeys = [];
    this.save();
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function usePublicApi(): {
  endpoints: ApiEndpoint[];
  webhooks: Webhook[];
  apiKeys: ApiKey[];
  deliveries: WebhookDelivery[];
  createWebhook: (input: CreateWebhookInput) => Webhook;
  updateWebhook: (id: string, updates: UpdateWebhookInput) => Webhook;
  deleteWebhook: (id: string) => void;
  triggerEvent: (event: string, payload: Record<string, unknown>) => WebhookDelivery[];
  generateApiKey: (input: GenerateApiKeyInput) => ApiKey;
  revokeApiKey: (id: string) => ApiKey;
  generateOpenApiSpec: () => OpenApiSpec;
} {
  const mgr = PublicApiManager.getInstance();
  const [, setTick] = useState(0);

  useEffect(() => {
    return mgr.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, [mgr]);

  return {
    endpoints: mgr.getAllEndpoints(),
    webhooks: mgr.getAllWebhooks(),
    apiKeys: mgr.getAllApiKeys(),
    deliveries: mgr.getRecentDeliveries(),
    createWebhook: useCallback((input: CreateWebhookInput) => mgr.createWebhook(input), [mgr]),
    updateWebhook: useCallback((id: string, updates: UpdateWebhookInput) => mgr.updateWebhook(id, updates), [mgr]),
    deleteWebhook: useCallback((id: string) => mgr.deleteWebhook(id), [mgr]),
    triggerEvent: useCallback((event: string, payload: Record<string, unknown>) => mgr.triggerEvent(event, payload), [mgr]),
    generateApiKey: useCallback((input: GenerateApiKeyInput) => mgr.generateApiKey(input), [mgr]),
    revokeApiKey: useCallback((id: string) => mgr.revokeApiKey(id), [mgr]),
    generateOpenApiSpec: useCallback(() => mgr.generateOpenApiSpec(), [mgr]),
  };
}
