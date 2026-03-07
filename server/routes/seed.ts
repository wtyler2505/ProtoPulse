import crypto from 'crypto';

import type { Express } from 'express';
import { db } from '../db';
import { storage } from '../storage';
import {
  projects,
  architectureNodes,
  architectureEdges,
  bomItems,
  validationIssues,
  chatMessages,
  historyItems,
  componentParts,
  componentLibrary,
} from '@shared/schema';
import { asyncHandler, payloadLimit } from './utils';
import { STANDARD_LIBRARY_COMPONENTS } from '@shared/standard-library';
import { eq, and, count } from 'drizzle-orm';

import type { StandardComponentDef } from '@shared/standard-library';

function buildSeedComponentPart(projectId: number) {
  const pinNames = ['VCC', 'PB0', 'PB1', 'PB2', 'PB3', 'PB4', 'GND', 'PB5'];
  const pinTypes: Array<'power' | 'io'> = ['power', 'io', 'io', 'io', 'io', 'io', 'power', 'io'];

  const connectors = pinNames.map((name, i) => {
    const pinNum = i + 1;
    const isLeft = pinNum <= 4;
    const row = isLeft ? i : 7 - i;
    const x = isLeft ? 20 : 180;
    const y = 35 + row * 70;
    return {
      id: `pin${pinNum}`,
      name,
      description: `Pin ${pinNum} - ${name} (${pinTypes[i]})`,
      connectorType: 'pad' as const,
      shapeIds: {
        breadboard: [`pin${pinNum}-bb`],
        schematic: [`pin${pinNum}-sch`],
        pcb: [`pin${pinNum}-pcb`],
      },
      terminalPositions: {
        breadboard: { x, y },
        schematic: { x, y },
        pcb: { x, y },
      },
      padSpec: {
        type: 'tht' as const,
        shape: 'circle' as const,
        diameter: 1.6,
        drill: 0.8,
      },
    };
  });

  const leftPinsBB = Array.from({ length: 4 }, (_, i) => ({
    id: `pin${i + 1}-bb`,
    type: 'rect' as const,
    x: 20,
    y: 30 + i * 70,
    width: 20,
    height: 10,
    rotation: 0,
    style: { fill: '#C0C0C0', stroke: '#999999', strokeWidth: 1 },
  }));
  const rightPinsBB = Array.from({ length: 4 }, (_, i) => ({
    id: `pin${i + 5}-bb`,
    type: 'rect' as const,
    x: 160,
    y: 240 - i * 70,
    width: 20,
    height: 10,
    rotation: 0,
    style: { fill: '#C0C0C0', stroke: '#999999', strokeWidth: 1 },
  }));
  const leftPinsSch = Array.from({ length: 4 }, (_, i) => ({
    id: `pin${i + 1}-sch`,
    type: 'rect' as const,
    x: 0,
    y: 30 + i * 70,
    width: 20,
    height: 10,
    rotation: 0,
    style: { fill: '#C0C0C0', stroke: '#000000', strokeWidth: 1 },
  }));
  const rightPinsSch = Array.from({ length: 4 }, (_, i) => ({
    id: `pin${i + 5}-sch`,
    type: 'rect' as const,
    x: 180,
    y: 240 - i * 70,
    width: 20,
    height: 10,
    rotation: 0,
    style: { fill: '#C0C0C0', stroke: '#000000', strokeWidth: 1 },
  }));
  const leftPinsPcb = Array.from({ length: 4 }, (_, i) => ({
    id: `pin${i + 1}-pcb`,
    type: 'circle' as const,
    x: 20,
    y: 30 + i * 70,
    width: 16,
    height: 16,
    cx: 28,
    cy: 35 + i * 70,
    rotation: 0,
    style: { fill: '#C0C0C0', stroke: '#999999', strokeWidth: 1 },
  }));
  const rightPinsPcb = Array.from({ length: 4 }, (_, i) => ({
    id: `pin${i + 5}-pcb`,
    type: 'circle' as const,
    x: 164,
    y: 240 - i * 70,
    width: 16,
    height: 16,
    cx: 172,
    cy: 245 - i * 70,
    rotation: 0,
    style: { fill: '#C0C0C0', stroke: '#999999', strokeWidth: 1 },
  }));

  return {
    projectId,
    meta: {
      title: 'ATtiny85',
      family: 'Microcontroller',
      description: '8-bit AVR Microcontroller, 8-pin DIP',
      manufacturer: 'Microchip',
      mpn: 'ATTINY85-20PU',
      mountingType: 'tht',
      packageType: 'DIP',
      tags: ['microcontroller', 'AVR', '8-bit', 'DIP-8'],
      properties: [],
    },
    connectors,
    buses: [],
    views: {
      breadboard: {
        shapes: [
          {
            id: 'body-bb',
            type: 'rect' as const,
            x: 40,
            y: 0,
            width: 120,
            height: 280,
            rotation: 0,
            style: { fill: '#333333', stroke: '#000000', strokeWidth: 2 },
          },
          {
            id: 'notch-bb',
            type: 'circle' as const,
            x: 90,
            y: 5,
            width: 20,
            height: 20,
            cx: 100,
            cy: 15,
            rotation: 0,
            style: { fill: '#555555', stroke: '#444444', strokeWidth: 1 },
          },
          {
            id: 'label-bb',
            type: 'text' as const,
            x: 55,
            y: 140,
            width: 90,
            height: 20,
            rotation: 0,
            text: 'ATtiny85',
            style: { fill: '#FFFFFF', fontSize: 11, fontFamily: 'monospace', textAnchor: 'middle' },
          },
          ...leftPinsBB,
          ...rightPinsBB,
        ],
      },
      schematic: {
        shapes: [
          {
            id: 'body-sch',
            type: 'rect' as const,
            x: 20,
            y: 0,
            width: 160,
            height: 280,
            rotation: 0,
            style: { fill: '#FFFFFF', stroke: '#000000', strokeWidth: 2 },
          },
          {
            id: 'label-sch',
            type: 'text' as const,
            x: 60,
            y: 140,
            width: 80,
            height: 20,
            rotation: 0,
            text: 'ATtiny85',
            style: { fontSize: 12, fontFamily: 'monospace', textAnchor: 'middle' },
          },
          ...leftPinsSch,
          ...rightPinsSch,
        ],
      },
      pcb: {
        shapes: [
          {
            id: 'body-pcb',
            type: 'rect' as const,
            x: 40,
            y: 0,
            width: 120,
            height: 280,
            rotation: 0,
            style: { fill: '#1a1a1a', stroke: '#333333', strokeWidth: 1 },
          },
          ...leftPinsPcb,
          ...rightPinsPcb,
        ],
      },
    },
    constraints: [],
  };
}

