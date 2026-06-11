import type { Express } from 'express';
import type { IStorage } from '../storage';
import type { CircuitInstanceRow } from '@shared/schema';
import type { PartMeta } from '@shared/component-types';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error/v3';
import { parseIdParam, payloadLimit, circuitPaginationSchema } from './utils';
import { requireCircuitOwnership } from '../routes/auth-middleware';
import { getRefDesPrefix, nextRefdes } from '@shared/ref-des';
import { mirrorIngressBestEffort, type IngressRequest } from '../parts-ingress';
import { featureFlags } from '../env';
import { db } from '../db';
import { findAuditorPinCatalogPins } from '../lib/auditor-pinout-catalog';
import { createRequire } from 'node:module';

const createInstanceSchema = z.object({
  partId: z.number().int().positive().nullable().optional(),
  referenceDesignator: z.string().min(1).optional(),
  schematicX: z.number().optional(),
  schematicY: z.number().optional(),
  schematicRotation: z.number().optional(),
  breadboardX: z.number().nullable().optional(),
  breadboardY: z.number().nullable().optional(),
  breadboardRotation: z.number().nullable().optional(),
  benchX: z.number().nullable().optional(),
  benchY: z.number().nullable().optional(),
  pcbX: z.number().nullable().optional(),
  pcbY: z.number().nullable().optional(),
  pcbRotation: z.number().nullable().optional(),
  pcbSide: z.enum(['front', 'back']).optional(),
  properties: z.record(z.string()).optional(),
});

const updateInstanceSchema = z.object({
  referenceDesignator: z.string().min(1).optional(),
  schematicX: z.number().optional(),
  schematicY: z.number().optional(),
  schematicRotation: z.number().optional(),
  breadboardX: z.number().nullable().optional(),
  breadboardY: z.number().nullable().optional(),
  breadboardRotation: z.number().nullable().optional(),
  benchX: z.number().nullable().optional(),
  benchY: z.number().nullable().optional(),
  pcbX: z.number().nullable().optional(),
  pcbY: z.number().nullable().optional(),
  pcbRotation: z.number().nullable().optional(),
  pcbSide: z.enum(['front', 'back']).optional(),
  properties: z.record(z.string()).optional(),
});

const runPinVerificationSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  autoAuditor: z.boolean().optional().default(true),
  auditorReports: z.array(z.object({
    instanceId: z.number().int().positive(),
    source: z.string().min(2).max(120).optional(),
    pins: z.array(z.object({
      pinLabel: z.string().min(1).max(120),
    })).min(1),
  })).optional(),
});

type PinVerificationStatus = 'verified' | 'unverified_ai_guess' | 'conflict';

interface PinVerificationEntry {
  pinLabel: string;
  status: PinVerificationStatus;
  source: string;
  note?: string;
  trust: {
    verified: boolean;
    source: 'live_supplier_api' | 'historical_estimate' | 'manual_entry' | 'fallback_unknown';
    value: PinVerificationStatus;
    note?: string;
    isMock?: boolean;
  };
}

type AuthoritativePinSource = 'component_connectors' | 'datasheet_pin_map' | 'none';

interface PinVerificationRunRecord {
  runId: string;
  circuitId: number;
  createdAt: number;
  flaggedInstances: number;
  unverifiedGuessCount: number;
  conflictCount: number;
  dryRun: boolean;
  topAuthoritativeSourceLabel: string;
}

interface PinVerificationOrchestrationStage {
  role: 'drafter' | 'auditor' | 'judge';
  source: string;
  action: string;
}

interface PinVerificationOrchestrationTrace {
  mode: 'local_mcp_swarm';
  engine: {
    coordinator: 'genkit';
    transport: 'mcp';
    openaiAgentsCompatible: boolean;
    openaiAgentsExecution: boolean;
  };
  stages: PinVerificationOrchestrationStage[];
}

