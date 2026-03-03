/**
 * Core undo/redo engine using the Command pattern.
 *
 * Each undoable action is wrapped in an `UndoableCommand` that knows how to
 * execute itself *and* reverse itself.  The `UndoRedoStack` manages two stacks
 * (undo & redo) and enforces a configurable maximum depth.
 */

/** A single reversible action. */
export interface UndoableCommand {
  /** Machine-readable action type (e.g. "add-node", "remove-bom-item"). */
  readonly type: string;
  /** Human-readable description shown in the UI (e.g. "Add MCU block"). */
  readonly description: string;
  /** Apply the action. */
  execute(): Promise<void>;
  /** Reverse the action. */
  undo(): Promise<void>;
}

/** An entry in the history list exposed to the UI. */
export interface HistoryEntry {
  readonly type: string;
  readonly description: string;
  /** Index within the undo stack (0 = oldest). */
  readonly index: number;
}

/** Default maximum number of commands in each stack. */
const DEFAULT_MAX_SIZE = 50;

/** Immutable snapshot of derived stack state, suitable for `useSyncExternalStore`. */
export interface UndoRedoSnapshot {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoDescription: string | null;
  readonly redoDescription: string | null;
  readonly history: HistoryEntry[];
}

/**
 * Manages a pair of undo/redo stacks and exposes an imperative API for
 * pushing, undoing, and redoing commands.
 *
 * The stack is intentionally *not* a React class — it is a plain object so
 * that the React wrapper can subscribe to changes via a listener callback.
 */
export class UndoRedoStack {
  private undoItems: UndoableCommand[] = [];
  private redoItems: UndoableCommand[] = [];
  private readonly maxSize: number;
  private listener: (() => void) | null = null;

  /**
   * Cached snapshot — rebuilt only when the stack mutates.  Returning the
   * same object reference between mutations lets `useSyncExternalStore`
   * skip re-renders when nothing changed.
   */
  private cachedSnapshot: UndoRedoSnapshot;

  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
    this.cachedSnapshot = this.buildSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Subscription — the React context calls this to re-render on changes.
  // ---------------------------------------------------------------------------

  /** Register a single listener invoked after every mutation. */
  setListener(fn: (() => void) | null): void {
    this.listener = fn;
  }

  private notify(): void {
    this.cachedSnapshot = this.buildSnapshot();
    this.listener?.();
  }

  private buildSnapshot(): UndoRedoSnapshot {
    const lastUndo = this.undoItems[this.undoItems.length - 1];
    const lastRedo = this.redoItems[this.redoItems.length - 1];
    return {
      canUndo: this.undoItems.length > 0,
      canRedo: this.redoItems.length > 0,
      undoDescription: lastUndo?.description ?? null,
      redoDescription: lastRedo?.description ?? null,
      history: this.undoItems.map((cmd, i) => ({
        type: cmd.type,
        description: cmd.description,
        index: i,
      })),
    };
  }

  /** Return a stable snapshot reference (changes only after mutations). */
  getSnapshot(): UndoRedoSnapshot {
    return this.cachedSnapshot;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Push a new command onto the undo stack.  Clears the redo stack. */
  push(command: UndoableCommand): void {
    this.undoItems.push(command);
    if (this.undoItems.length > this.maxSize) {
      this.undoItems.splice(0, this.undoItems.length - this.maxSize);
    }
    this.redoItems = [];
    this.notify();
  }

  /** Undo the most recent command — moves it to the redo stack. */
  async undo(): Promise<void> {
    const command = this.undoItems.pop();
    if (!command) {
      return;
    }
    await command.undo();
    this.redoItems.push(command);
    if (this.redoItems.length > this.maxSize) {
      this.redoItems.splice(0, this.redoItems.length - this.maxSize);
    }
    this.notify();
  }

  /** Redo the most recently undone command — moves it back to the undo stack. */
  async redo(): Promise<void> {
    const command = this.redoItems.pop();
    if (!command) {
      return;
    }
    await command.execute();
    this.undoItems.push(command);
    if (this.undoItems.length > this.maxSize) {
      this.undoItems.splice(0, this.undoItems.length - this.maxSize);
    }
    this.notify();
  }

  /** Whether there is at least one command to undo. */
  get canUndo(): boolean {
    return this.undoItems.length > 0;
  }

  /** Whether there is at least one command to redo. */
  get canRedo(): boolean {
    return this.redoItems.length > 0;
  }

  /** Description of the next command that would be undone, or `null`. */
  get undoDescription(): string | null {
    const last = this.undoItems[this.undoItems.length - 1];
    return last?.description ?? null;
  }

  /** Description of the next command that would be redone, or `null`. */
  get redoDescription(): string | null {
    const last = this.redoItems[this.redoItems.length - 1];
    return last?.description ?? null;
  }

  /** Number of commands in the undo stack. */
  get undoSize(): number {
    return this.undoItems.length;
  }

  /** Number of commands in the redo stack. */
  get redoSize(): number {
    return this.redoItems.length;
  }

  /** Ordered history of all undoable commands (oldest first). */
  get history(): HistoryEntry[] {
    return this.undoItems.map((cmd, i) => ({
      type: cmd.type,
      description: cmd.description,
      index: i,
    }));
  }

  /** Reset both stacks completely. */
  clear(): void {
    this.undoItems = [];
    this.redoItems = [];
    this.notify();
  }
}
