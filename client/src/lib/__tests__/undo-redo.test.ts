import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';

import { UndoRedoStack } from '@/lib/undo-redo';
import type { UndoableCommand } from '@/lib/undo-redo';
import { UndoRedoProvider, useUndoRedo } from '@/lib/undo-redo-context';
import {
  createAddNodeCommand,
  createRemoveNodeCommand,
  createUpdateNodeCommand,
  createAddEdgeCommand,
  createRemoveEdgeCommand,
  createAddBomItemCommand,
  createRemoveBomItemCommand,
  createBatchCommand,
} from '@/lib/undo-redo-commands';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommand(overrides: Partial<UndoableCommand> = {}): UndoableCommand {
  return {
    type: 'test',
    description: 'test command',
    execute: vi.fn().mockResolvedValue(undefined),
    undo: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// UndoRedoStack — core engine
// ---------------------------------------------------------------------------

describe('UndoRedoStack', () => {
  let stack: UndoRedoStack;

  beforeEach(() => {
    stack = new UndoRedoStack();
  });

  it('starts empty with no undo/redo available', () => {
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
    expect(stack.undoDescription).toBeNull();
    expect(stack.redoDescription).toBeNull();
    expect(stack.undoSize).toBe(0);
    expect(stack.redoSize).toBe(0);
    expect(stack.history).toEqual([]);
  });

  it('push() adds to undo stack', () => {
    const cmd = makeCommand({ description: 'Add resistor' });
    stack.push(cmd);

    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(false);
    expect(stack.undoDescription).toBe('Add resistor');
    expect(stack.undoSize).toBe(1);
  });

  it('push() clears the redo stack', async () => {
    const cmd1 = makeCommand({ description: 'first' });
    const cmd2 = makeCommand({ description: 'second' });

    stack.push(cmd1);
    stack.push(cmd2);
    await stack.undo();

    expect(stack.canRedo).toBe(true);

    stack.push(makeCommand({ description: 'third' }));
    expect(stack.canRedo).toBe(false);
    expect(stack.redoSize).toBe(0);
  });

  it('undo() calls command.undo() and moves to redo stack', async () => {
    const cmd = makeCommand({ description: 'wire connection' });
    stack.push(cmd);

    await stack.undo();

    expect(cmd.undo).toHaveBeenCalledOnce();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(true);
    expect(stack.redoDescription).toBe('wire connection');
  });

  it('redo() calls command.execute() and moves back to undo stack', async () => {
    const cmd = makeCommand({ description: 'add capacitor' });
    stack.push(cmd);
    await stack.undo();

    await stack.redo();

    expect(cmd.execute).toHaveBeenCalledOnce();
    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(false);
    expect(stack.undoDescription).toBe('add capacitor');
  });

  it('undo() on empty stack is a no-op', async () => {
    await stack.undo();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
  });

  it('redo() on empty stack is a no-op', async () => {
    await stack.redo();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
  });

  it('respects max stack size on push', () => {
    const smallStack = new UndoRedoStack(3);
    for (let i = 0; i < 5; i++) {
      smallStack.push(makeCommand({ description: `cmd-${i}` }));
    }

    expect(smallStack.undoSize).toBe(3);
    // Oldest commands were trimmed, newest survive
    expect(smallStack.history.map((h) => h.description)).toEqual(['cmd-2', 'cmd-3', 'cmd-4']);
  });

  it('respects max stack size on undo (redo side)', async () => {
    const smallStack = new UndoRedoStack(2);
    for (let i = 0; i < 3; i++) {
      smallStack.push(makeCommand({ description: `cmd-${i}` }));
    }
    // Undo all 2 (max size trimmed push to 2)
    await smallStack.undo();
    await smallStack.undo();

    expect(smallStack.redoSize).toBe(2);
  });

  it('clear() resets both stacks', async () => {
    stack.push(makeCommand());
    stack.push(makeCommand());
    await stack.undo();

    stack.clear();

    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
    expect(stack.undoSize).toBe(0);
    expect(stack.redoSize).toBe(0);
    expect(stack.history).toEqual([]);
  });

  it('history returns ordered entries with indices', () => {
    stack.push(makeCommand({ type: 'a', description: 'first' }));
    stack.push(makeCommand({ type: 'b', description: 'second' }));
    stack.push(makeCommand({ type: 'c', description: 'third' }));

    const history = stack.history;
    expect(history).toHaveLength(3);
    expect(history[0]).toEqual({ type: 'a', description: 'first', index: 0 });
    expect(history[1]).toEqual({ type: 'b', description: 'second', index: 1 });
    expect(history[2]).toEqual({ type: 'c', description: 'third', index: 2 });
  });

  it('notifies listener on push, undo, redo, and clear', async () => {
    const listener = vi.fn();
    stack.setListener(listener);

    stack.push(makeCommand());
    expect(listener).toHaveBeenCalledTimes(1);

    await stack.undo();
    expect(listener).toHaveBeenCalledTimes(2);

    await stack.redo();
    expect(listener).toHaveBeenCalledTimes(3);

    stack.clear();
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('removing listener stops notifications', () => {
    const listener = vi.fn();
    stack.setListener(listener);
    stack.push(makeCommand());
    expect(listener).toHaveBeenCalledTimes(1);

    stack.setListener(null);
    stack.push(makeCommand());
    expect(listener).toHaveBeenCalledTimes(1); // no additional call
  });

  it('multiple undo/redo cycles work correctly', async () => {
    const cmd1 = makeCommand({ description: 'A' });
    const cmd2 = makeCommand({ description: 'B' });

    stack.push(cmd1);
    stack.push(cmd2);

    await stack.undo(); // undo B
    expect(stack.undoDescription).toBe('A');
    expect(stack.redoDescription).toBe('B');

    await stack.undo(); // undo A
    expect(stack.canUndo).toBe(false);
    expect(stack.redoDescription).toBe('A');

    await stack.redo(); // redo A
    expect(stack.undoDescription).toBe('A');

    await stack.redo(); // redo B
    expect(stack.undoDescription).toBe('B');
    expect(stack.canRedo).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Command factories
// ---------------------------------------------------------------------------

describe('command factories', () => {
  describe('createAddNodeCommand', () => {
    it('execute calls addFn, undo calls removeFn', async () => {
      const addFn = vi.fn();
      const removeFn = vi.fn();
      const data = { id: 'node-1', label: 'MCU' };
      const cmd = createAddNodeCommand(data, addFn, removeFn, 'Add MCU');

      expect(cmd.type).toBe('add-node');
      expect(cmd.description).toBe('Add MCU');

      await cmd.execute();
      expect(addFn).toHaveBeenCalledWith(data);

      await cmd.undo();
      expect(removeFn).toHaveBeenCalledWith(data);
    });
  });

  describe('createRemoveNodeCommand', () => {
    it('execute calls removeFn with id, undo calls addFn with data', async () => {
      const addFn = vi.fn();
      const removeFn = vi.fn();
      const data = { id: 'node-2', label: 'Sensor' };
      const cmd = createRemoveNodeCommand('node-2', data, addFn, removeFn);

      await cmd.execute();
      expect(removeFn).toHaveBeenCalledWith('node-2');

      await cmd.undo();
      expect(addFn).toHaveBeenCalledWith(data);
    });
  });

  describe('createUpdateNodeCommand', () => {
    it('execute calls updateFn with new data, undo restores old data', async () => {
      const updateFn = vi.fn();
      const cmd = createUpdateNodeCommand('node-3', { label: 'Old' }, { label: 'New' }, updateFn);

      await cmd.execute();
      expect(updateFn).toHaveBeenCalledWith('node-3', { label: 'New' });

      await cmd.undo();
      expect(updateFn).toHaveBeenCalledWith('node-3', { label: 'Old' });
    });
  });

  describe('createAddEdgeCommand', () => {
    it('execute calls addFn, undo calls removeFn', async () => {
      const addFn = vi.fn();
      const removeFn = vi.fn();
      const data = { id: 'edge-1', source: 'a', target: 'b' };
      const cmd = createAddEdgeCommand(data, addFn, removeFn);

      await cmd.execute();
      expect(addFn).toHaveBeenCalledWith(data);

      await cmd.undo();
      expect(removeFn).toHaveBeenCalledWith(data);
    });
  });

  describe('createRemoveEdgeCommand', () => {
    it('execute calls removeFn with id, undo calls addFn with data', async () => {
      const addFn = vi.fn();
      const removeFn = vi.fn();
      const data = { id: 'edge-2', source: 'x', target: 'y' };
      const cmd = createRemoveEdgeCommand('edge-2', data, addFn, removeFn);

      await cmd.execute();
      expect(removeFn).toHaveBeenCalledWith('edge-2');

      await cmd.undo();
      expect(addFn).toHaveBeenCalledWith(data);
    });
  });

  describe('createAddBomItemCommand', () => {
    it('execute calls addFn, undo calls removeFn', async () => {
      const addFn = vi.fn();
      const removeFn = vi.fn();
      const item = { partNumber: 'LM7805', quantity: 5 };
      const cmd = createAddBomItemCommand(item, addFn, removeFn, 'Add LM7805');

      expect(cmd.type).toBe('add-bom-item');

      await cmd.execute();
      expect(addFn).toHaveBeenCalledWith(item);

      await cmd.undo();
      expect(removeFn).toHaveBeenCalledWith(item);
    });
  });

  describe('createRemoveBomItemCommand', () => {
    it('execute calls removeFn with id, undo calls addFn with data', async () => {
      const addFn = vi.fn();
      const removeFn = vi.fn();
      const item = { partNumber: 'LM7805', quantity: 5 };
      const cmd = createRemoveBomItemCommand('bom-1', item, addFn, removeFn);

      await cmd.execute();
      expect(removeFn).toHaveBeenCalledWith('bom-1');

      await cmd.undo();
      expect(addFn).toHaveBeenCalledWith(item);
    });
  });
});

// ---------------------------------------------------------------------------
// Batch commands
// ---------------------------------------------------------------------------

describe('createBatchCommand', () => {
  it('executes all commands in order', async () => {
    const order: number[] = [];
    const cmds = [
      makeCommand({ execute: vi.fn().mockImplementation(() => { order.push(1); }) }),
      makeCommand({ execute: vi.fn().mockImplementation(() => { order.push(2); }) }),
      makeCommand({ execute: vi.fn().mockImplementation(() => { order.push(3); }) }),
    ];

    const batch = createBatchCommand(cmds, 'Batch operation');
    await batch.execute();

    expect(order).toEqual([1, 2, 3]);
  });

  it('undoes all commands in reverse order', async () => {
    const order: number[] = [];
    const cmds = [
      makeCommand({ undo: vi.fn().mockImplementation(() => { order.push(1); }) }),
      makeCommand({ undo: vi.fn().mockImplementation(() => { order.push(2); }) }),
      makeCommand({ undo: vi.fn().mockImplementation(() => { order.push(3); }) }),
    ];

    const batch = createBatchCommand(cmds);
    await batch.undo();

    expect(order).toEqual([3, 2, 1]);
  });

  it('builds description from child commands when none provided', () => {
    const cmds = [
      makeCommand({ description: 'Add node' }),
      makeCommand({ description: 'Add edge' }),
    ];
    const batch = createBatchCommand(cmds);
    expect(batch.description).toBe('Add node, Add edge');
  });

  it('uses provided description when given', () => {
    const batch = createBatchCommand([makeCommand()], 'Custom batch');
    expect(batch.description).toBe('Custom batch');
  });

  it('has type "batch"', () => {
    const batch = createBatchCommand([makeCommand()]);
    expect(batch.type).toBe('batch');
  });
});

// ---------------------------------------------------------------------------
// React context integration
// ---------------------------------------------------------------------------

describe('UndoRedoProvider + useUndoRedo', () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    return createElement(UndoRedoProvider, null, children);
  }

  it('provides initial empty state', () => {
    const { result } = renderHook(() => useUndoRedo(), { wrapper });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undoDescription).toBeNull();
    expect(result.current.redoDescription).toBeNull();
    expect(result.current.history).toEqual([]);
  });

  it('push updates canUndo', () => {
    const { result } = renderHook(() => useUndoRedo(), { wrapper });

    act(() => {
      result.current.push(makeCommand({ description: 'test push' }));
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoDescription).toBe('test push');
  });

  it('undo and redo cycle through state', async () => {
    const { result } = renderHook(() => useUndoRedo(), { wrapper });

    act(() => {
      result.current.push(makeCommand({ description: 'op-1' }));
    });

    act(() => {
      result.current.undo();
    });

    // After undo finishes asynchronously, canRedo should be true.
    // Because undo is async internally but the listener fires synchronously
    // after completion, we need to wait for the promise to settle.
    await vi.waitFor(() => {
      expect(result.current.canRedo).toBe(true);
    });
    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.redo();
    });

    await vi.waitFor(() => {
      expect(result.current.canUndo).toBe(true);
    });
    expect(result.current.canRedo).toBe(false);
  });

  it('clear resets state', () => {
    const { result } = renderHook(() => useUndoRedo(), { wrapper });

    act(() => {
      result.current.push(makeCommand());
      result.current.push(makeCommand());
    });

    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.clear();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.history).toEqual([]);
  });

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useUndoRedo());
    }).toThrow('useUndoRedo must be used within an UndoRedoProvider');
  });

  it('history is exposed correctly', () => {
    const { result } = renderHook(() => useUndoRedo(), { wrapper });

    act(() => {
      result.current.push(makeCommand({ type: 'a', description: 'first' }));
      result.current.push(makeCommand({ type: 'b', description: 'second' }));
    });

    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0].description).toBe('first');
    expect(result.current.history[1].description).toBe('second');
  });
});

