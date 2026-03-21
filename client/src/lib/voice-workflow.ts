/**
 * VoiceWorkflowManager — Voice command recognition and execution for hands-free bench operation.
 *
 * Singleton + subscribe pattern. Fuzzy-matches spoken transcripts against a registry of voice
 * commands, extracts parameters from template patterns, and maintains command history.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoiceCommand {
  id: string;
  phrases: string[];
  action: string;
  parameters?: Record<string, string>;
  category: string;
  description: string;
  requiresConfirmation: boolean;
}

export interface VoiceRecognitionResult {
  transcript: string;
  confidence: number;
  matchedCommand?: VoiceCommand;
  parameters?: Record<string, string>;
  timestamp: number;
}

export interface VoiceWorkflowState {
  listening: boolean;
  lastResult?: VoiceRecognitionResult;
  commandHistory: VoiceRecognitionResult[];
  errorCount: number;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateCommandId(): string {
  idCounter += 1;
  const rand = Math.random().toString(36).substring(2, 8);
  return `vcmd-${idCounter}-${rand}`;
}

// ---------------------------------------------------------------------------
// Fuzzy matching utilities
// ---------------------------------------------------------------------------

/**
 * Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) {
    return n;
  }
  if (n === 0) {
    return m;
  }

  // Use two rows instead of full matrix for space efficiency
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Fuzzy match score between 0 and 1 (1 = perfect match).
 */
export function fuzzyMatchScore(input: string, target: string): number {
  const a = input.toLowerCase().trim();
  const b = target.toLowerCase().trim();

  if (a === b) {
    return 1;
  }
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  // Exact substring match gets high score
  if (b.includes(a) || a.includes(b)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return 0.8 + 0.2 * (shorter / longer);
  }

  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Extract parameters from a transcript given a template with {paramName} placeholders.
 *
 * Example: extractParameters("set baud rate to 115200", "set baud rate to {baudRate}")
 *   → { baudRate: "115200" }
 */
export function extractParameters(transcript: string, template: string): Record<string, string> | null {
  const paramRegex = /\{(\w+)\}/g;
  const paramNames: string[] = [];
  let match: RegExpExecArray | null;

  // Collect param names
  while ((match = paramRegex.exec(template)) !== null) {
    paramNames.push(match[1]);
  }

  if (paramNames.length === 0) {
    return null;
  }

  // Build a regex from the template by replacing {param} with capture groups
  let regexStr = template.toLowerCase().trim();
  // Escape regex special characters in non-param parts
  regexStr = regexStr.replace(/[.*+?^${}()|[\]\\]/g, (ch) => {
    // Don't escape our own braces that are part of params — they're already replaced
    return ch === '{' || ch === '}' ? ch : `\\${ch}`;
  });
  // Replace {paramName} with capture groups
  for (const name of paramNames) {
    regexStr = regexStr.replace(`{${name}}`, '(.+?)');
  }
  regexStr = `^${regexStr}$`;

  const regex = new RegExp(regexStr, 'i');
  const result = regex.exec(transcript.trim());

  if (!result) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < paramNames.length; i++) {
    params[paramNames[i]] = result[i + 1].trim();
  }

  return params;
}

// ---------------------------------------------------------------------------
// Built-in voice commands
// ---------------------------------------------------------------------------

