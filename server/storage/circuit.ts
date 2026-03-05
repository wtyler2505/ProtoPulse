import { eq, and, desc, asc, isNull, sql } from 'drizzle-orm';
import {
  circuitDesigns, type CircuitDesignRow, type InsertCircuitDesign,
  circuitInstances, type CircuitInstanceRow, type InsertCircuitInstance,
  circuitNets, type CircuitNetRow, type InsertCircuitNet,
  circuitWires, type CircuitWireRow, type InsertCircuitWire,
  simulationResults, type SimulationResultRow, type InsertSimulationResult,
  hierarchicalPorts, type HierarchicalPortRow, type InsertHierarchicalPort,
} from '@shared/schema';
import { StorageError, VersionConflictError } from './errors';
import type { StorageDeps } from './types';

export class CircuitStorage {
  constructor(private deps: StorageDeps) {}

  private get db() { return this.deps.db; }

  // --- Circuit Designs ---

  async getCircuitDesigns(projectId: number): Promise<CircuitDesignRow[]> {
    try {
      return await this.db.select().from(circuitDesigns)
        .where(eq(circuitDesigns.projectId, projectId))
        .orderBy(asc(circuitDesigns.id));
    } catch (e) {
      throw new StorageError('getCircuitDesigns', `projects/${projectId}/circuit-designs`, e);
    }
  }

  async getCircuitDesign(id: number): Promise<CircuitDesignRow | undefined> {
    try {
      const [design] = await this.db.select().from(circuitDesigns)
        .where(eq(circuitDesigns.id, id));
      return design;
    } catch (e) {
      throw new StorageError('getCircuitDesign', `circuit-designs/${id}`, e);
    }
  }

  async createCircuitDesign(data: InsertCircuitDesign): Promise<CircuitDesignRow> {
    try {
      const [created] = await this.db.insert(circuitDesigns).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('createCircuitDesign', 'circuit-designs', e);
    }
  }

  async updateCircuitDesign(id: number, data: Partial<InsertCircuitDesign>, expectedVersion?: number): Promise<CircuitDesignRow | undefined> {
    try {
      const conditions = [eq(circuitDesigns.id, id)];
      if (expectedVersion !== undefined) {
        conditions.push(eq(circuitDesigns.version, expectedVersion));
      }
      const [updated] = await this.db.update(circuitDesigns)
        .set({ ...data, version: sql`${circuitDesigns.version} + 1`, updatedAt: new Date() })
        .where(and(...conditions))
        .returning();
      if (expectedVersion !== undefined && !updated) {
        const [existing] = await this.db.select({ id: circuitDesigns.id, version: circuitDesigns.version })
          .from(circuitDesigns).where(eq(circuitDesigns.id, id));
        if (existing) {
          throw new VersionConflictError('circuit-designs', id, existing.version);
        }
      }
      return updated;
    } catch (e) {
      if (e instanceof StorageError) { throw e; }
      throw new StorageError('updateCircuitDesign', `circuit-designs/${id}`, e);
    }
  }

  async deleteCircuitDesign(id: number): Promise<CircuitDesignRow | undefined> {
    try {
      const [deleted] = await this.db.delete(circuitDesigns)
        .where(eq(circuitDesigns.id, id))
        .returning();
      return deleted;
    } catch (e) {
      throw new StorageError('deleteCircuitDesign', `circuit-designs/${id}`, e);
    }
  }

  // --- Circuit Instances ---

  async getCircuitInstances(circuitId: number): Promise<CircuitInstanceRow[]> {
    try {
      return await this.db.select().from(circuitInstances)
        .where(eq(circuitInstances.circuitId, circuitId))
        .orderBy(asc(circuitInstances.id));
    } catch (e) {
      throw new StorageError('getCircuitInstances', `circuits/${circuitId}/instances`, e);
    }
  }

  async getCircuitInstance(id: number): Promise<CircuitInstanceRow | undefined> {
    try {
      const [instance] = await this.db.select().from(circuitInstances)
        .where(eq(circuitInstances.id, id));
      return instance;
    } catch (e) {
      throw new StorageError('getCircuitInstance', `circuit-instances/${id}`, e);
    }
  }

  async createCircuitInstance(data: InsertCircuitInstance): Promise<CircuitInstanceRow> {
    try {
      const [created] = await this.db.insert(circuitInstances).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('createCircuitInstance', 'circuit-instances', e);
    }
  }

