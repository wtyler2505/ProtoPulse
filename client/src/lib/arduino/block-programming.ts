/**
 * BL-0630 — Scratch-like Visual Block Programming for Arduino
 *
 * Provides a block-based visual programming engine that generates Arduino C++
 * code. Supports 20+ block types across 9 categories, block-to-C++ code
 * generation, basic C++-to-blocks reverse parsing, program validation,
 * and category coloring.
 *
 * Singleton + Subscribe pattern.
 *
 * Usage:
 *   const engine = BlockProgrammingEngine.getInstance();
 *   const setupId = engine.addBlock({ type: 'setup' });
 *   const pinId = engine.addBlock({ type: 'pin_mode', params: { pin: '13', mode: 'OUTPUT' } });
 *   engine.connectBlocks(setupId, pinId);
 *   const code = engine.generateCode();
 *
 * React hook:
 *   const { blocks, addBlock, generateCode, validate, ... } = useBlockProgramming();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlockCategory =
  | 'control'
  | 'io'
  | 'logic'
  | 'math'
  | 'variables'
  | 'functions'
  | 'serial'
  | 'timing'
  | 'advanced';

export type BlockType =
  // control
  | 'setup'
  | 'loop'
  | 'if'
  | 'if_else'
  | 'while'
  | 'for'
  | 'repeat'
  // io
  | 'pin_mode'
  | 'digital_write'
  | 'digital_read'
  | 'analog_write'
  | 'analog_read'
  // logic
  | 'compare'
  | 'logic_op'
  | 'not'
  // math
  | 'math_op'
  | 'math_value'
  | 'map_value'
  // variables
  | 'variable_set'
  | 'variable_get'
  // functions
  | 'function_def'
  | 'function_call'
  // serial
  | 'serial_begin'
  | 'serial_print'
  | 'serial_read'
  // timing
  | 'delay'
  | 'millis'
  // advanced
  | 'raw_code'
  | 'comment';

export interface BlockDefinition {
  type: BlockType;
  category: BlockCategory;
  label: string;
  description: string;
  params: BlockParamDef[];
  hasBody: boolean;
  hasElseBody: boolean;
  returnsValue: boolean;
}

export interface BlockParamDef {
  name: string;
  type: 'string' | 'number' | 'select' | 'pin' | 'variable';
  label: string;
  default: string;
  options?: string[];
}

export interface Block {
  id: string;
  type: BlockType;
  params: Record<string, string>;
  /** Child blocks (body). */
  children: string[];
  /** Else-branch children (for if_else). */
  elseChildren: string[];
  /** Next sibling block ID. */
  nextId: string | null;
  /** Position for canvas (if needed). */
  x: number;
  y: number;
}

export interface ValidationError {
  blockId: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface GeneratedCode {
  code: string;
  errors: ValidationError[];
}

// ---------------------------------------------------------------------------
// Constants — Category Colors
// ---------------------------------------------------------------------------

export const CATEGORY_COLORS: Record<BlockCategory, string> = {
  control: '#FFAB19',
  io: '#4C97FF',
  logic: '#59C059',
  math: '#5C68A6',
  variables: '#FF8C1A',
  functions: '#FF6680',
  serial: '#CF63CF',
  timing: '#0FBD8C',
  advanced: '#5C5C5C',
};

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  control: 'Control',
  io: 'Input/Output',
  logic: 'Logic',
  math: 'Math',
  variables: 'Variables',
  functions: 'Functions',
  serial: 'Serial',
  timing: 'Timing',
  advanced: 'Advanced',
};

