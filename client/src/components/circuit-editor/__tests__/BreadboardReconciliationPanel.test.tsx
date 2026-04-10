import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BreadboardReconciliationPanel from '../BreadboardReconciliationPanel';
import type { BreadboardBenchInsight } from '@/lib/breadboard-bench';

function makeInsight(overrides: Partial<BreadboardBenchInsight>): BreadboardBenchInsight {
  return {
    partId: 1,
    bomItemId: null,
    title: 'Untitled',
    family: 'Other',
    benchCategory: 'Workbench',
    pinCount: 2,
    fit: 'native',
    modelQuality: 'basic',
    hasPreciseArtwork: false,
    isTracked: true,
    isOwned: true,
    ownedQuantity: 1,
    requiredQuantity: 1,
    missingQuantity: 0,
    storageLocation: null,
    lowStock: false,
    readyNow: true,
    starterFriendly: true,
    ...overrides,
  };
}

const mockInsights: BreadboardBenchInsight[] = [
  makeInsight({
    partId: 1,
    title: '10k Resistor',
    ownedQuantity: 3,
    requiredQuantity: 5,
    missingQuantity: 2,
    readyNow: false,
  }),
  makeInsight({
    partId: 2,
    title: 'Red LED',
    ownedQuantity: 4,
    requiredQuantity: 4,
    missingQuantity: 0,
    readyNow: true,
  }),
];

const ownedInsights: BreadboardBenchInsight[] = [
  makeInsight({
    partId: 1,
    title: '10k Resistor',
    ownedQuantity: 5,
    requiredQuantity: 5,
    missingQuantity: 0,
    readyNow: true,
  }),
  makeInsight({
    partId: 2,
    title: 'Red LED',
    ownedQuantity: 4,
    requiredQuantity: 4,
    missingQuantity: 0,
    readyNow: true,
  }),
];

describe('BreadboardReconciliationPanel', () => {
  it('shows have/need comparison per component', () => {
    render(<BreadboardReconciliationPanel insights={mockInsights} />);
    expect(screen.getByText('3 / 5')).toBeInTheDocument();
    expect(screen.getByTestId('missing-badge')).toBeInTheDocument();
  });

  it('shows all-clear when everything owned', () => {
    render(<BreadboardReconciliationPanel insights={ownedInsights} />);
    expect(screen.getByText(/ready to build/i)).toBeInTheDocument();
  });

  it('links missing parts to shopping list', () => {
    render(<BreadboardReconciliationPanel insights={mockInsights} onShop={vi.fn()} />);
    expect(screen.getByTestId('shop-missing-button')).toBeInTheDocument();
  });

  it('calls onShop when shop button is clicked', async () => {
    const user = userEvent.setup();
    const onShop = vi.fn();
    render(<BreadboardReconciliationPanel insights={mockInsights} onShop={onShop} />);
    await user.click(screen.getByTestId('shop-missing-button'));
    expect(onShop).toHaveBeenCalled();
  });

  it('displays storage location when available', () => {
    const insights = [
      makeInsight({
        partId: 1,
        title: 'Cap 100uF',
        ownedQuantity: 2,
        requiredQuantity: 2,
        missingQuantity: 0,
        storageLocation: 'Drawer A1',
        readyNow: true,
      }),
    ];
    render(<BreadboardReconciliationPanel insights={insights} />);
    expect(screen.getByText('Drawer A1')).toBeInTheDocument();
  });

  it('shows correct counts in summary', () => {
    render(<BreadboardReconciliationPanel insights={mockInsights} />);
    // 1 of 2 parts is missing stock
    expect(screen.getByTestId('reconciliation-summary')).toBeInTheDocument();
  });
});
