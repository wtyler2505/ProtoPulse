/**
 * BL-0374 — Scriptable command palette actions.
 *
 * A centralized command registry that powers the command palette.
 * Commands can be registered, searched, and executed. Each command
 * has an ID, label, optional keyboard shortcut, category, and
 * execute function. Supports import/export of custom commands.
 *
 * Singleton+subscribe pattern. Custom command scripts persist in
 * localStorage as serializable metadata (the execute functions
 * themselves are registered at runtime).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Categories for grouping commands in the palette. */
export type CommandCategory =
  | 'navigation'
  | 'edit'
  | 'view'
  | 'export'
  | 'ai'
  | 'tools'
  | 'project'
  | 'debug'
  | 'custom';

/** A keyboard shortcut string (e.g., "Ctrl+Shift+P"). */
export type ShortcutString = string;

/** A registered command definition. */
export interface Command {
  /** Unique identifier (e.g., "navigate:architecture"). */
  id: string;
  /** Human-readable label shown in the palette. */
  label: string;
  /** Grouping category. */
  category: CommandCategory;
  /** Optional description / help text. */
  description?: string;
  /** Optional keyboard shortcut (display only — binding is external). */
  shortcut?: ShortcutString;
  /** Whether this command is user-defined (custom) vs built-in. */
  isCustom: boolean;
  /** Whether the command is currently enabled. */
  enabled: boolean;
  /** Tags for improved search matching. */
  tags: string[];
  /** The function to execute. */
  execute: () => void;
}

/** Serializable command metadata (for import/export, no execute fn). */
export interface CommandMeta {
  id: string;
  label: string;
  category: CommandCategory;
  description?: string;
  shortcut?: ShortcutString;
  isCustom: boolean;
  tags: string[];
}

/** A search result with relevance score. */
export interface CommandSearchResult {
  command: Command;
  score: number;
}

/** Parsed shortcut for matching. */
export interface ParsedShortcut {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

/** Execution history entry. */
export interface CommandExecution {
  commandId: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-scriptable-commands';
const HISTORY_KEY = 'protopulse-command-history';
const MAX_HISTORY = 50;

// ---------------------------------------------------------------------------
// Shortcut parsing
// ---------------------------------------------------------------------------

/**
 * Parse a shortcut string like "Ctrl+Shift+P" into structured form.
 * Modifier order doesn't matter. Key is the last non-modifier segment.
 */
export function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split('+').map((p) => p.trim());
  let ctrl = false;
  let shift = false;
  let alt = false;
  let meta = false;
  let key = '';

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') {
      ctrl = true;
    } else if (lower === 'shift') {
      shift = true;
    } else if (lower === 'alt' || lower === 'option') {
      alt = true;
    } else if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === 'super') {
      meta = true;
    } else {
      key = lower;
    }
  }

  return { key, ctrl, shift, alt, meta };
}

/**
 * Normalize a shortcut string to canonical form: "Ctrl+Shift+Alt+Meta+Key".
 */
export function normalizeShortcut(shortcut: string): string {
  const parsed = parseShortcut(shortcut);
  const parts: string[] = [];
  if (parsed.ctrl) {
    parts.push('Ctrl');
  }
  if (parsed.shift) {
    parts.push('Shift');
  }
  if (parsed.alt) {
    parts.push('Alt');
  }
  if (parsed.meta) {
    parts.push('Meta');
  }
  if (parsed.key) {
    parts.push(parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key);
  }
  return parts.join('+');
}

