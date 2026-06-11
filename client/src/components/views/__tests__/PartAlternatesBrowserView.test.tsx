import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PartAlternatesBrowserView from '../PartAlternatesBrowserView';

const mockUseAlternatesBrowse = vi.fn();
const mockUsePartAlternates = vi.fn();

vi.mock('@/lib/parts/use-alternates-browse', () => ({
  useAlternatesBrowse: () => mockUseAlternatesBrowse(),
}));

vi.mock('@/lib/parts/use-part-alternates', () => ({
  usePartAlternates: (...args: unknown[]) => mockUsePartAlternates(...args),
}));

const BROWSE_ROWS = [
  {
    part: {
      id: 'part-1',
      slug: 'resistor-10k',
      title: '10K Resistor',
      manufacturer: 'Stackpole',
      mpn: 'RMCF0402FT10K0',
      category: 'resistor',
      trustLevel: 'verified',
    },
    alternateCount: 1,
  },
];

const ALTERNATES = [
  {
    id: 'alt-1',
    slug: 'yageo-rc0402',
    title: 'Yageo RC0402FR-0710KL',
    description: null,
    manufacturer: 'Yageo',
    mpn: 'RC0402FR-0710KL',
    canonicalCategory: 'resistor',
    packageType: '0402',
    tolerance: '1%',
    esdSensitive: null,
    assemblyCategory: 'smt',
    meta: {},
    connectors: [],
    datasheetUrl: null,
    manufacturerUrl: null,
    origin: 'library',
    originRef: null,
    forkedFromId: null,
    authorUserId: null,
    isPublic: true,
    trustLevel: 'library',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    matchScore: 0.92,
  },
];

describe('PartAlternatesBrowserView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders trust, score, reason, and tradeoff details for expanded alternates', async () => {
    mockUseAlternatesBrowse.mockReturnValue({
      data: BROWSE_ROWS,
      isLoading: false,
      error: null,
    });
    mockUsePartAlternates.mockImplementation((partId: string | null) => ({
      data: partId ? ALTERNATES : undefined,
      isLoading: false,
    }));

    render(<PartAlternatesBrowserView />);

    expect(screen.getByTestId('alt-source-trust-part-1').textContent).toContain('verified');

    fireEvent.click(screen.getByTestId('alt-group-part-1'));

    expect(await screen.findByTestId('alt-item-alt-1')).toBeInTheDocument();
    expect(screen.getByTestId('alt-match-alt-1').textContent).toBe('92% match');
    expect(screen.getByTestId('alt-trust-alt-1').textContent).toContain('library');
    expect(screen.getByTestId('alt-reason-alt-1').textContent).toContain('Strong catalog match');
    expect(screen.getByTestId('alt-tradeoff-alt-1').textContent).toContain('trust source is library');
  });
});
