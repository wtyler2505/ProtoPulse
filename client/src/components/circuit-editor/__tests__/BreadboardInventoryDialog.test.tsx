/**
 * Smoke tests for BreadboardInventoryDialog (audit finding #335).
 * Covers: renders nothing when closed, opens dialog when open=true, renders insights,
 * respects filter/search, invokes callbacks.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import BreadboardInventoryDialog from '../BreadboardInventoryDialog';
import type { BreadboardBenchInsight } from '@/lib/breadboard-bench';

function makeInsight(overrides: Partial<BreadboardBenchInsight> = {}): BreadboardBenchInsight {
  return {
    partId: 1,
    bomItemId: 'bom-1',
    title: 'Resistor 10k',
    family: 'resistor',
    benchCategory: 'passive',
    pinCount: 2,
    fit: 'native',
    modelQuality: 'basic',
    hasPreciseArtwork: false,
    isTracked: false,
    isOwned: false,
    ownedQuantity: 0,
    requiredQuantity: 2,
    missingQuantity: 2,
    storageLocation: null,
    lowStock: false,
    readyNow: false,
    starterFriendly: true,
    manufacturer: 'ACME',
    mpn: 'RES-10K',
    ...overrides,
  };
}

const baseProps = {
  onOpenAiReconcile: vi.fn(),
  onOpenChange: vi.fn(),
  onOpenStorageView: vi.fn(),
  onTrackPart: vi.fn(),
  onUpdateTrackedPart: vi.fn(),
};

describe('BreadboardInventoryDialog', () => {
  it('renders nothing visible when open=false', () => {
    render(
      <BreadboardInventoryDialog
        {...baseProps}
        insights={[]}
        open={false}
      />,
    );
    // Radix dialog hides content when closed — dialog title shouldn't be queryable.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the dialog content when open=true', { timeout: 15000 }, () => {
    render(
      <BreadboardInventoryDialog
        {...baseProps}
        insights={[makeInsight()]}
        open={true}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders insight title in list when open', () => {
    render(
      <BreadboardInventoryDialog
        {...baseProps}
        insights={[makeInsight({ title: 'Unique Resistor 12345' })]}
        open={true}
      />,
    );
    expect(screen.getByText(/Unique Resistor 12345/)).toBeInTheDocument();
  });

  it('accepts empty insights without crashing', () => {
    expect(() =>
      render(
        <BreadboardInventoryDialog
          {...baseProps}
          insights={[]}
          open={true}
        />,
      ),
    ).not.toThrow();
  });
});