// ---------------------------------------------------------------------------
// Block definitions registry
// ---------------------------------------------------------------------------

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  // Control
  { type: 'setup', category: 'control', label: 'setup', description: 'Runs once when the board starts.', params: [], hasBody: true, hasElseBody: false, returnsValue: false },
  { type: 'loop', category: 'control', label: 'loop', description: 'Runs repeatedly after setup.', params: [], hasBody: true, hasElseBody: false, returnsValue: false },
  { type: 'if', category: 'control', label: 'if', description: 'Conditional execution.', params: [{ name: 'condition', type: 'string', label: 'condition', default: 'true' }], hasBody: true, hasElseBody: false, returnsValue: false },
  { type: 'if_else', category: 'control', label: 'if / else', description: 'Conditional with else branch.', params: [{ name: 'condition', type: 'string', label: 'condition', default: 'true' }], hasBody: true, hasElseBody: true, returnsValue: false },
  { type: 'while', category: 'control', label: 'while', description: 'Loop while condition is true.', params: [{ name: 'condition', type: 'string', label: 'condition', default: 'true' }], hasBody: true, hasElseBody: false, returnsValue: false },
  { type: 'for', category: 'control', label: 'for', description: 'Counted loop.', params: [{ name: 'variable', type: 'variable', label: 'variable', default: 'i' }, { name: 'start', type: 'number', label: 'from', default: '0' }, { name: 'end', type: 'number', label: 'to', default: '10' }, { name: 'step', type: 'number', label: 'step', default: '1' }], hasBody: true, hasElseBody: false, returnsValue: false },
  { type: 'repeat', category: 'control', label: 'repeat', description: 'Repeat N times.', params: [{ name: 'count', type: 'number', label: 'times', default: '10' }], hasBody: true, hasElseBody: false, returnsValue: false },

  // IO
  { type: 'pin_mode', category: 'io', label: 'set pin mode', description: 'Configure a pin as input or output.', params: [{ name: 'pin', type: 'pin', label: 'pin', default: '13' }, { name: 'mode', type: 'select', label: 'mode', default: 'OUTPUT', options: ['INPUT', 'OUTPUT', 'INPUT_PULLUP'] }], hasBody: false, hasElseBody: false, returnsValue: false },
  { type: 'digital_write', category: 'io', label: 'digital write', description: 'Set a digital pin HIGH or LOW.', params: [{ name: 'pin', type: 'pin', label: 'pin', default: '13' }, { name: 'value', type: 'select', label: 'value', default: 'HIGH', options: ['HIGH', 'LOW'] }], hasBody: false, hasElseBody: false, returnsValue: false },
  { type: 'digital_read', category: 'io', label: 'digital read', description: 'Read a digital pin value.', params: [{ name: 'pin', type: 'pin', label: 'pin', default: '2' }], hasBody: false, hasElseBody: false, returnsValue: true },
  { type: 'analog_write', category: 'io', label: 'analog write', description: 'Write PWM value to a pin.', params: [{ name: 'pin', type: 'pin', label: 'pin', default: '9' }, { name: 'value', type: 'number', label: 'value (0-255)', default: '128' }], hasBody: false, hasElseBody: false, returnsValue: false },
  { type: 'analog_read', category: 'io', label: 'analog read', description: 'Read an analog pin value.', params: [{ name: 'pin', type: 'pin', label: 'pin', default: 'A0' }], hasBody: false, hasElseBody: false, returnsValue: true },

  // Logic
  { type: 'compare', category: 'logic', label: 'compare', description: 'Compare two values.', params: [{ name: 'left', type: 'string', label: 'left', default: '0' }, { name: 'op', type: 'select', label: 'operator', default: '==', options: ['==', '!=', '<', '>', '<=', '>='] }, { name: 'right', type: 'string', label: 'right', default: '0' }], hasBody: false, hasElseBody: false, returnsValue: true },
  { type: 'logic_op', category: 'logic', label: 'logic', description: 'Logical AND / OR.', params: [{ name: 'left', type: 'string', label: 'left', default: 'true' }, { name: 'op', type: 'select', label: 'operator', default: '&&', options: ['&&', '||'] }, { name: 'right', type: 'string', label: 'right', default: 'true' }], hasBody: false, hasElseBody: false, returnsValue: true },
  { type: 'not', category: 'logic', label: 'not', description: 'Logical NOT.', params: [{ name: 'value', type: 'string', label: 'value', default: 'true' }], hasBody: false, hasElseBody: false, returnsValue: true },

  // Math
  { type: 'math_op', category: 'math', label: 'math', description: 'Arithmetic operation.', params: [{ name: 'left', type: 'string', label: 'left', default: '0' }, { name: 'op', type: 'select', label: 'operator', default: '+', options: ['+', '-', '*', '/', '%'] }, { name: 'right', type: 'string', label: 'right', default: '0' }], hasBody: false, hasElseBody: false, returnsValue: true },
  { type: 'math_value', category: 'math', label: 'number', description: 'A numeric constant.', params: [{ name: 'value', type: 'number', label: 'value', default: '0' }], hasBody: false, hasElseBody: false, returnsValue: true },
  { type: 'map_value', category: 'math', label: 'map', description: 'Map a value from one range to another.', params: [{ name: 'value', type: 'string', label: 'value', default: '0' }, { name: 'fromLow', type: 'number', label: 'from low', default: '0' }, { name: 'fromHigh', type: 'number', label: 'from high', default: '1023' }, { name: 'toLow', type: 'number', label: 'to low', default: '0' }, { name: 'toHigh', type: 'number', label: 'to high', default: '255' }], hasBody: false, hasElseBody: false, returnsValue: true },

  // Variables
  { type: 'variable_set', category: 'variables', label: 'set variable', description: 'Set a variable value.', params: [{ name: 'name', type: 'variable', label: 'name', default: 'x' }, { name: 'type', type: 'select', label: 'type', default: 'int', options: ['int', 'float', 'bool', 'String', 'long', 'byte'] }, { name: 'value', type: 'string', label: 'value', default: '0' }], hasBody: false, hasElseBody: false, returnsValue: false },
  { type: 'variable_get', category: 'variables', label: 'get variable', description: 'Get a variable value.', params: [{ name: 'name', type: 'variable', label: 'name', default: 'x' }], hasBody: false, hasElseBody: false, returnsValue: true },

  // Functions
  { type: 'function_def', category: 'functions', label: 'define function', description: 'Define a custom function.', params: [{ name: 'name', type: 'string', label: 'name', default: 'myFunction' }, { name: 'returnType', type: 'select', label: 'returns', default: 'void', options: ['void', 'int', 'float', 'bool', 'String'] }], hasBody: true, hasElseBody: false, returnsValue: false },
  { type: 'function_call', category: 'functions', label: 'call function', description: 'Call a custom function.', params: [{ name: 'name', type: 'string', label: 'name', default: 'myFunction' }], hasBody: false, hasElseBody: false, returnsValue: false },

  // Serial
  { type: 'serial_begin', category: 'serial', label: 'serial begin', description: 'Start serial communication.', params: [{ name: 'baud', type: 'select', label: 'baud rate', default: '9600', options: ['300', '1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200'] }], hasBody: false, hasElseBody: false, returnsValue: false },
  { type: 'serial_print', category: 'serial', label: 'serial print', description: 'Print to serial monitor.', params: [{ name: 'value', type: 'string', label: 'value', default: '"Hello"' }, { name: 'newline', type: 'select', label: 'newline', default: 'yes', options: ['yes', 'no'] }], hasBody: false, hasElseBody: false, returnsValue: false },
  { type: 'serial_read', category: 'serial', label: 'serial read', description: 'Read from serial.', params: [], hasBody: false, hasElseBody: false, returnsValue: true },

  // Timing
  { type: 'delay', category: 'timing', label: 'delay', description: 'Wait for milliseconds.', params: [{ name: 'ms', type: 'number', label: 'milliseconds', default: '1000' }], hasBody: false, hasElseBody: false, returnsValue: false },
  { type: 'millis', category: 'timing', label: 'millis', description: 'Get time since boot in ms.', params: [], hasBody: false, hasElseBody: false, returnsValue: true },

  // Advanced
  { type: 'raw_code', category: 'advanced', label: 'raw C++ code', description: 'Insert raw C++ code.', params: [{ name: 'code', type: 'string', label: 'code', default: '// custom code' }], hasBody: false, hasElseBody: false, returnsValue: false },
  { type: 'comment', category: 'advanced', label: 'comment', description: 'Add a code comment.', params: [{ name: 'text', type: 'string', label: 'comment', default: 'TODO' }], hasBody: false, hasElseBody: false, returnsValue: false },
];

