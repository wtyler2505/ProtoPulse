import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import {
  invalidateAfterToolCalls,
  TOOL_INVALIDATION_MAP,
  SCORCHED_EARTH_TOOLS,
} from '../chat-cache-invalidation';
import type { ToolCallInfo } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type MockQueryClient = Pick<QueryClient, 'invalidateQueries'> & {
  invalidateQueries: ReturnType<typeof vi.fn>;
};

function makeClient(): MockQueryClient {
  return { invalidateQueries: vi.fn().mockResolvedValue(undefined) } as unknown as MockQueryClient;
}

function makeToolCall(name: string): ToolCallInfo {
  return {
    id: `id-${name}`,
    name,
    input: {},
    result: { success: true, message: 'ok' },
  };
}

const PROJECT_ID = 42;

// ---------------------------------------------------------------------------
// invalidateAfterToolCalls
// ---------------------------------------------------------------------------

describe('invalidateAfterToolCalls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when toolCalls is empty', () => {
    const qc = makeClient();
    invalidateAfterToolCalls(qc, PROJECT_ID, []);
    expect(qc.invalidateQueries).not.toHaveBeenCalled();
  });

  it('does nothing when toolCalls is undefined', () => {
    const qc = makeClient();
    invalidateAfterToolCalls(qc, PROJECT_ID, undefined);
    expect(qc.invalidateQueries).not.toHaveBeenCalled();
  });

  it('invalidates only the BOM prefix for a single add_bom_item call', () => {
    const qc = makeClient();
    invalidateAfterToolCalls(qc, PROJECT_ID, [makeToolCall('add_bom_item')]);
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/projects'] });
  });

  it('dedupes identical prefixes across multiple tools in the same family', () => {
    const qc = makeClient();
    invalidateAfterToolCalls(qc, PROJECT_ID, [
      makeToolCall('add_bom_item'),
      makeToolCall('update_bom_item'),
      makeToolCall('remove_bom_item'),
    ]);
    // All three share the '/api/projects' prefix → one call only.
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/projects'] });
  });

  it('invalidates the union of prefixes for tools from different families', () => {
    const qc = makeClient();
    invalidateAfterToolCalls(qc, PROJECT_ID, [
      makeToolCall('add_bom_item'),          // /api/projects
      makeToolCall('create_circuit'),        // circuit-designs, circuit-roots
      makeToolCall('delete_component_part'), // component-parts, component-library, parts
    ]);
    const keys = qc.invalidateQueries.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0]);
    expect(new Set(keys)).toEqual(
      new Set([
        '/api/projects',
        'circuit-designs',
        'circuit-roots',
        'component-parts',
        'component-library',
        'parts',
      ]),
    );
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(6);
  });

  it('triggers a full (scorched-earth) invalidation when clear_canvas is present', () => {
    const qc = makeClient();
    invalidateAfterToolCalls(qc, PROJECT_ID, [
      makeToolCall('add_bom_item'),
      makeToolCall('clear_canvas'),
    ]);
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(qc.invalidateQueries).toHaveBeenCalledWith();
  });

  it('triggers a full invalidation for generate_architecture', () => {
    const qc = makeClient();
    invalidateAfterToolCalls(qc, PROJECT_ID, [makeToolCall('generate_architecture')]);
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(qc.invalidateQueries).toHaveBeenCalledWith();
  });

  it('triggers a full invalidation and warns for unknown tool names (fail-safe)', () => {
    const qc = makeClient();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    invalidateAfterToolCalls(qc, PROJECT_ID, [makeToolCall('brand_new_unmapped_tool')]);
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(qc.invalidateQueries).toHaveBeenCalledWith();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/brand_new_unmapped_tool/);
  });

  it('does NOT invalidate anything for read-only tools with empty prefix list', () => {
    const qc = makeClient();
    invalidateAfterToolCalls(qc, PROJECT_ID, [
      makeToolCall('query_nodes'),
      makeToolCall('search_parts'),
      makeToolCall('export_bom_csv'),
    ]);
    expect(qc.invalidateQueries).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Static map sanity checks
// ---------------------------------------------------------------------------

describe('TOOL_INVALIDATION_MAP / SCORCHED_EARTH_TOOLS', () => {
  it('lists the core scorched-earth tools', () => {
    expect(SCORCHED_EARTH_TOOLS.has('clear_canvas')).toBe(true);
    expect(SCORCHED_EARTH_TOOLS.has('generate_architecture')).toBe(true);
    expect(SCORCHED_EARTH_TOOLS.has('restore_snapshot')).toBe(true);
  });

  it('maps core BOM mutation tools', () => {
    expect(TOOL_INVALIDATION_MAP.add_bom_item).toContain('/api/projects');
    expect(TOOL_INVALIDATION_MAP.update_bom_item).toContain('/api/projects');
    expect(TOOL_INVALIDATION_MAP.remove_bom_item).toContain('/api/projects');
  });

  it('maps circuit tools to circuit-* prefixes', () => {
    expect(TOOL_INVALIDATION_MAP.create_circuit).toContain('circuit-designs');
    expect(TOOL_INVALIDATION_MAP.draw_net).toContain('circuit-nets');
  });
});
