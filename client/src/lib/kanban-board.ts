/**
 * Kanban Board State Manager
 *
 * Lightweight in-app Kanban board for tracking design tasks within ProtoPulse.
 * Supports custom columns, task CRUD, filtering, architecture node linking,
 * and localStorage persistence with import/export.
 *
 * Usage:
 *   const board = KanbanBoard.getInstance();
 *   board.createTask({ title: 'Route power traces', columnId: 'todo', priority: 'high' });
 *   board.moveTask(taskId, 'in-progress');
 *
 * React hook:
 *   const { tasks, columns, createTask, moveTask } = useKanbanBoard();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface KanbanColumn {
  id: string;
  name: string;
  order: number;
  color?: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  columnId: string;
  priority: TaskPriority;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  dueDate?: number;
  assignee?: string;
  linkedNodeIds: string[];
  order: number;
}

export interface KanbanBoardData {
  columns: KanbanColumn[];
  tasks: KanbanTask[];
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  columnId?: string;
  priority?: TaskPriority;
  tags?: string[];
  dueDate?: number;
  assignee?: string;
  linkedNodeIds?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  tags?: string[];
  dueDate?: number | null;
  assignee?: string | null;
  linkedNodeIds?: string[];
}

export interface TaskFilter {
  tag?: string;
  priority?: TaskPriority;
  assignee?: string;
  columnId?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-kanban-board';

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'backlog', name: 'Backlog', order: 0, color: '#6b7280' },
  { id: 'todo', name: 'To Do', order: 1, color: '#3b82f6' },
  { id: 'in-progress', name: 'In Progress', order: 2, color: '#f59e0b' },
  { id: 'done', name: 'Done', order: 3, color: '#22c55e' },
];

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// KanbanBoard
// ---------------------------------------------------------------------------

/**
 * Manages Kanban board state with columns and tasks.
 * Singleton per application. Notifies subscribers on state changes.
 * Persists to localStorage.
 */
export class KanbanBoard {
  private static instance: KanbanBoard | null = null;

  private columns: KanbanColumn[];
  private tasks: KanbanTask[];
  private listeners = new Set<Listener>();

