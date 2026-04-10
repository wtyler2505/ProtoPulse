/**
 * Breadboard-specific UndoableCommand implementations.
 *
 * Each command class wraps injected callbacks (mutations) so the undo/redo
 * engine can reverse breadboard actions without coupling to React hooks.
 *
 * Commands:
 *   - PlaceComponentCommand  — placing a new component on the board
 *   - DeleteComponentCommand  — removing a component from the board
 *   - MoveComponentCommand    — dragging a component to a new position
 */

import type { UndoableCommand } from '../undo-redo';

// ---------------------------------------------------------------------------
// Position type
// ---------------------------------------------------------------------------

export interface BoardPosition {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// PlaceComponentCommand
// ---------------------------------------------------------------------------

export class PlaceComponentCommand implements UndoableCommand {
  readonly type = 'place-component' as const;
  readonly description: string;

  private readonly callbacks: {
    create: () => Promise<void> | void;
    remove: () => Promise<void> | void;
  };

  constructor(
    refDes: string,
    callbacks: { create: () => Promise<void> | void; remove: () => Promise<void> | void },
  ) {
    this.description = `Place ${refDes}`;
    this.callbacks = callbacks;
  }

  async execute(): Promise<void> {
    await this.callbacks.create();
  }

  async undo(): Promise<void> {
    await this.callbacks.remove();
  }
}

// ---------------------------------------------------------------------------
// DeleteComponentCommand
// ---------------------------------------------------------------------------

export class DeleteComponentCommand implements UndoableCommand {
  readonly type = 'delete-component' as const;
  readonly description: string;

  private readonly callbacks: {
    remove: () => Promise<void> | void;
    restore: () => Promise<void> | void;
  };

  constructor(
    refDes: string,
    callbacks: { remove: () => Promise<void> | void; restore: () => Promise<void> | void },
  ) {
    this.description = `Delete ${refDes}`;
    this.callbacks = callbacks;
  }

  async execute(): Promise<void> {
    await this.callbacks.remove();
  }

  async undo(): Promise<void> {
    await this.callbacks.restore();
  }
}

// ---------------------------------------------------------------------------
// MoveComponentCommand
// ---------------------------------------------------------------------------

export class MoveComponentCommand implements UndoableCommand {
  readonly type = 'move-component' as const;
  readonly description: string;

  private readonly from: BoardPosition;
  private readonly to: BoardPosition;
  private readonly callbacks: {
    move: (pos: BoardPosition) => Promise<void> | void;
  };

  constructor(
    refDes: string,
    from: BoardPosition,
    to: BoardPosition,
    callbacks: { move: (pos: BoardPosition) => Promise<void> | void },
  ) {
    this.description = `Move ${refDes}`;
    this.from = from;
    this.to = to;
    this.callbacks = callbacks;
  }

  async execute(): Promise<void> {
    await this.callbacks.move(this.to);
  }

  async undo(): Promise<void> {
    await this.callbacks.move(this.from);
  }
}
