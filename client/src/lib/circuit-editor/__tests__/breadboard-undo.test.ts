/**
 * Breadboard Undo/Redo Command Tests
 *
 * Tests for breadboard-specific UndoableCommand implementations.
 * Runs in client project config (happy-dom environment).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PlaceComponentCommand,
  DeleteComponentCommand,
  MoveComponentCommand,
} from '../breadboard-undo';
import { UndoRedoStack } from '../../undo-redo';

describe('PlaceComponentCommand', () => {
  it('executes the create callback on execute', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);
    const cmd = new PlaceComponentCommand('R1', { create, remove });
    await cmd.execute();
    expect(create).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it('executes the remove callback on undo', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);
    const cmd = new PlaceComponentCommand('R1', { create, remove });
    await cmd.execute();
    await cmd.undo();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('has type "place-component" and includes refDes in description', () => {
    const cmd = new PlaceComponentCommand('U1', {
      create: vi.fn(),
      remove: vi.fn(),
    });
    expect(cmd.type).toBe('place-component');
    expect(cmd.description).toContain('U1');
  });
});

describe('DeleteComponentCommand', () => {
  it('executes the remove callback on execute', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const restore = vi.fn().mockResolvedValue(undefined);
    const cmd = new DeleteComponentCommand('C1', { remove, restore });
    await cmd.execute();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('executes the restore callback on undo', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const restore = vi.fn().mockResolvedValue(undefined);
    const cmd = new DeleteComponentCommand('C1', { remove, restore });
    await cmd.execute();
    await cmd.undo();
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('has type "delete-component"', () => {
    const cmd = new DeleteComponentCommand('C1', {
      remove: vi.fn(),
      restore: vi.fn(),
    });
    expect(cmd.type).toBe('delete-component');
  });
});

describe('MoveComponentCommand', () => {
  it('executes the move callback with new position on execute', async () => {
    const move = vi.fn().mockResolvedValue(undefined);
    const from = { x: 100, y: 50 };
    const to = { x: 200, y: 100 };
    const cmd = new MoveComponentCommand('R1', from, to, { move });
    await cmd.execute();
    expect(move).toHaveBeenCalledWith(to);
  });

  it('executes the move callback with original position on undo', async () => {
    const move = vi.fn().mockResolvedValue(undefined);
    const from = { x: 100, y: 50 };
    const to = { x: 200, y: 100 };
    const cmd = new MoveComponentCommand('R1', from, to, { move });
    await cmd.execute();
    await cmd.undo();
    expect(move).toHaveBeenCalledWith(from);
  });

  it('has type "move-component" and includes refDes in description', () => {
    const cmd = new MoveComponentCommand('U1', { x: 0, y: 0 }, { x: 10, y: 10 }, {
      move: vi.fn(),
    });
    expect(cmd.type).toBe('move-component');
    expect(cmd.description).toContain('U1');
  });
});

describe('UndoRedoStack integration with breadboard commands', () => {
  let stack: UndoRedoStack;

  beforeEach(() => {
    stack = new UndoRedoStack();
  });

  it('can push and undo a place command', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);
    const cmd = new PlaceComponentCommand('R1', { create, remove });
    await cmd.execute();
    stack.push(cmd);

    expect(stack.canUndo).toBe(true);
    expect(stack.undoDescription).toContain('R1');

    await stack.undo();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(true);
  });

  it('can redo after undo', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);
    const cmd = new PlaceComponentCommand('R1', { create, remove });
    await cmd.execute();
    stack.push(cmd);

    await stack.undo();
    await stack.redo();
    expect(create).toHaveBeenCalledTimes(2); // initial + redo
    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(false);
  });

  it('notifies listener on push/undo/redo', async () => {
    const listener = vi.fn();
    stack.setListener(listener);

    const cmd = new PlaceComponentCommand('R1', {
      create: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    });
    await cmd.execute();
    stack.push(cmd);
    expect(listener).toHaveBeenCalledTimes(1);

    await stack.undo();
    expect(listener).toHaveBeenCalledTimes(2);

    await stack.redo();
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