/**
 * Compute a SHA-256 content hash for a standard library component definition.
 * Used to detect whether an existing DB row needs updating.
 */
export function computeComponentHash(comp: StandardComponentDef): string {
  const payload = JSON.stringify({
    description: comp.description,
    category: comp.category,
    tags: comp.tags,
    meta: comp.meta,
    connectors: comp.connectors,
    buses: comp.buses,
    views: comp.views,
    constraints: comp.constraints,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export interface SeedResult {
  inserted: number;
  updated: number;
  unchanged: number;
}

/**
 * Seed the standard component library. True upsert by title + isPublic=true.
 * - If component does not exist: INSERT.
 * - If component exists but content hash differs: UPDATE.
 * - If component exists and content hash matches: SKIP (unchanged).
 */
export async function seedStandardLibrary(): Promise<SeedResult> {
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const comp of STANDARD_LIBRARY_COMPONENTS) {
    const newHash = computeComponentHash(comp);

    // Check if already exists
    const existing = await db
      .select({
        id: componentLibrary.id,
        description: componentLibrary.description,
        category: componentLibrary.category,
        tags: componentLibrary.tags,
        meta: componentLibrary.meta,
        connectors: componentLibrary.connectors,
        buses: componentLibrary.buses,
        views: componentLibrary.views,
        constraints: componentLibrary.constraints,
      })
      .from(componentLibrary)
      .where(and(eq(componentLibrary.title, comp.title), eq(componentLibrary.isPublic, true)));

    if (existing.length === 0) {
      // INSERT new component
      await db.insert(componentLibrary).values({
        title: comp.title,
        description: comp.description,
        category: comp.category,
        tags: comp.tags,
        meta: comp.meta,
        connectors: comp.connectors,
        buses: comp.buses,
        views: comp.views,
        constraints: comp.constraints,
        isPublic: true,
      });
      inserted++;
    } else {
      // Compute hash of existing row content to compare
      const existingHash = crypto.createHash('sha256').update(JSON.stringify({
        description: existing[0].description,
        category: existing[0].category,
        tags: existing[0].tags,
        meta: existing[0].meta,
        connectors: existing[0].connectors,
        buses: existing[0].buses,
        views: existing[0].views,
        constraints: existing[0].constraints,
      })).digest('hex');

      if (existingHash !== newHash) {
        // UPDATE existing component
        await db.update(componentLibrary)
          .set({
            description: comp.description,
            category: comp.category,
            tags: comp.tags,
            meta: comp.meta,
            connectors: comp.connectors,
            buses: comp.buses,
            views: comp.views,
            constraints: comp.constraints,
            updatedAt: new Date(),
          })
          .where(eq(componentLibrary.id, existing[0].id));
        updated++;
      } else {
        unchanged++;
      }
    }
  }

  return { inserted, updated, unchanged };
}

export function registerSeedRoutes(app: Express): void {
  // Seed standard library endpoint
  app.post(
    '/api/admin/seed-library',
    payloadLimit(16 * 1024),
    asyncHandler(async (_req, res) => {
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ message: 'Not found' });
      }
      const result = await seedStandardLibrary();
      res.json({
        message: 'Standard library seeded',
        inserted: result.inserted,
        updated: result.updated,
        unchanged: result.unchanged,
        total: STANDARD_LIBRARY_COMPONENTS.length,
      });
    }),
  );

  app.post(
    '/api/seed',
    payloadLimit(16 * 1024),
    asyncHandler(async (_req, res) => {
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ message: 'Not found' });
      }
      const existingProjects = await storage.getProjects();
      if (existingProjects.length > 0) {
        const existingParts = await storage.getComponentParts(existingProjects[0].id);
        if (existingParts.length === 0) {
          await storage.createComponentPart(buildSeedComponentPart(existingProjects[0].id));
        }
        return res.json({ message: 'Already seeded', project: existingProjects[0] });
      }

      const result = await db.transaction(async (tx) => {
        const [project] = await tx
          .insert(projects)
          .values({ name: 'Smart_Agro_Node_v1', description: 'IoT Agriculture Sensor Node' })
          .returning();

        await tx.insert(architectureNodes).values([
          {
            projectId: project.id,
            nodeId: '1',
            nodeType: 'mcu',
            label: 'ESP32-S3-WROOM-1',
            positionX: 400,
            positionY: 100,
            data: { description: 'Dual-core MCU, Wi-Fi/BLE' },
          },
          {
            projectId: project.id,
            nodeId: '2',
            nodeType: 'power',
            label: 'TP4056 PMU',
            positionX: 150,
            positionY: 250,
            data: { description: 'Li-Ion Battery Charger' },
          },
          {
            projectId: project.id,
            nodeId: '3',
            nodeType: 'comm',
            label: 'SX1262 LoRa',
            positionX: 650,
            positionY: 250,
            data: { description: 'Long Range Transceiver' },
          },
          {
            projectId: project.id,
            nodeId: '4',
            nodeType: 'sensor',
            label: 'SHT40',
            positionX: 400,
            positionY: 400,
            data: { description: 'Temp/Humidity Sensor' },
          },
          {
            projectId: project.id,
            nodeId: '5',
            nodeType: 'connector',
            label: 'USB-C Connector',
            positionX: 150,
            positionY: 100,
            data: { description: 'Power/Data Input' },
          },
        ]);

        await tx.insert(architectureEdges).values([
          {
            projectId: project.id,
            edgeId: 'e5-2',
            source: '5',
            target: '2',
            animated: true,
            label: '5V VBUS',
            style: { stroke: '#ef4444' },
          },
          {
            projectId: project.id,
            edgeId: 'e2-1',
            source: '2',
            target: '1',
            animated: true,
            label: '3.3V',
            style: { stroke: '#ef4444' },
          },
          {
            projectId: project.id,
            edgeId: 'e1-3',
            source: '1',
            target: '3',
            animated: true,
            label: 'SPI',
            style: { stroke: '#06b6d4' },
          },
          {
            projectId: project.id,
            edgeId: 'e1-4',
            source: '1',
            target: '4',
            animated: true,
            label: 'I2C',
            style: { stroke: '#06b6d4' },
          },
        ]);

        const bomData = [
          {
            projectId: project.id,
            partNumber: 'ESP32-S3-WROOM-1',
            manufacturer: 'Espressif',
            description: 'Wi-Fi/BLE MCU Module',
            quantity: 1,
            unitPrice: '3.5000',
            totalPrice: '3.5000',
            supplier: 'Mouser',
            stock: 1240,
            status: 'In Stock' as const,
          },
          {
            projectId: project.id,
            partNumber: 'TP4056',
            manufacturer: 'Top Power',
            description: 'Li-Ion Charger IC',
            quantity: 1,
            unitPrice: '0.1500',
            totalPrice: '0.1500',
            supplier: 'LCSC',
            stock: 50000,
            status: 'In Stock' as const,
          },
          {
            projectId: project.id,
            partNumber: 'SX1262IMLTRT',
            manufacturer: 'Semtech',
            description: 'LoRa Transceiver',
            quantity: 1,
            unitPrice: '4.2000',
            totalPrice: '4.2000',
            supplier: 'Digi-Key',
            stock: 85,
            status: 'Low Stock' as const,
          },
          {
            projectId: project.id,
            partNumber: 'SHT40-AD1B-R2',
            manufacturer: 'Sensirion',
            description: 'Sensor Humidity/Temp',
            quantity: 1,
            unitPrice: '1.8500',
            totalPrice: '1.8500',
            supplier: 'Mouser',
            stock: 5000,
            status: 'In Stock' as const,
          },
          {
            projectId: project.id,
            partNumber: 'USB4105-GF-A',
            manufacturer: 'GCT',
            description: 'USB Type-C Receptacle',
            quantity: 1,
            unitPrice: '0.6500',
            totalPrice: '0.6500',
            supplier: 'Digi-Key',
            stock: 12000,
            status: 'In Stock' as const,
          },
        ];
        await tx.insert(bomItems).values(bomData);

        await tx.insert(validationIssues).values([
          {
            projectId: project.id,
            severity: 'warning',
            message: 'Missing decoupling capacitor on ESP32 VDD',
            componentId: '1',
            suggestion: 'Add 10uF + 0.1uF ceramic capacitors close to pins.',
          },
          {
            projectId: project.id,
            severity: 'error',
            message: 'LoRa antenna path impedance mismatch likely',
            componentId: '3',
            suggestion: 'Check RF trace width and add Pi-matching network.',
          },
        ]);

        await tx.insert(chatMessages).values({
          projectId: project.id,
          role: 'system',
          content:
            'Welcome to ProtoPulse AI. I can help you generate architectures, create schematics, and optimize your BOM.',
          mode: 'chat',
        });

        await tx.insert(historyItems).values([
          { projectId: project.id, action: 'Project Created', user: 'User' },
          { projectId: project.id, action: 'Added ESP32-S3', user: 'User' },
          { projectId: project.id, action: 'Auto-connected Power Rails', user: 'AI' },
        ]);

        await tx.insert(componentParts).values(buildSeedComponentPart(project.id));

        return project;
      });

      res.status(201).json({ message: 'Seeded successfully', project: result });
    }),
  );
}