  constructor() {
    this.columns = DEFAULT_COLUMNS.map((c) => ({ ...c }));
    this.tasks = [];
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): KanbanBoard {
    if (!KanbanBoard.instance) {
      KanbanBoard.instance = new KanbanBoard();
    }
    return KanbanBoard.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    KanbanBoard.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked on any column or task mutation.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Column Management
  // -----------------------------------------------------------------------

  /** Get all columns sorted by order. */
  getColumns(): KanbanColumn[] {
    return [...this.columns].sort((a, b) => a.order - b.order);
  }

  /** Get a column by ID. Returns null if not found. */
  getColumn(id: string): KanbanColumn | null {
    return this.columns.find((c) => c.id === id) ?? null;
  }

  /** Add a new column. Returns the column ID. */
  addColumn(name: string, color?: string): string {
    const id = crypto.randomUUID();
    const maxOrder = this.columns.length > 0 ? Math.max(...this.columns.map((c) => c.order)) : -1;
    this.columns.push({ id, name, order: maxOrder + 1, color });
    this.save();
    this.notify();
    return id;
  }

  /** Remove a column by ID. Moves tasks in that column to the first column. Returns false if not found or if it's the last column. */
  removeColumn(id: string): boolean {
    const index = this.columns.findIndex((c) => c.id === id);
    if (index === -1) {
      return false;
    }
    if (this.columns.length <= 1) {
      return false;
    }

    this.columns.splice(index, 1);

    // Move orphaned tasks to the first column
    const firstColumn = this.columns.sort((a, b) => a.order - b.order)[0];
    for (const task of this.tasks) {
      if (task.columnId === id) {
        task.columnId = firstColumn.id;
        task.updatedAt = Date.now();
      }
    }

    this.save();
    this.notify();
    return true;
  }

  /** Rename a column. Returns false if not found. */
  renameColumn(id: string, name: string): boolean {
    const column = this.columns.find((c) => c.id === id);
    if (!column) {
      return false;
    }
    column.name = name;
    this.save();
    this.notify();
    return true;
  }

  /** Reorder columns by providing an array of column IDs in desired order. */
  reorderColumns(columnIds: string[]): boolean {
    // Validate all IDs exist
    for (const id of columnIds) {
      if (!this.columns.some((c) => c.id === id)) {
        return false;
      }
    }

    for (let i = 0; i < columnIds.length; i++) {
      const column = this.columns.find((c) => c.id === columnIds[i]);
      if (column) {
        column.order = i;
      }
    }

    this.save();
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // Task CRUD
  // -----------------------------------------------------------------------

  /** Create a new task. Returns the task ID. */
  createTask(input: CreateTaskInput): string {
    const columnId = input.columnId ?? this.columns.sort((a, b) => a.order - b.order)[0]?.id ?? 'backlog';

    // Validate column exists
    if (!this.columns.some((c) => c.id === columnId)) {
      throw new Error(`Column "${columnId}" does not exist`);
    }

    const tasksInColumn = this.tasks.filter((t) => t.columnId === columnId);
    const maxOrder = tasksInColumn.length > 0 ? Math.max(...tasksInColumn.map((t) => t.order)) : -1;

    const now = Date.now();
    const id = crypto.randomUUID();
    const task: KanbanTask = {
      id,
      title: input.title,
      description: input.description ?? '',
      columnId,
      priority: input.priority ?? 'medium',
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
      dueDate: input.dueDate,
      assignee: input.assignee,
      linkedNodeIds: input.linkedNodeIds ?? [],
      order: maxOrder + 1,
    };

    this.tasks.push(task);
    this.save();
    this.notify();
    return id;
  }

  /** Get a task by ID. Returns null if not found. */
  getTask(id: string): KanbanTask | null {
    return this.tasks.find((t) => t.id === id) ?? null;
  }

  /** Update a task. Returns false if not found. */
  updateTask(id: string, updates: UpdateTaskInput): boolean {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) {
      return false;
    }

    if (updates.title !== undefined) {
      task.title = updates.title;
    }
    if (updates.description !== undefined) {
      task.description = updates.description;
    }
    if (updates.priority !== undefined) {
      task.priority = updates.priority;
    }
    if (updates.tags !== undefined) {
      task.tags = updates.tags;
    }
    if (updates.dueDate !== undefined) {
      task.dueDate = updates.dueDate === null ? undefined : updates.dueDate;
    }
    if (updates.assignee !== undefined) {
      task.assignee = updates.assignee === null ? undefined : updates.assignee;
    }
    if (updates.linkedNodeIds !== undefined) {
      task.linkedNodeIds = updates.linkedNodeIds;
    }

    task.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  /** Delete a task. Returns false if not found. */
  deleteTask(id: string): boolean {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      return false;
    }
    this.tasks.splice(index, 1);
    this.save();
    this.notify();
    return true;
  }

  /** Move a task to a different column. Optionally specify position within the column. Returns false if task or column not found. */
  moveTask(taskId: string, targetColumnId: string, position?: number): boolean {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) {
      return false;
    }
    if (!this.columns.some((c) => c.id === targetColumnId)) {
      return false;
    }

    task.columnId = targetColumnId;
    task.updatedAt = Date.now();

    // Reorder within target column
    const tasksInTarget = this.tasks
      .filter((t) => t.columnId === targetColumnId && t.id !== taskId)
      .sort((a, b) => a.order - b.order);

    if (position !== undefined && position >= 0 && position <= tasksInTarget.length) {
      tasksInTarget.splice(position, 0, task);
    } else {
      tasksInTarget.push(task);
    }

    for (let i = 0; i < tasksInTarget.length; i++) {
      tasksInTarget[i].order = i;
    }

    this.save();
    this.notify();
    return true;
  }

  /** Reorder a task within its current column. */
  reorderTask(taskId: string, newPosition: number): boolean {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) {
      return false;
    }

    const tasksInColumn = this.tasks
      .filter((t) => t.columnId === task.columnId && t.id !== taskId)
      .sort((a, b) => a.order - b.order);