// ---------------------------------------------------------------------------
// Keyboard shortcut binding
// ---------------------------------------------------------------------------

describe('keyboard shortcuts', () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    return createElement(UndoRedoProvider, null, children);
  }

  it('Ctrl+Z triggers undo when not in an input', async () => {
    const cmd = makeCommand({ description: 'shortcut test' });
    const { result } = renderHook(() => useUndoRedo(), { wrapper });

    act(() => {
      result.current.push(cmd);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
      }));
    });

    await vi.waitFor(() => {
      expect(cmd.undo).toHaveBeenCalledOnce();
    });
  });

  it('Ctrl+Shift+Z triggers redo', async () => {
    const cmd = makeCommand({ description: 'redo shortcut' });
    const { result } = renderHook(() => useUndoRedo(), { wrapper });

    act(() => {
      result.current.push(cmd);
    });

    // First undo
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
      }));
    });

    await vi.waitFor(() => {
      expect(cmd.undo).toHaveBeenCalledOnce();
    });

    // Then redo
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      }));
    });

    await vi.waitFor(() => {
      expect(cmd.execute).toHaveBeenCalledOnce();
    });
  });

  it('does not trigger undo when target is an input element', () => {
    const cmd = makeCommand();
    const { result } = renderHook(() => useUndoRedo(), { wrapper });

    act(() => {
      result.current.push(cmd);
    });

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input, writable: false });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(cmd.undo).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('does not trigger undo when target is a textarea', () => {
    const cmd = makeCommand();
    const { result } = renderHook(() => useUndoRedo(), { wrapper });

    act(() => {
      result.current.push(cmd);
    });

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: textarea, writable: false });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(cmd.undo).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });
});
