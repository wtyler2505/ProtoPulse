/**
 * BL-0709 — Zero-Mouse Keyboard Engine
 *
 * Natural language command parser that maps free-form text to structured
 * EDA actions. Supports regex-matched commands (place/connect/delete/set/
 * zoom/show/export/run/find/select/align/undo/redo/save/compile/upload/
 * help), fuzzy autocomplete, command history, and custom command
 * registration.
 *
 * Singleton + Subscribe pattern. Command history persists to localStorage.
 *
 * Usage:
 *   const engine = KeyboardEngine.getInstance();
 *   const result = engine.execute('place resistor 10k');
 *   const suggestions = engine.autocomplete('pla');
 *
 * React hook:
 *   const { execute, autocomplete, history, registerCommand } = useKeyboardEngine();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommandCategory =
  | 'component'
  | 'connection'
  | 'editing'
  | 'view'
  | 'export'
  | 'simulation'
  | 'project'
  | 'navigation'
  | 'arduino'
  | 'help';

export interface ParsedCommand {
  /** The matched command ID. */
  commandId: string;
  /** Raw input text that was parsed. */
  raw: string;
  /** Extracted positional arguments. */
  args: string[];
  /** Extracted key=value flags. */
  flags: Record<string, string>;
}

export interface CommandResult {
  success: boolean;
  commandId: string;
  message: string;
  /** Optional data payload from the command handler. */
  data?: Record<string, unknown>;
}

export interface CommandDefinition {
  /** Unique command identifier (e.g. 'place', 'connect'). */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Category for grouping in help/autocomplete. */
  category: CommandCategory;
  /** Short description of what the command does. */
  description: string;
  /** Regex patterns that match this command (tested against full input). */
  patterns: RegExp[];
  /** Example usages shown in help output. */
  examples: string[];
  /**
   * Handler that executes the command.
   * Receives the parsed command and returns a result.
   */
  handler: (parsed: ParsedCommand) => CommandResult;
}

export interface CommandHistoryEntry {
  raw: string;
  commandId: string;
  success: boolean;
  timestamp: number;
}

export interface AutocompleteResult {
  commandId: string;
  label: string;
  description: string;
  examples: string[];
  score: number;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse:keyboard-engine-history';
const MAX_HISTORY = 100;

// ---------------------------------------------------------------------------
// Fuzzy scoring
// ---------------------------------------------------------------------------

/**
 * Simple fuzzy match score. Returns 0 if no match, higher is better.
 * Rewards prefix matches, consecutive matches, and exact containment.
 */
export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (t === q) {
    return 200;
  }
  if (t.startsWith(q)) {
    return 150;
  }
  if (t.includes(q)) {
    return 100;
  }

  // Subsequence matching
  let qi = 0;
  let consecutive = 0;
  let maxConsecutive = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      if (consecutive > maxConsecutive) {
        maxConsecutive = consecutive;
      }
      score += 10;
      if (ti === qi - 1) {
        score += 5; // prefix bonus
      }
    } else {
      consecutive = 0;
    }
  }

  if (qi < q.length) {
    return 0; // not all query chars matched
  }

  return score + maxConsecutive * 5;
}

// ---------------------------------------------------------------------------
// Argument parser
// ---------------------------------------------------------------------------

/**
 * Parse raw input text after the command keyword into args and flags.
 * Flags are key=value pairs. Everything else is a positional arg.
 */
export function parseArguments(input: string): { args: string[]; flags: Record<string, string> } {
  const args: string[] = [];
  const flags: Record<string, string> = {};

  // Tokenize respecting quoted strings
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    tokens.push(current);
  }

  for (const token of tokens) {
    const eqIdx = token.indexOf('=');
    if (eqIdx > 0 && eqIdx < token.length - 1) {
      const key = token.slice(0, eqIdx);
      const value = token.slice(eqIdx + 1);
      flags[key] = value;
    } else {
      args.push(token);
    }
  }

  return { args, flags };
}