  async updateCircuitInstance(id: number, data: Partial<InsertCircuitInstance>): Promise<CircuitInstanceRow | undefined> {
    try {
      const [updated] = await this.db.update(circuitInstances)
        .set(data)
        .where(eq(circuitInstances.id, id))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateCircuitInstance', `circuit-instances/${id}`, e);
    }
  }

  async deleteCircuitInstance(id: number): Promise<CircuitInstanceRow | undefined> {
    try {
      const [deleted] = await this.db.delete(circuitInstances)
        .where(eq(circuitInstances.id, id))
        .returning();
      return deleted;
    } catch (e) {
      throw new StorageError('deleteCircuitInstance', `circuit-instances/${id}`, e);
    }
  }

  // --- Circuit Nets ---

  async getCircuitNets(circuitId: number): Promise<CircuitNetRow[]> {
    try {
      return await this.db.select().from(circuitNets)
        .where(eq(circuitNets.circuitId, circuitId))
        .orderBy(asc(circuitNets.id));
    } catch (e) {
      throw new StorageError('getCircuitNets', `circuits/${circuitId}/nets`, e);
    }
  }

  async getCircuitNet(id: number): Promise<CircuitNetRow | undefined> {
    try {
      const [net] = await this.db.select().from(circuitNets)
        .where(eq(circuitNets.id, id));
      return net;
    } catch (e) {
      throw new StorageError('getCircuitNet', `circuit-nets/${id}`, e);
    }
  }

  async createCircuitNet(data: InsertCircuitNet): Promise<CircuitNetRow> {
    try {
      const [created] = await this.db.insert(circuitNets).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('createCircuitNet', 'circuit-nets', e);
    }
  }

  async updateCircuitNet(id: number, data: Partial<InsertCircuitNet>): Promise<CircuitNetRow | undefined> {
    try {
      const [updated] = await this.db.update(circuitNets)
        .set(data)
        .where(eq(circuitNets.id, id))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateCircuitNet', `circuit-nets/${id}`, e);
    }
  }

  async deleteCircuitNet(id: number): Promise<CircuitNetRow | undefined> {
    try {
      const [deleted] = await this.db.delete(circuitNets)
        .where(eq(circuitNets.id, id))
        .returning();
      return deleted;
    } catch (e) {
      throw new StorageError('deleteCircuitNet', `circuit-nets/${id}`, e);
    }
  }

  // --- Circuit Wires ---

  async getCircuitWires(circuitId: number): Promise<CircuitWireRow[]> {
    try {
      return await this.db.select().from(circuitWires)
        .where(eq(circuitWires.circuitId, circuitId))
        .orderBy(asc(circuitWires.id));
    } catch (e) {
      throw new StorageError('getCircuitWires', `circuits/${circuitId}/wires`, e);
    }
  }

  async getCircuitWire(id: number): Promise<CircuitWireRow | undefined> {
    try {
      const [wire] = await this.db.select().from(circuitWires)
        .where(eq(circuitWires.id, id));
      return wire;
    } catch (e) {
      throw new StorageError('getCircuitWire', `circuit-wires/${id}`, e);
    }
  }

  async createCircuitWire(data: InsertCircuitWire): Promise<CircuitWireRow> {
    try {
      const [created] = await this.db.insert(circuitWires).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('createCircuitWire', 'circuit-wires', e);
    }
  }

  async updateCircuitWire(id: number, data: Partial<InsertCircuitWire>): Promise<CircuitWireRow | undefined> {
    try {
      const [updated] = await this.db.update(circuitWires)
        .set(data)
        .where(eq(circuitWires.id, id))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateCircuitWire', `circuit-wires/${id}`, e);
    }
  }

  async deleteCircuitWire(id: number): Promise<CircuitWireRow | undefined> {
    try {
      const [deleted] = await this.db.delete(circuitWires)
        .where(eq(circuitWires.id, id))
        .returning();
      return deleted;
    } catch (e) {
      throw new StorageError('deleteCircuitWire', `circuit-wires/${id}`, e);
    }
  }

  // --- Simulation Results ---

  async getSimulationResults(circuitId: number): Promise<SimulationResultRow[]> {
    try {
      return await this.db.select()
        .from(simulationResults)
        .where(eq(simulationResults.circuitId, circuitId))
        .orderBy(desc(simulationResults.createdAt));
    } catch (e) {
      throw new StorageError('getSimulationResults', `circuits/${circuitId}/simulations`, e);
    }
  }