let openAIAgentsRuntimeAvailableCache: boolean | null = null;
async function detectOpenAIAgentsRuntimeAvailable(): Promise<boolean> {
  if (openAIAgentsRuntimeAvailableCache != null) {
    return openAIAgentsRuntimeAvailableCache;
  }
  try {
    const require = createRequire(import.meta.url);
    require.resolve('@openai/agents');
    openAIAgentsRuntimeAvailableCache = true;
  } catch {
    openAIAgentsRuntimeAvailableCache = false;
  }
  return openAIAgentsRuntimeAvailableCache;
}

async function runOpenAIAgentsJudgeRationale(input: {
  circuitId: number;
  flaggedInstances: number;
  unverifiedGuessCount: number;
  conflictCount: number;
}): Promise<{ executed: boolean; rationale?: string }> {
  const override = (globalThis as {
    __PROTO_TEST_OPENAI_AGENTS_JUDGE__?: (payload: {
      circuitId: number;
      flaggedInstances: number;
      unverifiedGuessCount: number;
      conflictCount: number;
    }) => Promise<{ executed: boolean; rationale?: string }>;
  }).__PROTO_TEST_OPENAI_AGENTS_JUDGE__;
  if (override) {
    return override(input);
  }

  const hasKey = typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.trim().length > 0;
  const runtimeAvailable = await detectOpenAIAgentsRuntimeAvailable();
  if (!runtimeAvailable || !hasKey) {
    return { executed: false };
  }

  try {
    const dynamicImporter = new Function('moduleName', 'return import(moduleName);') as (moduleName: string) => Promise<unknown>;
    const mod = await dynamicImporter('@openai/agents') as {
      Agent: new (args: { name: string; instructions: string; model?: string }) => unknown;
      run: (agent: unknown, input: string) => Promise<{ finalOutput?: string; output?: string }>;
    };
    const judgeAgent = new mod.Agent({
      name: 'ProtoPulse Judge',
      instructions: 'You summarize circuit pin-verification risk in one short sentence for an engineering UI.',
      model: 'gpt-5-nano',
    });
    const result = await mod.run(
      judgeAgent,
      `Circuit ${String(input.circuitId)} has ${String(input.flaggedInstances)} flagged instances, ` +
        `${String(input.unverifiedGuessCount)} unverified AI guesses, and ${String(input.conflictCount)} conflicts. ` +
        'Return one concise risk sentence.',
    );
    const rationale = typeof result.finalOutput === 'string'
      ? result.finalOutput
      : typeof result.output === 'string'
        ? result.output
        : undefined;
    return { executed: true, rationale };
  } catch {
    return { executed: false };
  }
}

const pinVerificationHistoryByCircuit = new Map<number, PinVerificationRunRecord[]>();
let pinVerificationRunCounter = 0;

function normalizePinToken(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function extractAuthoritativePinsFromConnectors(connectors: unknown): Set<string> {
  const pins = new Set<string>();
  if (!Array.isArray(connectors)) {
    return pins;
  }

  for (const connector of connectors) {
    if (!connector || typeof connector !== 'object') {
      continue;
    }
    const row = connector as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) {
      continue;
    }
    pins.add(normalizePinToken(name));
  }

  return pins;
}

function extractAuthoritativePinsFromDatasheetProperty(properties: unknown): Set<string> {
  const pins = new Set<string>();
  if (!properties || typeof properties !== 'object') {
    return pins;
  }
  const props = properties as Record<string, unknown>;
  const raw = props.datasheetPinMap;
  if (!Array.isArray(raw)) {
    return pins;
  }
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const label = typeof row.pinLabel === 'string' && row.pinLabel.trim().length > 0
      ? row.pinLabel.trim()
      : typeof row.name === 'string' && row.name.trim().length > 0
        ? row.name.trim()
        : null;
    if (!label) {
      continue;
    }
    pins.add(normalizePinToken(label));
  }
  return pins;
}

