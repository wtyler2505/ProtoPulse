import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../ai-tools/registry';
import type { ToolDefinition, ToolContext, ToolResult } from '../ai-tools/types';

// =============================================================================
// Helpers
// =============================================================================

function makeToolContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
    projectId: 1,
    storage: {} as ToolContext['storage'],
    ...overrides,
  };
}

function makeTool(overrides?: Partial<ToolDefinition>): ToolDefinition {
  return {
    name: 'test_tool',
    description: 'A test tool',
    category: 'architecture',
    parameters: z.object({ value: z.string() }),
    execute: async (): Promise<ToolResult> => ({
      success: true,
      message: 'executed',
    }),
    requiresConfirmation: false,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('ToolRegistry — requiresConfirmation server-side enforcement', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  // ---------------------------------------------------------------------------
  // Non-destructive tools (requiresConfirmation = false)
  // ---------------------------------------------------------------------------

  it('executes non-destructive tool without confirmed flag', async () => {
    const tool = makeTool({ name: 'safe_tool', requiresConfirmation: false });
    registry.register(tool);

    const result = await registry.execute('safe_tool', { value: 'test' }, makeToolContext());
    expect(result.success).toBe(true);
    expect(result.message).toBe('executed');
  });

  it('executes non-destructive tool with confirmed=false', async () => {
    const tool = makeTool({ name: 'safe_tool2', requiresConfirmation: false });
    registry.register(tool);

    const result = await registry.execute('safe_tool2', { value: 'test' }, makeToolContext({ confirmed: false }));
    expect(result.success).toBe(true);
    expect(result.message).toBe('executed');
  });

  // ---------------------------------------------------------------------------
  // Destructive tools (requiresConfirmation = true)
  // ---------------------------------------------------------------------------

  it('blocks destructive tool when confirmed is undefined', async () => {
    const tool = makeTool({ name: 'delete_all', requiresConfirmation: true });
    registry.register(tool);

    const result = await registry.execute('delete_all', { value: 'test' }, makeToolContext());
    expect(result.success).toBe(false);
    expect(result.message).toContain('requires user confirmation');
    expect(result.message).toContain('delete_all');
    expect(result.data).toEqual({ requiresConfirmation: true, toolName: 'delete_all' });
  });

  it('blocks destructive tool when confirmed is false', async () => {
    const tool = makeTool({ name: 'clear_bom', requiresConfirmation: true });
    registry.register(tool);

    const result = await registry.execute('clear_bom', { value: 'test' }, makeToolContext({ confirmed: false }));
    expect(result.success).toBe(false);
    expect(result.message).toContain('requires user confirmation');
    expect(result.data).toEqual({ requiresConfirmation: true, toolName: 'clear_bom' });
  });

  it('executes destructive tool when confirmed is true', async () => {
    const tool = makeTool({ name: 'delete_node', requiresConfirmation: true });
    registry.register(tool);

    const result = await registry.execute('delete_node', { value: 'test' }, makeToolContext({ confirmed: true }));
    expect(result.success).toBe(true);
    expect(result.message).toBe('executed');
  });

  // ---------------------------------------------------------------------------
  // Validation still happens before confirmation check
  // ---------------------------------------------------------------------------

  it('returns validation error before confirmation check for invalid params', async () => {
    const tool = makeTool({ name: 'destructive', requiresConfirmation: true });
    registry.register(tool);

    // Pass invalid params (missing required 'value' field)
    const result = await registry.execute('destructive', {}, makeToolContext());
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid params');
  });

  it('returns unknown tool error before confirmation check', async () => {
    const result = await registry.execute('nonexistent', {}, makeToolContext({ confirmed: true }));
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown tool');
  });

  // ---------------------------------------------------------------------------
  // getDestructiveTools
  // ---------------------------------------------------------------------------

  it('getDestructiveTools returns only tools with requiresConfirmation=true', () => {
    registry.register(makeTool({ name: 'safe1', requiresConfirmation: false }));
    registry.register(makeTool({ name: 'safe2', requiresConfirmation: false }));
    registry.register(makeTool({ name: 'dangerous1', requiresConfirmation: true }));
    registry.register(makeTool({ name: 'dangerous2', requiresConfirmation: true }));

    const destructive = registry.getDestructiveTools();
    expect(destructive).toEqual(['dangerous1', 'dangerous2']);
  });

  // ---------------------------------------------------------------------------
  // Executor function is NOT called when confirmation blocked
  // ---------------------------------------------------------------------------

  it('does NOT invoke the executor when confirmation is missing', async () => {
    let executorCalled = false;
    const tool = makeTool({
      name: 'track_call',
      requiresConfirmation: true,
      execute: async (): Promise<ToolResult> => {
        executorCalled = true;
        return { success: true, message: 'should not run' };
      },
    });
    registry.register(tool);

    await registry.execute('track_call', { value: 'test' }, makeToolContext());
    expect(executorCalled).toBe(false);
  });

  it('invokes the executor when confirmation is provided', async () => {
    let executorCalled = false;
    const tool = makeTool({
      name: 'track_call2',
      requiresConfirmation: true,
      execute: async (): Promise<ToolResult> => {
        executorCalled = true;
        return { success: true, message: 'ran' };
      },
    });
    registry.register(tool);

    await registry.execute('track_call2', { value: 'test' }, makeToolContext({ confirmed: true }));
    expect(executorCalled).toBe(true);
  });
});

// =============================================================================
// ToolContext.confirmed field type tests
// =============================================================================

describe('ToolContext — confirmed field', () => {
  it('accepts confirmed=true', () => {
    const ctx: ToolContext = { projectId: 1, storage: {} as ToolContext['storage'], confirmed: true };
    expect(ctx.confirmed).toBe(true);
  });

  it('accepts confirmed=false', () => {
    const ctx: ToolContext = { projectId: 1, storage: {} as ToolContext['storage'], confirmed: false };
    expect(ctx.confirmed).toBe(false);
  });

  it('accepts confirmed=undefined (optional field)', () => {
    const ctx: ToolContext = { projectId: 1, storage: {} as ToolContext['storage'] };
    expect(ctx.confirmed).toBeUndefined();
  });
});