// ---------------------------------------------------------------------------
// Built-in command definitions
// ---------------------------------------------------------------------------

function createBuiltinCommands(): CommandDefinition[] {
  return [
    {
      id: 'place',
      label: 'Place Component',
      category: 'component',
      description: 'Place a component on the canvas (e.g. resistor, capacitor, IC)',
      patterns: [
        /^place\s+(.+)/i,
        /^add\s+component\s+(.+)/i,
        /^insert\s+(.+)/i,
      ],
      examples: ['place resistor 10k', 'place capacitor 100nF', 'place ATmega328P'],
      handler: (parsed) => ({
        success: true,
        commandId: 'place',
        message: `Place component: ${parsed.args.join(' ')}`,
        data: { component: parsed.args.join(' '), flags: parsed.flags },
      }),
    },
    {
      id: 'connect',
      label: 'Connect Nodes',
      category: 'connection',
      description: 'Create a connection/wire between two nodes or pins',
      patterns: [
        /^connect\s+(.+)\s+to\s+(.+)/i,
        /^wire\s+(.+)\s+to\s+(.+)/i,
        /^link\s+(.+)\s+to\s+(.+)/i,
      ],
      examples: ['connect R1 to C1', 'wire VCC to R1.pin1', 'link U1.TX to U2.RX'],
      handler: (parsed) => {
        const raw = parsed.raw;
        const toMatch = raw.match(/^(?:connect|wire|link)\s+(.+?)\s+to\s+(.+)$/i);
        if (toMatch) {
          return {
            success: true,
            commandId: 'connect',
            message: `Connect: ${toMatch[1].trim()} → ${toMatch[2].trim()}`,
            data: { source: toMatch[1].trim(), target: toMatch[2].trim() },
          };
        }
        return { success: false, commandId: 'connect', message: 'Syntax: connect <source> to <target>' };
      },
    },
    {
      id: 'delete',
      label: 'Delete',
      category: 'editing',
      description: 'Delete selected items or a specific component by name',
      patterns: [
        /^delete\s+(.*)/i,
        /^remove\s+(.*)/i,
        /^del\s+(.*)/i,
      ],
      examples: ['delete R1', 'delete selected', 'remove C3'],
      handler: (parsed) => ({
        success: true,
        commandId: 'delete',
        message: `Delete: ${parsed.args.join(' ') || 'selected'}`,
        data: { target: parsed.args.join(' ') || 'selected' },
      }),
    },
    {
      id: 'set',
      label: 'Set Property',
      category: 'editing',
      description: 'Set a property on a component (e.g. value, footprint)',
      patterns: [
        /^set\s+(\S+)\s+(\S+)\s+(.+)/i,
        /^change\s+(\S+)\s+(\S+)\s+to\s+(.+)/i,
      ],
      examples: ['set R1 value 4.7k', 'change C1 footprint 0805', 'set U1 voltage 3.3V'],
      handler: (parsed) => {
        const match = parsed.raw.match(/^(?:set|change)\s+(\S+)\s+(\S+)\s+(?:to\s+)?(.+)$/i);
        if (match) {
          return {
            success: true,
            commandId: 'set',
            message: `Set ${match[1]}.${match[2]} = ${match[3]}`,
            data: { target: match[1], property: match[2], value: match[3] },
          };
        }
        return { success: false, commandId: 'set', message: 'Syntax: set <component> <property> <value>' };
      },
    },
    {
      id: 'zoom',
      label: 'Zoom',
      category: 'view',
      description: 'Zoom in, out, or to fit the view',
      patterns: [
        /^zoom\s+(in|out|fit|reset|\d+%?)/i,
        /^z\s+(in|out|fit|reset|\d+%?)/i,
      ],
      examples: ['zoom in', 'zoom out', 'zoom fit', 'zoom 150%'],
      handler: (parsed) => {
        const level = parsed.args[0] || 'fit';
        return {
          success: true,
          commandId: 'zoom',
          message: `Zoom: ${level}`,
          data: { level },
        };
      },
    },
    {
      id: 'show',
      label: 'Show View',
      category: 'navigation',
      description: 'Navigate to a specific view or panel',
      patterns: [
        /^show\s+(.+)/i,
        /^open\s+(.+)/i,
        /^go\s+to\s+(.+)/i,
        /^view\s+(.+)/i,
      ],
      examples: ['show schematic', 'open bom', 'go to pcb', 'show architecture'],
      handler: (parsed) => ({
        success: true,
        commandId: 'show',
        message: `Show view: ${parsed.args.join(' ')}`,
        data: { view: parsed.args.join(' ').toLowerCase() },
      }),
    },
    {
      id: 'export',
      label: 'Export',
      category: 'export',
      description: 'Export design in a specific format',
      patterns: [
        /^export\s+(.+)/i,
        /^generate\s+(.+)/i,
      ],
      examples: ['export gerber', 'export kicad', 'export bom csv', 'generate netlist'],
      handler: (parsed) => ({
        success: true,
        commandId: 'export',
        message: `Export: ${parsed.args.join(' ')}`,
        data: { format: parsed.args.join(' ').toLowerCase() },
      }),
    },
    {
      id: 'run',
      label: 'Run',
      category: 'simulation',
      description: 'Run a simulation, DRC check, or analysis',
      patterns: [
        /^run\s+(.+)/i,
        /^execute\s+(.+)/i,
        /^start\s+(.+)/i,
      ],
      examples: ['run drc', 'run simulation', 'run erc', 'run monte carlo'],
      handler: (parsed) => ({
        success: true,
        commandId: 'run',
        message: `Run: ${parsed.args.join(' ')}`,
        data: { action: parsed.args.join(' ').toLowerCase() },
      }),
    },
    {
      id: 'find',
      label: 'Find',
      category: 'navigation',
      description: 'Find a component, net, or element on the canvas',
      patterns: [
        /^find\s+(.+)/i,
        /^search\s+(.+)/i,
        /^locate\s+(.+)/i,
      ],
      examples: ['find R1', 'search VCC', 'locate U1'],
      handler: (parsed) => ({
        success: true,
        commandId: 'find',
        message: `Find: ${parsed.args.join(' ')}`,
        data: { query: parsed.args.join(' ') },
      }),
    },
    {
      id: 'select',
      label: 'Select',
      category: 'editing',
      description: 'Select components by name, type, or criteria',
      patterns: [
        /^select\s+(.+)/i,
        /^sel\s+(.+)/i,
        /^pick\s+(.+)/i,
      ],
      examples: ['select all resistors', 'select R1 R2 R3', 'select net VCC'],
      handler: (parsed) => ({
        success: true,
        commandId: 'select',
        message: `Select: ${parsed.args.join(' ')}`,
        data: { criteria: parsed.args.join(' ') },
      }),
    },
    {
      id: 'align',
      label: 'Align',
      category: 'editing',
      description: 'Align selected components (left, right, top, bottom, center, distribute)',
      patterns: [
        /^align\s+(.+)/i,
        /^distribute\s+(.+)/i,
      ],
      examples: ['align left', 'align top', 'align center', 'distribute horizontal'],
      handler: (parsed) => ({
        success: true,
        commandId: 'align',
        message: `Align: ${parsed.args.join(' ')}`,
        data: { direction: parsed.args.join(' ').toLowerCase() },
      }),
    },
    {
      id: 'undo',
      label: 'Undo',
      category: 'editing',
      description: 'Undo the last action',
      patterns: [/^undo$/i, /^u$/i],
      examples: ['undo'],
      handler: () => ({ success: true, commandId: 'undo', message: 'Undo' }),
    },
    {
      id: 'redo',
      label: 'Redo',
      category: 'editing',
      description: 'Redo the last undone action',
      patterns: [/^redo$/i],
      examples: ['redo'],
      handler: () => ({ success: true, commandId: 'redo', message: 'Redo' }),
    },
    {
      id: 'save',
      label: 'Save',
      category: 'project',
      description: 'Save the current project',
      patterns: [/^save$/i, /^s$/i],
      examples: ['save'],
      handler: () => ({ success: true, commandId: 'save', message: 'Project saved' }),
    },
    {
      id: 'compile',
      label: 'Compile',
      category: 'arduino',
      description: 'Compile the current Arduino sketch',
      patterns: [
        /^compile$/i,
        /^build$/i,
        /^verify$/i,
        /^compile\s+(.+)/i,
      ],
      examples: ['compile', 'build', 'compile --board uno'],
      handler: (parsed) => ({
        success: true,
        commandId: 'compile',
        message: `Compile${parsed.args.length > 0 ? ': ' + parsed.args.join(' ') : ''}`,
        data: { options: parsed.args.join(' '), flags: parsed.flags },
      }),
    },
    {
      id: 'upload',
      label: 'Upload',
      category: 'arduino',
      description: 'Upload firmware to the connected board',
      patterns: [
        /^upload$/i,
        /^flash$/i,
        /^program$/i,
        /^upload\s+(.+)/i,
      ],
      examples: ['upload', 'flash', 'upload --port /dev/ttyUSB0'],
      handler: (parsed) => ({
        success: true,
        commandId: 'upload',
        message: `Upload${parsed.args.length > 0 ? ': ' + parsed.args.join(' ') : ''}`,
        data: { options: parsed.args.join(' '), flags: parsed.flags },
      }),
    },
    {
      id: 'help',
      label: 'Help',
      category: 'help',
      description: 'Show available commands or help for a specific command',
      patterns: [
        /^help$/i,
        /^help\s+(.+)/i,
        /^\?$/,
        /^commands$/i,
      ],
      examples: ['help', 'help place', '?'],
      handler: (parsed) => {
        const topic = parsed.args.join(' ');
        return {
          success: true,
          commandId: 'help',
          message: topic ? `Help for: ${topic}` : 'Available commands listed',
          data: { topic: topic || undefined },
        };
      },
    },
    {
      id: 'rename',
      label: 'Rename',
      category: 'editing',
      description: 'Rename a component or net',
      patterns: [
        /^rename\s+(\S+)\s+(?:to\s+)?(\S+)/i,
        /^mv\s+(\S+)\s+(\S+)/i,
      ],
      examples: ['rename R1 to R_pullup', 'rename net1 VCC'],
      handler: (parsed) => {
        const match = parsed.raw.match(/^(?:rename|mv)\s+(\S+)\s+(?:to\s+)?(\S+)$/i);
        if (match) {
          return {
            success: true,
            commandId: 'rename',
            message: `Rename: ${match[1]} → ${match[2]}`,
            data: { from: match[1], to: match[2] },
          };
        }
        return { success: false, commandId: 'rename', message: 'Syntax: rename <old> to <new>' };
      },
    },
    {
      id: 'copy',
      label: 'Copy',
      category: 'editing',
      description: 'Copy selected items to clipboard',
      patterns: [/^copy$/i, /^cp$/i],
      examples: ['copy'],
      handler: () => ({ success: true, commandId: 'copy', message: 'Copied to clipboard' }),
    },
    {
      id: 'paste',
      label: 'Paste',
      category: 'editing',
      description: 'Paste items from clipboard',
      patterns: [/^paste$/i, /^p$/i],
      examples: ['paste'],
      handler: () => ({ success: true, commandId: 'paste', message: 'Pasted from clipboard' }),
    },
    {
      id: 'rotate',
      label: 'Rotate',
      category: 'editing',
      description: 'Rotate selected components by a given angle',
      patterns: [
        /^rotate\s+(\d+)/i,
        /^rot\s+(\d+)/i,
        /^rotate$/i,
      ],
      examples: ['rotate 90', 'rotate 45', 'rotate'],
      handler: (parsed) => {
        const angle = parsed.args[0] ? parseInt(parsed.args[0], 10) : 90;
        return {
          success: true,
          commandId: 'rotate',
          message: `Rotate: ${String(angle)}°`,
          data: { angle },
        };
      },
    },
    {
      id: 'mirror',
      label: 'Mirror / Flip',
      category: 'editing',
      description: 'Mirror selected components horizontally or vertically',
      patterns: [
        /^mirror\s+(h|v|horizontal|vertical)/i,
        /^flip\s+(h|v|horizontal|vertical)/i,
        /^mirror$/i,
        /^flip$/i,
      ],
      examples: ['mirror h', 'flip vertical'],
      handler: (parsed) => {
        const axis = parsed.args[0]?.startsWith('v') ? 'vertical' : 'horizontal';
        return {
          success: true,
          commandId: 'mirror',
          message: `Mirror: ${axis}`,
          data: { axis },
        };
      },
    },
    {
      id: 'measure',
      label: 'Measure',
      category: 'view',
      description: 'Measure distance between two points or components',
      patterns: [
        /^measure\s+(.+?)\s+to\s+(.+)/i,
        /^distance\s+(.+?)\s+to\s+(.+)/i,
        /^measure$/i,
      ],
      examples: ['measure R1 to C1', 'measure'],
      handler: (parsed) => {
        const match = parsed.raw.match(/^(?:measure|distance)\s+(.+?)\s+to\s+(.+)$/i);
        if (match) {
          return {
            success: true,
            commandId: 'measure',
            message: `Measure: ${match[1].trim()} ↔ ${match[2].trim()}`,
            data: { from: match[1].trim(), to: match[2].trim() },
          };
        }
        return { success: true, commandId: 'measure', message: 'Measurement tool activated' };
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// KeyboardEngine
// ---------------------------------------------------------------------------

export class KeyboardEngine {
  private static instance: KeyboardEngine | null = null;
  private commands: Map<string, CommandDefinition> = new Map();
  private history: CommandHistoryEntry[] = [];
  private listeners: Set<Listener> = new Set();

  private constructor() {
    this.loadHistory();
    const builtins = createBuiltinCommands();
    for (const cmd of builtins) {
      this.commands.set(cmd.id, cmd);
    }
  }

  static getInstance(): KeyboardEngine {
    if (!KeyboardEngine.instance) {
      KeyboardEngine.instance = new KeyboardEngine();
    }
    return KeyboardEngine.instance;
  }

  static resetForTesting(): void {
    KeyboardEngine.instance = null;
  }

  // ── Subscribe ──

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      fn();
    });
  }

  // ── Persistence ──

  private loadHistory(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.history = JSON.parse(raw) as CommandHistoryEntry[];
      }
    } catch {
      this.history = [];
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch {
      // localStorage quota exceeded — silently ignore
    }
  }

  // ── Command registration ──

  /**
   * Register a custom command definition.
   * Overwrites any existing command with the same ID.
   */
  registerCommand(command: CommandDefinition): void {
    this.commands.set(command.id, command);
    this.notify();
  }

  /**
   * Unregister a command by ID.
   * Returns true if a command was removed, false if not found.
   */
  unregisterCommand(id: string): boolean {
    const existed = this.commands.delete(id);
    if (existed) {
      this.notify();
    }
    return existed;
  }

  /**
   * Get a command definition by ID.
   */
  getCommand(id: string): CommandDefinition | undefined {
    return this.commands.get(id);
  }

  /**
   * Get all registered command definitions.
   */
  getAllCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  // ── Parsing ──

  /**
   * Parse raw input text into a ParsedCommand by matching against registered
   * command patterns. Returns null if no command matches.
   */
  parse(input: string): ParsedCommand | null {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return null;
    }

    for (const [id, cmd] of Array.from(this.commands.entries())) {
      for (const pattern of cmd.patterns) {
        const match = trimmed.match(pattern);
        if (match) {
          // Extract the part after the command keyword for arg parsing
          const captured = match.slice(1).filter(Boolean);
          const remainder = captured.join(' ');
          const { args, flags } = parseArguments(remainder);
          return { commandId: id, raw: trimmed, args, flags };
        }
      }
    }

    return null;
  }

  // ── Execution ──

  /**
   * Parse and execute a raw input string.
   * Returns the command result, or an error result if no command matches.
   */
  execute(input: string): CommandResult {
    const parsed = this.parse(input);
    if (!parsed) {
      const result: CommandResult = {
        success: false,
        commandId: 'unknown',
        message: `Unknown command: "${input.trim()}". Type "help" for available commands.`,
      };
      this.addHistoryEntry(input.trim(), 'unknown', false);
      return result;
    }

    const cmd = this.commands.get(parsed.commandId);
    if (!cmd) {
      const result: CommandResult = {
        success: false,
        commandId: parsed.commandId,
        message: `Command "${parsed.commandId}" not found.`,
      };
      this.addHistoryEntry(input.trim(), parsed.commandId, false);
      return result;
    }

    try {
      const result = cmd.handler(parsed);
      this.addHistoryEntry(input.trim(), parsed.commandId, result.success);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Command execution failed';
      const result: CommandResult = {
        success: false,
        commandId: parsed.commandId,
        message,
      };
      this.addHistoryEntry(input.trim(), parsed.commandId, false);
      return result;
    }
  }

  // ── Autocomplete ──

  /**
   * Return autocomplete suggestions for partial input, sorted by relevance.
   */
  autocomplete(input: string, maxResults = 10): AutocompleteResult[] {
    const trimmed = input.trim().toLowerCase();
    if (trimmed.length === 0) {
      // Return all commands sorted alphabetically
      return Array.from(this.commands.values())
        .sort((a, b) => a.label.localeCompare(b.label))
        .slice(0, maxResults)
        .map((cmd) => ({
          commandId: cmd.id,
          label: cmd.label,
          description: cmd.description,
          examples: cmd.examples,
          score: 50,
        }));
    }

    const results: AutocompleteResult[] = [];

    Array.from(this.commands.values()).forEach((cmd) => {
      // Score against id, label, description, and category
      const idScore = fuzzyScore(trimmed, cmd.id);
      const labelScore = fuzzyScore(trimmed, cmd.label);
      const descScore = fuzzyScore(trimmed, cmd.description) * 0.5;
      const catScore = fuzzyScore(trimmed, cmd.category) * 0.3;

      // Also check examples
      let exampleScore = 0;
      for (const ex of cmd.examples) {
        const s = fuzzyScore(trimmed, ex) * 0.4;
        if (s > exampleScore) {
          exampleScore = s;
        }
      }

      const best = Math.max(idScore, labelScore, descScore, catScore, exampleScore);

      if (best > 0) {
        results.push({
          commandId: cmd.id,
          label: cmd.label,
          description: cmd.description,
          examples: cmd.examples,
          score: best,
        });
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxResults);
  }

  // ── History ──

  private addHistoryEntry(raw: string, commandId: string, success: boolean): void {
    const entry: CommandHistoryEntry = {
      raw,
      commandId,
      success,
      timestamp: Date.now(),
    };
    this.history.push(entry);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }
    this.saveHistory();
    this.notify();
  }

  /**
   * Get command execution history, newest first.
   */
  getHistory(limit?: number): CommandHistoryEntry[] {
    const sorted = [...this.history].reverse();
    return limit !== undefined ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Clear all history.
   */
  clearHistory(): void {
    this.history = [];
    this.saveHistory();
    this.notify();
  }

  /**
   * Get the most recently executed command input.
   */
  getLastCommand(): string | null {
    if (this.history.length === 0) {
      return null;
    }
    return this.history[this.history.length - 1].raw;
  }

  /**
   * Get unique commands from history for quick re-execution, most recent first.
   */
  getRecentUniqueCommands(limit = 10): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (let i = this.history.length - 1; i >= 0 && result.length < limit; i--) {
      const raw = this.history[i].raw;
      if (!seen.has(raw)) {
        seen.add(raw);
        result.push(raw);
      }
    }

    return result;
  }

  // ── Help generation ──

  /**
   * Generate a help text summary of all registered commands.
   */
  generateHelp(commandId?: string): string {
    if (commandId) {
      const cmd = this.commands.get(commandId);
      if (!cmd) {
        return `Unknown command: "${commandId}"`;
      }
      const lines = [
        `## ${cmd.label} (${cmd.id})`,
        `Category: ${cmd.category}`,
        cmd.description,
        '',
        'Examples:',
        ...cmd.examples.map((ex) => `  ${ex}`),
      ];
      return lines.join('\n');
    }

    // Group by category
    const byCategory = new Map<CommandCategory, CommandDefinition[]>();
    Array.from(this.commands.values()).forEach((cmd) => {
      const existing = byCategory.get(cmd.category) ?? [];
      existing.push(cmd);
      byCategory.set(cmd.category, existing);
    });

    const lines: string[] = ['# Available Commands', ''];

    Array.from(byCategory.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([category, cmds]) => {
        lines.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)}`);
        for (const cmd of cmds.sort((a, b) => a.id.localeCompare(b.id))) {
          lines.push(`  ${cmd.id.padEnd(12)} ${cmd.description}`);
        }
        lines.push('');
      });

    return lines.join('\n');
  }

  /**
   * Get a snapshot for useSyncExternalStore.
   */
  getSnapshot(): { history: CommandHistoryEntry[]; commandCount: number } {
    return {
      history: [...this.history],
      commandCount: this.commands.size,
    };
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useKeyboardEngine(): {
  execute: (input: string) => CommandResult;
  parse: (input: string) => ParsedCommand | null;
  autocomplete: (input: string, maxResults?: number) => AutocompleteResult[];
  history: CommandHistoryEntry[];
  commandCount: number;
  clearHistory: () => void;
  getLastCommand: () => string | null;
  getRecentUniqueCommands: (limit?: number) => string[];
  registerCommand: (command: CommandDefinition) => void;
  unregisterCommand: (id: string) => boolean;
  getAllCommands: () => CommandDefinition[];
  generateHelp: (commandId?: string) => string;
} {
  const engine = KeyboardEngine.getInstance();
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());

  useEffect(() => {
    return engine.subscribe(() => {
      setSnapshot(engine.getSnapshot());
    });
  }, [engine]);

  const execute = useCallback((input: string) => engine.execute(input), [engine]);
  const parse = useCallback((input: string) => engine.parse(input), [engine]);
  const autocomplete = useCallback(
    (input: string, maxResults?: number) => engine.autocomplete(input, maxResults),
    [engine],
  );
  const clearHistory = useCallback(() => {
    engine.clearHistory();
  }, [engine]);
  const getLastCommand = useCallback(() => engine.getLastCommand(), [engine]);
  const getRecentUniqueCommands = useCallback((limit?: number) => engine.getRecentUniqueCommands(limit), [engine]);
  const registerCommand = useCallback((command: CommandDefinition) => {
    engine.registerCommand(command);
  }, [engine]);
  const unregisterCommand = useCallback((id: string) => engine.unregisterCommand(id), [engine]);
  const getAllCommands = useCallback(() => engine.getAllCommands(), [engine]);
  const generateHelp = useCallback((commandId?: string) => engine.generateHelp(commandId), [engine]);

  return {
    execute,
    parse,
    autocomplete,
    history: snapshot.history,
    commandCount: snapshot.commandCount,
    clearHistory,
    getLastCommand,
    getRecentUniqueCommands,
    registerCommand,
    unregisterCommand,
    getAllCommands,
    generateHelp,
  };
}
