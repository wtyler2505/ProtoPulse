import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BreadboardShoppingList from '../BreadboardShoppingList';
import type { ShoppingListItem } from '../BreadboardShoppingList';

const mockMissing: ShoppingListItem[] = [
  {
    partName: '10k Resistor',
    mpn: 'RC0805FR-0710KL',
    quantityNeeded: 2,
    bestPrice: { distributor: 'digikey', unitPrice: 0.10, totalPrice: 0.20, sku: 'RC0805-ND' },
  },
  {
    partName: 'ESP32-WROOM-32',
    mpn: 'ESP32-WROOM-32',
    quantityNeeded: 1,
    bestPrice: { distributor: 'mouser', unitPrice: 3.15, totalPrice: 3.15, sku: '356-ESP32WRM32' },
  },
  {
    partName: '100uF Electrolytic',
    mpn: 'UVR1C101MDD1TD',
    quantityNeeded: 3,
    bestPrice: null,
  },
];

describe('BreadboardShoppingList', () => {
  it('renders one row per missing part', () => {
    render(<BreadboardShoppingList missingParts={mockMissing} />);
    expect(screen.getAllByTestId(/^shopping-row-/)).toHaveLength(3);
  });

  it('shows total estimated cost', () => {
    render(<BreadboardShoppingList missingParts={mockMissing} />);
    expect(screen.getByTestId('total-cost')).toBeInTheDocument();
    // 0.20 + 3.15 = 3.35
    expect(screen.getByTestId('total-cost').textContent).toContain('3.35');
  });

  it('has export CSV button', () => {
    render(<BreadboardShoppingList missingParts={mockMissing} />);
    expect(screen.getByTestId('export-csv')).toBeInTheDocument();
  });

  it('shows "no price found" for parts without pricing', () => {
    render(<BreadboardShoppingList missingParts={mockMissing} />);
    // The 100uF cap has no bestPrice
    expect(screen.getByText(/no price found/i)).toBeInTheDocument();
  });

  it('displays distributor name for priced parts', () => {
    render(<BreadboardShoppingList missingParts={mockMissing} />);
    expect(screen.getByText(/digikey/i)).toBeInTheDocument();
    expect(screen.getByText(/mouser/i)).toBeInTheDocument();
  });

  it('displays quantity needed per row', () => {
    render(<BreadboardShoppingList missingParts={mockMissing} />);
    // Verify the quantity column
    expect(screen.getByTestId('shopping-row-0')).toHaveTextContent('2');
    expect(screen.getByTestId('shopping-row-1')).toHaveTextContent('1');
    expect(screen.getByTestId('shopping-row-2')).toHaveTextContent('3');
  });

  it('generates CSV on export button click', async () => {
    const user = userEvent.setup();
    
    // Mock createObjectURL without destroying the URL constructor
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    window.URL.revokeObjectURL = vi.fn();

    render(<BreadboardShoppingList missingParts={mockMissing} />);
    await user.click(screen.getByTestId('export-csv'));
    expect(window.URL.createObjectURL).toHaveBeenCalled();

    // Restore
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('renders empty state when no missing parts', () => {
    render(<BreadboardShoppingList missingParts={[]} />);
    expect(screen.getByText(/no missing parts/i)).toBeInTheDocument();
  });
});