export const BUILT_IN_VOICE_COMMANDS: Omit<VoiceCommand, 'id'>[] = [
  // Navigation
  { phrases: ['go to schematic', 'show schematic', 'open schematic'], action: 'navigate', parameters: { view: 'schematic' }, category: 'navigation', description: 'Switch to schematic view', requiresConfirmation: false },
  { phrases: ['show PCB', 'go to PCB', 'open PCB layout'], action: 'navigate', parameters: { view: 'pcb' }, category: 'navigation', description: 'Switch to PCB layout view', requiresConfirmation: false },
  { phrases: ['open settings', 'show settings', 'go to settings'], action: 'navigate', parameters: { view: 'settings' }, category: 'navigation', description: 'Open settings panel', requiresConfirmation: false },
  { phrases: ['switch to architecture', 'show architecture', 'go to architecture'], action: 'navigate', parameters: { view: 'architecture' }, category: 'navigation', description: 'Switch to architecture view', requiresConfirmation: false },

  // Actions
  { phrases: ['compile code', 'build firmware', 'compile firmware'], action: 'compile', parameters: {}, category: 'actions', description: 'Compile the current firmware', requiresConfirmation: true },
  { phrases: ['upload firmware', 'flash firmware', 'program board'], action: 'upload', parameters: {}, category: 'actions', description: 'Upload firmware to connected board', requiresConfirmation: true },
  { phrases: ['run validation', 'validate design', 'check design'], action: 'validate', parameters: {}, category: 'actions', description: 'Run design validation checks', requiresConfirmation: false },
  { phrases: ['export gerbers', 'generate gerbers', 'export PCB files'], action: 'export', parameters: { format: 'gerber' }, category: 'actions', description: 'Export Gerber fabrication files', requiresConfirmation: true },

  // Controls
  { phrases: ['zoom in', 'zoom closer', 'magnify'], action: 'zoom', parameters: { direction: 'in' }, category: 'controls', description: 'Zoom into the canvas', requiresConfirmation: false },
  { phrases: ['zoom out', 'zoom further', 'zoom away'], action: 'zoom', parameters: { direction: 'out' }, category: 'controls', description: 'Zoom out of the canvas', requiresConfirmation: false },
  { phrases: ['fit view', 'fit to screen', 'show all', 'fit all'], action: 'fitView', parameters: {}, category: 'controls', description: 'Fit the view to show all content', requiresConfirmation: false },
  { phrases: ['undo', 'undo that', 'go back'], action: 'undo', parameters: {}, category: 'controls', description: 'Undo the last action', requiresConfirmation: false },
  { phrases: ['redo', 'redo that', 'go forward'], action: 'redo', parameters: {}, category: 'controls', description: 'Redo the last undone action', requiresConfirmation: false },

  // Queries
  { phrases: ["what's the status", 'show status', 'project status'], action: 'queryStatus', parameters: {}, category: 'queries', description: 'Show current project status', requiresConfirmation: false },
  { phrases: ['show errors', 'list errors', 'what are the errors'], action: 'queryErrors', parameters: {}, category: 'queries', description: 'Display current errors and warnings', requiresConfirmation: false },
  { phrases: ['read temperature', 'what is the temperature', 'check temperature'], action: 'queryTemperature', parameters: {}, category: 'queries', description: 'Read temperature from connected sensor', requiresConfirmation: false },

  // Bench
  { phrases: ['start recording', 'begin recording', 'record data'], action: 'startRecording', parameters: {}, category: 'bench', description: 'Start recording serial data', requiresConfirmation: false },
  { phrases: ['stop recording', 'end recording', 'stop data'], action: 'stopRecording', parameters: {}, category: 'bench', description: 'Stop recording serial data', requiresConfirmation: false },
  { phrases: ['connect serial', 'open serial', 'connect port'], action: 'connectSerial', parameters: {}, category: 'bench', description: 'Connect to serial port', requiresConfirmation: false },
  { phrases: ['set baud rate to {baudRate}', 'baud rate {baudRate}', 'change baud to {baudRate}'], action: 'setBaudRate', parameters: {}, category: 'bench', description: 'Set serial baud rate', requiresConfirmation: false },
];

// ---------------------------------------------------------------------------
// VoiceWorkflowManager
// ---------------------------------------------------------------------------

const MATCH_THRESHOLD = 0.55;
const MAX_HISTORY = 500;

export class VoiceWorkflowManager {
  // -- Singleton --
  private static instance: VoiceWorkflowManager | null = null;

  static getInstance(): VoiceWorkflowManager {
    if (!VoiceWorkflowManager.instance) {
      VoiceWorkflowManager.instance = new VoiceWorkflowManager();
    }
    return VoiceWorkflowManager.instance;
  }

