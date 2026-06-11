import { describe, expect, it } from 'vitest';
import {
  getUrlWorkspaceView,
  normalizeWorkspacePath,
  parseWorkspaceProjectRoute,
} from '@/lib/workspace-route';

describe('workspace-route helpers', () => {
  it('parses canonical workspace routes', () => {
    expect(parseWorkspaceProjectRoute('/projects/42/schematic')).toEqual({
      projectId: 42,
      viewName: 'schematic',
      canonicalPath: '/projects/42/schematic',
    });
  });

  it('canonicalizes malformed duplicated workspace routes to the latest valid segment', () => {
    expect(parseWorkspaceProjectRoute('/projects/42/architecture/projects/42/schematic')).toEqual({
      projectId: 42,
      viewName: 'schematic',
      canonicalPath: '/projects/42/schematic',
    });
  });

  it('supports hash-router deep links', () => {
    expect(normalizeWorkspacePath('http://localhost:5173/#/projects/7/schematic?x=1')).toBe('/projects/7/schematic');
  });

  it('extracts current view when present', () => {
    expect(getUrlWorkspaceView('/projects/12/architecture')).toBe('architecture');
    expect(getUrlWorkspaceView('/projects/12')).toBeUndefined();
  });
});
