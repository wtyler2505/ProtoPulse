import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import CommunityView from '../CommunityView';
import { readViewer3DBridgeTarget } from '@/lib/viewer-3d-bridge';
import type { CommunityComponent } from '@/lib/community-library';

const mockSetActiveView = vi.fn();

const model3d: CommunityComponent = {
  id: 'seed-dip8-3d',
  name: 'DIP-8 3D Package',
  description: 'Accurate 3D model of a DIP-8 package.',
  type: '3d-model',
  category: 'Packages',
  tags: ['dip', 'package'],
  author: { id: 'community-4', name: '3DModelPro', reputation: 78 },
  version: '1.0.0',
  license: 'CC-BY',
  downloads: 120,
  rating: 4.8,
  ratingCount: 12,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  size: 4096,
  data: { format: 'STEP', pinCount: 8 },
  dependencies: [],
  compatibility: ['protopulse'],
};

vi.mock('@/components/ui/vault-hover-card', () => ({
  VaultHoverCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/community-library', async () => {
  const actual = await vi.importActual<typeof import('@/lib/community-library')>('@/lib/community-library');
  return {
    ...actual,
    useCommunityLibrary: () => ({
      components: [model3d],
      search: vi.fn(() => ({
        components: [model3d],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        facets: { types: [], categories: [], licenses: [] },
      })),
      rateComponent: vi.fn(),
      downloadComponent: vi.fn(),
      collections: [],
      createCollection: vi.fn(),
      deleteCollection: vi.fn(),
      featured: [],
      trending: [],
      newArrivals: [],
      stats: { totalComponents: 1, totalDownloads: 120, totalAuthors: 1 },
    }),
  };
});

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    addBomItem: vi.fn(),
  }),
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 99,
}));

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({
    activeView: 'community',
    setActiveView: mockSetActiveView,
    projectName: 'Test Project',
    setProjectName: vi.fn(),
    projectDescription: '',
    setProjectDescription: vi.fn(),
    schematicSheets: [],
    activeSheetId: 'top',
    setActiveSheetId: vi.fn(),
    isLoading: false,
    projectNotFound: false,
  }),
}));

describe('CommunityView 3D bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it('hands a selected community 3D model into the 3D viewer', () => {
    render(<CommunityView />);

    fireEvent.click(screen.getByTestId('community-card-seed-dip8-3d'));
    fireEvent.click(screen.getByTestId('detail-view-3d-btn'));

    expect(mockSetActiveView).toHaveBeenCalledWith('viewer_3d');
    expect(readViewer3DBridgeTarget()).toMatchObject({
      sourceView: 'community',
      projectId: 99,
      sourceId: 'seed-dip8-3d',
      title: 'DIP-8 3D Package',
      sourceName: '3DModelPro',
      sourceTrustScore: 78,
      trustTier: 'community',
      verificationLevel: 'community-only',
      verificationStatus: 'candidate',
      readyNow: true,
      modelFormat: 'STEP',
      modelKind: '3d-model',
    });
  });
});
