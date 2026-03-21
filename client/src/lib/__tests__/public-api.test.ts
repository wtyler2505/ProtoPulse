import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`) });

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) { delete store[k]; } }),
});

import {
  PublicApiManager,
  WEBHOOK_EVENTS,
  usePublicApi,
} from '../public-api';
import type {
  CreateWebhookInput,
  GenerateApiKeyInput,
} from '../public-api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWebhookInput(overrides: Partial<CreateWebhookInput> = {}): CreateWebhookInput {
  return {
    url: 'https://example.com/webhook',
    events: ['project.created', 'project.updated'],
    description: 'Test webhook',
    ...overrides,
  };
}

function makeApiKeyInput(overrides: Partial<GenerateApiKeyInput> = {}): GenerateApiKeyInput {
  return {
    name: 'Test Key',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PublicApiManager', () => {
  beforeEach(() => {
    PublicApiManager.resetForTesting();
    for (const k of Object.keys(store)) {
      delete store[k];
    }
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = PublicApiManager.getInstance();
      const b = PublicApiManager.getInstance();
      expect(a).toBe(b);
    });

    it('should return a new instance after resetForTesting', () => {
      const a = PublicApiManager.getInstance();
      PublicApiManager.resetForTesting();
      const b = PublicApiManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('subscription', () => {
    it('should notify listeners on change', () => {
      const mgr = PublicApiManager.getInstance();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.createWebhook(makeWebhookInput());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe correctly', () => {
      const mgr = PublicApiManager.getInstance();
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.createWebhook(makeWebhookInput());
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  describe('persistence', () => {
    it('should persist webhooks to localStorage', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.createWebhook(makeWebhookInput());
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should load webhooks from localStorage on init', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput());
      PublicApiManager.resetForTesting();
      const mgr2 = PublicApiManager.getInstance();
      expect(mgr2.getWebhook(wh.id)).not.toBeNull();
    });

    it('should handle corrupted localStorage gracefully', () => {
      store['protopulse:public-api:webhooks'] = '{bad';
      const mgr = PublicApiManager.getInstance();
      expect(mgr.getAllWebhooks()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Endpoint catalog
  // -----------------------------------------------------------------------

  describe('endpoint catalog', () => {
    it('should have 20+ built-in endpoints', () => {
      const mgr = PublicApiManager.getInstance();
      const endpoints = mgr.getAllEndpoints();
      expect(endpoints.length).toBeGreaterThanOrEqual(20);
    });

    it('should get endpoint by id', () => {
      const mgr = PublicApiManager.getInstance();
      const ep = mgr.getEndpoint('list-projects');
      expect(ep).not.toBeNull();
      expect(ep!.method).toBe('GET');
      expect(ep!.path).toBe('/api/projects');
    });

    it('should return null for unknown endpoint', () => {
      const mgr = PublicApiManager.getInstance();
      expect(mgr.getEndpoint('nonexistent')).toBeNull();
    });

    it('should filter endpoints by category', () => {
      const mgr = PublicApiManager.getInstance();
      const projectEndpoints = mgr.getEndpointsByCategory('projects');
      expect(projectEndpoints.length).toBeGreaterThan(0);
      projectEndpoints.forEach((ep) => {
        expect(ep.category).toBe('projects');
      });
    });

    it('should search endpoints by query', () => {
      const mgr = PublicApiManager.getInstance();
      const results = mgr.searchEndpoints('project');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search endpoints case-insensitively', () => {
      const mgr = PublicApiManager.getInstance();
      const results = mgr.searchEndpoints('PROJECT');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array for no search matches', () => {
      const mgr = PublicApiManager.getInstance();
      const results = mgr.searchEndpoints('zzzznonexistent');
      expect(results).toHaveLength(0);
    });

    it('should have all required categories represented', () => {
      const mgr = PublicApiManager.getInstance();
      const all = mgr.getAllEndpoints();
      const categories = new Set(all.map((e) => e.category));
      expect(categories.has('projects')).toBe(true);
      expect(categories.has('architecture')).toBe(true);
      expect(categories.has('bom')).toBe(true);
      expect(categories.has('circuit')).toBe(true);
      expect(categories.has('simulation')).toBe(true);
      expect(categories.has('export')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Webhooks — CRUD
  // -----------------------------------------------------------------------

  describe('webhooks CRUD', () => {
    it('should create a webhook with secret', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput());
      expect(wh.id).toBeTruthy();
      expect(wh.url).toBe('https://example.com/webhook');
      expect(wh.secret).toContain('whsec_');
      expect(wh.status).toBe('active');
      expect(wh.events).toHaveLength(2);
    });

    it('should reject non-HTTPS webhook URL', () => {
      const mgr = PublicApiManager.getInstance();
      expect(() => mgr.createWebhook(makeWebhookInput({ url: 'http://example.com' }))).toThrow('HTTPS');
    });

    it('should reject empty events', () => {
      const mgr = PublicApiManager.getInstance();
      expect(() => mgr.createWebhook(makeWebhookInput({ events: [] }))).toThrow('At least one event');
    });

    it('should reject invalid events', () => {
      const mgr = PublicApiManager.getInstance();
      expect(() => mgr.createWebhook(makeWebhookInput({ events: ['invalid.event'] }))).toThrow('Invalid events');
    });

    it('should get webhook by id', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput());
      expect(mgr.getWebhook(wh.id)).toEqual(wh);
    });

    it('should return null for unknown webhook', () => {
      const mgr = PublicApiManager.getInstance();
      expect(mgr.getWebhook('nope')).toBeNull();
    });

    it('should get all webhooks', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.createWebhook(makeWebhookInput());
      mgr.createWebhook(makeWebhookInput({ url: 'https://other.com/hook' }));
      expect(mgr.getAllWebhooks()).toHaveLength(2);
    });

    it('should update a webhook', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput());
      const updated = mgr.updateWebhook(wh.id, { description: 'Updated' });
      expect(updated.description).toBe('Updated');
      expect(updated.updatedAt).toBeGreaterThanOrEqual(wh.updatedAt);
    });

    it('should reject updating nonexistent webhook', () => {
      const mgr = PublicApiManager.getInstance();
      expect(() => mgr.updateWebhook('nope', {})).toThrow('Webhook not found');
    });

    it('should reject updating to non-HTTPS URL', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput());
      expect(() => mgr.updateWebhook(wh.id, { url: 'http://bad.com' })).toThrow('HTTPS');
    });

    it('should reject updating with invalid events', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput());
      expect(() => mgr.updateWebhook(wh.id, { events: ['nope'] })).toThrow('Invalid events');
    });

    it('should delete a webhook and its deliveries', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput());
      mgr.triggerEvent('project.created', { id: '1' });
      expect(mgr.getDeliveriesForWebhook(wh.id).length).toBeGreaterThan(0);
      mgr.deleteWebhook(wh.id);
      expect(mgr.getWebhook(wh.id)).toBeNull();
      expect(mgr.getDeliveriesForWebhook(wh.id)).toHaveLength(0);
    });

    it('should reject deleting nonexistent webhook', () => {
      const mgr = PublicApiManager.getInstance();
      expect(() => mgr.deleteWebhook('nope')).toThrow('Webhook not found');
    });

    it('should pause a webhook', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput());
      const paused = mgr.pauseWebhook(wh.id);
      expect(paused.status).toBe('paused');
    });

    it('should resume a webhook', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput());
      mgr.pauseWebhook(wh.id);
      const resumed = mgr.resumeWebhook(wh.id);
      expect(resumed.status).toBe('active');
    });

    it('should disable a webhook', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput());
      const disabled = mgr.disableWebhook(wh.id);
      expect(disabled.status).toBe('disabled');
    });
  });

  // -----------------------------------------------------------------------
  // Event triggering
  // -----------------------------------------------------------------------

  describe('event triggering', () => {
    it('should trigger event and create deliveries', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.createWebhook(makeWebhookInput());
      const deliveries = mgr.triggerEvent('project.created', { id: '1' });
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].status).toBe('pending');
      expect(deliveries[0].event).toBe('project.created');
      expect(deliveries[0].signature).toContain('sha256=');
    });

    it('should only trigger matching webhooks', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.createWebhook(makeWebhookInput({ events: ['project.created'] }));
      mgr.createWebhook(makeWebhookInput({ events: ['bom.item.created'], url: 'https://other.com/hook' }));
      const deliveries = mgr.triggerEvent('project.created', { id: '1' });
      expect(deliveries).toHaveLength(1);
    });

    it('should not trigger paused webhooks', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput());
      mgr.pauseWebhook(wh.id);
      const deliveries = mgr.triggerEvent('project.created', { id: '1' });
      expect(deliveries).toHaveLength(0);
    });

    it('should not trigger disabled webhooks', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput());
      mgr.disableWebhook(wh.id);
      const deliveries = mgr.triggerEvent('project.created', { id: '1' });
      expect(deliveries).toHaveLength(0);
    });

    it('should reject invalid event name', () => {
      const mgr = PublicApiManager.getInstance();
      expect(() => mgr.triggerEvent('invalid.event', {})).toThrow('Invalid event');
    });

    it('should update webhook lastTriggeredAt', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput());
      expect(wh.lastTriggeredAt).toBeNull();
      mgr.triggerEvent('project.created', { id: '1' });
      const updated = mgr.getWebhook(wh.id);
      expect(updated!.lastTriggeredAt).not.toBeNull();
    });

    it('should generate deterministic HMAC signature', () => {
      const mgr = PublicApiManager.getInstance();
      const sig1 = mgr.computeSignature('test payload', 'secret');
      const sig2 = mgr.computeSignature('test payload', 'secret');
      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different payloads', () => {
      const mgr = PublicApiManager.getInstance();
      const sig1 = mgr.computeSignature('payload1', 'secret');
      const sig2 = mgr.computeSignature('payload2', 'secret');
      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const mgr = PublicApiManager.getInstance();
      const sig1 = mgr.computeSignature('payload', 'secret1');
      const sig2 = mgr.computeSignature('payload', 'secret2');
      expect(sig1).not.toBe(sig2);
    });
  });

  // -----------------------------------------------------------------------
  // Delivery tracking
  // -----------------------------------------------------------------------

  describe('delivery tracking', () => {
    it('should get delivery by id', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.createWebhook(makeWebhookInput());
      const deliveries = mgr.triggerEvent('project.created', {});
      const delivery = mgr.getDelivery(deliveries[0].id);
      expect(delivery).not.toBeNull();
    });

    it('should return null for unknown delivery', () => {
      const mgr = PublicApiManager.getInstance();
      expect(mgr.getDelivery('nope')).toBeNull();
    });

    it('should get deliveries for a specific webhook', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput());
      mgr.triggerEvent('project.created', {});
      mgr.triggerEvent('project.updated', {});
      expect(mgr.getDeliveriesForWebhook(wh.id)).toHaveLength(2);
    });

    it('should get recent deliveries', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.createWebhook(makeWebhookInput());
      mgr.triggerEvent('project.created', {});
      mgr.triggerEvent('project.updated', {});
      const recent = mgr.getRecentDeliveries(1);
      expect(recent).toHaveLength(1);
    });

    it('should mark delivery as success', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.createWebhook(makeWebhookInput());
      const deliveries = mgr.triggerEvent('project.created', {});
      const updated = mgr.markDeliverySuccess(deliveries[0].id, 200, 'OK');
      expect(updated.status).toBe('success');
      expect(updated.statusCode).toBe(200);
      expect(updated.responseBody).toBe('OK');
      expect(updated.completedAt).not.toBeNull();
    });

    it('should mark delivery as failed and set retry', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.createWebhook(makeWebhookInput({ maxRetries: 3 }));
      const deliveries = mgr.triggerEvent('project.created', {});
      const failed = mgr.markDeliveryFailed(deliveries[0].id, 'Connection refused', 500);
      expect(failed.status).toBe('retrying'); // first attempt, still has retries
      expect(failed.attemptCount).toBe(1);
      expect(failed.error).toBe('Connection refused');
    });

    it('should mark delivery as permanently failed after exhausting retries', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.createWebhook(makeWebhookInput({ maxRetries: 1 })); // 1 retry = 2 total attempts
      const deliveries = mgr.triggerEvent('project.created', {});
      mgr.markDeliveryFailed(deliveries[0].id, 'Error 1');
      const final = mgr.markDeliveryFailed(deliveries[0].id, 'Error 2');
      expect(final.status).toBe('failed');
      expect(final.completedAt).not.toBeNull();
    });

    it('should increment webhook failure count on permanent failure', () => {
      const mgr = PublicApiManager.getInstance();
      const wh = mgr.createWebhook(makeWebhookInput({ maxRetries: 0 }));
      const deliveries = mgr.triggerEvent('project.created', {});
      mgr.markDeliveryFailed(deliveries[0].id, 'Error');
      const updated = mgr.getWebhook(wh.id);
      expect(updated!.failureCount).toBe(1);
    });

    it('should throw for nonexistent delivery in markDeliverySuccess', () => {
      const mgr = PublicApiManager.getInstance();
      expect(() => mgr.markDeliverySuccess('nope', 200)).toThrow('Delivery not found');
    });

    it('should throw for nonexistent delivery in markDeliveryFailed', () => {
      const mgr = PublicApiManager.getInstance();
      expect(() => mgr.markDeliveryFailed('nope', 'err')).toThrow('Delivery not found');
    });

    it('should retry a failed delivery', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.createWebhook(makeWebhookInput({ maxRetries: 0 }));
      const deliveries = mgr.triggerEvent('project.created', {});
      mgr.markDeliveryFailed(deliveries[0].id, 'Error');
      const retried = mgr.retryDelivery(deliveries[0].id);
      expect(retried.status).toBe('pending');
      expect(retried.maxAttempts).toBe(2); // original 1 + 1
    });

    it('should reject retrying a successful delivery', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.createWebhook(makeWebhookInput());
      const deliveries = mgr.triggerEvent('project.created', {});
      mgr.markDeliverySuccess(deliveries[0].id, 200);
      expect(() => mgr.retryDelivery(deliveries[0].id)).toThrow('Can only retry');
    });

    it('should throw for nonexistent delivery in retryDelivery', () => {
      const mgr = PublicApiManager.getInstance();
      expect(() => mgr.retryDelivery('nope')).toThrow('Delivery not found');
    });
  });

  // -----------------------------------------------------------------------
  // API Keys
  // -----------------------------------------------------------------------

  describe('API keys', () => {
    it('should generate an API key', () => {
      const mgr = PublicApiManager.getInstance();
      const key = mgr.generateApiKey(makeApiKeyInput());
      expect(key.id).toBeTruthy();
      expect(key.key).toContain('pp_');
      expect(key.prefix).toBe(key.key.slice(0, 11));
      expect(key.isActive).toBe(true);
      expect(key.permissions).toEqual(['read', 'write']);
    });

    it('should reject empty name', () => {
      const mgr = PublicApiManager.getInstance();
      expect(() => mgr.generateApiKey({ name: '' })).toThrow('name is required');
      expect(() => mgr.generateApiKey({ name: '  ' })).toThrow('name is required');
    });

    it('should get API key by id', () => {
      const mgr = PublicApiManager.getInstance();
      const key = mgr.generateApiKey(makeApiKeyInput());
      expect(mgr.getApiKey(key.id)).toEqual(key);
    });

    it('should return null for unknown API key', () => {
      const mgr = PublicApiManager.getInstance();
      expect(mgr.getApiKey('nope')).toBeNull();
    });

    it('should get all API keys', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.generateApiKey(makeApiKeyInput({ name: 'Key 1' }));
      mgr.generateApiKey(makeApiKeyInput({ name: 'Key 2' }));
      expect(mgr.getAllApiKeys()).toHaveLength(2);
    });

    it('should revoke an API key', () => {
      const mgr = PublicApiManager.getInstance();
      const key = mgr.generateApiKey(makeApiKeyInput());
      const revoked = mgr.revokeApiKey(key.id);
      expect(revoked.isActive).toBe(false);
    });

    it('should throw when revoking nonexistent key', () => {
      const mgr = PublicApiManager.getInstance();
      expect(() => mgr.revokeApiKey('nope')).toThrow('API key not found');
    });

    it('should delete an API key', () => {
      const mgr = PublicApiManager.getInstance();
      const key = mgr.generateApiKey(makeApiKeyInput());
      mgr.deleteApiKey(key.id);
      expect(mgr.getApiKey(key.id)).toBeNull();
    });

    it('should throw when deleting nonexistent key', () => {
      const mgr = PublicApiManager.getInstance();
      expect(() => mgr.deleteApiKey('nope')).toThrow('API key not found');
    });

    it('should validate an active API key', () => {
      const mgr = PublicApiManager.getInstance();
      const key = mgr.generateApiKey(makeApiKeyInput());
      const validated = mgr.validateApiKey(key.key);
      expect(validated).not.toBeNull();
      expect(validated!.lastUsedAt).not.toBeNull();
    });

    it('should reject a revoked API key', () => {
      const mgr = PublicApiManager.getInstance();
      const key = mgr.generateApiKey(makeApiKeyInput());
      mgr.revokeApiKey(key.id);
      expect(mgr.validateApiKey(key.key)).toBeNull();
    });

    it('should reject an expired API key', () => {
      const mgr = PublicApiManager.getInstance();
      const key = mgr.generateApiKey(makeApiKeyInput({
        expiresAt: Date.now() - 86400000, // expired yesterday
      }));
      expect(mgr.validateApiKey(key.key)).toBeNull();
    });

    it('should reject an unknown API key', () => {
      const mgr = PublicApiManager.getInstance();
      expect(mgr.validateApiKey('invalid_key')).toBeNull();
    });

    it('should accept custom permissions', () => {
      const mgr = PublicApiManager.getInstance();
      const key = mgr.generateApiKey(makeApiKeyInput({ permissions: ['read'] }));
      expect(key.permissions).toEqual(['read']);
    });

    it('should accept custom rate limit', () => {
      const mgr = PublicApiManager.getInstance();
      const key = mgr.generateApiKey(makeApiKeyInput({ rateLimit: 100 }));
      expect(key.rateLimit).toBe(100);
    });
  });

  // -----------------------------------------------------------------------
  // OpenAPI spec
  // -----------------------------------------------------------------------

  describe('OpenAPI spec generation', () => {
    it('should generate a valid OpenAPI 3.1.0 spec', () => {
      const mgr = PublicApiManager.getInstance();
      const spec = mgr.generateOpenApiSpec();
      expect(spec.openapi).toBe('3.1.0');
      expect(spec.info.title).toBe('ProtoPulse API');
      expect(spec.info.version).toBe('1.0.0');
    });

    it('should include all endpoint paths', () => {
      const mgr = PublicApiManager.getInstance();
      const spec = mgr.generateOpenApiSpec();
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
      expect(spec.paths['/api/projects']).toBeTruthy();
    });

    it('should include security schemes', () => {
      const mgr = PublicApiManager.getInstance();
      const spec = mgr.generateOpenApiSpec();
      expect(spec.components.securitySchemes['apiKey']).toBeTruthy();
    });

    it('should include tags', () => {
      const mgr = PublicApiManager.getInstance();
      const spec = mgr.generateOpenApiSpec();
      expect(spec.tags.length).toBeGreaterThan(0);
    });

    it('should include request bodies for POST endpoints', () => {
      const mgr = PublicApiManager.getInstance();
      const spec = mgr.generateOpenApiSpec();
      const createProject = spec.paths['/api/projects']?.['post'] as Record<string, unknown> | undefined;
      expect(createProject).toBeTruthy();
      expect(createProject!['requestBody']).toBeTruthy();
    });

    it('should include parameters for path params', () => {
      const mgr = PublicApiManager.getInstance();
      const spec = mgr.generateOpenApiSpec();
      const getProject = spec.paths['/api/projects/{id}']?.['get'] as Record<string, unknown> | undefined;
      expect(getProject).toBeTruthy();
      expect(getProject!['parameters']).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Webhook stats
  // -----------------------------------------------------------------------

  describe('webhook stats', () => {
    it('should calculate stats correctly', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.createWebhook(makeWebhookInput());
      mgr.createWebhook(makeWebhookInput({ url: 'https://other.com/hook', events: ['bom.item.created'] }));
      const stats = mgr.getWebhookStats();
      expect(stats.totalWebhooks).toBe(2);
      expect(stats.activeWebhooks).toBe(2);
    });

    it('should track success rate', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.createWebhook(makeWebhookInput());
      const d1 = mgr.triggerEvent('project.created', {});
      mgr.markDeliverySuccess(d1[0].id, 200);
      const d2 = mgr.triggerEvent('project.updated', {});
      mgr.markDeliverySuccess(d2[0].id, 200);
      const stats = mgr.getWebhookStats();
      expect(stats.successRate).toBe(1.0);
    });

    it('should return zero success rate with no deliveries', () => {
      const mgr = PublicApiManager.getInstance();
      const stats = mgr.getWebhookStats();
      expect(stats.successRate).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Webhook events constant
  // -----------------------------------------------------------------------

  describe('webhook events', () => {
    it('should have 20 defined events', () => {
      expect(WEBHOOK_EVENTS).toHaveLength(20);
    });

    it('should include project events', () => {
      expect(WEBHOOK_EVENTS).toContain('project.created');
      expect(WEBHOOK_EVENTS).toContain('project.updated');
      expect(WEBHOOK_EVENTS).toContain('project.deleted');
    });

    it('should include circuit events', () => {
      expect(WEBHOOK_EVENTS).toContain('circuit.design.created');
      expect(WEBHOOK_EVENTS).toContain('circuit.wire.created');
    });

    it('should include simulation events', () => {
      expect(WEBHOOK_EVENTS).toContain('simulation.started');
      expect(WEBHOOK_EVENTS).toContain('simulation.completed');
    });
  });

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  describe('utility', () => {
    it('should clear all data', () => {
      const mgr = PublicApiManager.getInstance();
      mgr.createWebhook(makeWebhookInput());
      mgr.generateApiKey(makeApiKeyInput());
      mgr.triggerEvent('project.created', {});
      mgr.clearAll();
      expect(mgr.getAllWebhooks()).toHaveLength(0);
      expect(mgr.getAllApiKeys()).toHaveLength(0);
      expect(mgr.getRecentDeliveries()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // React hook
  // -----------------------------------------------------------------------

  describe('usePublicApi', () => {
    it('should be exported as a function', () => {
      expect(typeof usePublicApi).toBe('function');
    });
  });
});