  async getSimulationResult(id: number): Promise<SimulationResultRow | undefined> {
    try {
      const [result] = await this.db.select()
        .from(simulationResults)
        .where(eq(simulationResults.id, id));
      return result;
    } catch (e) {
      throw new StorageError('getSimulationResult', `simulations/${id}`, e);
    }
  }

  async createSimulationResult(data: InsertSimulationResult): Promise<SimulationResultRow> {
    try {
      const [result] = await this.db.insert(simulationResults)
        .values(data)
        .returning();
      return result;
    } catch (e) {
      throw new StorageError('createSimulationResult', `circuits/${data.circuitId}/simulations`, e);
    }
  }

  async deleteSimulationResult(id: number): Promise<SimulationResultRow | undefined> {
    try {
      const [deleted] = await this.db.delete(simulationResults)
        .where(eq(simulationResults.id, id))
        .returning();
      return deleted;
    } catch (e) {
      throw new StorageError('deleteSimulationResult', `simulations/${id}`, e);
    }
  }

  async cleanupSimulationResults(circuitId: number, maxResults: number): Promise<number> {
    try {
      const results = await this.db.select({ id: simulationResults.id })
        .from(simulationResults)
        .where(eq(simulationResults.circuitId, circuitId))
        .orderBy(desc(simulationResults.createdAt));

      if (results.length <= maxResults) { return 0; }

      const idsToDelete = results.slice(maxResults).map(r => r.id);
      let deleted = 0;
      for (const id of idsToDelete) {
        await this.db.delete(simulationResults)
          .where(eq(simulationResults.id, id));
        deleted++;
      }
      return deleted;
    } catch (e) {
      throw new StorageError('cleanupSimulationResults', `circuits/${circuitId}/simulations`, e);
    }
  }

  // --- Hierarchical Sheet Navigation ---

  async getChildDesigns(parentDesignId: number): Promise<CircuitDesignRow[]> {
    try {
      return await this.db.select().from(circuitDesigns)
        .where(eq(circuitDesigns.parentDesignId, parentDesignId))
        .orderBy(asc(circuitDesigns.id));
    } catch (e) {
      throw new StorageError('getChildDesigns', `circuit-designs/${parentDesignId}/children`, e);
    }
  }

  async getRootDesigns(projectId: number): Promise<CircuitDesignRow[]> {
    try {
      return await this.db.select().from(circuitDesigns)
        .where(and(eq(circuitDesigns.projectId, projectId), isNull(circuitDesigns.parentDesignId)))
        .orderBy(asc(circuitDesigns.id));
    } catch (e) {
      throw new StorageError('getRootDesigns', `projects/${projectId}/root-designs`, e);
    }
  }

  async getHierarchicalPorts(designId: number): Promise<HierarchicalPortRow[]> {
    try {
      return await this.db.select().from(hierarchicalPorts)
        .where(eq(hierarchicalPorts.designId, designId))
        .orderBy(asc(hierarchicalPorts.id));
    } catch (e) {
      throw new StorageError('getHierarchicalPorts', `circuit-designs/${designId}/ports`, e);
    }
  }

  async getHierarchicalPort(id: number): Promise<HierarchicalPortRow | undefined> {
    try {
      const [port] = await this.db.select().from(hierarchicalPorts)
        .where(eq(hierarchicalPorts.id, id));
      return port;
    } catch (e) {
      throw new StorageError('getHierarchicalPort', `hierarchical-ports/${id}`, e);
    }
  }

  async createHierarchicalPort(data: InsertHierarchicalPort): Promise<HierarchicalPortRow> {
    try {
      const [port] = await this.db.insert(hierarchicalPorts)
        .values(data)
        .returning();
      return port;
    } catch (e) {
      throw new StorageError('createHierarchicalPort', `circuit-designs/${data.designId}/ports`, e);
    }
  }

  async updateHierarchicalPort(id: number, data: Partial<InsertHierarchicalPort>): Promise<HierarchicalPortRow | undefined> {
    try {
      const [updated] = await this.db.update(hierarchicalPorts)
        .set(data)
        .where(eq(hierarchicalPorts.id, id))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateHierarchicalPort', `hierarchical-ports/${id}`, e);
    }
  }

  async deleteHierarchicalPort(id: number): Promise<HierarchicalPortRow | undefined> {
    try {
      const [deleted] = await this.db.delete(hierarchicalPorts)
        .where(eq(hierarchicalPorts.id, id))
        .returning();
      return deleted;
    } catch (e) {
      throw new StorageError('deleteHierarchicalPort', `hierarchical-ports/${id}`, e);
    }
  }
}
