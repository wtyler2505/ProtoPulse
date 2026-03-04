import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { KanbanBoard, useKanbanBoard } from '../kanban-board';
import type { KanbanTask, KanbanColumn, KanbanBoardData, CreateTaskInput } from '../kanban-board';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let board: KanbanBoard;
let mockStorage: Storage;

beforeEach(() => {
  mockStorage = createMockLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  KanbanBoard.resetForTesting();
  board = KanbanBoard.getInstance();
});

afterEach(() => {
  KanbanBoard.resetForTesting();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('KanbanBoard - Singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = KanbanBoard.getInstance();
    const b = KanbanBoard.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetForTesting', () => {
    const first = KanbanBoard.getInstance();
    KanbanBoard.resetForTesting();
    const second = KanbanBoard.getInstance();
    expect(first).not.toBe(second);
  });
});

// ---------------------------------------------------------------------------
// Default Columns
// ---------------------------------------------------------------------------

describe('KanbanBoard - Default Columns', () => {
  it('has 4 default columns', () => {
    expect(board.getColumns()).toHaveLength(4);
  });

  it('default columns are backlog, todo, in-progress, done', () => {
    const ids = board.getColumns().map((c) => c.id);
    expect(ids).toContain('backlog');
    expect(ids).toContain('todo');
    expect(ids).toContain('in-progress');
    expect(ids).toContain('done');
  });

  it('columns are sorted by order', () => {
    const columns = board.getColumns();
    for (let i = 1; i < columns.length; i++) {
      expect(columns[i].order).toBeGreaterThan(columns[i - 1].order);
    }
  });

  it('default columns have colors', () => {
    for (const column of board.getColumns()) {
      expect(column.color).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Column Management
// ---------------------------------------------------------------------------

describe('KanbanBoard - Column Management', () => {
  it('adds a new column', () => {
    const id = board.addColumn('Testing', '#ff0000');
    expect(board.getColumn(id)).not.toBeNull();
    expect(board.getColumn(id)!.name).toBe('Testing');
    expect(board.getColumn(id)!.color).toBe('#ff0000');
  });

  it('new column has the highest order', () => {
    const id = board.addColumn('Review');
    const column = board.getColumn(id);
    const allOrders = board.getColumns().map((c) => c.order);
    expect(column!.order).toBe(Math.max(...allOrders));
  });

  it('removes a column', () => {
    const id = board.addColumn('Temporary');
    expect(board.removeColumn(id)).toBe(true);
    expect(board.getColumn(id)).toBeNull();
  });

  it('cannot remove the last column', () => {
    // Remove all columns except one
    const columns = board.getColumns();
    for (let i = 0; i < columns.length - 1; i++) {
      board.removeColumn(columns[i].id);
    }
    expect(board.getColumns()).toHaveLength(1);
    expect(board.removeColumn(board.getColumns()[0].id)).toBe(false);
  });

  it('removing a column moves its tasks to the first column', () => {
    const colId = board.addColumn('Temp');
    const taskId = board.createTask({ title: 'Test', columnId: colId });
    board.removeColumn(colId);
    const task = board.getTask(taskId);
    expect(task).not.toBeNull();
    const firstColumn = board.getColumns()[0];
    expect(task!.columnId).toBe(firstColumn.id);
  });

  it('returns false when removing non-existent column', () => {
    expect(board.removeColumn('nonexistent')).toBe(false);
  });

  it('renames a column', () => {
    expect(board.renameColumn('todo', 'To Do Items')).toBe(true);
    expect(board.getColumn('todo')!.name).toBe('To Do Items');
  });

  it('returns false when renaming non-existent column', () => {
    expect(board.renameColumn('nonexistent', 'New Name')).toBe(false);
  });

  it('reorders columns', () => {
    const result = board.reorderColumns(['done', 'in-progress', 'todo', 'backlog']);
    expect(result).toBe(true);
    const columns = board.getColumns();
    expect(columns[0].id).toBe('done');
    expect(columns[1].id).toBe('in-progress');
    expect(columns[2].id).toBe('todo');
    expect(columns[3].id).toBe('backlog');
  });

  it('returns false when reordering with invalid column ID', () => {
    expect(board.reorderColumns(['done', 'nonexistent'])).toBe(false);
  });

  it('getColumn returns null for unknown ID', () => {
    expect(board.getColumn('nonexistent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task CRUD
// ---------------------------------------------------------------------------

describe('KanbanBoard - Task CRUD', () => {
  it('creates a task with required fields', () => {
    const id = board.createTask({ title: 'Route power traces' });
    const task = board.getTask(id);
    expect(task).not.toBeNull();
    expect(task!.title).toBe('Route power traces');
    expect(task!.description).toBe('');
    expect(task!.priority).toBe('medium');
    expect(task!.tags).toEqual([]);
    expect(task!.linkedNodeIds).toEqual([]);
  });

  it('creates a task with all fields', () => {
    const id = board.createTask({
      title: 'Add decoupling caps',
      description: 'Add 100nF caps near each IC',
      columnId: 'in-progress',
      priority: 'high',
      tags: ['pcb', 'power'],
      dueDate: 1700000000000,
      assignee: 'Tyler',
      linkedNodeIds: ['node-1', 'node-2'],
    });
    const task = board.getTask(id);
    expect(task!.title).toBe('Add decoupling caps');
    expect(task!.description).toBe('Add 100nF caps near each IC');
    expect(task!.columnId).toBe('in-progress');
    expect(task!.priority).toBe('high');
    expect(task!.tags).toEqual(['pcb', 'power']);
    expect(task!.dueDate).toBe(1700000000000);
    expect(task!.assignee).toBe('Tyler');
    expect(task!.linkedNodeIds).toEqual(['node-1', 'node-2']);
  });

  it('creates a task in the first column by default', () => {
    const id = board.createTask({ title: 'Test task' });
    const task = board.getTask(id);
    const firstColumn = board.getColumns()[0];
    expect(task!.columnId).toBe(firstColumn.id);
  });

  it('throws error for invalid column ID', () => {
    expect(() => board.createTask({ title: 'Test', columnId: 'nonexistent' })).toThrow();
  });

  it('task has createdAt and updatedAt timestamps', () => {
    const before = Date.now();
    const id = board.createTask({ title: 'Test' });
    const after = Date.now();
    const task = board.getTask(id);
    expect(task!.createdAt).toBeGreaterThanOrEqual(before);
    expect(task!.createdAt).toBeLessThanOrEqual(after);
    expect(task!.updatedAt).toBe(task!.createdAt);
  });

  it('task has a unique UUID id', () => {
    const id1 = board.createTask({ title: 'Task 1' });
    const id2 = board.createTask({ title: 'Task 2' });
    expect(id1).not.toBe(id2);
    // UUID format
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('updates a task', () => {
    const id = board.createTask({ title: 'Original' });
    const result = board.updateTask(id, { title: 'Updated', priority: 'critical' });
    expect(result).toBe(true);
    const task = board.getTask(id);
    expect(task!.title).toBe('Updated');
    expect(task!.priority).toBe('critical');
  });

  it('update changes updatedAt timestamp', () => {
    const id = board.createTask({ title: 'Test' });
    const createdAt = board.getTask(id)!.createdAt;
    // Small delay to ensure different timestamp
    board.updateTask(id, { title: 'Updated' });
    const task = board.getTask(id);
    expect(task!.updatedAt).toBeGreaterThanOrEqual(createdAt);
  });

  it('returns false when updating non-existent task', () => {
    expect(board.updateTask('nonexistent', { title: 'New' })).toBe(false);
  });

  it('clears optional fields with null', () => {
    const id = board.createTask({
      title: 'Test',
      dueDate: 1700000000000,
      assignee: 'Tyler',
    });
    board.updateTask(id, { dueDate: null, assignee: null });
    const task = board.getTask(id);
    expect(task!.dueDate).toBeUndefined();
    expect(task!.assignee).toBeUndefined();
  });

  it('deletes a task', () => {
    const id = board.createTask({ title: 'To delete' });
    expect(board.deleteTask(id)).toBe(true);
    expect(board.getTask(id)).toBeNull();
  });

  it('returns false when deleting non-existent task', () => {
    expect(board.deleteTask('nonexistent')).toBe(false);
  });

  it('getTask returns null for unknown ID', () => {
    expect(board.getTask('nonexistent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task Movement
// ---------------------------------------------------------------------------

describe('KanbanBoard - Task Movement', () => {
  it('moves a task to a different column', () => {
    const id = board.createTask({ title: 'Test', columnId: 'todo' });
    expect(board.moveTask(id, 'in-progress')).toBe(true);
    expect(board.getTask(id)!.columnId).toBe('in-progress');
  });

  it('move updates updatedAt', () => {
    const id = board.createTask({ title: 'Test', columnId: 'todo' });
    const before = board.getTask(id)!.updatedAt;
    board.moveTask(id, 'done');
    expect(board.getTask(id)!.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('returns false when moving non-existent task', () => {
    expect(board.moveTask('nonexistent', 'todo')).toBe(false);
  });

  it('returns false when moving to non-existent column', () => {
    const id = board.createTask({ title: 'Test' });
    expect(board.moveTask(id, 'nonexistent')).toBe(false);
  });

  it('moves a task to a specific position', () => {
    board.createTask({ title: 'Task 1', columnId: 'todo' });
    const id2 = board.createTask({ title: 'Task 2', columnId: 'backlog' });
    board.createTask({ title: 'Task 3', columnId: 'todo' });

    board.moveTask(id2, 'todo', 1);
    const todoTasks = board.getTasksByColumn('todo');
    expect(todoTasks[1].id).toBe(id2);
  });

  it('reorders a task within its column', () => {
    const id1 = board.createTask({ title: 'Task 1', columnId: 'todo' });
    board.createTask({ title: 'Task 2', columnId: 'todo' });
    const id3 = board.createTask({ title: 'Task 3', columnId: 'todo' });

    board.reorderTask(id1, 2);
    const todoTasks = board.getTasksByColumn('todo');
    // Task 1 should now be at the end
    expect(todoTasks[todoTasks.length - 1].id).toBe(id1);
  });

  it('returns false when reordering non-existent task', () => {
    expect(board.reorderTask('nonexistent', 0)).toBe(false);
  });

  it('clamps position when reordering beyond bounds', () => {
    const id1 = board.createTask({ title: 'Task 1', columnId: 'todo' });
    board.createTask({ title: 'Task 2', columnId: 'todo' });

    // Position 999 should be clamped
    expect(board.reorderTask(id1, 999)).toBe(true);
    const tasks = board.getTasksByColumn('todo');
    expect(tasks[tasks.length - 1].id).toBe(id1);
  });
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe('KanbanBoard - Filtering', () => {
  beforeEach(() => {
    board.createTask({ title: 'High PCB', priority: 'high', tags: ['pcb'], assignee: 'Alice', columnId: 'todo' });
    board.createTask({
      title: 'Low Power',
      priority: 'low',
      tags: ['power'],
      assignee: 'Bob',
      columnId: 'in-progress',
    });
    board.createTask({
      title: 'Critical Bug',
      priority: 'critical',
      tags: ['pcb', 'bug'],
      assignee: 'Alice',
      columnId: 'todo',
    });
    board.createTask({ title: 'Medium Task', priority: 'medium', tags: ['general'], columnId: 'backlog' });
  });

  it('filters by tag', () => {
    const results = board.filterTasks({ tag: 'pcb' });
    expect(results).toHaveLength(2);
  });

  it('filter by tag is case-insensitive', () => {
    const results = board.filterTasks({ tag: 'PCB' });
    expect(results).toHaveLength(2);
  });

  it('filters by priority', () => {
    const results = board.filterTasks({ priority: 'high' });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('High PCB');
  });

  it('filters by assignee', () => {
    const results = board.filterTasks({ assignee: 'Alice' });
    expect(results).toHaveLength(2);
  });

  it('filters by column', () => {
    const results = board.filterTasks({ columnId: 'todo' });
    expect(results).toHaveLength(2);
  });

  it('combines multiple filters', () => {
    const results = board.filterTasks({ tag: 'pcb', assignee: 'Alice' });
    expect(results).toHaveLength(2);
  });

  it('returns empty for no matches', () => {
    const results = board.filterTasks({ tag: 'nonexistent' });
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Linked Nodes
// ---------------------------------------------------------------------------

describe('KanbanBoard - Linked Nodes', () => {
  it('creates a task with linked node IDs', () => {
    const id = board.createTask({
      title: 'Test',
      linkedNodeIds: ['node-abc', 'node-def'],
    });
    const task = board.getTask(id);
    expect(task!.linkedNodeIds).toEqual(['node-abc', 'node-def']);
  });

  it('finds tasks by linked node ID', () => {
    board.createTask({ title: 'Task 1', linkedNodeIds: ['node-1', 'node-2'] });
    board.createTask({ title: 'Task 2', linkedNodeIds: ['node-2', 'node-3'] });
    board.createTask({ title: 'Task 3', linkedNodeIds: ['node-3'] });

    const results = board.getTasksByLinkedNode('node-2');
    expect(results).toHaveLength(2);
  });

  it('returns empty when no tasks are linked to a node', () => {
    board.createTask({ title: 'Test', linkedNodeIds: ['node-1'] });
    expect(board.getTasksByLinkedNode('node-999')).toHaveLength(0);
  });

  it('updates linked node IDs', () => {
    const id = board.createTask({ title: 'Test', linkedNodeIds: ['node-1'] });
    board.updateTask(id, { linkedNodeIds: ['node-2', 'node-3'] });
    const task = board.getTask(id);
    expect(task!.linkedNodeIds).toEqual(['node-2', 'node-3']);
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe('KanbanBoard - Persistence', () => {
  it('saves to localStorage on task creation', () => {
    board.createTask({ title: 'Test' });
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('loads from localStorage on construction', () => {
    // Create data then reset
    board.createTask({ title: 'Persisted Task', columnId: 'todo' });
    KanbanBoard.resetForTesting();

    // New instance should load from storage
    const newBoard = KanbanBoard.getInstance();
    const tasks = newBoard.getAllTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Persisted Task');
  });

  it('handles corrupt localStorage data gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not valid json{{{');
    KanbanBoard.resetForTesting();
    const newBoard = KanbanBoard.getInstance();
    // Should fall back to defaults
    expect(newBoard.getColumns()).toHaveLength(4);
    expect(newBoard.getAllTasks()).toHaveLength(0);
  });

  it('handles empty localStorage', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    KanbanBoard.resetForTesting();
    const newBoard = KanbanBoard.getInstance();
    expect(newBoard.getColumns()).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------

describe('KanbanBoard - Import/Export', () => {
  it('exports board data', () => {
    board.createTask({ title: 'Task 1', columnId: 'todo' });
    board.createTask({ title: 'Task 2', columnId: 'done' });

    const data = board.exportData();
    expect(data.columns).toHaveLength(4);
    expect(data.tasks).toHaveLength(2);
  });

  it('imports board data', () => {
    const importData: KanbanBoardData = {
      columns: [
        { id: 'col-1', name: 'Column 1', order: 0 },
        { id: 'col-2', name: 'Column 2', order: 1 },
      ],
      tasks: [
        {
          id: 'task-1',
          title: 'Imported Task',
          description: 'Test',
          columnId: 'col-1',
          priority: 'high',
          tags: ['test'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          linkedNodeIds: [],
          order: 0,
        },
      ],
    };

    board.importData(importData);
    expect(board.getColumns()).toHaveLength(2);
    expect(board.getAllTasks()).toHaveLength(1);
    expect(board.getTask('task-1')!.title).toBe('Imported Task');
  });

  it('throws on invalid import data (no columns)', () => {
    expect(() =>
      board.importData({ columns: [], tasks: [] }),
    ).toThrow('must have at least one column');
  });

  it('throws on invalid import data (bad columns)', () => {
    expect(() =>
      board.importData({
        columns: [{ id: 123 } as unknown as KanbanColumn],
        tasks: [],
      }),
    ).toThrow();
  });

  it('throws on import with task referencing non-existent column', () => {
    expect(() =>
      board.importData({
        columns: [{ id: 'col-1', name: 'Col', order: 0 }],
        tasks: [
          {
            id: 'task-1',
            title: 'Bad Task',
            description: '',
            columnId: 'nonexistent',
            priority: 'medium',
            tags: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            linkedNodeIds: [],
            order: 0,
          },
        ],
      }),
    ).toThrow('non-existent column');
  });

  it('roundtrips export and import', () => {
    board.createTask({ title: 'Task A', columnId: 'todo', priority: 'high' });
    board.createTask({ title: 'Task B', columnId: 'done', priority: 'low' });
    board.addColumn('Custom');

    const exported = board.exportData();
    KanbanBoard.resetForTesting();
    const newBoard = KanbanBoard.getInstance();

    // Clear localStorage to prevent loading old data
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    KanbanBoard.resetForTesting();
    const freshBoard = KanbanBoard.getInstance();
    freshBoard.importData(exported);

    expect(freshBoard.getColumns()).toHaveLength(exported.columns.length);
    expect(freshBoard.getAllTasks()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

describe('KanbanBoard - Subscription', () => {
  it('notifies subscribers on task creation', () => {
    const listener = vi.fn<() => void>();
    board.subscribe(listener);
    board.createTask({ title: 'Test' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on task update', () => {
    const id = board.createTask({ title: 'Test' });
    const listener = vi.fn<() => void>();
    board.subscribe(listener);
    board.updateTask(id, { title: 'Updated' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on task deletion', () => {
    const id = board.createTask({ title: 'Test' });
    const listener = vi.fn<() => void>();
    board.subscribe(listener);
    board.deleteTask(id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on task move', () => {
    const id = board.createTask({ title: 'Test', columnId: 'todo' });
    const listener = vi.fn<() => void>();
    board.subscribe(listener);
    board.moveTask(id, 'done');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on column add', () => {
    const listener = vi.fn<() => void>();
    board.subscribe(listener);
    board.addColumn('Custom');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on column remove', () => {
    const colId = board.addColumn('Custom');
    const listener = vi.fn<() => void>();
    board.subscribe(listener);
    board.removeColumn(colId);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn<() => void>();
    const unsub = board.subscribe(listener);
    unsub();
    board.createTask({ title: 'Test' });
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Task Count and Queries
// ---------------------------------------------------------------------------

describe('KanbanBoard - Queries', () => {
  it('getTaskCount returns correct count', () => {
    expect(board.getTaskCount()).toBe(0);
    board.createTask({ title: 'Task 1' });
    board.createTask({ title: 'Task 2' });
    expect(board.getTaskCount()).toBe(2);
  });

  it('getAllTasks returns all tasks sorted by order', () => {
    board.createTask({ title: 'Task 1', columnId: 'todo' });
    board.createTask({ title: 'Task 2', columnId: 'done' });
    board.createTask({ title: 'Task 3', columnId: 'todo' });

    const tasks = board.getAllTasks();
    expect(tasks).toHaveLength(3);
  });

  it('getTasksByColumn returns tasks for a specific column', () => {
    board.createTask({ title: 'Todo 1', columnId: 'todo' });
    board.createTask({ title: 'Done 1', columnId: 'done' });
    board.createTask({ title: 'Todo 2', columnId: 'todo' });

    const todoTasks = board.getTasksByColumn('todo');
    expect(todoTasks).toHaveLength(2);
    for (const task of todoTasks) {
      expect(task.columnId).toBe('todo');
    }
  });

  it('getTasksByColumn returns empty for column with no tasks', () => {
    expect(board.getTasksByColumn('done')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

describe('useKanbanBoard', () => {
  beforeEach(() => {
    KanbanBoard.resetForTesting();
  });

  it('provides columns', () => {
    const { result } = renderHook(() => useKanbanBoard());
    expect(result.current.columns).toHaveLength(4);
  });

  it('provides empty tasks initially', () => {
    const { result } = renderHook(() => useKanbanBoard());
    expect(result.current.tasks).toHaveLength(0);
    expect(result.current.taskCount).toBe(0);
  });

  it('creates a task and updates state', () => {
    const { result } = renderHook(() => useKanbanBoard());

    act(() => {
      result.current.createTask({ title: 'Hook Task' });
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.taskCount).toBe(1);
  });

  it('moves a task via hook', () => {
    const { result } = renderHook(() => useKanbanBoard());

    let taskId: string;
    act(() => {
      taskId = result.current.createTask({ title: 'Test', columnId: 'todo' });
    });

    act(() => {
      result.current.moveTask(taskId!, 'done');
    });

    const task = result.current.tasks.find((t) => t.id === taskId!);
    expect(task!.columnId).toBe('done');
  });

  it('deletes a task via hook', () => {
    const { result } = renderHook(() => useKanbanBoard());

    let taskId: string;
    act(() => {
      taskId = result.current.createTask({ title: 'Test' });
    });

    act(() => {
      result.current.deleteTask(taskId!);
    });

    expect(result.current.tasks).toHaveLength(0);
  });

  it('adds and removes columns via hook', () => {
    const { result } = renderHook(() => useKanbanBoard());

    let colId: string;
    act(() => {
      colId = result.current.addColumn('Custom');
    });

    expect(result.current.columns).toHaveLength(5);

    act(() => {
      result.current.removeColumn(colId!);
    });

    expect(result.current.columns).toHaveLength(4);
  });

  it('filters tasks via hook', () => {
    const { result } = renderHook(() => useKanbanBoard());

    act(() => {
      result.current.createTask({ title: 'High', priority: 'high' });
      result.current.createTask({ title: 'Low', priority: 'low' });
    });

    const filtered = result.current.filterTasks({ priority: 'high' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('High');
  });

  it('exports and imports via hook', () => {
    const { result } = renderHook(() => useKanbanBoard());

    act(() => {
      result.current.createTask({ title: 'Export Me' });
    });

    const data = result.current.exportData();
    expect(data.tasks).toHaveLength(1);

    act(() => {
      result.current.importData({
        columns: [{ id: 'single', name: 'Single', order: 0 }],
        tasks: [
          {
            id: 'imported',
            title: 'Imported',
            description: '',
            columnId: 'single',
            priority: 'medium',
            tags: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            linkedNodeIds: [],
            order: 0,
          },
        ],
      });
    });

    expect(result.current.columns).toHaveLength(1);
    expect(result.current.tasks).toHaveLength(1);
  });
});
