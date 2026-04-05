import { describe, expect, it } from 'vitest';

import type { Project } from '@shared/schema';
import { findProjectListAnomalies } from '../project-list-sanity';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: 'Healthy Project',
    description: 'A healthy active project',
    ownerId: 7,
    version: 1,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    deletedAt: null,
    approvedAt: null,
    approvedBy: null,
    ...overrides,
  };
}

describe('findProjectListAnomalies', () => {
  it('returns no anomalies for healthy active projects', () => {
    expect(findProjectListAnomalies([makeProject(), makeProject({ id: 2, name: 'Another Project' })])).toEqual([]);
  });

  it('flags ownerless and soft-deleted projects', () => {
    expect(
      findProjectListAnomalies([
        makeProject({ id: 2, ownerId: null, deletedAt: new Date('2026-04-01T01:00:00.000Z') }),
      ]),
    ).toEqual([
      {
        projectId: 2,
        issues: ['soft-deleted project leaked into active list', 'owner missing'],
      },
    ]);
  });

  it('flags duplicate ids and blank names', () => {
    expect(
      findProjectListAnomalies([
        makeProject({ id: 5, name: '   ' }),
        makeProject({ id: 5, name: 'Duplicate' }),
      ]),
    ).toEqual([
      {
        projectId: 5,
        issues: ['blank project name', 'duplicate project id in list'],
      },
      {
        projectId: 5,
        issues: ['duplicate project id in list'],
      },
    ]);
  });
});
