import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useWidgets, getWidgetsStorageKey, instanceMatchesView } from '../useWidgets';
import type { WidgetInstance } from '../widget.types';

const PROJECT_ID = 42;

function floatingInstance(overrides: Partial<WidgetInstance> = {}): Omit<WidgetInstance, 'instanceId'> {
  return {
    defId: 'notes',
    surface: 'floating',
    scope: 'pinned',
    rect: { x: 10, y: 10, w: 200, h: 150, z: 0, minimized: false },
    ...overrides,
  };
}

describe('useWidgets', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts empty and adds widgets with generated instance ids', () => {
    const { result } = renderHook(() => useWidgets(PROJECT_ID));
    expect(result.current.instances).toEqual([]);

    let created: WidgetInstance | undefined;
    act(() => {
      created = result.current.addWidget(floatingInstance());
    });

    expect(created!.instanceId).toBeTruthy();
    expect(result.current.instances).toHaveLength(1);
    expect(result.current.instances[0].defId).toBe('notes');
  });

  it('removes and updates widgets', () => {
    const { result } = renderHook(() => useWidgets(PROJECT_ID));
    let id = '';
    act(() => {
      id = result.current.addWidget(floatingInstance()).instanceId;
    });

    act(() => {
      result.current.updateWidget(id, { config: { text: 'hello' }, scope: 'global' });
    });
    expect(result.current.instances[0].config).toEqual({ text: 'hello' });
    expect(result.current.instances[0].scope).toBe('global');

    act(() => {
      result.current.removeWidget(id);
    });
    expect(result.current.instances).toEqual([]);
  });

  it('persists across hook remounts (round-trip)', () => {
    const first = renderHook(() => useWidgets(PROJECT_ID));
    act(() => {
      first.result.current.addWidget(floatingInstance({ config: { text: 'persisted' } }));
    });
    first.unmount();

    const second = renderHook(() => useWidgets(PROJECT_ID));
    expect(second.result.current.instances).toHaveLength(1);
    expect(second.result.current.instances[0].config).toEqual({ text: 'persisted' });
  });

  it('isolates state per project key', () => {
    const a = renderHook(() => useWidgets(1));
    act(() => {
      a.result.current.addWidget(floatingInstance());
    });
    a.unmount();

    const b = renderHook(() => useWidgets(2));
    expect(b.result.current.instances).toEqual([]);
    expect(getWidgetsStorageKey(1)).not.toBe(getWidgetsStorageKey(2));
  });

  it('recovers from corrupt payloads without throwing', () => {
    window.localStorage.setItem(getWidgetsStorageKey(PROJECT_ID), '{not json');
    const { result } = renderHook(() => useWidgets(PROJECT_ID));
    expect(result.current.instances).toEqual([]);
  });

  it('rejects payloads with the wrong version or shape', () => {
    window.localStorage.setItem(
      getWidgetsStorageKey(PROJECT_ID),
      JSON.stringify({ version: 999, instances: [floatingInstance()] }),
    );
    const { result } = renderHook(() => useWidgets(PROJECT_ID));
    expect(result.current.instances).toEqual([]);
  });

  describe('scope filtering via instancesFor', () => {
    it('matches global and pinned on every view, view-lists only on listed views', () => {
      const { result } = renderHook(() => useWidgets(PROJECT_ID));
      act(() => {
        result.current.addWidget(floatingInstance({ scope: 'global' }));
        result.current.addWidget(floatingInstance({ scope: 'pinned' }));
        result.current.addWidget(floatingInstance({ scope: { views: ['pcb', 'schematic'] } }));
        result.current.addWidget(floatingInstance({ surface: 'dashboard', scope: 'global' }));
      });

      expect(result.current.instancesFor('floating', 'pcb')).toHaveLength(3);
      expect(result.current.instancesFor('floating', 'breadboard')).toHaveLength(2);
      expect(result.current.instancesFor('dashboard', 'pcb')).toHaveLength(1);
    });

    it('instanceMatchesView treats view-scoped instances as hidden with no active view', () => {
      const scoped: WidgetInstance = {
        instanceId: 'x',
        ...floatingInstance({ scope: { views: ['pcb'] } }),
      };
      expect(instanceMatchesView(scoped)).toBe(false);
      expect(instanceMatchesView(scoped, 'pcb')).toBe(true);
      expect(instanceMatchesView({ ...scoped, scope: 'pinned' })).toBe(true);
    });
  });
});
