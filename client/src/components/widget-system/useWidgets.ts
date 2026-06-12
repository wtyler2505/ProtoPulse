import { useCallback, useEffect, useRef, useState } from 'react';
import { getProjectScopedStorageKey } from '@/lib/client-state-scope';
import type { WidgetInstance, WidgetSurface } from './widget.types';

/**
 * Widget instance state + persistence.
 *
 * Phase 1: standalone hook persisting to project-scoped localStorage — the
 * exact pattern workspace-reducer.ts uses. The feasibility doc's end-state is
 * to fold `widgets[]` INTO workspace-reducer (and later back it with server
 * prefs / Tauri store); the payload format here is versioned so that
 * migration needs no storage-format change.
 */

const WIDGETS_STORAGE_BASE_KEY = 'protopulse-widgets';
const PAYLOAD_VERSION = 1;

interface PersistedWidgetsPayload {
  version: number;
  instances: WidgetInstance[];
}

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getWidgetsStorageKey(projectId: number): string {
  return getProjectScopedStorageKey(WIDGETS_STORAGE_BASE_KEY, projectId);
}

function loadInstances(projectId: number): WidgetInstance[] {
  if (!hasLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(getWidgetsStorageKey(projectId));
    if (!raw) return [];
    const payload = JSON.parse(raw) as Partial<PersistedWidgetsPayload> | null;
    if (!payload || payload.version !== PAYLOAD_VERSION || !Array.isArray(payload.instances)) {
      return [];
    }
    return payload.instances.filter(
      (inst): inst is WidgetInstance =>
        typeof inst === 'object' &&
        inst !== null &&
        typeof inst.instanceId === 'string' &&
        typeof inst.defId === 'string' &&
        (inst.surface === 'dashboard' || inst.surface === 'floating'),
    );
  } catch {
    // Corrupt payload — recover to empty state, never throw.
    return [];
  }
}

function persistInstances(projectId: number, instances: WidgetInstance[]): void {
  if (!hasLocalStorage()) return;
  try {
    const payload: PersistedWidgetsPayload = { version: PAYLOAD_VERSION, instances };
    window.localStorage.setItem(getWidgetsStorageKey(projectId), JSON.stringify(payload));
  } catch {
    // Quota/serialization failure must never crash the workspace.
  }
}

function createInstanceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Does this instance appear on the given view? */
export function instanceMatchesView(instance: WidgetInstance, activeView?: string): boolean {
  if (instance.scope === 'global' || instance.scope === 'pinned') return true;
  if (!activeView) return false;
  return instance.scope.views.includes(activeView);
}

export interface UseWidgetsResult {
  instances: WidgetInstance[];
  addWidget(instance: Omit<WidgetInstance, 'instanceId'> & { instanceId?: string }): WidgetInstance;
  removeWidget(instanceId: string): void;
  updateWidget(instanceId: string, patch: Partial<Omit<WidgetInstance, 'instanceId'>>): void;
  instancesFor(surface: WidgetSurface, activeView?: string): WidgetInstance[];
}

export function useWidgets(projectId: number): UseWidgetsResult {
  const [instances, setInstances] = useState<WidgetInstance[]>(() => loadInstances(projectId));
  const projectIdRef = useRef(projectId);

  // Reload when switching projects (storage keys are project-scoped).
  useEffect(() => {
    if (projectIdRef.current !== projectId) {
      projectIdRef.current = projectId;
      setInstances(loadInstances(projectId));
    }
  }, [projectId]);

  useEffect(() => {
    persistInstances(projectIdRef.current, instances);
  }, [instances]);

  const addWidget = useCallback<UseWidgetsResult['addWidget']>((instance) => {
    const created: WidgetInstance = {
      ...instance,
      instanceId: instance.instanceId ?? createInstanceId(),
    };
    setInstances((prev) => [...prev, created]);
    return created;
  }, []);

  const removeWidget = useCallback((instanceId: string) => {
    setInstances((prev) => prev.filter((inst) => inst.instanceId !== instanceId));
  }, []);

  const updateWidget = useCallback(
    (instanceId: string, patch: Partial<Omit<WidgetInstance, 'instanceId'>>) => {
      setInstances((prev) =>
        prev.map((inst) => (inst.instanceId === instanceId ? { ...inst, ...patch } : inst)),
      );
    },
    [],
  );

  const instancesFor = useCallback(
    (surface: WidgetSurface, activeView?: string) =>
      instances.filter(
        (inst) => inst.surface === surface && instanceMatchesView(inst, activeView),
      ),
    [instances],
  );

  return { instances, addWidget, removeWidget, updateWidget, instancesFor };
}
