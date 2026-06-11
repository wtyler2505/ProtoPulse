import { afterEach, describe, expect, it } from 'vitest';
import { getSchematicCanvasMode } from '@/lib/schematic-canvas-mode';

describe('getSchematicCanvasMode', () => {
  afterEach(() => {
    delete (globalThis as { __PROTOPULSE_FLAGS__?: unknown }).__PROTOPULSE_FLAGS__;
  });

  it('defaults to tscircuit when no override exists', () => {
    expect(getSchematicCanvasMode()).toBe('tscircuit');
  });

  it('ignores window override when provided', () => {
    (globalThis as { __PROTOPULSE_FLAGS__?: { schematicCanvasMode?: string } }).__PROTOPULSE_FLAGS__ = {
      schematicCanvasMode: 'reactflow',
    };
    expect(getSchematicCanvasMode()).toBe('tscircuit');
  });

  it('stays on tscircuit for unknown window override values', () => {
    (globalThis as { __PROTOPULSE_FLAGS__?: { schematicCanvasMode?: string } }).__PROTOPULSE_FLAGS__ = {
      schematicCanvasMode: 'invalid-mode',
    };
    expect(getSchematicCanvasMode()).toBe('tscircuit');
  });
});
