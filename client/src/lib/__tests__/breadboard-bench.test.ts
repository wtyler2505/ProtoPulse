import { describe, expect, it } from 'vitest';

import {
  buildBreadboardBenchSummary,
  buildBreadboardInventoryDigest,
  filterBreadboardBenchInsights,
  indexBreadboardBenchInsights,
} from '@/lib/breadboard-bench';
import { buildBreadboardChatPrompt, buildBreadboardPlannerPrompt } from '@/lib/breadboard-ai-prompts';
import type { BomItem } from '@/lib/project-context';
import type { ComponentPart } from '@shared/schema';

const parts: ComponentPart[] = [
  {
    id: 1,
    projectId: 1,
    nodeId: null,
    meta: {
      title: 'ATmega328P DIP',
      family: 'mcu',
      manufacturer: 'Microchip',
      mpn: 'ATmega328P-PU',
      mountingType: 'tht',
      packageType: 'DIP-28',
      properties: [],
      tags: ['microcontroller'],
      breadboardModelQuality: 'verified',
    },
    connectors: Array.from({ length: 28 }, (_, index) => ({ id: `pin-${index + 1}` })),
    buses: [],
    views: {
      breadboard: { shapes: [{ type: 'rect' }] },
      schematic: { shapes: [] },
      pcb: { shapes: [] },
    },
    constraints: [],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ComponentPart,
  {
    id: 2,
    projectId: 1,
    nodeId: null,
    meta: {
      title: 'BME280 Breakout',
      family: 'sensor',
      manufacturer: 'Bosch',
      mpn: 'BME280',
      mountingType: 'smd',
      packageType: 'LGA',
      properties: [],
      tags: ['sensor', 'breakout'],
    },
    connectors: Array.from({ length: 8 }, (_, index) => ({ id: `sensor-${index + 1}` })),
    buses: [],
    views: {
      breadboard: { shapes: [] },
      schematic: { shapes: [] },
      pcb: { shapes: [] },
    },
    constraints: [],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ComponentPart,
];

const bom: BomItem[] = [
  {
    id: 'bom-1',
    partNumber: 'ATmega328P-PU',
    manufacturer: 'Microchip',
    description: 'ATmega328P DIP microcontroller',
    quantity: 1,
    unitPrice: 2.4,
    totalPrice: 2.4,
    supplier: 'Digi-Key',
    stock: 100,
    status: 'In Stock',
    quantityOnHand: 3,
    minimumStock: 1,
    storageLocation: 'Drawer A1',
  },
];

describe('breadboard-bench helpers', () => {
  it('builds inventory-aware bench insights', () => {
    const summary = buildBreadboardBenchSummary(parts, bom);
    const indexed = indexBreadboardBenchInsights(summary.insights);

    expect(summary.totals.projectPartCount).toBe(2);
    expect(summary.totals.trackedCount).toBe(1);
    expect(summary.totals.ownedCount).toBe(1);
    expect(summary.totals.readyCount).toBe(1);
    expect(summary.totals.verifiedCount).toBe(1);
    expect(summary.totals.missingCount).toBe(1);
    expect(indexed[1]?.bomItemId).toBe('bom-1');
    expect(indexed[1]?.requiredQuantity).toBe(1);
    expect(indexed[1]?.storageLocation).toBe('Drawer A1');
    expect(indexed[2]?.fit).toBe('breakout_required');
  });

  it('filters breadboard insights by owned and starter-friendly slices', () => {
    const summary = buildBreadboardBenchSummary(parts, bom);

    expect(filterBreadboardBenchInsights(summary.insights, 'owned')).toHaveLength(1);
    expect(filterBreadboardBenchInsights(summary.insights, 'starter')).toHaveLength(1);
  });

  it('creates inventory digests and AI prompts with project context', () => {
    const summary = buildBreadboardBenchSummary(parts, bom);
    const digest = buildBreadboardInventoryDigest(summary.insights);

    expect(digest).toContain('ATmega328P DIP');
    expect(digest).toContain('BME280 Breakout');

    const chatPrompt = buildBreadboardChatPrompt('diagnose_wiring', {
      projectName: 'Rover Brain',
      insights: summary.insights,
    });
    const plannerPrompt = buildBreadboardPlannerPrompt('build_from_stash', {
      projectName: 'Rover Brain',
      insights: summary.insights,
    });
    const reconcilePrompt = buildBreadboardPlannerPrompt('reconcile_inventory', {
      projectName: 'Rover Brain',
      insights: summary.insights,
    });

    expect(chatPrompt).toContain('Rover Brain');
    expect(chatPrompt).toContain('Diagnose the current breadboard setup');
    expect(plannerPrompt).toContain('embedded-reasoning style planning');
    expect(plannerPrompt).toContain('Owned bench inventory');
    expect(reconcilePrompt).toContain('Audit the current owned stash');
  });
});