    const clampedPosition = Math.max(0, Math.min(newPosition, tasksInColumn.length));
    tasksInColumn.splice(clampedPosition, 0, task);

    for (let i = 0; i < tasksInColumn.length; i++) {
      tasksInColumn[i].order = i;
    }

    task.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get all tasks, optionally sorted by order within their columns. */
  getAllTasks(): KanbanTask[] {
    return [...this.tasks].sort((a, b) => a.order - b.order);
  }

  /** Get tasks in a specific column, sorted by order. */
  getTasksByColumn(columnId: string): KanbanTask[] {
    return this.tasks.filter((t) => t.columnId === columnId).sort((a, b) => a.order - b.order);
  }

  /** Filter tasks by tag, priority, assignee, and/or column. */
  filterTasks(filter: TaskFilter): KanbanTask[] {
    let result = [...this.tasks];

    if (filter.tag !== undefined) {
      const tagLower = filter.tag.toLowerCase();
      result = result.filter((t) => t.tags.some((tag) => tag.toLowerCase() === tagLower));
    }

    if (filter.priority !== undefined) {
      result = result.filter((t) => t.priority === filter.priority);
    }

    if (filter.assignee !== undefined) {
      result = result.filter((t) => t.assignee === filter.assignee);
    }

    if (filter.columnId !== undefined) {
      result = result.filter((t) => t.columnId === filter.columnId);
    }

    return result.sort((a, b) => a.order - b.order);
  }

  /** Get tasks linked to a specific architecture node ID. */
  getTasksByLinkedNode(nodeId: string): KanbanTask[] {
    return this.tasks.filter((t) => t.linkedNodeIds.includes(nodeId)).sort((a, b) => a.order - b.order);
  }