  static resetInstance(): void {
    VoiceWorkflowManager.instance = null;
  }

  // -- State --
  private commands: Map<string, VoiceCommand> = new Map();
  private history: VoiceRecognitionResult[] = [];
  private listening = false;
  private errorCount = 0;
  private listeners: Set<Listener> = new Set();

  private constructor() {
    // Register built-in commands
    for (const cmd of BUILT_IN_VOICE_COMMANDS) {
      this.registerCommand(cmd);
    }
  }

  // -- Subscribe --
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  // -- Command registration --

  registerCommand(cmd: Omit<VoiceCommand, 'id'>): VoiceCommand {
    const id = generateCommandId();
    const command: VoiceCommand = { ...cmd, id };
    this.commands.set(id, command);
    this.notify();
    return command;
  }

  unregisterCommand(cmdId: string): void {
    if (this.commands.delete(cmdId)) {
      this.notify();
    }
  }

  getCommands(): VoiceCommand[] {
    return Array.from(this.commands.values());
  }

  getCommandsByCategory(category: string): VoiceCommand[] {
    return Array.from(this.commands.values()).filter((c) => c.category === category);
  }

  // -- Matching --

  matchCommand(transcript: string): VoiceRecognitionResult {
    const normalized = transcript.toLowerCase().trim();
    let bestScore = 0;
    let bestCommand: VoiceCommand | undefined;
    let bestParams: Record<string, string> | undefined;

    this.commands.forEach((cmd) => {
      for (const phrase of cmd.phrases) {
        // Check for parameterized phrase first
        const hasParams = /\{(\w+)\}/.test(phrase);

        if (hasParams) {
          const params = extractParameters(normalized, phrase);
          if (params) {
            // Parameter extraction succeeded — give a high score
            const phraseWithoutParams = phrase.replace(/\{(\w+)\}/g, '').trim();
            const transcriptWithoutParams = Object.values(params).reduce(
              (t, v) => t.replace(v.toLowerCase(), '').trim(),
              normalized,
            );
            const baseScore = fuzzyMatchScore(transcriptWithoutParams, phraseWithoutParams);
            const score = Math.max(0.85, baseScore);

            if (score > bestScore) {
              bestScore = score;
              bestCommand = cmd;
              bestParams = { ...cmd.parameters, ...params };
            }
          }
        } else {
          const score = fuzzyMatchScore(normalized, phrase);
          if (score > bestScore) {
            bestScore = score;
            bestCommand = cmd;
            bestParams = cmd.parameters ? { ...cmd.parameters } : undefined;
          }
        }
      }
    });

    const result: VoiceRecognitionResult = {
      transcript,
      confidence: bestScore,
      matchedCommand: bestScore >= MATCH_THRESHOLD ? bestCommand : undefined,
      parameters: bestScore >= MATCH_THRESHOLD ? bestParams : undefined,
      timestamp: Date.now(),
    };

    return result;
  }

  processTranscript(transcript: string): VoiceRecognitionResult {
    const result = this.matchCommand(transcript);

    // Add to history
    if (this.history.length >= MAX_HISTORY) {
      this.history.shift();
    }
    this.history.push(result);

    if (!result.matchedCommand) {
      this.errorCount += 1;
    }

    this.notify();
    return result;
  }

  // -- History --

  getHistory(limit?: number): VoiceRecognitionResult[] {
    if (limit && limit > 0) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
    this.errorCount = 0;
    this.notify();
  }

  // -- State --

  getState(): VoiceWorkflowState {
    return {
      listening: this.listening,
      lastResult: this.history.length > 0 ? this.history[this.history.length - 1] : undefined,
      commandHistory: [...this.history],
      errorCount: this.errorCount,
    };
  }

  setListening(listening: boolean): void {
    this.listening = listening;
    this.notify();
  }

  isListening(): boolean {
    return this.listening;
  }
}