function extractAuthoritativePinsFromAuditorReports(
  auditorReports: Array<{ instanceId: number; source?: string; pins: Array<{ pinLabel: string }> }> | undefined,
): Map<number, { pins: Set<string>; source: string }> {
  const byInstance = new Map<number, { pins: Set<string>; source: string }>();
  if (!auditorReports || auditorReports.length === 0) {
    return byInstance;
  }
  for (const report of auditorReports) {
    const pins = new Set<string>();
    for (const pin of report.pins) {
      pins.add(normalizePinToken(pin.pinLabel));
    }
    if (pins.size === 0) {
      continue;
    }
    byInstance.set(report.instanceId, {
      pins,
      source: report.source?.trim() || 'auditor_mcp_datasheet',
    });
  }
  return byInstance;
}

async function buildAutoAuditorReports(
  instances: CircuitInstanceRow[],
  storage: IStorage,
  projectId: number | null,
): Promise<Array<{ instanceId: number; source: string; pins: Array<{ pinLabel: string }> }>> {
  if (projectId == null) {
    return [];
  }

  const partCache = new Map<number, Awaited<ReturnType<IStorage['getComponentPart']>>>();
  const reports: Array<{ instanceId: number; source: string; pins: Array<{ pinLabel: string }> }> = [];

  for (const instance of instances) {
    if (instance.partId == null) {
      continue;
    }
    let part = partCache.get(instance.partId);
    if (!part) {
      part = await storage.getComponentPart(instance.partId, projectId);
      partCache.set(instance.partId, part);
    }
    if (!part) {
      continue;
    }
    const meta = (part.meta ?? {}) as Record<string, unknown>;
    const candidates = [
      typeof meta.mpn === 'string' ? meta.mpn : null,
      typeof meta.title === 'string' ? meta.title : null,
      typeof meta.family === 'string' ? meta.family : null,
      typeof meta.label === 'string' ? meta.label : null,
    ];
    const pins = findAuditorPinCatalogPins(candidates);
    if (!pins || pins.length === 0) {
      continue;
    }
    reports.push({
      instanceId: instance.id,
      source: 'auditor_mcp_catalog',
      pins: pins.map((pinLabel) => ({ pinLabel })),
    });
  }

  return reports;
}

function detectPinVerificationEntriesFromProperties(
  properties: unknown,
  authoritativePins: Set<string>,
  authoritativeSource: AuthoritativePinSource,
): PinVerificationEntry[] {
  if (!properties || typeof properties !== 'object') {
    return [];
  }

  const props = properties as Record<string, unknown>;
  const rawMappings = props.aiPinMappings;
  if (!Array.isArray(rawMappings)) {
    return [];
  }

  const entries: PinVerificationEntry[] = [];
  for (const mapping of rawMappings) {
    if (!mapping || typeof mapping !== 'object') {
      continue;
    }
    const row = mapping as Record<string, unknown>;
    const pinLabel = typeof row.pinLabel === 'string' && row.pinLabel.trim().length > 0
      ? row.pinLabel.trim()
      : null;
    if (!pinLabel) {
      continue;
    }

    const verification = typeof row.verification === 'string' ? row.verification.trim().toLowerCase() : '';
    const normalizedPin = normalizePinToken(pinLabel);
    const pinExistsInAuthoritativeMap = normalizedPin.length > 0 && authoritativePins.has(normalizedPin);

    let status: PinVerificationStatus | null = null;
    if (verification === 'conflict' || (!pinExistsInAuthoritativeMap && authoritativePins.size > 0)) {
      status = 'conflict';
    } else if (verification === 'verified' || pinExistsInAuthoritativeMap) {
      status = 'verified';
    } else {
      const source = typeof row.source === 'string' ? row.source.trim().toLowerCase() : '';
      const aiGuess = row.aiGuess === true;
      if (aiGuess || source.includes('ai') || source.includes('drafter')) {
        status = 'unverified_ai_guess';
      }
    }
    if (!status) {
      continue;
    }

    const source = status === 'verified'
      ? (authoritativeSource === 'datasheet_pin_map' ? 'auditor_datasheet_pin_map' : 'auditor_authoritative_pin_map')
      : status === 'conflict'
        ? 'judge_crosscheck'
        : (typeof row.source === 'string' && row.source.trim().length > 0 ? row.source.trim() : 'auditor_ai');

    let note = typeof row.note === 'string' && row.note.trim().length > 0 ? row.note.trim() : undefined;
    if (!note && status === 'conflict' && authoritativePins.size > 0) {
      note = `Pin "${pinLabel}" is not present in authoritative connector map`;
    }
    entries.push({
      pinLabel,
      status,
      source,
      note,
      trust: status === 'verified'
        ? {
            verified: true,
            source: 'manual_entry',
            value: status,
            note: note ?? `Pin "${pinLabel}" matches authoritative ${authoritativeSource}.`,
          }
        : {
            verified: false,
            source: 'fallback_unknown',
            value: status,
            isMock: true,
            note: note ?? `Pin "${pinLabel}" is ${status} and must not be treated as authoritative.`,
          },
    });
  }

  return entries;
}