/**
 * Check if a KeyboardEvent matches a shortcut string.
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);
  if (parsed.key !== event.key.toLowerCase()) {
    return false;
  }
  if (parsed.ctrl !== event.ctrlKey) {
    return false;
  }
  if (parsed.shift !== event.shiftKey) {
    return false;
  }
  if (parsed.alt !== event.altKey) {
    return false;
  }
  if (parsed.meta !== event.metaKey) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Search scoring
// ---------------------------------------------------------------------------

function computeSearchScore(query: string, command: Command): number {
  const lower = query.toLowerCase();
  const labelLower = command.label.toLowerCase();
  const idLower = command.id.toLowerCase();
  const descLower = (command.description ?? '').toLowerCase();

  let score = 0;

  // Exact label match
  if (labelLower === lower) {
    score += 100;
  }
  // Label starts with query
  else if (labelLower.startsWith(lower)) {
    score += 80;
  }
  // Label contains query
  else if (labelLower.includes(lower)) {
    score += 50;
  }

  // ID match
  if (idLower.includes(lower)) {
    score += 30;
  }

  // Description match
  if (descLower.includes(lower)) {
    score += 20;
  }

  // Tag match
  for (const tag of command.tags) {
    if (tag.toLowerCase().includes(lower)) {
      score += 25;
      break;
    }
  }

  // Category match
  if (command.category.toLowerCase().includes(lower)) {
    score += 15;
  }

  // Word boundary bonus: query matches start of a word in label
  const words = labelLower.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(lower)) {
      score += 10;
      break;
    }
  }

  return score;
}

// ---------------------------------------------------------------------------
// Built-in commands (no-op execute — wired at UI level)
// ---------------------------------------------------------------------------

function noop(): void {
  // Placeholder — wired to actual handlers at UI integration
}

const BUILT_IN_COMMANDS: Omit<Command, 'execute'>[] = [
  {
    id: 'navigate:architecture',
    label: 'Go to Architecture View',
    category: 'navigation',
    description: 'Switch to the architecture block diagram view',
    shortcut: 'Ctrl+1',
    isCustom: false,
    enabled: true,
    tags: ['view', 'switch', 'architecture', 'blocks'],
  },
  {
    id: 'navigate:schematic',
    label: 'Go to Schematic View',
    category: 'navigation',
    description: 'Switch to the circuit schematic editor',
    shortcut: 'Ctrl+2',
    isCustom: false,
    enabled: true,
    tags: ['view', 'switch', 'schematic', 'circuit'],
  },
  {
    id: 'navigate:bom',
    label: 'Go to BOM View',
    category: 'navigation',
    description: 'Switch to the bill of materials',
    shortcut: 'Ctrl+3',
    isCustom: false,
    enabled: true,
    tags: ['view', 'switch', 'bom', 'parts'],
  },
  {
    id: 'navigate:validation',
    label: 'Go to Validation View',
    category: 'navigation',
    description: 'Switch to the design validation / DRC view',
    isCustom: false,
    enabled: true,
    tags: ['view', 'switch', 'validation', 'drc'],
  },
  {
    id: 'project:save',
    label: 'Save Project',
    category: 'project',
    description: 'Save all pending changes',
    shortcut: 'Ctrl+S',
    isCustom: false,
    enabled: true,
    tags: ['save', 'persist'],
  },
  {
    id: 'edit:undo',
    label: 'Undo',
    category: 'edit',
    description: 'Undo the last action',
    shortcut: 'Ctrl+Z',
    isCustom: false,
    enabled: true,
    tags: ['undo', 'revert'],
  },
  {
    id: 'edit:redo',
    label: 'Redo',
    category: 'edit',
    description: 'Redo the last undone action',
    shortcut: 'Ctrl+Shift+Z',
    isCustom: false,
    enabled: true,
    tags: ['redo', 'forward'],
  },
  {
    id: 'export:kicad',
    label: 'Export to KiCad',
    category: 'export',
    description: 'Export the current design in KiCad format',
    isCustom: false,
    enabled: true,
    tags: ['export', 'kicad', 'pcb'],
  },
  {
    id: 'export:gerber',
    label: 'Export Gerber Files',
    category: 'export',
    description: 'Generate Gerber manufacturing files',
    isCustom: false,
    enabled: true,
    tags: ['export', 'gerber', 'manufacturing', 'pcb'],
  },
  {
    id: 'ai:chat',
    label: 'Open AI Chat',
    category: 'ai',
    description: 'Open the AI assistant chat panel',
    isCustom: false,
    enabled: true,
    tags: ['ai', 'chat', 'assistant', 'help'],
  },
  {
    id: 'tools:drc',
    label: 'Run Design Rule Check',
    category: 'tools',
    description: 'Run DRC on the current design',
    isCustom: false,
    enabled: true,
    tags: ['drc', 'check', 'rules', 'validate'],
  },
  {
    id: 'view:zoom-fit',
    label: 'Zoom to Fit',
    category: 'view',
    description: 'Fit the entire design in view',
    shortcut: 'Ctrl+0',
    isCustom: false,
    enabled: true,
    tags: ['zoom', 'fit', 'reset'],
  },
];

// ---------------------------------------------------------------------------
// ScriptableCommandManager — singleton + subscribe
// ---------------------------------------------------------------------------

export class ScriptableCommandManager {
  private static instance: ScriptableCommandManager | null = null;

  private commands: Map<string, Command> = new Map();
  private executionHistory: CommandExecution[] = [];
  private subscribers = new Set<() => void>();

  private constructor() {
    this.registerBuiltIns();
    this.loadCustomMeta();
    this.loadHistory();
  }

  static getInstance(): ScriptableCommandManager {
    if (!ScriptableCommandManager.instance) {
      ScriptableCommandManager.instance = new ScriptableCommandManager();
    }
    return ScriptableCommandManager.instance;
  }

  /** Reset singleton for testing. */
  static resetInstance(): void {
    if (ScriptableCommandManager.instance) {
      ScriptableCommandManager.instance.subscribers.clear();
    }
    ScriptableCommandManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(): void {
    this.subscribers.forEach((fn) => fn());
  }

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  private registerBuiltIns(): void {
    for (const cmd of BUILT_IN_COMMANDS) {
      this.commands.set(cmd.id, { ...cmd, execute: noop });
    }
  }

  /**
   * Register a command. Overwrites if the ID already exists.
   * The execute function is required.
   */
  register(command: Command): void {
    this.commands.set(command.id, command);
    if (command.isCustom) {
      this.saveCustomMeta();
    }
    this.notify();
  }

  /**
   * Register a custom command with minimal params.
   * Creates a command with isCustom=true and provided execute fn.
   */
  registerCustom(
    id: string,
    label: string,
    execute: () => void,
    options?: {
      category?: CommandCategory;
      description?: string;
      shortcut?: string;
      tags?: string[];
    },
  ): Command {
    const command: Command = {
      id,
      label,
      category: options?.category ?? 'custom',
      description: options?.description,
      shortcut: options?.shortcut,
      isCustom: true,
      enabled: true,
      tags: options?.tags ?? [],
      execute,
    };
    this.register(command);
    return command;
  }

  /** Unregister a command by ID. Only custom commands can be removed. */
  unregister(id: string): boolean {
    const cmd = this.commands.get(id);
    if (!cmd) {
      return false;
    }
    if (!cmd.isCustom) {
      return false; // Cannot remove built-in commands
    }
    this.commands.delete(id);
    this.saveCustomMeta();
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // Execution
  // -----------------------------------------------------------------------

  /**
   * Execute a command by ID.
   * Returns true if the command was found and executed.
   */
  execute(id: string): boolean {
    const cmd = this.commands.get(id);
    if (!cmd || !cmd.enabled) {
      return false;
    }
    cmd.execute();
    this.recordExecution(id);
    this.notify();
    return true;
  }

  /** Enable or disable a command. */
  setEnabled(id: string, enabled: boolean): void {
    const cmd = this.commands.get(id);
    if (cmd) {
      cmd.enabled = enabled;
      this.notify();
    }
  }

  /** Bind an execute function to a built-in command. */
  bindExecute(id: string, execute: () => void): boolean {
    const cmd = this.commands.get(id);
    if (!cmd) {
      return false;
    }
    cmd.execute = execute;
    return true;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get a command by ID. */
  getCommand(id: string): Command | undefined {
    return this.commands.get(id);
  }

  /** Get all registered commands. */
  getAllCommands(): Command[] {
    const result: Command[] = [];
    this.commands.forEach((cmd) => result.push(cmd));
    return result;
  }

  /** Get commands filtered by category. */
  getByCategory(category: CommandCategory): Command[] {
    return this.getAllCommands().filter((c) => c.category === category);
  }

  /** Get only custom commands. */
  getCustomCommands(): Command[] {
    return this.getAllCommands().filter((c) => c.isCustom);
  }

  /** Get only built-in commands. */
  getBuiltInCommands(): Command[] {
    return this.getAllCommands().filter((c) => !c.isCustom);
  }

  /** Get all registered command count. */
  getCount(): number {
    return this.commands.size;
  }

  /** Check if a command exists. */
  has(id: string): boolean {
    return this.commands.has(id);
  }

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  /**
   * Fuzzy-search commands by query string.
   * Returns results sorted by relevance score (descending).
   * Only returns commands with score > 0.
   */
  search(query: string): CommandSearchResult[] {
    if (!query.trim()) {
      // No query — return all enabled commands sorted by label
      return this.getAllCommands()
        .filter((c) => c.enabled)
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((command) => ({ command, score: 1 }));
    }

    const results: CommandSearchResult[] = [];
    this.commands.forEach((command) => {
      if (!command.enabled) {
        return;
      }
      const score = computeSearchScore(query, command);
      if (score > 0) {
        results.push({ command, score });
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /**
   * Find a command by its shortcut string.
   * Returns the first matching command or undefined.
   */
  findByShortcut(shortcut: string): Command | undefined {
    const normalized = normalizeShortcut(shortcut);
    let found: Command | undefined;
    this.commands.forEach((cmd) => {
      if (!found && cmd.shortcut && normalizeShortcut(cmd.shortcut) === normalized) {
        found = cmd;
      }
    });
    return found;
  }

  // -----------------------------------------------------------------------
  // Execution history
  // -----------------------------------------------------------------------

  private recordExecution(commandId: string): void {
    this.executionHistory.push({ commandId, timestamp: Date.now() });
    if (this.executionHistory.length > MAX_HISTORY) {
      this.executionHistory = this.executionHistory.slice(-MAX_HISTORY);
    }
    this.saveHistory();
  }

  /** Get the N most recently executed command IDs (most recent first). */
  getRecentCommands(limit = 10): CommandExecution[] {
    return this.executionHistory.slice(-limit).reverse();
  }

  /** Get the most frequently executed commands. */
  getFrequentCommands(limit = 10): { commandId: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const exec of this.executionHistory) {
      counts.set(exec.commandId, (counts.get(exec.commandId) ?? 0) + 1);
    }
    const entries: { commandId: string; count: number }[] = [];
    counts.forEach((count, commandId) => {
      entries.push({ commandId, count });
    });
    entries.sort((a, b) => b.count - a.count);
    return entries.slice(0, limit);
  }

  /** Clear execution history. */
  clearHistory(): void {
    this.executionHistory = [];
    this.saveHistory();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /**
   * Export all custom command metadata (without execute functions).
   * Useful for sharing or backing up custom commands.
   */
  exportCustomCommands(): CommandMeta[] {
    return this.getCustomCommands().map((cmd) => ({
      id: cmd.id,
      label: cmd.label,
      category: cmd.category,
      description: cmd.description,
      shortcut: cmd.shortcut,
      isCustom: true,
      tags: [...cmd.tags],
    }));
  }

  /**
   * Import command metadata. Creates commands with no-op execute functions.
   * Callers must then bind real execute functions via bindExecute().
   * Returns the number of commands imported.
   */
  importCommands(metas: CommandMeta[]): number {
    let imported = 0;
    for (const meta of metas) {
      if (!meta.id || !meta.label) {
        continue;
      }
      const command: Command = {
        id: meta.id,
        label: meta.label,
        category: meta.category ?? 'custom',
        description: meta.description,
        shortcut: meta.shortcut,
        isCustom: true,
        enabled: true,
        tags: meta.tags ?? [],
        execute: noop,
      };
      this.commands.set(command.id, command);
      imported++;
    }
    if (imported > 0) {
      this.saveCustomMeta();
      this.notify();
    }
    return imported;
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Save custom command metadata to localStorage. */
  private saveCustomMeta(): void {
    try {
      const metas = this.exportCustomCommands();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(metas));
    } catch {
      // localStorage unavailable
    }
  }

  /** Load custom command metadata from localStorage. */
  private loadCustomMeta(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const metas = JSON.parse(raw) as CommandMeta[];
      if (!Array.isArray(metas)) {
        return;
      }
      this.importCommands(metas);
    } catch {
      // Corrupt data — start fresh
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.executionHistory));
    } catch {
      // localStorage unavailable
    }
  }

  private loadHistory(): void {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) {
        return;
      }
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        this.executionHistory = data;
      }
    } catch {
      this.executionHistory = [];
    }
  }
}
