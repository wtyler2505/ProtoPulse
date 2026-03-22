/**
 * Voice-Driven Bench Sessions
 *
 * Full hands-free execution — voice commands control the entire bench workflow.
 * "ProtoPulse, compile code, flash OTA, and if temp spikes >60C, kill power."
 *
 * Usage:
 *   const manager = VoiceBenchManager.getInstance();
 *   manager.startSession();
 *   const result = manager.processCommand('compile code');
 *   manager.addSafetyOverride({ condition: 'temperature', operator: '>', threshold: 60, unit: 'C', action: 'kill_power' });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoiceCommandCategory =
  | 'compile'
  | 'upload'
  | 'monitor'
  | 'control'
  | 'safety'
  | 'query'
  | 'navigation';

export interface VoiceBenchCommand {
  readonly id: string;
  readonly phrases: readonly string[];
  readonly action: string;
  readonly category: VoiceCommandCategory;
  readonly description: string;
  readonly requiresConfirmation: boolean;
  readonly dangerous: boolean;
}

export interface VoiceCommandResult {
  readonly matched: boolean;
  readonly command?: VoiceBenchCommand;
  readonly result: string;
  readonly requiresConfirmation: boolean;
  readonly parameters: Record<string, string>;
}

export type SafetyAction = 'kill_power' | 'stop_upload' | 'disconnect' | 'alert' | 'pause';

export type SafetyOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

export interface SafetyOverride {
  readonly id: string;
  readonly condition: string;
  readonly operator: SafetyOperator;
  readonly threshold: number;
  readonly unit: string;
  readonly action: SafetyAction;
  readonly active: boolean;
  readonly createdAt: number;
  readonly triggeredCount: number;
  readonly lastTriggeredAt?: number;
}

export interface SafetyCheckResult {
  readonly override: SafetyOverride;
  readonly triggered: boolean;
  readonly currentValue: number;
  readonly message: string;
}

export interface VoiceMacro {
  readonly id: string;
  readonly name: string;
  readonly trigger: string;
  readonly steps: ReadonlyArray<{ readonly command: string; readonly delayMs: number }>;
  readonly description: string;
  readonly createdAt: number;
}

export interface VoiceBenchSession {
  readonly id: string;
  readonly active: boolean;
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly commandsExecuted: number;
  readonly lastCommand?: string;
  readonly lastResult?: string;
  readonly safetyTriggered: number;
}

export interface VoiceBenchSnapshot {
  readonly sessionActive: boolean;
  readonly commandsExecuted: number;
  readonly safetyOverrideCount: number;
  readonly macroCount: number;
  readonly pendingConfirmation: boolean;
}

// ---------------------------------------------------------------------------
// Built-in Commands
// ---------------------------------------------------------------------------

export const BUILT_IN_COMMANDS: VoiceBenchCommand[] = [
  // Compile
  { id: 'compile', phrases: ['compile code', 'verify sketch', 'build', 'compile'], action: 'compile', category: 'compile', description: 'Compile the current sketch', requiresConfirmation: false, dangerous: false },
  { id: 'compile_verbose', phrases: ['compile verbose', 'compile with details', 'verbose build'], action: 'compile_verbose', category: 'compile', description: 'Compile with verbose output', requiresConfirmation: false, dangerous: false },

  // Upload
  { id: 'upload', phrases: ['upload firmware', 'flash', 'upload', 'program board'], action: 'upload', category: 'upload', description: 'Upload firmware to connected board', requiresConfirmation: true, dangerous: false },
  { id: 'upload_ota', phrases: ['flash ota', 'upload ota', 'ota update', 'wireless upload'], action: 'upload_ota', category: 'upload', description: 'Upload firmware over-the-air', requiresConfirmation: true, dangerous: false },

  // Monitor
  { id: 'connect_serial', phrases: ['connect serial', 'open monitor', 'open serial', 'start serial'], action: 'connect_serial', category: 'monitor', description: 'Open serial monitor connection', requiresConfirmation: false, dangerous: false },
  { id: 'disconnect_serial', phrases: ['disconnect serial', 'close monitor', 'close serial', 'stop serial'], action: 'disconnect_serial', category: 'monitor', description: 'Close serial monitor connection', requiresConfirmation: false, dangerous: false },
  { id: 'set_baud', phrases: ['set baud rate to', 'baud rate', 'set baud'], action: 'set_baud', category: 'monitor', description: 'Set serial baud rate', requiresConfirmation: false, dangerous: false },
  { id: 'start_recording', phrases: ['start recording', 'record serial', 'begin recording'], action: 'start_recording', category: 'monitor', description: 'Start recording serial output', requiresConfirmation: false, dangerous: false },
  { id: 'stop_recording', phrases: ['stop recording', 'end recording', 'finish recording'], action: 'stop_recording', category: 'monitor', description: 'Stop recording serial output', requiresConfirmation: false, dangerous: false },

  // Control
  { id: 'kill_power', phrases: ['kill power', 'emergency stop', 'e stop', 'cut power', 'power off'], action: 'kill_power', category: 'control', description: 'Emergency power cutoff', requiresConfirmation: false, dangerous: true },
  { id: 'reset_board', phrases: ['reset board', 'reboot', 'restart board', 'hard reset'], action: 'reset_board', category: 'control', description: 'Reset the connected board', requiresConfirmation: true, dangerous: false },
  { id: 'undo', phrases: ['undo', 'undo that', 'go back'], action: 'undo', category: 'control', description: 'Undo last action', requiresConfirmation: false, dangerous: false },
  { id: 'redo', phrases: ['redo', 'redo that'], action: 'redo', category: 'control', description: 'Redo last undone action', requiresConfirmation: false, dangerous: false },
  { id: 'save', phrases: ['save', 'save project', 'save all'], action: 'save', category: 'control', description: 'Save the current project', requiresConfirmation: false, dangerous: false },

  // Safety
  { id: 'add_safety', phrases: ['if', 'when', 'safety override', 'add safety rule'], action: 'add_safety', category: 'safety', description: 'Create a safety override condition', requiresConfirmation: false, dangerous: false },
  { id: 'clear_safety', phrases: ['clear safety', 'remove all safety', 'disable safety'], action: 'clear_safety', category: 'safety', description: 'Remove all safety overrides', requiresConfirmation: true, dangerous: true },

  // Query
  { id: 'status', phrases: ['status', 'status report', 'what is the status', 'how is it going'], action: 'status_report', category: 'query', description: 'Get current system status', requiresConfirmation: false, dangerous: false },
  { id: 'read_sensor', phrases: ['read', 'what is the', 'show me', 'get value of'], action: 'read_sensor', category: 'query', description: 'Read a sensor or variable value', requiresConfirmation: false, dangerous: false },
  { id: 'show_errors', phrases: ['show errors', 'list errors', 'any errors', 'what went wrong'], action: 'show_errors', category: 'query', description: 'Show recent errors', requiresConfirmation: false, dangerous: false },

  // Navigation
  { id: 'switch_view', phrases: ['switch to', 'go to', 'show', 'open'], action: 'switch_view', category: 'navigation', description: 'Switch to a different view', requiresConfirmation: false, dangerous: false },
  { id: 'zoom_component', phrases: ['zoom to', 'focus on', 'find', 'locate'], action: 'zoom_to', category: 'navigation', description: 'Navigate to a specific component', requiresConfirmation: false, dangerous: false },
  { id: 'export', phrases: ['export', 'export as', 'download'], action: 'export', category: 'navigation', description: 'Export in specified format', requiresConfirmation: false, dangerous: false },
  { id: 'run_macro', phrases: ['run macro', 'execute macro', 'macro'], action: 'run_macro', category: 'control', description: 'Execute a saved macro', requiresConfirmation: false, dangerous: false },
];

// ---------------------------------------------------------------------------
// Safety condition parsing
// ---------------------------------------------------------------------------

const CONDITION_ALIASES: Record<string, string> = {
  temp: 'temperature',
  temperature: 'temperature',
  volt: 'voltage',
  voltage: 'voltage',
  current: 'current',
  amp: 'current',
  amps: 'current',
  power: 'power',
  humidity: 'humidity',
  pressure: 'pressure',
  speed: 'speed',
  rpm: 'rpm',
};

const ACTION_ALIASES: Record<string, SafetyAction> = {
  'kill power': 'kill_power',
  'cut power': 'kill_power',
  'power off': 'kill_power',
  'emergency stop': 'kill_power',
  'stop upload': 'stop_upload',
  'cancel upload': 'stop_upload',
  disconnect: 'disconnect',
  alert: 'alert',
  warn: 'alert',
  pause: 'pause',
  stop: 'kill_power',
};

const OPERATOR_MAP: Record<string, SafetyOperator> = {
  'above': '>',
  'over': '>',
  'exceeds': '>',
  'greater than': '>',
  'more than': '>',
  'spikes above': '>',
  'spikes over': '>',
  'goes above': '>',
  'reaches': '>=',
  'below': '<',
  'under': '<',
  'less than': '<',
  'drops below': '<',
  'falls below': '<',
  'goes below': '<',
  'equals': '==',
  'is': '==',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  '==': '==',
  '!=': '!=',
};

export function parseSafetyCondition(transcript: string): Omit<SafetyOverride, 'id' | 'active' | 'createdAt' | 'triggeredCount' | 'lastTriggeredAt'> | null {
  const lower = transcript.toLowerCase().trim();

  // Pattern: "if {condition} {operator} {threshold}{unit}, {action}"
  // e.g., "if temp spikes above 60C, kill power"
  // e.g., "if voltage drops below 3.3V, alert"
  // e.g., "when current exceeds 2A, disconnect"

  // Extract action (after comma or "then")
  let actionPart = '';
  let conditionPart = lower;
  const commaIdx = lower.lastIndexOf(',');
  const thenIdx = lower.lastIndexOf(' then ');

  if (commaIdx > 0) {
    actionPart = lower.slice(commaIdx + 1).trim();
    conditionPart = lower.slice(0, commaIdx).trim();
  } else if (thenIdx > 0) {
    actionPart = lower.slice(thenIdx + 6).trim();
    conditionPart = lower.slice(0, thenIdx).trim();
  }

  if (!actionPart) { return null; }

  // Resolve action
  let action: SafetyAction | undefined;
  for (const [alias, act] of Object.entries(ACTION_ALIASES)) {
    if (actionPart.includes(alias)) {
      action = act;
      break;
    }
  }
  if (!action) { return null; }

  // Strip leading "if" / "when"
  conditionPart = conditionPart.replace(/^(if|when)\s+/i, '');

  // Find condition variable
  let condition = '';
  for (const [alias, resolved] of Object.entries(CONDITION_ALIASES)) {
    if (conditionPart.includes(alias)) {
      condition = resolved;
      break;
    }
  }
  if (!condition) {
    // Try to use the first word as the condition
    const words = conditionPart.split(/\s+/);
    if (words.length > 0) {
      condition = words[0];
    }
  }
  if (!condition) { return null; }

  // Find operator
  let operator: SafetyOperator = '>';
  for (const [alias, op] of Object.entries(OPERATOR_MAP)) {
    if (conditionPart.includes(alias)) {
      operator = op;
      break;
    }
  }

  // Extract threshold number and unit
  const numMatch = conditionPart.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z°%]*)/);
  if (!numMatch) { return null; }

  const threshold = parseFloat(numMatch[1]);
  const unit = numMatch[2] || '';

  return { condition, operator, threshold, unit, action };
}

// ---------------------------------------------------------------------------
// Fuzzy matching
// ---------------------------------------------------------------------------

function fuzzyScore(input: string, target: string): number {
  const a = input.toLowerCase();
  const b = target.toLowerCase();
  if (a === b) { return 1.0; }
  if (b.startsWith(a)) { return 0.9; }
  if (b.includes(a)) { return 0.7; }

  // Simple word overlap
  const inputWords = a.split(/\s+/);
  const targetWords = b.split(/\s+/);
  let matches = 0;
  for (const word of inputWords) {
    if (targetWords.some(tw => tw.includes(word) || word.includes(tw))) {
      matches++;
    }
  }
  return inputWords.length > 0 ? (matches / inputWords.length) * 0.6 : 0;
}

function extractParameters(transcript: string, command: VoiceBenchCommand): Record<string, string> {
  const lower = transcript.toLowerCase();
  const params: Record<string, string> = {};

  // Extract baud rate
  if (command.action === 'set_baud') {
    const baudMatch = lower.match(/(\d+)/);
    if (baudMatch) { params.baudRate = baudMatch[1]; }
  }

  // Extract view name
  if (command.action === 'switch_view') {
    const viewMatch = lower.match(/(?:switch to|go to|show|open)\s+(.+)/i);
    if (viewMatch) { params.view = viewMatch[1].trim(); }
  }

  // Extract component name for zoom
  if (command.action === 'zoom_to') {
    const compMatch = lower.match(/(?:zoom to|focus on|find|locate)\s+(.+)/i);
    if (compMatch) { params.component = compMatch[1].trim(); }
  }

  // Extract sensor name for read
  if (command.action === 'read_sensor') {
    const sensorMatch = lower.match(/(?:read|what is the|show me|get value of)\s+(.+)/i);
    if (sensorMatch) { params.sensor = sensorMatch[1].trim(); }
  }

  // Extract export format
  if (command.action === 'export') {
    const formatMatch = lower.match(/(?:export|export as|download)\s+(.+)/i);
    if (formatMatch) { params.format = formatMatch[1].trim(); }
  }

  // Extract macro name
  if (command.action === 'run_macro') {
    const macroMatch = lower.match(/(?:run macro|execute macro|macro)\s+(.+)/i);
    if (macroMatch) { params.macroName = macroMatch[1].trim(); }
  }

  return params;
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class VoiceBenchManager {
  private static _instance: VoiceBenchManager | null = null;
  private _session: VoiceBenchSession | null = null;
  private _safetyOverrides: SafetyOverride[] = [];
  private _macros: VoiceMacro[] = [];
  private _commands: VoiceBenchCommand[] = [...BUILT_IN_COMMANDS];
  private _commandHistory: Array<{ transcript: string; result: VoiceCommandResult; timestamp: number }> = [];
  private _pendingConfirmation: { command: VoiceBenchCommand; parameters: Record<string, string> } | null = null;
  private _listeners = new Set<() => void>();
  private _nextId = 1;

  private constructor() {}

  static getInstance(): VoiceBenchManager {
    if (!VoiceBenchManager._instance) {
      VoiceBenchManager._instance = new VoiceBenchManager();
    }
    return VoiceBenchManager._instance;
  }

  /** Reset singleton for testing */
  static resetInstance(): void {
    VoiceBenchManager._instance = null;
  }

  // Subscribe / notify
  subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  };

  private notify(): void {
    this._listeners.forEach(l => { l(); });
  }

  getSnapshot(): VoiceBenchSnapshot {
    return {
      sessionActive: this._session?.active ?? false,
      commandsExecuted: this._session?.commandsExecuted ?? 0,
      safetyOverrideCount: this._safetyOverrides.filter(s => s.active).length,
      macroCount: this._macros.length,
      pendingConfirmation: this._pendingConfirmation !== null,
    };
  }

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  startSession(): VoiceBenchSession {
    if (this._session?.active) {
      return this._session;
    }
    this._session = {
      id: `session-${String(this._nextId++)}`,
      active: true,
      startedAt: Date.now(),
      commandsExecuted: 0,
      safetyTriggered: 0,
    };
    this.notify();
    return this._session;
  }

  endSession(): void {
    if (!this._session?.active) { return; }
    this._session = {
      ...this._session,
      active: false,
      endedAt: Date.now(),
    };
    this._pendingConfirmation = null;
    this.notify();
  }

  getSession(): VoiceBenchSession | null {
    return this._session;
  }

  // ---------------------------------------------------------------------------
  // Command processing
  // ---------------------------------------------------------------------------

  processCommand(transcript: string): VoiceCommandResult {
    if (!this._session?.active) {
      return { matched: false, result: 'No active session. Start a session first.', requiresConfirmation: false, parameters: {} };
    }

    const lower = transcript.toLowerCase().trim();

    // Check for safety condition creation
    if (lower.startsWith('if ') || lower.startsWith('when ')) {
      const parsed = parseSafetyCondition(lower);
      if (parsed) {
        const override = this.addSafetyOverride(parsed);
        const result: VoiceCommandResult = {
          matched: true,
          command: BUILT_IN_COMMANDS.find(c => c.id === 'add_safety'),
          result: `Safety override added: ${parsed.condition} ${parsed.operator} ${String(parsed.threshold)}${parsed.unit} → ${parsed.action}`,
          requiresConfirmation: false,
          parameters: { overrideId: override.id },
        };
        this.recordCommand(transcript, result);
        return result;
      }
    }

    // Match against commands
    let bestMatch: VoiceBenchCommand | undefined;
    let bestScore = 0;

    for (const cmd of this._commands) {
      for (const phrase of cmd.phrases) {
        const score = fuzzyScore(lower, phrase);
        if (score > bestScore && score >= 0.5) {
          bestScore = score;
          bestMatch = cmd;
        }
      }
    }

    if (!bestMatch) {
      const result: VoiceCommandResult = {
        matched: false,
        result: `Command not recognized: "${transcript}"`,
        requiresConfirmation: false,
        parameters: {},
      };
      return result;
    }

    const parameters = extractParameters(transcript, bestMatch);

    // Check if confirmation required
    if (bestMatch.requiresConfirmation) {
      this._pendingConfirmation = { command: bestMatch, parameters };
      const result: VoiceCommandResult = {
        matched: true,
        command: bestMatch,
        result: `Confirm: ${bestMatch.description}?`,
        requiresConfirmation: true,
        parameters,
      };
      this.notify();
      return result;
    }

    const result: VoiceCommandResult = {
      matched: true,
      command: bestMatch,
      result: `Executing: ${bestMatch.description}`,
      requiresConfirmation: false,
      parameters,
    };
    this.recordCommand(transcript, result);
    return result;
  }

  confirmAction(confirmed: boolean): string {
    if (!this._pendingConfirmation) {
      return 'No pending action to confirm.';
    }

    const { command, parameters } = this._pendingConfirmation;
    this._pendingConfirmation = null;

    if (confirmed) {
      const result: VoiceCommandResult = {
        matched: true,
        command,
        result: `Confirmed and executing: ${command.description}`,
        requiresConfirmation: false,
        parameters,
      };
      this.recordCommand(`confirmed: ${command.action}`, result);
      this.notify();
      return `Executing: ${command.description}`;
    }

    this.notify();
    return `Cancelled: ${command.description}`;
  }

  private recordCommand(transcript: string, result: VoiceCommandResult): void {
    this._commandHistory.push({ transcript, result, timestamp: Date.now() });
    if (this._commandHistory.length > 500) {
      this._commandHistory = this._commandHistory.slice(-500);
    }
    if (this._session) {
      this._session = {
        ...this._session,
        commandsExecuted: this._session.commandsExecuted + 1,
        lastCommand: transcript,
        lastResult: result.result,
      };
    }
    this.notify();
  }

  getHistory(limit?: number): Array<{ transcript: string; result: VoiceCommandResult; timestamp: number }> {
    const history = [...this._commandHistory];
    if (limit !== undefined && limit > 0) {
      return history.slice(-limit);
    }
    return history;
  }

  clearHistory(): void {
    this._commandHistory = [];
    this.notify();
  }

  // ---------------------------------------------------------------------------
  // Safety overrides
  // ---------------------------------------------------------------------------

  addSafetyOverride(config: Omit<SafetyOverride, 'id' | 'active' | 'createdAt' | 'triggeredCount' | 'lastTriggeredAt'>): SafetyOverride {
    const override: SafetyOverride = {
      id: `safety-${String(this._nextId++)}`,
      condition: config.condition,
      operator: config.operator,
      threshold: config.threshold,
      unit: config.unit,
      action: config.action,
      active: true,
      createdAt: Date.now(),
      triggeredCount: 0,
    };
    this._safetyOverrides.push(override);
    this.notify();
    return override;
  }

  removeSafetyOverride(id: string): void {
    this._safetyOverrides = this._safetyOverrides.filter(s => s.id !== id);
    this.notify();
  }

  getSafetyOverrides(): SafetyOverride[] {
    return [...this._safetyOverrides];
  }

  checkSafetyConditions(telemetry: Record<string, number>): SafetyCheckResult[] {
    const results: SafetyCheckResult[] = [];

    for (const override of this._safetyOverrides) {
      if (!override.active) { continue; }

      const value = telemetry[override.condition];
      if (value === undefined) { continue; }

      let triggered = false;
      switch (override.operator) {
        case '>': triggered = value > override.threshold; break;
        case '<': triggered = value < override.threshold; break;
        case '>=': triggered = value >= override.threshold; break;
        case '<=': triggered = value <= override.threshold; break;
        case '==': triggered = value === override.threshold; break;
        case '!=': triggered = value !== override.threshold; break;
      }

      if (triggered) {
        // Update trigger count
        const idx = this._safetyOverrides.indexOf(override);
        if (idx >= 0) {
          this._safetyOverrides[idx] = {
            ...override,
            triggeredCount: override.triggeredCount + 1,
            lastTriggeredAt: Date.now(),
          };
        }
        if (this._session) {
          this._session = {
            ...this._session,
            safetyTriggered: this._session.safetyTriggered + 1,
          };
        }
      }

      results.push({
        override,
        triggered,
        currentValue: value,
        message: triggered
          ? `SAFETY: ${override.condition} is ${String(value)}${override.unit} (${override.operator} ${String(override.threshold)}${override.unit}) → ${override.action}`
          : `OK: ${override.condition} = ${String(value)}${override.unit}`,
      });
    }

    if (results.some(r => r.triggered)) {
      this.notify();
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Macros
  // ---------------------------------------------------------------------------

  createMacro(name: string, trigger: string, steps: VoiceMacro['steps'], description?: string): VoiceMacro {
    const macro: VoiceMacro = {
      id: `macro-${String(this._nextId++)}`,
      name,
      trigger: trigger.toLowerCase(),
      steps: [...steps],
      description: description ?? `Macro: ${name}`,
      createdAt: Date.now(),
    };
    this._macros.push(macro);
    this.notify();
    return macro;
  }

  deleteMacro(id: string): void {
    this._macros = this._macros.filter(m => m.id !== id);
    this.notify();
  }

  getMacros(): VoiceMacro[] {
    return [...this._macros];
  }

  executeMacro(macroId: string): string[] {
    const macro = this._macros.find(m => m.id === macroId);
    if (!macro) {
      return [`Macro not found: ${macroId}`];
    }

    const results: string[] = [];
    for (const step of macro.steps) {
      const result = this.processCommand(step.command);
      results.push(result.result);
    }
    return results;
  }

  findMacroByTrigger(transcript: string): VoiceMacro | undefined {
    const lower = transcript.toLowerCase();
    return this._macros.find(m => lower.includes(m.trigger));
  }

  // ---------------------------------------------------------------------------
  // Custom commands
  // ---------------------------------------------------------------------------

  registerCommand(cmd: VoiceBenchCommand): void {
    // Don't duplicate
    if (this._commands.some(c => c.id === cmd.id)) { return; }
    this._commands.push(cmd);
  }

  unregisterCommand(id: string): void {
    this._commands = this._commands.filter(c => c.id !== id || BUILT_IN_COMMANDS.some(b => b.id === c.id));
  }

  getCommands(): VoiceBenchCommand[] {
    return [...this._commands];
  }

  getCommandsByCategory(category: VoiceCommandCategory): VoiceBenchCommand[] {
    return this._commands.filter(c => c.category === category);
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  getSessionStats(): { duration: number; commandsExecuted: number; safetyTriggered: number; macrosRun: number } {
    if (!this._session) {
      return { duration: 0, commandsExecuted: 0, safetyTriggered: 0, macrosRun: 0 };
    }
    const endTime = this._session.endedAt ?? Date.now();
    return {
      duration: endTime - this._session.startedAt,
      commandsExecuted: this._session.commandsExecuted,
      safetyTriggered: this._session.safetyTriggered,
      macrosRun: this._commandHistory.filter(h => h.result.command?.action === 'run_macro').length,
    };
  }

  // ---------------------------------------------------------------------------
  // Reset (for testing)
  // ---------------------------------------------------------------------------

  reset(): void {
    this._session = null;
    this._safetyOverrides = [];
    this._macros = [];
    this._commands = [...BUILT_IN_COMMANDS];
    this._commandHistory = [];
    this._pendingConfirmation = null;
    this._nextId = 1;
    this.notify();
  }
}