  /** Get the total number of tasks. */
  getTaskCount(): number {
    return this.tasks.length;
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export the full board state as JSON. */
  exportData(): KanbanBoardData {
    return {
      columns: this.getColumns(),
      tasks: this.getAllTasks(),
    };
  }

  /** Import board data from JSON, replacing the current state. */
  importData(data: KanbanBoardData): void {
    if (!Array.isArray(data.columns) || !Array.isArray(data.tasks)) {
      throw new Error('Invalid board data: columns and tasks must be arrays');
    }

    if (data.columns.length === 0) {
      throw new Error('Invalid board data: must have at least one column');
    }

    // Validate columns
    for (const col of data.columns) {
      if (typeof col.id !== 'string' || typeof col.name !== 'string' || typeof col.order !== 'number') {
        throw new Error('Invalid column data: each column must have id, name, and order');
      }
    }

    // Validate tasks
    const columnIds = data.columns.map((c) => c.id);
    for (const task of data.tasks) {
      if (typeof task.id !== 'string' || typeof task.title !== 'string') {
        throw new Error('Invalid task data: each task must have id and title');
      }
      if (!columnIds.includes(task.columnId)) {
        throw new Error(`Task "${task.title}" references non-existent column "${task.columnId}"`);
      }
    }

    this.columns = data.columns.map((c) => ({ ...c }));
    this.tasks = data.tasks.map((t) => ({ ...t }));
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist board state to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const data: KanbanBoardData = { columns: this.columns, tasks: this.tasks };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load board state from localStorage. */
  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as Record<string, unknown>;

      // Load columns
      if (Array.isArray(data.columns) && data.columns.length > 0) {
        const validColumns = (data.columns as unknown[]).filter(
          (c: unknown): c is KanbanColumn =>
            typeof c === 'object' &&
            c !== null &&
            typeof (c as KanbanColumn).id === 'string' &&
            typeof (c as KanbanColumn).name === 'string' &&
            typeof (c as KanbanColumn).order === 'number',
        );
        if (validColumns.length > 0) {
          this.columns = validColumns;
        }
      }

      // Load tasks
      if (Array.isArray(data.tasks)) {
        const columnIds = this.columns.map((c) => c.id);
        this.tasks = (data.tasks as unknown[]).filter(
          (t: unknown): t is KanbanTask =>
            typeof t === 'object' &&
            t !== null &&
            typeof (t as KanbanTask).id === 'string' &&
            typeof (t as KanbanTask).title === 'string' &&
            typeof (t as KanbanTask).columnId === 'string' &&
            columnIds.includes((t as KanbanTask).columnId) &&
            typeof (t as KanbanTask).createdAt === 'number' &&
            typeof (t as KanbanTask).updatedAt === 'number' &&
            typeof (t as KanbanTask).order === 'number',
        );
      }
    } catch {
      // Corrupt data — keep defaults
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the Kanban board in React components.
 * Subscribes to the KanbanBoard singleton and triggers re-renders on state changes.
 */
export function useKanbanBoard(): {
  columns: KanbanColumn[];
  tasks: KanbanTask[];
  createTask: (input: CreateTaskInput) => string;
  updateTask: (id: string, updates: UpdateTaskInput) => boolean;
  deleteTask: (id: string) => boolean;
  moveTask: (taskId: string, targetColumnId: string, position?: number) => boolean;
  reorderTask: (taskId: string, newPosition: number) => boolean;
  getTasksByColumn: (columnId: string) => KanbanTask[];
  filterTasks: (filter: TaskFilter) => KanbanTask[];
  getTasksByLinkedNode: (nodeId: string) => KanbanTask[];
  addColumn: (name: string, color?: string) => string;
  removeColumn: (id: string) => boolean;
  renameColumn: (id: string, name: string) => boolean;
  reorderColumns: (columnIds: string[]) => boolean;
  exportData: () => KanbanBoardData;
  importData: (data: KanbanBoardData) => void;
  taskCount: number;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const board = KanbanBoard.getInstance();
    const unsubscribe = board.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const createTask = useCallback((input: CreateTaskInput) => {
    return KanbanBoard.getInstance().createTask(input);
  }, []);

  const updateTask = useCallback((id: string, updates: UpdateTaskInput) => {
    return KanbanBoard.getInstance().updateTask(id, updates);
  }, []);

  const deleteTask = useCallback((id: string) => {
    return KanbanBoard.getInstance().deleteTask(id);
  }, []);

  const moveTask = useCallback((taskId: string, targetColumnId: string, position?: number) => {
    return KanbanBoard.getInstance().moveTask(taskId, targetColumnId, position);
  }, []);

  const reorderTask = useCallback((taskId: string, newPosition: number) => {
    return KanbanBoard.getInstance().reorderTask(taskId, newPosition);
  }, []);

  const getTasksByColumn = useCallback((columnId: string) => {
    return KanbanBoard.getInstance().getTasksByColumn(columnId);
  }, []);

  const filterTasks = useCallback((filter: TaskFilter) => {
    return KanbanBoard.getInstance().filterTasks(filter);
  }, []);

  const getTasksByLinkedNode = useCallback((nodeId: string) => {
    return KanbanBoard.getInstance().getTasksByLinkedNode(nodeId);
  }, []);

  const addColumn = useCallback((name: string, color?: string) => {
    return KanbanBoard.getInstance().addColumn(name, color);
  }, []);

  const removeColumn = useCallback((id: string) => {
    return KanbanBoard.getInstance().removeColumn(id);
  }, []);

  const renameColumn = useCallback((id: string, name: string) => {
    return KanbanBoard.getInstance().renameColumn(id, name);
  }, []);

  const reorderColumns = useCallback((columnIds: string[]) => {
    return KanbanBoard.getInstance().reorderColumns(columnIds);
  }, []);

  const exportData = useCallback(() => {
    return KanbanBoard.getInstance().exportData();
  }, []);

  const importData = useCallback((data: KanbanBoardData) => {
    KanbanBoard.getInstance().importData(data);
  }, []);

  const board = typeof window !== 'undefined' ? KanbanBoard.getInstance() : null;

  return {
    columns: board?.getColumns() ?? [],
    tasks: board?.getAllTasks() ?? [],
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    reorderTask,
    getTasksByColumn,
    filterTasks,
    getTasksByLinkedNode,
    addColumn,
    removeColumn,
    renameColumn,
    reorderColumns,
    exportData,
    importData,
    taskCount: board?.getTaskCount() ?? 0,
  };
}
