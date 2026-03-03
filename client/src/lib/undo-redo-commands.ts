/**
 * Pre-built command factories for common undoable operations.
 *
 * Each factory returns an `UndoableCommand` that pairs an execute function
 * with its inverse.  The factories are agnostic about *how* the mutations
 * happen — callers pass in the add/remove/update callbacks (typically from
 * React Query mutations exposed by domain contexts).
 */

import type { UndoableCommand } from '@/lib/undo-redo';

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/**
 * Groups multiple commands into a single undoable unit.
 * Execute runs all in order; undo reverses them in reverse order.
 */
export function createBatchCommand(
  commands: UndoableCommand[],
  description?: string,
): UndoableCommand {
  return {
    type: 'batch',
    description: description ?? commands.map((c) => c.description).join(', '),
    async execute() {
      for (const cmd of commands) {
        await cmd.execute();
      }
    },
    async undo() {
      for (let i = commands.length - 1; i >= 0; i--) {
        await commands[i].undo();
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Architecture node commands
// ---------------------------------------------------------------------------

/** Command that adds an architecture node; undo removes it. */
export function createAddNodeCommand<T>(
  nodeData: T,
  addFn: (data: T) => void | Promise<void>,
  removeFn: (data: T) => void | Promise<void>,
  description?: string,
): UndoableCommand {
  return {
    type: 'add-node',
    description: description ?? 'Add node',
    async execute() {
      await addFn(nodeData);
    },
    async undo() {
      await removeFn(nodeData);
    },
  };
}

/** Command that removes an architecture node; undo re-adds it. */
export function createRemoveNodeCommand<T>(
  nodeId: string,
  nodeData: T,
  addFn: (data: T) => void | Promise<void>,
  removeFn: (id: string) => void | Promise<void>,
  description?: string,
): UndoableCommand {
  return {
    type: 'remove-node',
    description: description ?? `Remove node ${nodeId}`,
    async execute() {
      await removeFn(nodeId);
    },
    async undo() {
      await addFn(nodeData);
    },
  };
}

/** Command that updates properties on a node; undo restores the old values. */
export function createUpdateNodeCommand<T>(
  nodeId: string,
  oldData: T,
  newData: T,
  updateFn: (id: string, data: T) => void | Promise<void>,
  description?: string,
): UndoableCommand {
  return {
    type: 'update-node',
    description: description ?? `Update node ${nodeId}`,
    async execute() {
      await updateFn(nodeId, newData);
    },
    async undo() {
      await updateFn(nodeId, oldData);
    },
  };
}

// ---------------------------------------------------------------------------
// Architecture edge commands
// ---------------------------------------------------------------------------

/** Command that adds an architecture edge; undo removes it. */
export function createAddEdgeCommand<T>(
  edgeData: T,
  addFn: (data: T) => void | Promise<void>,
  removeFn: (data: T) => void | Promise<void>,
  description?: string,
): UndoableCommand {
  return {
    type: 'add-edge',
    description: description ?? 'Add edge',
    async execute() {
      await addFn(edgeData);
    },
    async undo() {
      await removeFn(edgeData);
    },
  };
}

/** Command that removes an edge; undo re-adds it. */
export function createRemoveEdgeCommand<T>(
  edgeId: string,
  edgeData: T,
  addFn: (data: T) => void | Promise<void>,
  removeFn: (id: string) => void | Promise<void>,
  description?: string,
): UndoableCommand {
  return {
    type: 'remove-edge',
    description: description ?? `Remove edge ${edgeId}`,
    async execute() {
      await removeFn(edgeId);
    },
    async undo() {
      await addFn(edgeData);
    },
  };
}

// ---------------------------------------------------------------------------
// BOM item commands
// ---------------------------------------------------------------------------

/** Command that adds a BOM item; undo removes it. */
export function createAddBomItemCommand<T>(
  itemData: T,
  addFn: (data: T) => void | Promise<void>,
  removeFn: (data: T) => void | Promise<void>,
  description?: string,
): UndoableCommand {
  return {
    type: 'add-bom-item',
    description: description ?? 'Add BOM item',
    async execute() {
      await addFn(itemData);
    },
    async undo() {
      await removeFn(itemData);
    },
  };
}

/** Command that removes a BOM item; undo re-adds it. */
export function createRemoveBomItemCommand<T>(
  itemId: string,
  itemData: T,
  addFn: (data: T) => void | Promise<void>,
  removeFn: (id: string) => void | Promise<void>,
  description?: string,
): UndoableCommand {
  return {
    type: 'remove-bom-item',
    description: description ?? `Remove BOM item ${itemId}`,
    async execute() {
      await removeFn(itemId);
    },
    async undo() {
      await addFn(itemData);
    },
  };
}
