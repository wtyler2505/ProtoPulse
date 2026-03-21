import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Stub globals before importing the module
// ---------------------------------------------------------------------------

let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `uuid-${uuidCounter++}`),
});

import {
  BlockProgrammingEngine,
  BLOCK_DEFINITIONS,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  getBlockDefinition,
  getBlocksByCategory,
  getAllCategories,
  generateBlockCode,
  parseCodeToBlocks,
  useBlockProgramming,
} from '../block-programming';
import type {
  BlockType,
  BlockCategory,
  Block,
  BlockDefinition,
  ValidationError,
  GeneratedCode,
  ParsedProgram,
} from '../block-programming';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BlockProgrammingEngine', () => {
  let engine: BlockProgrammingEngine;

  beforeEach(() => {
    uuidCounter = 0;
    BlockProgrammingEngine.resetForTesting();
    engine = BlockProgrammingEngine.getInstance();
  });

  afterEach(() => {
    BlockProgrammingEngine.resetForTesting();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      expect(BlockProgrammingEngine.getInstance()).toBe(engine);
    });

    it('returns new instance after resetForTesting', () => {
      BlockProgrammingEngine.resetForTesting();
      expect(BlockProgrammingEngine.getInstance()).not.toBe(engine);
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('calls listener on state changes', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.addBlock({ type: 'setup' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes correctly', () => {
      const listener = vi.fn();
      const unsub = engine.subscribe(listener);
      unsub();
      engine.addBlock({ type: 'setup' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      engine.subscribe(l1);
      engine.subscribe(l2);
      engine.addBlock({ type: 'setup' });
      expect(l1).toHaveBeenCalled();
      expect(l2).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Block definitions registry
  // -----------------------------------------------------------------------

  describe('block definitions', () => {
    it('has at least 20 block types', () => {
      expect(BLOCK_DEFINITIONS.length).toBeGreaterThanOrEqual(20);
    });

    it('has definitions for all 9 categories', () => {
      const categories = new Set(BLOCK_DEFINITIONS.map((d) => d.category));
      expect(categories.size).toBe(9);
    });

    it('getBlockDefinition returns definition for known type', () => {
      const def = getBlockDefinition('setup');
      expect(def).toBeDefined();
      expect(def!.type).toBe('setup');
      expect(def!.category).toBe('control');
    });

    it('getBlockDefinition returns undefined for unknown type', () => {
      expect(getBlockDefinition('not_a_type' as BlockType)).toBeUndefined();
    });

    it('getBlocksByCategory filters correctly', () => {
      const ioBlocks = getBlocksByCategory('io');
      expect(ioBlocks.length).toBeGreaterThanOrEqual(4);
      ioBlocks.forEach((b) => {
        expect(b.category).toBe('io');
      });
    });

    it('getAllCategories returns all 9', () => {
      expect(getAllCategories()).toHaveLength(9);
    });
  });

  // -----------------------------------------------------------------------
  // Category colors
  // -----------------------------------------------------------------------

  describe('category colors', () => {
    it('has colors for all categories', () => {
      getAllCategories().forEach((cat) => {
        expect(CATEGORY_COLORS[cat]).toBeDefined();
        expect(CATEGORY_COLORS[cat]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('has labels for all categories', () => {
      getAllCategories().forEach((cat) => {
        expect(CATEGORY_LABELS[cat]).toBeDefined();
        expect(CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Block CRUD
  // -----------------------------------------------------------------------

  describe('addBlock', () => {
    it('adds a block with default params', () => {
      const id = engine.addBlock({ type: 'pin_mode' });
      const block = engine.getBlock(id);
      expect(block).not.toBeNull();
      expect(block!.type).toBe('pin_mode');
      expect(block!.params['pin']).toBe('13');
      expect(block!.params['mode']).toBe('OUTPUT');
    });

    it('adds a block with custom params', () => {
      const id = engine.addBlock({ type: 'pin_mode', params: { pin: '5', mode: 'INPUT' } });
      const block = engine.getBlock(id)!;
      expect(block.params['pin']).toBe('5');
      expect(block.params['mode']).toBe('INPUT');
    });

    it('adds a block with position', () => {
      const id = engine.addBlock({ type: 'setup', x: 100, y: 200 });
      const block = engine.getBlock(id)!;
      expect(block.x).toBe(100);
      expect(block.y).toBe(200);
    });

    it('tracks declared variables', () => {
      engine.addBlock({ type: 'variable_set', params: { name: 'myVar', type: 'int', value: '0' } });
      expect(engine.getDeclaredVariables()).toContain('myVar');
    });

    it('adds block to root list', () => {
      const id = engine.addBlock({ type: 'setup' });
      expect(engine.getRootBlockIds()).toContain(id);
    });
  });

  describe('getBlock', () => {
    it('returns null for unknown id', () => {
      expect(engine.getBlock('nope')).toBeNull();
    });

    it('returns a copy', () => {
      const id = engine.addBlock({ type: 'setup' });
      const b1 = engine.getBlock(id)!;
      b1.type = 'loop' as BlockType;
      expect(engine.getBlock(id)!.type).toBe('setup');
    });
  });

  describe('getAllBlocks', () => {
    it('returns all blocks', () => {
      engine.addBlock({ type: 'setup' });
      engine.addBlock({ type: 'loop' });
      expect(engine.getAllBlocks()).toHaveLength(2);
    });
  });

  describe('removeBlock', () => {
    it('removes a block', () => {
      const id = engine.addBlock({ type: 'setup' });
      expect(engine.removeBlock(id)).toBe(true);
      expect(engine.getBlock(id)).toBeNull();
      expect(engine.getBlockCount()).toBe(0);
    });

    it('returns false for unknown id', () => {
      expect(engine.removeBlock('nope')).toBe(false);
    });

    it('removes from parent children', () => {
      const parentId = engine.addBlock({ type: 'setup' });
      const childId = engine.addBlock({ type: 'delay', params: { ms: '1000' } });
      engine.connectBlocks(parentId, childId);
      engine.removeBlock(childId);
      expect(engine.getBlock(parentId)!.children).toHaveLength(0);
    });

    it('removes from root list', () => {
      const id = engine.addBlock({ type: 'setup' });
      engine.removeBlock(id);
      expect(engine.getRootBlockIds()).not.toContain(id);
    });
  });

  describe('updateBlockParams', () => {
    it('updates parameters', () => {
      const id = engine.addBlock({ type: 'delay', params: { ms: '1000' } });
      expect(engine.updateBlockParams(id, { ms: '2000' })).toBe(true);
      expect(engine.getBlock(id)!.params['ms']).toBe('2000');
    });

    it('returns false for unknown id', () => {
      expect(engine.updateBlockParams('nope', {})).toBe(false);
    });

    it('tracks variable name changes', () => {
      const id = engine.addBlock({ type: 'variable_set', params: { name: 'old', type: 'int', value: '0' } });
      engine.updateBlockParams(id, { name: 'newVar' });
      expect(engine.getDeclaredVariables()).toContain('newVar');
    });
  });

  describe('moveBlock', () => {
    it('updates position', () => {
      const id = engine.addBlock({ type: 'setup' });
      expect(engine.moveBlock(id, 50, 100)).toBe(true);
      const block = engine.getBlock(id)!;
      expect(block.x).toBe(50);
      expect(block.y).toBe(100);
    });

    it('returns false for unknown id', () => {
      expect(engine.moveBlock('nope', 0, 0)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Block connections
  // -----------------------------------------------------------------------

  describe('connectBlocks', () => {
    it('connects child to parent body', () => {
      const parentId = engine.addBlock({ type: 'setup' });
      const childId = engine.addBlock({ type: 'delay', params: { ms: '500' } });
      expect(engine.connectBlocks(parentId, childId)).toBe(true);
      expect(engine.getBlock(parentId)!.children).toContain(childId);
    });

    it('removes child from root list', () => {
      const parentId = engine.addBlock({ type: 'setup' });
      const childId = engine.addBlock({ type: 'delay', params: { ms: '500' } });
      engine.connectBlocks(parentId, childId);
      expect(engine.getRootBlockIds()).not.toContain(childId);
    });

    it('returns false when parent has no body', () => {
      const parentId = engine.addBlock({ type: 'delay', params: { ms: '500' } });
      const childId = engine.addBlock({ type: 'delay', params: { ms: '1000' } });
      expect(engine.connectBlocks(parentId, childId)).toBe(false);
    });

    it('returns false for duplicate connection', () => {
      const parentId = engine.addBlock({ type: 'setup' });
      const childId = engine.addBlock({ type: 'delay', params: { ms: '500' } });
      engine.connectBlocks(parentId, childId);
      expect(engine.connectBlocks(parentId, childId)).toBe(false);
    });

    it('returns false for unknown blocks', () => {
      expect(engine.connectBlocks('nope', 'nope2')).toBe(false);
    });
  });

  describe('connectElse', () => {
    it('connects to else branch of if_else', () => {
      const ifId = engine.addBlock({ type: 'if_else', params: { condition: 'x > 0' } });
      const elseChild = engine.addBlock({ type: 'delay', params: { ms: '100' } });
      expect(engine.connectElse(ifId, elseChild)).toBe(true);
      expect(engine.getBlock(ifId)!.elseChildren).toContain(elseChild);
    });

    it('returns false for blocks without else body', () => {
      const ifId = engine.addBlock({ type: 'if', params: { condition: 'x > 0' } });
      const childId = engine.addBlock({ type: 'delay', params: { ms: '100' } });
      expect(engine.connectElse(ifId, childId)).toBe(false);
    });
  });

  describe('disconnectBlock', () => {
    it('disconnects child from parent', () => {
      const parentId = engine.addBlock({ type: 'setup' });
      const childId = engine.addBlock({ type: 'delay', params: { ms: '500' } });
      engine.connectBlocks(parentId, childId);
      expect(engine.disconnectBlock(parentId, childId)).toBe(true);
      expect(engine.getBlock(parentId)!.children).not.toContain(childId);
      expect(engine.getRootBlockIds()).toContain(childId);
    });

    it('disconnects from else branch', () => {
      const ifId = engine.addBlock({ type: 'if_else', params: { condition: 'true' } });
      const elseChild = engine.addBlock({ type: 'delay', params: { ms: '100' } });
      engine.connectElse(ifId, elseChild);
      expect(engine.disconnectBlock(ifId, elseChild)).toBe(true);
      expect(engine.getBlock(ifId)!.elseChildren).not.toContain(elseChild);
    });

    it('returns false when no connection exists', () => {
      const parentId = engine.addBlock({ type: 'setup' });
      const childId = engine.addBlock({ type: 'delay', params: { ms: '500' } });
      expect(engine.disconnectBlock(parentId, childId)).toBe(false);
    });

    it('returns false for unknown parent', () => {
      expect(engine.disconnectBlock('nope', 'nope2')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Code generation
  // -----------------------------------------------------------------------

  describe('generateCode', () => {
    it('generates empty sketch', () => {
      const result = engine.generateCode();
      expect(result.code).toContain('void setup()');
      expect(result.code).toContain('void loop()');
    });

    it('generates blink program', () => {
      engine.createBlinkProgram();
      const result = engine.generateCode();
      expect(result.code).toContain('pinMode(13, OUTPUT)');
      expect(result.code).toContain('digitalWrite(13, HIGH)');
      expect(result.code).toContain('delay(1000)');
      expect(result.code).toContain('digitalWrite(13, LOW)');
    });

    it('generates setup with serial begin', () => {
      const setupId = engine.addBlock({ type: 'setup' });
      const serialId = engine.addBlock({ type: 'serial_begin', params: { baud: '115200' } });
      engine.connectBlocks(setupId, serialId);
      const result = engine.generateCode();
      expect(result.code).toContain('Serial.begin(115200)');
    });

    it('generates if block', () => {
      const loopId = engine.addBlock({ type: 'loop' });
      const ifId = engine.addBlock({ type: 'if', params: { condition: 'x > 0' } });
      const body = engine.addBlock({ type: 'delay', params: { ms: '100' } });
      engine.connectBlocks(loopId, ifId);
      engine.connectBlocks(ifId, body);
      const result = engine.generateCode();
      expect(result.code).toContain('if (x > 0)');
      expect(result.code).toContain('delay(100)');
    });

    it('generates if_else block', () => {
      const loopId = engine.addBlock({ type: 'loop' });
      const ifElseId = engine.addBlock({ type: 'if_else', params: { condition: 'a == b' } });
      const thenBody = engine.addBlock({ type: 'digital_write', params: { pin: '13', value: 'HIGH' } });
      const elseBody = engine.addBlock({ type: 'digital_write', params: { pin: '13', value: 'LOW' } });
      engine.connectBlocks(loopId, ifElseId);
      engine.connectBlocks(ifElseId, thenBody);
      engine.connectElse(ifElseId, elseBody);
      const result = engine.generateCode();
      expect(result.code).toContain('if (a == b)');
      expect(result.code).toContain('} else {');
    });

    it('generates while loop', () => {
      const loopId = engine.addBlock({ type: 'loop' });
      const whileId = engine.addBlock({ type: 'while', params: { condition: 'running' } });
      engine.connectBlocks(loopId, whileId);
      const result = engine.generateCode();
      expect(result.code).toContain('while (running)');
    });

    it('generates for loop', () => {
      const loopId = engine.addBlock({ type: 'loop' });
      const forId = engine.addBlock({ type: 'for', params: { variable: 'i', start: '0', end: '5', step: '1' } });
      engine.connectBlocks(loopId, forId);
      const result = engine.generateCode();
      expect(result.code).toContain('for (int i = 0; i < 5; i += 1)');
    });

    it('generates repeat loop', () => {
      const loopId = engine.addBlock({ type: 'loop' });
      const repeatId = engine.addBlock({ type: 'repeat', params: { count: '3' } });
      engine.connectBlocks(loopId, repeatId);
      const result = engine.generateCode();
      expect(result.code).toContain('for (int _i = 0; _i < 3; _i++)');
    });

    it('generates serial println', () => {
      const setupId = engine.addBlock({ type: 'setup' });
      const printId = engine.addBlock({ type: 'serial_print', params: { value: '"Hello"', newline: 'yes' } });
      engine.connectBlocks(setupId, printId);
      const result = engine.generateCode();
      expect(result.code).toContain('Serial.println("Hello")');
    });

    it('generates serial print without newline', () => {
      const setupId = engine.addBlock({ type: 'setup' });
      const printId = engine.addBlock({ type: 'serial_print', params: { value: '"Hi"', newline: 'no' } });
      engine.connectBlocks(setupId, printId);
      const result = engine.generateCode();
      expect(result.code).toContain('Serial.print("Hi")');
    });

    it('generates map function', () => {
      const loopId = engine.addBlock({ type: 'loop' });
      const varId = engine.addBlock({ type: 'variable_set', params: { name: 'val', type: 'int', value: 'map(analogRead(A0), 0, 1023, 0, 255)' } });
      engine.connectBlocks(loopId, varId);
      const result = engine.generateCode();
      expect(result.code).toContain('int val = map(analogRead(A0), 0, 1023, 0, 255)');
    });

    it('generates comment', () => {
      const setupId = engine.addBlock({ type: 'setup' });
      const commentId = engine.addBlock({ type: 'comment', params: { text: 'Initialize pins' } });
      engine.connectBlocks(setupId, commentId);
      const result = engine.generateCode();
      expect(result.code).toContain('// Initialize pins');
    });

    it('generates raw code', () => {
      const setupId = engine.addBlock({ type: 'setup' });
      const rawId = engine.addBlock({ type: 'raw_code', params: { code: 'TCCR1A = 0;' } });
      engine.connectBlocks(setupId, rawId);
      const result = engine.generateCode();
      expect(result.code).toContain('TCCR1A = 0;');
    });

    it('generates function definition and call', () => {
      const funcId = engine.addBlock({ type: 'function_def', params: { name: 'blink', returnType: 'void' } });
      const body = engine.addBlock({ type: 'digital_write', params: { pin: '13', value: 'HIGH' } });
      engine.connectBlocks(funcId, body);

      const loopId = engine.addBlock({ type: 'loop' });
      const callId = engine.addBlock({ type: 'function_call', params: { name: 'blink' } });
      engine.connectBlocks(loopId, callId);

      const result = engine.generateCode();
      expect(result.code).toContain('void blink()');
      expect(result.code).toContain('blink();');
    });

    it('generates global variable declarations', () => {
      engine.addBlock({ type: 'variable_set', params: { name: 'count', type: 'int', value: '0' } });
      engine.addBlock({ type: 'setup' });
      const result = engine.generateCode();
      expect(result.code).toContain('int count = 0;');
    });

    it('generates analogRead expression', () => {
      const loopId = engine.addBlock({ type: 'loop' });
      const mapId = engine.addBlock({ type: 'map_value', params: { value: 'sensorVal', fromLow: '0', fromHigh: '1023', toLow: '0', toHigh: '180' } });
      engine.connectBlocks(loopId, mapId);
      const result = engine.generateCode();
      expect(result.code).toContain('map(sensorVal, 0, 1023, 0, 180)');
    });
  });

  // -----------------------------------------------------------------------
  // generateBlockCode helper — individual block types
  // -----------------------------------------------------------------------

  describe('generateBlockCode', () => {
    it('generates digital_read', () => {
      const id = engine.addBlock({ type: 'digital_read', params: { pin: '7' } });
      const blocks = new Map<string, Block>();
      blocks.set(id, engine.getBlock(id)!);
      expect(generateBlockCode(blocks, id, 0)).toBe('digitalRead(7)');
    });

    it('generates analog_read', () => {
      const id = engine.addBlock({ type: 'analog_read', params: { pin: 'A0' } });
      const blocks = new Map<string, Block>();
      blocks.set(id, engine.getBlock(id)!);
      expect(generateBlockCode(blocks, id, 0)).toBe('analogRead(A0)');
    });

    it('generates analog_write', () => {
      const id = engine.addBlock({ type: 'analog_write', params: { pin: '9', value: '128' } });
      const blocks = new Map<string, Block>();
      blocks.set(id, engine.getBlock(id)!);
      expect(generateBlockCode(blocks, id, 0)).toBe('analogWrite(9, 128);');
    });

    it('generates compare', () => {
      const id = engine.addBlock({ type: 'compare', params: { left: 'x', op: '>', right: '5' } });
      const blocks = new Map<string, Block>();
      blocks.set(id, engine.getBlock(id)!);
      expect(generateBlockCode(blocks, id, 0)).toBe('(x > 5)');
    });

    it('generates logic_op', () => {
      const id = engine.addBlock({ type: 'logic_op', params: { left: 'a', op: '||', right: 'b' } });
      const blocks = new Map<string, Block>();
      blocks.set(id, engine.getBlock(id)!);
      expect(generateBlockCode(blocks, id, 0)).toBe('(a || b)');
    });

    it('generates not', () => {
      const id = engine.addBlock({ type: 'not', params: { value: 'flag' } });
      const blocks = new Map<string, Block>();
      blocks.set(id, engine.getBlock(id)!);
      expect(generateBlockCode(blocks, id, 0)).toBe('!(flag)');
    });

    it('generates math_op', () => {
      const id = engine.addBlock({ type: 'math_op', params: { left: '3', op: '*', right: '7' } });
      const blocks = new Map<string, Block>();
      blocks.set(id, engine.getBlock(id)!);
      expect(generateBlockCode(blocks, id, 0)).toBe('(3 * 7)');
    });

    it('generates math_value', () => {
      const id = engine.addBlock({ type: 'math_value', params: { value: '42' } });
      const blocks = new Map<string, Block>();
      blocks.set(id, engine.getBlock(id)!);
      expect(generateBlockCode(blocks, id, 0)).toBe('42');
    });

    it('generates variable_get', () => {
      const id = engine.addBlock({ type: 'variable_get', params: { name: 'counter' } });
      const blocks = new Map<string, Block>();
      blocks.set(id, engine.getBlock(id)!);
      expect(generateBlockCode(blocks, id, 0)).toBe('counter');
    });

    it('generates serial_read', () => {
      const id = engine.addBlock({ type: 'serial_read' });
      const blocks = new Map<string, Block>();
      blocks.set(id, engine.getBlock(id)!);
      expect(generateBlockCode(blocks, id, 0)).toBe('Serial.read()');
    });

    it('generates millis', () => {
      const id = engine.addBlock({ type: 'millis' });
      const blocks = new Map<string, Block>();
      blocks.set(id, engine.getBlock(id)!);
      expect(generateBlockCode(blocks, id, 0)).toBe('millis()');
    });

    it('generates power_cycle', () => {
      // power_cycle is not in blocks, just test unknown returns empty
      const blocks = new Map<string, Block>();
      expect(generateBlockCode(blocks, 'nonexistent', 0)).toBe('');
    });
  });

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  describe('validate', () => {
    it('returns no errors for valid blink program', () => {
      engine.createBlinkProgram();
      const errors = engine.validate();
      expect(errors.filter((e) => e.severity === 'error')).toHaveLength(0);
    });

    it('errors on multiple setup blocks', () => {
      engine.addBlock({ type: 'setup' });
      engine.addBlock({ type: 'setup' });
      const errors = engine.validate();
      expect(errors.some((e) => e.message.includes('Only one setup'))).toBe(true);
    });

    it('errors on multiple loop blocks', () => {
      engine.addBlock({ type: 'loop' });
      engine.addBlock({ type: 'loop' });
      const errors = engine.validate();
      expect(errors.some((e) => e.message.includes('Only one loop'))).toBe(true);
    });

    it('warns on invalid pin', () => {
      engine.addBlock({ type: 'pin_mode', params: { pin: 'invalid', mode: 'OUTPUT' } });
      const errors = engine.validate();
      expect(errors.some((e) => e.message.includes('Invalid pin'))).toBe(true);
    });

    it('accepts valid digital pin numbers', () => {
      engine.addBlock({ type: 'pin_mode', params: { pin: '13', mode: 'OUTPUT' } });
      const errors = engine.validate();
      expect(errors.filter((e) => e.message.includes('Invalid pin'))).toHaveLength(0);
    });

    it('accepts analog pins (A0-A7)', () => {
      engine.addBlock({ type: 'digital_read', params: { pin: 'A0' } });
      const errors = engine.validate();
      expect(errors.filter((e) => e.message.includes('Invalid pin'))).toHaveLength(0);
    });

    it('warns on analog_write value out of range', () => {
      engine.addBlock({ type: 'analog_write', params: { pin: '9', value: '300' } });
      const errors = engine.validate();
      expect(errors.some((e) => e.message.includes('0-255'))).toBe(true);
    });

    it('warns on long delay', () => {
      engine.addBlock({ type: 'delay', params: { ms: '60000' } });
      const errors = engine.validate();
      expect(errors.some((e) => e.message.includes('millis()'))).toBe(true);
    });

    it('warns on undeclared variable get', () => {
      engine.addBlock({ type: 'variable_get', params: { name: 'undeclaredVar' } });
      const errors = engine.validate();
      expect(errors.some((e) => e.message.includes('not been declared'))).toBe(true);
    });

    it('no warning when variable is declared', () => {
      engine.addBlock({ type: 'variable_set', params: { name: 'myVar', type: 'int', value: '0' } });
      engine.addBlock({ type: 'variable_get', params: { name: 'myVar' } });
      const errors = engine.validate();
      expect(errors.filter((e) => e.message.includes('not been declared'))).toHaveLength(0);
    });

    it('warns on empty control block body', () => {
      engine.addBlock({ type: 'if', params: { condition: 'true' } });
      const errors = engine.validate();
      expect(errors.some((e) => e.message.includes('no body'))).toBe(true);
    });

    it('no empty body warning for setup/loop', () => {
      engine.addBlock({ type: 'setup' });
      engine.addBlock({ type: 'loop' });
      const errors = engine.validate();
      expect(errors.filter((e) => e.message.includes('no body'))).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // C++ to blocks parser
  // -----------------------------------------------------------------------

  describe('parseCodeToBlocks', () => {
    it('parses basic blink sketch', () => {
      const code = `void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}`;
      const result = parseCodeToBlocks(code);
      expect(result.setupBlocks).toHaveLength(1);
      expect(result.setupBlocks[0].type).toBe('pin_mode');
      expect(result.loopBlocks).toHaveLength(4);
      expect(result.loopBlocks[0].type).toBe('digital_write');
      expect(result.loopBlocks[1].type).toBe('delay');
    });

    it('parses Serial.begin and Serial.println', () => {
      const code = `void setup() {
  Serial.begin(9600);
}

void loop() {
  Serial.println("Hello");
}`;
      const result = parseCodeToBlocks(code);
      expect(result.setupBlocks[0].type).toBe('serial_begin');
      expect(result.setupBlocks[0].params['baud']).toBe('9600');
      expect(result.loopBlocks[0].type).toBe('serial_print');
      expect(result.loopBlocks[0].params['newline']).toBe('yes');
    });

    it('parses Serial.print (no newline)', () => {
      const code = `void setup() {
}

void loop() {
  Serial.print("val: ");
}`;
      const result = parseCodeToBlocks(code);
      expect(result.loopBlocks[0].type).toBe('serial_print');
      expect(result.loopBlocks[0].params['newline']).toBe('no');
    });

    it('parses variable declarations', () => {
      const code = `void setup() {
  int count = 0;
  float voltage = 3.3;
}

void loop() {
}`;
      const result = parseCodeToBlocks(code);
      expect(result.setupBlocks).toHaveLength(2);
      expect(result.setupBlocks[0].type).toBe('variable_set');
      expect(result.setupBlocks[0].params['type']).toBe('int');
      expect(result.setupBlocks[0].params['name']).toBe('count');
      expect(result.setupBlocks[1].params['type']).toBe('float');
    });

    it('parses comments', () => {
      const code = `void setup() {
  // Initialize
}

void loop() {
}`;
      const result = parseCodeToBlocks(code);
      expect(result.setupBlocks[0].type).toBe('comment');
      expect(result.setupBlocks[0].params['text']).toBe('Initialize');
    });

    it('parses analogWrite', () => {
      const code = `void setup() {
}

void loop() {
  analogWrite(9, 128);
}`;
      const result = parseCodeToBlocks(code);
      expect(result.loopBlocks[0].type).toBe('analog_write');
      expect(result.loopBlocks[0].params['pin']).toBe('9');
    });

    it('falls back to raw_code for unknown statements', () => {
      const code = `void setup() {
  TCCR1A = 0;
}

void loop() {
}`;
      const result = parseCodeToBlocks(code);
      expect(result.setupBlocks[0].type).toBe('raw_code');
    });

    it('handles empty setup and loop', () => {
      const code = `void setup() {
}

void loop() {
}`;
      const result = parseCodeToBlocks(code);
      expect(result.setupBlocks).toHaveLength(0);
      expect(result.loopBlocks).toHaveLength(0);
    });

    it('handles code without setup or loop', () => {
      const result = parseCodeToBlocks('// just a comment');
      expect(result.setupBlocks).toHaveLength(0);
      expect(result.loopBlocks).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Import from C++
  // -----------------------------------------------------------------------

  describe('importFromCode', () => {
    it('imports a basic sketch', () => {
      const code = `void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
}`;
      engine.importFromCode(code);
      expect(engine.getBlockCount()).toBe(5); // setup + 1 child + loop + 2 children
      const result = engine.generateCode();
      expect(result.code).toContain('pinMode(13, OUTPUT)');
      expect(result.code).toContain('digitalWrite(13, HIGH)');
      expect(result.code).toContain('delay(1000)');
    });

    it('clears existing blocks before import', () => {
      engine.addBlock({ type: 'setup' });
      engine.addBlock({ type: 'loop' });
      engine.importFromCode(`void setup() {
}

void loop() {
}`);
      expect(engine.getBlockCount()).toBe(2); // just setup + loop
    });
  });

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  describe('clear', () => {
    it('clears all blocks', () => {
      engine.addBlock({ type: 'setup' });
      engine.addBlock({ type: 'loop' });
      engine.clear();
      expect(engine.getBlockCount()).toBe(0);
      expect(engine.getAllBlocks()).toHaveLength(0);
      expect(engine.getRootBlockIds()).toHaveLength(0);
    });

    it('clears declared variables', () => {
      engine.addBlock({ type: 'variable_set', params: { name: 'x', type: 'int', value: '0' } });
      engine.clear();
      expect(engine.getDeclaredVariables()).toHaveLength(0);
    });
  });

  describe('createBlinkProgram', () => {
    it('creates a valid blink program', () => {
      engine.createBlinkProgram();
      expect(engine.getBlockCount()).toBe(7); // setup + pin_mode + loop + high + delay1 + low + delay2
      const result = engine.generateCode();
      expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
    });
  });

  describe('getBlockCount', () => {
    it('returns correct count', () => {
      expect(engine.getBlockCount()).toBe(0);
      engine.addBlock({ type: 'setup' });
      expect(engine.getBlockCount()).toBe(1);
      engine.addBlock({ type: 'loop' });
      expect(engine.getBlockCount()).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // useBlockProgramming hook
  // -----------------------------------------------------------------------

  describe('useBlockProgramming', () => {
    it('is exported as a function', () => {
      expect(typeof useBlockProgramming).toBe('function');
    });
  });
});