export function registerCircuitInstanceRoutes(app: Express, storage: IStorage): void {
  app.get('/api/circuits/:circuitId/instances', requireCircuitOwnership, async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const pagination = circuitPaginationSchema.safeParse(req.query);
    if (!pagination.success) {
      return res.status(400).json({ message: 'Invalid pagination: ' + fromZodError(pagination.error).toString() });
    }
    const { limit, offset, sort } = pagination.data;
    const all = await storage.getCircuitInstances(circuitId);
    const sorted = sort === 'asc' ? all : [...all].reverse();
    const data = sorted.slice(offset, offset + limit);
    res.json({ data, total: all.length });
  });

  app.get('/api/circuits/:circuitId/instances/:id', requireCircuitOwnership, async (req, res) => {
    const id = parseIdParam(req.params.id);
    const instance = await storage.getCircuitInstance(id);
    if (!instance) { return res.status(404).json({ message: 'Circuit instance not found' }); }
    res.json(instance);
  });

  app.post('/api/circuits/:circuitId/instances', requireCircuitOwnership, payloadLimit(16 * 1024), async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = createInstanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }

    // Auto-generate reference designator if not provided (or strip trailing '?')
    let refDes = parsed.data.referenceDesignator;
    if (refDes && refDes.endsWith('?')) {
      // Client sent a placeholder like "R?" — strip the '?' and let auto-increment resolve
      refDes = undefined;
    }
    if (!refDes) {
      const existing = await storage.getCircuitInstances(circuitId);
      const existingRefdes = existing.map((inst) => inst.referenceDesignator);
      // Derive prefix from the part's family metadata or properties
      let prefix = 'X';
      try {
        if (parsed.data.partId) {
          const design = await storage.getCircuitDesign(circuitId);
          if (design) {
            const part = await storage.getComponentPart(parsed.data.partId, design.projectId);
            if (part) {
              const meta = (part.meta ?? {}) as Partial<PartMeta>;
              prefix = getRefDesPrefix({ family: meta.family, tags: meta.tags });
            }
          }
        } else {
          // BL-0497: No partId — derive prefix from properties.componentTitle
          const props = parsed.data.properties ?? {};
          const title = (props.componentTitle ?? '').toLowerCase();
          const titlePrefix = getRefDesPrefix({ family: title, tags: title.split(/\s+/) });
          if (titlePrefix !== 'X') { prefix = titlePrefix; }
        }
      } catch {
        // If part lookup fails, fall back to 'X' prefix
      }
      refDes = nextRefdes(prefix, existingRefdes);
    }

    const data = { ...parsed.data, circuitId, referenceDesignator: refDes, properties: parsed.data.properties ?? {} };
    const instance = await storage.createCircuitInstance(data);
    res.status(201).json(instance);

    // Phase 2 dual-write mirror: circuit instance → parts (via component_part lookup)
    // + part_placements. Best-effort, fire-and-forget. Only fires when the instance has
    // a concrete partId to mirror; instances with null partId rely on properties.componentTitle
    // and are left for Phase 4 backfill.
    if (featureFlags.partsCatalogV2 && parsed.data.partId) {
      void (async () => {
        try {
          const design = await storage.getCircuitDesign(circuitId);
          if (!design) { return; }
          const part = await storage.getComponentPart(parsed.data.partId!, design.projectId);
          if (!part) { return; }
          const meta = (part.meta ?? {}) as Record<string, unknown>;
          const title =
            (typeof meta['title'] === 'string' && meta['title']) ||
            (typeof meta['label'] === 'string' && meta['label']) ||
            instance.referenceDesignator;
          const canonicalCategory =
            (typeof meta['partFamily'] === 'string' && meta['partFamily']) ||
            (typeof meta['family'] === 'string' && meta['family']) ||
            (typeof meta['category'] === 'string' && meta['category']) ||
            'other';
          const ingressReq: IngressRequest = {
            source: 'circuit_instance',
            origin: 'user',
            projectId: design.projectId,
            fields: {
              title,
              description: typeof meta['description'] === 'string' ? meta['description'] : null,
              manufacturer: typeof meta['manufacturer'] === 'string' ? meta['manufacturer'] : null,
              mpn: typeof meta['mpn'] === 'string' ? meta['mpn'] : null,
              canonicalCategory,
              packageType: typeof meta['packageType'] === 'string' ? meta['packageType'] : null,
              meta,
              connectors: (part.connectors ?? []) as unknown[],
            },
            placement: {
              surface: 'schematic',
              containerType: 'circuit',
              containerId: circuitId,
              referenceDesignator: instance.referenceDesignator,
              x: parsed.data.schematicX ?? null,
              y: parsed.data.schematicY ?? null,
              rotation: parsed.data.schematicRotation ?? 0,
            },
          };
          await mirrorIngressBestEffort(
            ingressReq,
            {
              source: 'circuit_instance',
              projectId: design.projectId,
              legacyTable: 'circuit_instances',
              legacyId: instance.id,
            },
            db,
          );
        } catch {
          // Mirror is best-effort; swallow the error and let Phase 4 reconcile.
        }
      })();
    }
  });

  // BL-0638: Verify instance belongs to the circuit before mutating
  app.patch('/api/circuits/:circuitId/instances/:id', requireCircuitOwnership, payloadLimit(16 * 1024), async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const id = parseIdParam(req.params.id);
    const existing = await storage.getCircuitInstance(id);
    if (!existing || existing.circuitId !== circuitId) {
      return res.status(404).json({ message: 'Circuit instance not found' });
    }
    const parsed = updateInstanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const updated = await storage.updateCircuitInstance(id, parsed.data);
    if (!updated) { return res.status(404).json({ message: 'Circuit instance not found' }); }
    res.json(updated);
  });

  // BL-0638: Verify instance belongs to the circuit before deleting
  app.delete('/api/circuits/:circuitId/instances/:id', requireCircuitOwnership, async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const id = parseIdParam(req.params.id);
    const existing = await storage.getCircuitInstance(id);
    if (!existing || existing.circuitId !== circuitId) {
      return res.status(404).json({ message: 'Circuit instance not found' });
    }
    const deleted = await storage.deleteCircuitInstance(id);
    if (!deleted) { return res.status(404).json({ message: 'Circuit instance not found' }); }
    res.status(204).end();
  });

  // ---------------------------------------------------------------------------
  // Push to PCB — forward annotation from schematic to PCB layout
  // ---------------------------------------------------------------------------

  app.post('/api/circuits/:circuitId/pin-verification/run', requireCircuitOwnership, payloadLimit(16 * 1024), async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = runPinVerificationSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }

    const instances = await storage.getCircuitInstances(circuitId);
    const design = await storage.getCircuitDesign(circuitId);
    const projectId = design?.projectId ?? null;
    const partConnectorCache = new Map<number, Set<string>>();
    const suppliedReports = parsed.data.auditorReports ?? [];
    const autoReports = parsed.data.autoAuditor
      ? await buildAutoAuditorReports(instances, storage, projectId)
      : [];
    const auditorReportPins = extractAuthoritativePinsFromAuditorReports([...suppliedReports, ...autoReports]);

    const generated = await Promise.all(instances.map(async (instance) => {
      let authoritativePins = new Set<string>();
      let authoritativeSource: AuthoritativePinSource = 'none';
      let authoritativeSourceLabel = 'none';

      const report = auditorReportPins.get(instance.id);
      if (report && report.pins.size > 0) {
        authoritativePins = report.pins;
        authoritativeSource = 'datasheet_pin_map';
        authoritativeSourceLabel = report.source;
      }

      if (projectId != null && instance.partId != null) {
        const cached = partConnectorCache.get(instance.partId);
        if (cached) {
          if (cached.size > 0) {
            authoritativePins = cached;
            authoritativeSource = 'component_connectors';
            authoritativeSourceLabel = 'component_connectors';
          }
        } else {
          const part = await storage.getComponentPart(instance.partId, projectId);
          const connectorPins = extractAuthoritativePinsFromConnectors(part?.connectors);
          partConnectorCache.set(instance.partId, connectorPins);
          if (connectorPins.size > 0) {
            authoritativePins = connectorPins;
            authoritativeSource = 'component_connectors';
            authoritativeSourceLabel = 'component_connectors';
          }
        }
      }
      if (authoritativePins.size === 0) {
        const datasheetPins = extractAuthoritativePinsFromDatasheetProperty(instance.properties);
        if (datasheetPins.size > 0) {
          authoritativePins = datasheetPins;
          authoritativeSource = 'datasheet_pin_map';
          authoritativeSourceLabel = 'datasheet_pin_map';
        }
      }
      return {
        instanceId: instance.id,
        referenceDesignator: instance.referenceDesignator,
        entries: detectPinVerificationEntriesFromProperties(instance.properties, authoritativePins, authoritativeSource),
        authoritativeSource,
        authoritativeSourceLabel,
      };
    }));

    const flagged = generated.filter((row) => row.entries.some((entry) => entry.status !== 'verified'));
    if (!parsed.data.dryRun) {
      await Promise.all(
        flagged.map(async (row) => {
          const existing = instances.find((instance) => instance.id === row.instanceId);
          if (!existing) {
            return;
          }
          const currentProperties = (existing.properties && typeof existing.properties === 'object')
            ? (existing.properties as Record<string, unknown>)
            : {};
          await storage.updateCircuitInstance(row.instanceId, {
            properties: {
              ...currentProperties,
              pinVerificationEntries: row.entries,
              pinVerificationAuthoritativeSource: row.authoritativeSourceLabel,
              pinVerificationLastRunAt: new Date().toISOString(),
            } as unknown as Record<string, string>,
          });
        }),
      );
    }

    const openAIAgentsCompatible = await detectOpenAIAgentsRuntimeAvailable();
    const openAIAgentsJudge = await runOpenAIAgentsJudgeRationale({
      circuitId,
      flaggedInstances: flagged.length,
      unverifiedGuessCount: flagged.reduce((sum, row) => sum + row.entries.filter((e) => e.status === 'unverified_ai_guess').length, 0),
      conflictCount: flagged.reduce((sum, row) => sum + row.entries.filter((e) => e.status === 'conflict').length, 0),
    });
    const response = {
      ok: true,
      circuitId,
      totalInstances: instances.length,
      flaggedInstances: flagged.length,
      unverifiedGuessCount: flagged.reduce((sum, row) => sum + row.entries.filter((e) => e.status === 'unverified_ai_guess').length, 0),
      conflictCount: flagged.reduce((sum, row) => sum + row.entries.filter((e) => e.status === 'conflict').length, 0),
      dryRun: parsed.data.dryRun,
      results: flagged.map((row) => ({
        instanceId: row.instanceId,
        referenceDesignator: row.referenceDesignator,
        authoritativeSource: row.authoritativeSource,
        authoritativeSourceLabel: row.authoritativeSourceLabel,
        entries: row.entries,
      })),
      orchestration: {
        mode: 'local_mcp_swarm',
        engine: {
          coordinator: 'genkit',
          transport: 'mcp',
          openaiAgentsCompatible: openAIAgentsCompatible,
          openaiAgentsExecution: openAIAgentsJudge.executed,
        },
        stages: [
          {
            role: 'drafter',
            source: 'instance.properties.aiPinMappings',
            action: 'generated candidate pin mappings',
          },
          {
            role: 'auditor',
            source: suppliedReports.length > 0 || autoReports.length > 0 ? 'auditor_reports' : 'component_connectors_or_datasheet_pin_map',
            action: 'loaded authoritative pin candidates',
          },
          {
            role: 'judge',
            source: 'pin-verification crosscheck',
            action: 'classified entries as verified, unverified_ai_guess, or conflict',
          },
          ...(openAIAgentsJudge.executed
            ? [
                {
                  role: 'judge' as const,
                  source: '@openai/agents',
                  action: openAIAgentsJudge.rationale
                    ? `agent rationale: ${openAIAgentsJudge.rationale}`
                    : 'agent rationale generated',
                },
              ]
            : []),
        ],
      } as PinVerificationOrchestrationTrace,
    };

    pinVerificationRunCounter += 1;
    const runRecord: PinVerificationRunRecord = {
      runId: `pv-${String(pinVerificationRunCounter)}`,
      circuitId,
      createdAt: Date.now(),
      flaggedInstances: response.flaggedInstances,
      unverifiedGuessCount: response.unverifiedGuessCount,
      conflictCount: response.conflictCount,
      dryRun: response.dryRun,
      topAuthoritativeSourceLabel: response.results[0]?.authoritativeSourceLabel ?? response.results[0]?.authoritativeSource ?? 'none',
    };
    const history = pinVerificationHistoryByCircuit.get(circuitId) ?? [];
    history.unshift(runRecord);
    pinVerificationHistoryByCircuit.set(circuitId, history.slice(0, 25));

    return res.status(200).json(response);
  });

  app.get('/api/circuits/:circuitId/pin-verification/history', requireCircuitOwnership, async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const history = pinVerificationHistoryByCircuit.get(circuitId) ?? [];
    return res.status(200).json({
      ok: true,
      circuitId,
      total: history.length,
      data: history,
    });
  });

  app.post('/api/circuits/:circuitId/push-to-pcb', requireCircuitOwnership, payloadLimit(16 * 1024), async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const instances = await storage.getCircuitInstances(circuitId);

    if (instances.length === 0) {
      return res.status(400).json({ message: 'No instances in this circuit design' });
    }

    // Separate placed vs unplaced instances
    const unplaced = instances.filter((inst) => inst.pcbX == null || inst.pcbY == null);
    const alreadyPlaced = instances.length - unplaced.length;

    // Assign default positions in an "unplaced parts" area to the left of the board origin
    // Stack vertically with spacing, at negative X so they appear outside the board
    const UNPLACED_X = -30; // mm, left of board origin
    const START_Y = 5;      // mm
    const SPACING_Y = 15;   // mm between components

    const pushedInstances: CircuitInstanceRow[] = [];
    for (let i = 0; i < unplaced.length; i++) {
      const inst = unplaced[i]!;
      const updated = await storage.updateCircuitInstance(inst.id, {
        pcbX: UNPLACED_X,
        pcbY: START_Y + i * SPACING_Y,
        pcbRotation: 0,
        pcbSide: 'front',
      });
      if (updated) {
        pushedInstances.push(updated);
      }
    }

    res.json({
      pushed: pushedInstances.length,
      alreadyPlaced,
      total: instances.length,
      instances: pushedInstances,
    });
  });
}
