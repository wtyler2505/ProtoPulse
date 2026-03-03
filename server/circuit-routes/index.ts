import type { Express } from 'express';
import type { IStorage } from '../storage';
import { registerCircuitDesignRoutes } from './designs';
import { registerCircuitInstanceRoutes } from './instances';
import { registerCircuitNetRoutes } from './nets';
import { registerCircuitWireRoutes } from './wires';
import { registerCircuitExpansionRoutes } from './expansion';
import { registerCircuitNetlistRoutes } from './netlist';
import { registerCircuitAutorouteRoutes } from './autoroute';
import { registerCircuitExportRoutes } from './exports';
import { registerCircuitImportRoutes } from './imports';
import { registerCircuitSimulationRoutes } from './simulations';
import { registerCircuitHierarchyRoutes } from './hierarchy';

export function registerCircuitRoutes(app: Express, storage: IStorage): void {
  registerCircuitHierarchyRoutes(app, storage);
  registerCircuitDesignRoutes(app, storage);
  registerCircuitInstanceRoutes(app, storage);
  registerCircuitNetRoutes(app, storage);
  registerCircuitWireRoutes(app, storage);
  registerCircuitExpansionRoutes(app, storage);
  registerCircuitNetlistRoutes(app, storage);
  registerCircuitAutorouteRoutes(app, storage);
  registerCircuitExportRoutes(app, storage);
  registerCircuitImportRoutes(app, storage);
  registerCircuitSimulationRoutes(app, storage);
}
