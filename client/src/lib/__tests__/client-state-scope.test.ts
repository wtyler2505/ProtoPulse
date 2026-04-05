import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearStorageEntriesByPrefix,
  getCurrentClientStateScope,
  getProjectScopedStorageKey,
  getScopedStorageKey,
} from '@/lib/client-state-scope';

describe('client-state-scope', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to anonymous scope when no session exists', () => {
    expect(getCurrentClientStateScope()).toBe('anonymous');
  });

  it('uses the current session id as the client state scope', () => {
    localStorage.setItem('protopulse-session-id', 'session-123');

    expect(getCurrentClientStateScope()).toBe('session-123');
  });

  it('builds scoped storage keys from the active scope', () => {
    localStorage.setItem('protopulse-session-id', 'session-abc');

    expect(getScopedStorageKey('protopulse-last-project')).toBe('protopulse-last-project:session-abc');
  });

  it('builds project-scoped storage keys from the active scope and project id', () => {
    localStorage.setItem('protopulse-session-id', 'session-xyz');

    expect(getProjectScopedStorageKey('protopulse-panel-layout', 42)).toBe(
      'protopulse-panel-layout:session-xyz:42',
    );
  });

  it('clears every storage entry with the requested prefix', () => {
    localStorage.setItem('protopulse-last-project', '1');
    localStorage.setItem('protopulse-last-project:scope-a', '2');
    localStorage.setItem('protopulse-last-project:scope-b', '3');
    localStorage.setItem('protopulse-panel-layout:scope-a:9', 'keep');

    clearStorageEntriesByPrefix('protopulse-last-project');

    expect(localStorage.getItem('protopulse-last-project')).toBeNull();
    expect(localStorage.getItem('protopulse-last-project:scope-a')).toBeNull();
    expect(localStorage.getItem('protopulse-last-project:scope-b')).toBeNull();
    expect(localStorage.getItem('protopulse-panel-layout:scope-a:9')).toBe('keep');
  });
});