export function getBlockDefinition(type: BlockType): BlockDefinition | undefined {
  return BLOCK_DEFINITIONS.find((d) => d.type === type);
}

export function getBlocksByCategory(category: BlockCategory): BlockDefinition[] {
  return BLOCK_DEFINITIONS.filter((d) => d.category === category);
}

export function getAllCategories(): BlockCategory[] {
  return ['control', 'io', 'logic', 'math', 'variables', 'functions', 'serial', 'timing', 'advanced'];
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

function indent(code: string, level: number): string {
  const prefix = '  '.repeat(level);
  return code
    .split('\n')
    .map((line) => (line.trim() ? prefix + line : line))
    .join('\n');
}

export function generateBlockCode(blocks: Map<string, Block>, blockId: string, level: number): string {
  const block = blocks.get(blockId);
  if (!block) {
    return '';
  }

  const p = block.params;
  let code = '';

  switch (block.type) {
    case 'setup':
      code = `void setup() {\n${generateChildrenCode(blocks, block.children, level + 1)}\n${indent('}', level)}`;
      break;
    case 'loop':
      code = `void loop() {\n${generateChildrenCode(blocks, block.children, level + 1)}\n${indent('}', level)}`;
      break;
    case 'if':
      code = `if (${p['condition'] ?? 'true'}) {\n${generateChildrenCode(blocks, block.children, level + 1)}\n${indent('}', level)}`;
      break;
    case 'if_else':
      code = `if (${p['condition'] ?? 'true'}) {\n${generateChildrenCode(blocks, block.children, level + 1)}\n${indent('} else {', level)}\n${generateChildrenCode(blocks, block.elseChildren, level + 1)}\n${indent('}', level)}`;
      break;
    case 'while':
      code = `while (${p['condition'] ?? 'true'}) {\n${generateChildrenCode(blocks, block.children, level + 1)}\n${indent('}', level)}`;
      break;
    case 'for':
      code = `for (int ${p['variable'] ?? 'i'} = ${p['start'] ?? '0'}; ${p['variable'] ?? 'i'} < ${p['end'] ?? '10'}; ${p['variable'] ?? 'i'} += ${p['step'] ?? '1'}) {\n${generateChildrenCode(blocks, block.children, level + 1)}\n${indent('}', level)}`;
      break;
    case 'repeat':
      code = `for (int _i = 0; _i < ${p['count'] ?? '10'}; _i++) {\n${generateChildrenCode(blocks, block.children, level + 1)}\n${indent('}', level)}`;
      break;
    case 'pin_mode':
      code = `pinMode(${p['pin'] ?? '13'}, ${p['mode'] ?? 'OUTPUT'});`;
      break;
    case 'digital_write':
      code = `digitalWrite(${p['pin'] ?? '13'}, ${p['value'] ?? 'HIGH'});`;
      break;
    case 'digital_read':
      code = `digitalRead(${p['pin'] ?? '2'})`;
      break;
    case 'analog_write':
      code = `analogWrite(${p['pin'] ?? '9'}, ${p['value'] ?? '128'});`;
      break;
    case 'analog_read':
      code = `analogRead(${p['pin'] ?? 'A0'})`;
      break;
    case 'compare':
      code = `(${p['left'] ?? '0'} ${p['op'] ?? '=='} ${p['right'] ?? '0'})`;
      break;
    case 'logic_op':
      code = `(${p['left'] ?? 'true'} ${p['op'] ?? '&&'} ${p['right'] ?? 'true'})`;
      break;
    case 'not':
      code = `!(${p['value'] ?? 'true'})`;
      break;
    case 'math_op':
      code = `(${p['left'] ?? '0'} ${p['op'] ?? '+'} ${p['right'] ?? '0'})`;
      break;
    case 'math_value':
      code = p['value'] ?? '0';
      break;
    case 'map_value':
      code = `map(${p['value'] ?? '0'}, ${p['fromLow'] ?? '0'}, ${p['fromHigh'] ?? '1023'}, ${p['toLow'] ?? '0'}, ${p['toHigh'] ?? '255'})`;
      break;
    case 'variable_set':
      code = `${p['type'] ?? 'int'} ${p['name'] ?? 'x'} = ${p['value'] ?? '0'};`;
      break;
    case 'variable_get':
      code = p['name'] ?? 'x';
      break;
    case 'function_def':
      code = `${p['returnType'] ?? 'void'} ${p['name'] ?? 'myFunction'}() {\n${generateChildrenCode(blocks, block.children, level + 1)}\n${indent('}', level)}`;
      break;
    case 'function_call':
      code = `${p['name'] ?? 'myFunction'}();`;
      break;
    case 'serial_begin':
      code = `Serial.begin(${p['baud'] ?? '9600'});`;
      break;
    case 'serial_print':
      code = (p['newline'] ?? 'yes') === 'yes' ? `Serial.println(${p['value'] ?? '"Hello"'});` : `Serial.print(${p['value'] ?? '"Hello"'});`;
      break;
    case 'serial_read':
      code = 'Serial.read()';
      break;
    case 'delay':
      code = `delay(${p['ms'] ?? '1000'});`;
      break;
    case 'millis':
      code = 'millis()';
      break;
    case 'raw_code':
      code = p['code'] ?? '// custom code';
      break;
    case 'comment':
      code = `// ${p['text'] ?? 'TODO'}`;
      break;
  }

  return code;
}

function generateChildrenCode(blocks: Map<string, Block>, childIds: string[], level: number): string {
  if (childIds.length === 0) {
    return '';
  }
  return childIds
    .map((id) => indent(generateBlockCode(blocks, id, level), level))
    .filter((c) => c.trim())
    .join('\n');
}

// ---------------------------------------------------------------------------
// Basic C++-to-blocks parser
// ---------------------------------------------------------------------------

export interface ParsedProgram {
  setupBlocks: Array<{ type: BlockType; params: Record<string, string> }>;
  loopBlocks: Array<{ type: BlockType; params: Record<string, string> }>;
}

function parseStatementToBlock(line: string): { type: BlockType; params: Record<string, string> } | null {
  const trimmed = line.trim().replace(/;$/, '');

  // pinMode(pin, mode)
  const pinModeMatch = trimmed.match(/^pinMode\((\w+),\s*(\w+)\)$/);
  if (pinModeMatch) {
    return { type: 'pin_mode', params: { pin: pinModeMatch[1], mode: pinModeMatch[2] } };
  }

  // digitalWrite(pin, value)
  const dwMatch = trimmed.match(/^digitalWrite\((\w+),\s*(\w+)\)$/);
  if (dwMatch) {
    return { type: 'digital_write', params: { pin: dwMatch[1], value: dwMatch[2] } };
  }

  // analogWrite(pin, value)
  const awMatch = trimmed.match(/^analogWrite\((\w+),\s*(\w+)\)$/);
  if (awMatch) {
    return { type: 'analog_write', params: { pin: awMatch[1], value: awMatch[2] } };
  }

  // Serial.begin(baud)
  const sbMatch = trimmed.match(/^Serial\.begin\((\d+)\)$/);
  if (sbMatch) {
    return { type: 'serial_begin', params: { baud: sbMatch[1] } };
  }

  // Serial.println(value)
  const spnMatch = trimmed.match(/^Serial\.println\((.+)\)$/);
  if (spnMatch) {
    return { type: 'serial_print', params: { value: spnMatch[1], newline: 'yes' } };
  }

  // Serial.print(value)
  const spMatch = trimmed.match(/^Serial\.print\((.+)\)$/);
  if (spMatch) {
    return { type: 'serial_print', params: { value: spMatch[1], newline: 'no' } };
  }

  // delay(ms)
  const delayMatch = trimmed.match(/^delay\((\d+)\)$/);
  if (delayMatch) {
    return { type: 'delay', params: { ms: delayMatch[1] } };
  }

  // // comment
  const commentMatch = trimmed.match(/^\/\/\s*(.*)$/);
  if (commentMatch) {
    return { type: 'comment', params: { text: commentMatch[1] } };
  }

  // variable declaration: type name = value
  const varMatch = trimmed.match(/^(int|float|bool|String|long|byte)\s+(\w+)\s*=\s*(.+)$/);
  if (varMatch) {
    return { type: 'variable_set', params: { type: varMatch[1], name: varMatch[2], value: varMatch[3] } };
  }

  // Fallback: raw code
  if (trimmed.length > 0) {
    return { type: 'raw_code', params: { code: trimmed } };
  }

  return null;
}

/**
 * Parse a basic Arduino sketch into block representations.
 * Handles simple flat statements inside setup() and loop().
 * Does not handle nested control structures.
 */
export function parseCodeToBlocks(code: string): ParsedProgram {
  const result: ParsedProgram = { setupBlocks: [], loopBlocks: [] };

  // Extract setup() body
  const setupMatch = code.match(/void\s+setup\s*\(\s*\)\s*\{([\s\S]*?)\n\}/);
  if (setupMatch) {
    const lines = setupMatch[1].split('\n');
    for (const line of lines) {
      const block = parseStatementToBlock(line);
      if (block) {
        result.setupBlocks.push(block);
      }
    }
  }

  // Extract loop() body
  const loopMatch = code.match(/void\s+loop\s*\(\s*\)\s*\{([\s\S]*?)\n\}/);
  if (loopMatch) {
    const lines = loopMatch[1].split('\n');
    for (const line of lines) {
      const block = parseStatementToBlock(line);
      if (block) {
        result.loopBlocks.push(block);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// BlockProgrammingEngine
// ---------------------------------------------------------------------------

export class BlockProgrammingEngine {
  private static instance: BlockProgrammingEngine | null = null;

  private blocks = new Map<string, Block>();
  private rootBlockIds: string[] = [];
  private declaredVariables = new Set<string>();
  private listeners = new Set<Listener>();

  constructor() {
    // Empty program
  }

  static getInstance(): BlockProgrammingEngine {
    if (!BlockProgrammingEngine.instance) {
      BlockProgrammingEngine.instance = new BlockProgrammingEngine();
    }
    return BlockProgrammingEngine.instance;
  }

  static resetForTesting(): void {
    BlockProgrammingEngine.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

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
  // Block CRUD
  // -----------------------------------------------------------------------

  addBlock(input: { type: BlockType; params?: Record<string, string>; x?: number; y?: number }): string {
    const def = getBlockDefinition(input.type);
    const id = crypto.randomUUID();

    const defaultParams: Record<string, string> = {};
    if (def) {
      def.params.forEach((p) => {
        defaultParams[p.name] = p.default;
      });
    }

    const block: Block = {
      id,
      type: input.type,
      params: { ...defaultParams, ...input.params },
      children: [],
      elseChildren: [],
      nextId: null,
      x: input.x ?? 0,
      y: input.y ?? 0,
    };

    this.blocks.set(id, block);
    this.rootBlockIds.push(id);

    // Track declared variables
    if (input.type === 'variable_set') {
      this.declaredVariables.add(block.params['name'] ?? 'x');
    }

    this.notify();
    return id;
  }

  getBlock(id: string): Block | null {
    const b = this.blocks.get(id);
    return b ? { ...b, params: { ...b.params }, children: [...b.children], elseChildren: [...b.elseChildren] } : null;
  }

  getAllBlocks(): Block[] {
    return Array.from(this.blocks.values()).map((b) => ({
      ...b,
      params: { ...b.params },
      children: [...b.children],
      elseChildren: [...b.elseChildren],
    }));
  }

  getRootBlockIds(): string[] {
    return [...this.rootBlockIds];
  }

  removeBlock(id: string): boolean {
    if (!this.blocks.has(id)) {
      return false;
    }

    // Remove from parent's children
    this.blocks.forEach((b) => {
      const childIdx = b.children.indexOf(id);
      if (childIdx !== -1) {
        b.children.splice(childIdx, 1);
      }
      const elseIdx = b.elseChildren.indexOf(id);
      if (elseIdx !== -1) {
        b.elseChildren.splice(elseIdx, 1);
      }
      if (b.nextId === id) {
        b.nextId = null;
      }
    });

    // Remove from root
    const rootIdx = this.rootBlockIds.indexOf(id);
    if (rootIdx !== -1) {
      this.rootBlockIds.splice(rootIdx, 1);
    }

    this.blocks.delete(id);
    this.notify();
    return true;
  }

  updateBlockParams(id: string, params: Record<string, string>): boolean {
    const block = this.blocks.get(id);
    if (!block) {
      return false;
    }
    const entries = Object.entries(params);
    for (const [key, value] of entries) {
      block.params[key] = value;
    }

    if (block.type === 'variable_set' && params['name']) {
      this.declaredVariables.add(params['name']);
    }

    this.notify();
    return true;
  }

  moveBlock(id: string, x: number, y: number): boolean {
    const block = this.blocks.get(id);
    if (!block) {
      return false;
    }
    block.x = x;
    block.y = y;
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // Block connections
  // -----------------------------------------------------------------------

  /**
   * Add childId as a body child of parentId.
   */
  connectBlocks(parentId: string, childId: string): boolean {
    const parent = this.blocks.get(parentId);
    const child = this.blocks.get(childId);
    if (!parent || !child) {
      return false;
    }
    const def = getBlockDefinition(parent.type);
    if (!def?.hasBody) {
      return false;
    }
    if (parent.children.includes(childId)) {
      return false;
    }

    // Remove from root if it was a root
    const rootIdx = this.rootBlockIds.indexOf(childId);
    if (rootIdx !== -1) {
      this.rootBlockIds.splice(rootIdx, 1);
    }

    parent.children.push(childId);
    this.notify();
    return true;
  }

  /**
   * Add childId to the else branch of parentId (for if_else blocks).
   */
  connectElse(parentId: string, childId: string): boolean {
    const parent = this.blocks.get(parentId);
    const child = this.blocks.get(childId);
    if (!parent || !child) {
      return false;
    }
    const def = getBlockDefinition(parent.type);
    if (!def?.hasElseBody) {
      return false;
    }
    if (parent.elseChildren.includes(childId)) {
      return false;
    }

    const rootIdx = this.rootBlockIds.indexOf(childId);
    if (rootIdx !== -1) {
      this.rootBlockIds.splice(rootIdx, 1);
    }

    parent.elseChildren.push(childId);
    this.notify();
    return true;
  }

  disconnectBlock(parentId: string, childId: string): boolean {
    const parent = this.blocks.get(parentId);
    if (!parent) {
      return false;
    }
    let found = false;

    const childIdx = parent.children.indexOf(childId);
    if (childIdx !== -1) {
      parent.children.splice(childIdx, 1);
      found = true;
    }

    const elseIdx = parent.elseChildren.indexOf(childId);
    if (elseIdx !== -1) {
      parent.elseChildren.splice(elseIdx, 1);
      found = true;
    }

    if (found) {
      this.rootBlockIds.push(childId);
      this.notify();
    }
    return found;
  }

  // -----------------------------------------------------------------------
  // Code generation
  // -----------------------------------------------------------------------

  generateCode(): GeneratedCode {
    const errors = this.validate();
    const codeBlocks: string[] = [];

    // Find setup and loop blocks
    const setupBlocks = Array.from(this.blocks.values()).filter((b) => b.type === 'setup');
    const loopBlocks = Array.from(this.blocks.values()).filter((b) => b.type === 'loop');
    const functionDefs = Array.from(this.blocks.values()).filter((b) => b.type === 'function_def');

    // Generate global variable declarations
    const globalVars: string[] = [];
    this.rootBlockIds.forEach((id) => {
      const block = this.blocks.get(id);
      if (block && block.type === 'variable_set') {
        globalVars.push(generateBlockCode(this.blocks, id, 0));
      }
    });

    if (globalVars.length > 0) {
      codeBlocks.push(globalVars.join('\n'));
      codeBlocks.push('');
    }

    // Generate function definitions
    functionDefs.forEach((fd) => {
      codeBlocks.push(generateBlockCode(this.blocks, fd.id, 0));
      codeBlocks.push('');
    });

    // Generate setup
    if (setupBlocks.length > 0) {
      setupBlocks.forEach((sb) => {
        codeBlocks.push(generateBlockCode(this.blocks, sb.id, 0));
      });
    } else {
      codeBlocks.push('void setup() {\n}');
    }

    codeBlocks.push('');

    // Generate loop
    if (loopBlocks.length > 0) {
      loopBlocks.forEach((lb) => {
        codeBlocks.push(generateBlockCode(this.blocks, lb.id, 0));
      });
    } else {
      codeBlocks.push('void loop() {\n}');
    }

    return { code: codeBlocks.join('\n'), errors };
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  validate(): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check: at most one setup and one loop
    const setupCount = Array.from(this.blocks.values()).filter((b) => b.type === 'setup').length;
    const loopCount = Array.from(this.blocks.values()).filter((b) => b.type === 'loop').length;

    if (setupCount > 1) {
      const setupBlocks = Array.from(this.blocks.values()).filter((b) => b.type === 'setup');
      setupBlocks.slice(1).forEach((b) => {
        errors.push({ blockId: b.id, message: 'Only one setup block is allowed', severity: 'error' });
      });
    }

    if (loopCount > 1) {
      const loopBlocksList = Array.from(this.blocks.values()).filter((b) => b.type === 'loop');
      loopBlocksList.slice(1).forEach((b) => {
        errors.push({ blockId: b.id, message: 'Only one loop block is allowed', severity: 'error' });
      });
    }

    // Check each block
    this.blocks.forEach((block) => {
      const def = getBlockDefinition(block.type);
      if (!def) {
        errors.push({ blockId: block.id, message: `Unknown block type: ${block.type}`, severity: 'error' });
        return;
      }

      // Validate required params
      def.params.forEach((paramDef) => {
        const val = block.params[paramDef.name];
        if (val === undefined || val.trim() === '') {
          errors.push({
            blockId: block.id,
            message: `Parameter "${paramDef.label}" is required for ${def.label}`,
            severity: 'error',
          });
        }
      });

      // Pin validation
      if (block.type === 'pin_mode' || block.type === 'digital_write' || block.type === 'digital_read') {
        const pin = block.params['pin'];
        if (pin && !/^(\d+|A\d+)$/.test(pin)) {
          errors.push({ blockId: block.id, message: `Invalid pin "${pin}". Use a number or A0-A7.`, severity: 'error' });
        }
      }

      // analog_write range
      if (block.type === 'analog_write') {
        const val = parseInt(block.params['value'] ?? '0', 10);
        if (!isNaN(val) && (val < 0 || val > 255)) {
          errors.push({ blockId: block.id, message: 'Analog write value must be 0-255', severity: 'warning' });
        }
      }

      // Delay warning for very large values
      if (block.type === 'delay') {
        const ms = parseInt(block.params['ms'] ?? '0', 10);
        if (!isNaN(ms) && ms > 30000) {
          errors.push({ blockId: block.id, message: 'Delay over 30 seconds — consider using millis() instead', severity: 'warning' });
        }
      }

      // variable_get: check if declared
      if (block.type === 'variable_get') {
        const name = block.params['name'];
        if (name && !this.declaredVariables.has(name)) {
          errors.push({ blockId: block.id, message: `Variable "${name}" has not been declared`, severity: 'warning' });
        }
      }

      // Empty body warning for control blocks
      if (def.hasBody && block.children.length === 0 && (block.type === 'if' || block.type === 'if_else' || block.type === 'while' || block.type === 'for' || block.type === 'repeat')) {
        errors.push({ blockId: block.id, message: `${def.label} block has no body`, severity: 'warning' });
      }
    });

    return errors;
  }

  // -----------------------------------------------------------------------
  // Import from C++
  // -----------------------------------------------------------------------

  importFromCode(code: string): void {
    const parsed = parseCodeToBlocks(code);

    this.clear();

    // Create setup block
    const setupId = this.addBlock({ type: 'setup' });
    parsed.setupBlocks.forEach((pb) => {
      const childId = this.addBlock({ type: pb.type, params: pb.params });
      this.connectBlocks(setupId, childId);
    });

    // Create loop block
    const loopId = this.addBlock({ type: 'loop' });
    parsed.loopBlocks.forEach((pb) => {
      const childId = this.addBlock({ type: pb.type, params: pb.params });
      this.connectBlocks(loopId, childId);
    });

    this.notify();
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  clear(): void {
    this.blocks.clear();
    this.rootBlockIds = [];
    this.declaredVariables.clear();
    this.notify();
  }

  getBlockCount(): number {
    return this.blocks.size;
  }

  getDeclaredVariables(): string[] {
    return Array.from(this.declaredVariables);
  }

  /**
   * Create a default blink program.
   */
  createBlinkProgram(): void {
    this.clear();

    const setupId = this.addBlock({ type: 'setup' });
    const pinModeId = this.addBlock({ type: 'pin_mode', params: { pin: '13', mode: 'OUTPUT' } });
    this.connectBlocks(setupId, pinModeId);

    const loopId = this.addBlock({ type: 'loop' });
    const highId = this.addBlock({ type: 'digital_write', params: { pin: '13', value: 'HIGH' } });
    const delay1Id = this.addBlock({ type: 'delay', params: { ms: '1000' } });
    const lowId = this.addBlock({ type: 'digital_write', params: { pin: '13', value: 'LOW' } });
    const delay2Id = this.addBlock({ type: 'delay', params: { ms: '1000' } });
    this.connectBlocks(loopId, highId);
    this.connectBlocks(loopId, delay1Id);
    this.connectBlocks(loopId, lowId);
    this.connectBlocks(loopId, delay2Id);
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useBlockProgramming(): {
  blocks: Block[];
  rootBlockIds: string[];
  declaredVariables: string[];
  addBlock: (input: { type: BlockType; params?: Record<string, string>; x?: number; y?: number }) => string;
  removeBlock: (id: string) => boolean;
  updateBlockParams: (id: string, params: Record<string, string>) => boolean;
  moveBlock: (id: string, x: number, y: number) => boolean;
  connectBlocks: (parentId: string, childId: string) => boolean;
  connectElse: (parentId: string, childId: string) => boolean;
  disconnectBlock: (parentId: string, childId: string) => boolean;
  generateCode: () => GeneratedCode;
  validate: () => ValidationError[];
  importFromCode: (code: string) => void;
  clear: () => void;
  createBlinkProgram: () => void;
  getBlockCount: () => number;
} {
  const engine = BlockProgrammingEngine.getInstance();
  const [, setTick] = useState(0);

  useEffect(() => {
    return engine.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, [engine]);

  return {
    blocks: engine.getAllBlocks(),
    rootBlockIds: engine.getRootBlockIds(),
    declaredVariables: engine.getDeclaredVariables(),
    addBlock: useCallback((input: { type: BlockType; params?: Record<string, string>; x?: number; y?: number }) => engine.addBlock(input), [engine]),
    removeBlock: useCallback((id: string) => engine.removeBlock(id), [engine]),
    updateBlockParams: useCallback((id: string, params: Record<string, string>) => engine.updateBlockParams(id, params), [engine]),
    moveBlock: useCallback((id: string, x: number, y: number) => engine.moveBlock(id, x, y), [engine]),
    connectBlocks: useCallback((parentId: string, childId: string) => engine.connectBlocks(parentId, childId), [engine]),
    connectElse: useCallback((parentId: string, childId: string) => engine.connectElse(parentId, childId), [engine]),
    disconnectBlock: useCallback((parentId: string, childId: string) => engine.disconnectBlock(parentId, childId), [engine]),
    generateCode: useCallback(() => engine.generateCode(), [engine]),
    validate: useCallback(() => engine.validate(), [engine]),
    importFromCode: useCallback((code: string) => engine.importFromCode(code), [engine]),
    clear: useCallback(() => engine.clear(), [engine]),
    createBlinkProgram: useCallback(() => engine.createBlinkProgram(), [engine]),
    getBlockCount: useCallback(() => engine.getBlockCount(), [engine]),
  };
}
