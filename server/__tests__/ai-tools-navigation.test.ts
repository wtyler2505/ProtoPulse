import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../ai-tools/registry';
import { registerNavigationTools } from '../ai-tools/navigation';
import type { ToolContext } from '../ai-tools/types';
import type { IStorage } from '../storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerNavigationTools(registry);
  return registry;
}

function createCtx(): ToolContext {
  return {
    projectId: 1,
    storage: {} as IStorage,
    confirmed: true,
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('Navigation tools — registration', () => {
  const registry = createRegistry();

  const expectedTools = ['switch_view', 'switch_schematic_sheet'];

  it.each(expectedTools)('registers "%s"', (name) => {
    expect(registry.get(name)).toBeDefined();
  });

  it('all navigation tools have category "navigation"', () => {
    const navTools = registry.getByCategory('navigation');
    expect(navTools.length).toBe(expectedTools.length);
    for (const tool of navTools) {
      expect(tool.category).toBe('navigation');
    }
  });

  it('no navigation tools are marked destructive', () => {
    const destructive = registry.getDestructiveTools();
    expect(destructive).not.toContain('switch_view');
    expect(destructive).not.toContain('switch_schematic_sheet');
  });
});

// ---------------------------------------------------------------------------
// Parameter validation — switch_view
// ---------------------------------------------------------------------------

describe('Navigation tools — switch_view parameter validation', () => {
  const registry = createRegistry();

  const validViews = [
    'architecture',
    'schematic',
    'procurement',
    'validation',
    'output',
    'project_explorer',
  ];

  it.each(validViews)('accepts valid view "%s"', (view) => {
    const result = registry.validate('switch_view', { view });
    expect(result.ok).toBe(true);
  });

  it('rejects invalid view name', () => {
    const result = registry.validate('switch_view', { view: 'settings' });
    expect(result.ok).toBe(false);
  });

  it('rejects empty view', () => {
    const result = registry.validate('switch_view', { view: '' });
    expect(result.ok).toBe(false);
  });

  it('rejects missing view parameter', () => {
    const result = registry.validate('switch_view', {});
    expect(result.ok).toBe(false);
  });

  it('rejects numeric view', () => {
    const result = registry.validate('switch_view', { view: 123 });
    expect(result.ok).toBe(false);
  });

  it('rejects view with extra spaces', () => {
    const result = registry.validate('switch_view', { view: ' architecture ' });
    expect(result.ok).toBe(false);
  });

  it('is case-sensitive (rejects uppercase)', () => {
    const result = registry.validate('switch_view', { view: 'Architecture' });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Parameter validation — switch_schematic_sheet
// ---------------------------------------------------------------------------

describe('Navigation tools — switch_schematic_sheet parameter validation', () => {
  const registry = createRegistry();

  it('accepts valid sheetId', () => {
    const result = registry.validate('switch_schematic_sheet', { sheetId: 'sheet-1' });
    expect(result.ok).toBe(true);
  });

  it('accepts UUID sheetId', () => {
    const result = registry.validate('switch_schematic_sheet', {
      sheetId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects missing sheetId', () => {
    const result = registry.validate('switch_schematic_sheet', {});
    expect(result.ok).toBe(false);
  });

  it('rejects empty sheetId', () => {
    const result = registry.validate('switch_schematic_sheet', { sheetId: '' });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Execution — switch_view
// ---------------------------------------------------------------------------

describe('Navigation tools — switch_view execution', () => {
  let registry: ToolRegistry;
  let ctx: ToolContext;

  beforeEach(() => {
    registry = createRegistry();
    ctx = createCtx();
  });

  it('returns success with client action for valid view', async () => {
    const result = await registry.execute('switch_view', { view: 'architecture' }, ctx);

    expect(result.success).toBe(true);
    expect(result.message).toContain('switch_view');
    expect(result.data).toMatchObject({ type: 'switch_view', view: 'architecture' });
  });

  it.each([
    'architecture',
    'schematic',
    'procurement',
    'validation',
    'output',
    'project_explorer',
  ] as const)('executes switch to "%s" view', async (view) => {
    const result = await registry.execute('switch_view', { view }, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ type: 'switch_view', view });
  });

  it('returns error for invalid view without data', async () => {
    const result = await registry.execute('switch_view', { view: 'invalid' }, ctx);

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Execution — switch_schematic_sheet
// ---------------------------------------------------------------------------

describe('Navigation tools — switch_schematic_sheet execution', () => {
  let registry: ToolRegistry;
  let ctx: ToolContext;

  beforeEach(() => {
    registry = createRegistry();
    ctx = createCtx();
  });

  it('returns success with client action for valid sheetId', async () => {
    const result = await registry.execute(
      'switch_schematic_sheet',
      { sheetId: 'sheet-power-supply' },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      type: 'switch_schematic_sheet',
      sheetId: 'sheet-power-supply',
    });
  });

  it('returns error for empty sheetId', async () => {
    const result = await registry.execute(
      'switch_schematic_sheet',
      { sheetId: '' },
      ctx,
    );

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full registry integration — ensures navigation tools coexist
// ---------------------------------------------------------------------------

describe('Navigation tools — full registry integration', () => {
  it('navigation tools work alongside other categories', () => {
    const registry = new ToolRegistry();
    registerNavigationTools(registry);

    // Can retrieve by category
    const navTools = registry.getByCategory('navigation');
    expect(navTools).toHaveLength(2);

    // Does not conflict with other categories
    const archTools = registry.getByCategory('architecture');
    expect(archTools).toHaveLength(0);
  });

  it('toAnthropicTools includes navigation tools', () => {
    const registry = createRegistry();
    const anthropicTools = registry.toAnthropicTools();

    expect(anthropicTools.length).toBe(2);
    const names = anthropicTools.map((t) => t.name);
    expect(names).toContain('switch_view');
    expect(names).toContain('switch_schematic_sheet');

    for (const tool of anthropicTools) {
      expect(tool.input_schema).toBeDefined();
      expect(tool.description).toBeDefined();
    }
  });

  it('toGeminiFunctionDeclarations includes navigation tools', () => {
    const registry = createRegistry();
    const geminiTools = registry.toGeminiFunctionDeclarations();

    expect(geminiTools.length).toBe(2);
    const names = geminiTools.map((t) => t.name);
    expect(names).toContain('switch_view');
    expect(names).toContain('switch_schematic_sheet');

    for (const tool of geminiTools) {
      expect(tool.parameters).toBeDefined();
      expect(tool.description).toBeDefined();
    }
  });
});
