/**
 * Intent handler registry — ordered by match priority.
 *
 * The first handler whose `match()` returns true wins, so more specific
 * handlers (e.g. "add to bom") must precede broader ones (e.g. "add node").
 * This order mirrors the original if/else chain in parseLocalIntent.
 */

import type { IntentHandler } from './types';
import { navigationHandler } from './navigation';
import { generateArchitectureHandler, clearCanvasHandler } from './architecture';
import { addNodeHandler, removeNodeHandler } from './nodes';
import { connectNodesHandler } from './connections';
import { addBomHandler, removeBomHandler, exportBomHandler, optimizeBomHandler } from './bom';
import { runValidationHandler, fixIssuesHandler } from './validation';
import { renameProjectHandler, updateDescriptionHandler } from './project';
import { projectInfoHandler, helpHandler, clearChatHandler } from './queries';
import {
  componentFallbackHandler,
  bomFallbackHandler,
  memoryFallbackHandler,
  powerFallbackHandler,
  antennaFallbackHandler,
  sensorFallbackHandler,
} from './domain-responses';

export type { IntentHandler, IntentContext, ParsedIntent } from './types';

/**
 * Handlers in priority order. The ordering here is critical — it preserves
 * the exact matching semantics of the original monolithic function.
 *
 * Groups (in order):
 *  1. Navigation (switch/go/show/open + view name)
 *  2. Generate architecture / clear canvas
 *  3. Add node / remove node
 *  4. Connect nodes
 *  5. BOM: add / remove / export / optimize
 *  6. Validation: run / fix
 *  7. Project metadata: rename / update description
 *  8. Read-only queries: project info / help / clear chat
 *  9. Domain-specific fallbacks: component, bom, memory, power, antenna, sensor
 */
export const intentHandlers: readonly IntentHandler[] = [
  // 1. Navigation
  navigationHandler,
  // 2. Architecture
  generateArchitectureHandler,
  clearCanvasHandler,
  // 3. Nodes
  addNodeHandler,
  removeNodeHandler,
  // 4. Connections
  connectNodesHandler,
  // 5. BOM (add/remove before export/optimize — "add to bom" must precede generic "add node")
  addBomHandler,
  removeBomHandler,
  exportBomHandler,
  optimizeBomHandler,
  // 6. Validation
  runValidationHandler,
  fixIssuesHandler,
  // 7. Project metadata
  renameProjectHandler,
  updateDescriptionHandler,
  // 8. Read-only queries
  projectInfoHandler,
  helpHandler,
  clearChatHandler,
  // 9. Domain-specific fallbacks (broadest patterns — must be last before default)
  componentFallbackHandler,
  bomFallbackHandler,
  memoryFallbackHandler,
  powerFallbackHandler,
  antennaFallbackHandler,
  sensorFallbackHandler,
];
