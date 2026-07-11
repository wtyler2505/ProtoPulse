/**
 * BL-0781 — NumberInput migration ARIA contract + functional-risk test for
 * BomTable's inline-edit cells.
 *
 * BomTable.tsx lines 240-241 (audit) are the highest visual+functional risk
 * instances in the procurement set: tight table-cell inputs (`w-16`/`w-24`,
 * `text-xs text-right font-mono`) with a bespoke
 * `focus-visible:ring-2 focus-visible:ring-cyan-400/50` editing-state focus
 * ring, PLUS an `onKeyDown={handleEditKeyDown}` handler that must keep
 * working (Enter saves, Escape cancels) after the wrapper swap from raw
 * `<input>` to `<NumberInput>`.
 *
 * Both rows are KEEP actions per the audit:
 *   - quantity:   min={1}  max={999999}
 *   - unit price: min={0}  max={99999.99}  step={0.01}
 *
 * The test harness reproduces ProcurementView's real startEdit/saveEdit/
 * cancelEdit/handleEditKeyDown wiring (see ProcurementView.tsx lines
 * 286-303) rather than stubbing it out, so the Enter/Escape assertions
 * exercise the same control flow production code uses.
 */

import { useCallback, useState } from 'react';

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BomTable } from '../BomTable';

import type { EnrichedBomItem, EditValues } from '../types';

// Mock the virtualizer so all rows render regardless of happy-dom's lack of
// real layout (established pattern — see ChatPanel.test.tsx / ValidationView.test.tsx).
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 48,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 48,
        size: 48,
        key: i,
      })),
    measureElement: vi.fn(),
  }),
}));

vi.mock('@/components/ui/styled-tooltip', () => ({
  StyledTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}));

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuSeparator: () => <hr />,
}));

vi.mock('@/components/ui/LifecycleBadge', () => ({
  LifecycleBadge: ({ partNumber }: { partNumber: string }) => <span data-testid={`lifecycle-${partNumber}`} />,
}));

const item: EnrichedBomItem = {
  id: '1',
  partNumber: 'ATmega328P-PU',
  manufacturer: 'Microchip',
  description: '8-bit MCU',
  quantity: 10,
  unitPrice: 2.4,
  totalPrice: 24,
  supplier: 'Digi-Key',
  stock: 100,
  status: 'In Stock',
  _isEsd: false,
  _assemblyCategory: null,
};

/**
 * Mirrors ProcurementView's real edit-state wiring (startEdit/saveEdit/
 * cancelEdit/handleEditKeyDown) so Enter/Escape behavior is exercised
 * end-to-end rather than through a stub.
 */
function BomTableHarness({ onSave, onCancel }: { onSave: (v: EditValues) => void; onCancel: () => void }) {
  const [editingId, setEditingId] = useState<number | null>(1);
  const [editValues, setEditValues] = useState<EditValues>({
    partNumber: item.partNumber,
    manufacturer: item.manufacturer,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    supplier: item.supplier,
  });

  const saveEdit = useCallback(() => {
    onSave(editValues);
    setEditingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editValues]);

  const cancelEdit = useCallback(() => {
    onCancel();
    setEditingId(null);
  }, [onCancel]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    },
    [saveEdit, cancelEdit],
  );

  return (
    <BomTable
      filteredBom={[item]}
      editingId={editingId}
      editValues={editValues}
      setEditValues={setEditValues}
      handleEditKeyDown={handleEditKeyDown}
      saveEdit={saveEdit}
      cancelEdit={cancelEdit}
      startEdit={() => setEditingId(1)}
      deleteBomItem={vi.fn()}
      addOutputLog={vi.fn()}
      toast={vi.fn()}
      highlightedItemId={null}
      handleHighlightItem={vi.fn()}
      onAssessDamage={vi.fn()}
    />
  );
}

describe('BomTable — NumberInput ARIA contract + onKeyDown regression (BL-0781)', () => {
  it('mirrors quantity bounds (min=1, max=999999) onto aria-value* attrs', () => {
    render(<BomTableHarness onSave={vi.fn()} onCancel={vi.fn()} />);

    const quantityInput = screen.getByTestId('edit-quantity-1');
    expect(quantityInput.getAttribute('type')).toBe('number');
    expect(quantityInput.getAttribute('min')).toBe('1');
    expect(quantityInput.getAttribute('max')).toBe('999999');
    expect(quantityInput.getAttribute('aria-valuemin')).toBe('1');
    expect(quantityInput.getAttribute('aria-valuemax')).toBe('999999');
    // preserved bespoke editing-state styling
    expect(quantityInput.className).toContain('w-16');
    expect(quantityInput.className).toContain('focus-visible:ring-cyan-400/50');
  });

  it('mirrors unit-price bounds (min=0, max=99999.99, step=0.01) onto aria-value* attrs', () => {
    render(<BomTableHarness onSave={vi.fn()} onCancel={vi.fn()} />);

    const unitPriceInput = screen.getByTestId('edit-unit-price-1');
    expect(unitPriceInput.getAttribute('type')).toBe('number');
    expect(unitPriceInput.getAttribute('min')).toBe('0');
    expect(unitPriceInput.getAttribute('max')).toBe('99999.99');
    expect(unitPriceInput.getAttribute('step')).toBe('0.01');
    expect(unitPriceInput.getAttribute('aria-valuemin')).toBe('0');
    expect(unitPriceInput.getAttribute('aria-valuemax')).toBe('99999.99');
    // preserved bespoke editing-state styling
    expect(unitPriceInput.className).toContain('w-24');
    expect(unitPriceInput.className).toContain('focus-visible:ring-cyan-400/50');
  });

  it('computes a live row total from quantity x unit price while editing (regression guard)', () => {
    render(<BomTableHarness onSave={vi.fn()} onCancel={vi.fn()} />);

    // 10 * 2.4 = 24.00, matching the seeded editValues
    expect(screen.getByText('$24.00')).toBeInTheDocument();
  });

  it('recomputes the live row total when the quantity NumberInput changes (onChange coercion regression guard)', () => {
    render(<BomTableHarness onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('$24.00')).toBeInTheDocument();

    const quantityInput = screen.getByTestId('edit-quantity-1');
    fireEvent.change(quantityInput, { target: { value: '5' } });

    // 5 * 2.4 = 12.00 — proves the migrated NumberInput's onChange still flows
    // through the same parseInt coercion into the live total computation.
    expect(screen.getByText('$12.00')).toBeInTheDocument();
    expect(screen.queryByText('$24.00')).not.toBeInTheDocument();
  });

  it('recomputes the live row total when the unit-price NumberInput changes (onChange coercion regression guard)', () => {
    render(<BomTableHarness onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('$24.00')).toBeInTheDocument();

    const unitPriceInput = screen.getByTestId('edit-unit-price-1');
    fireEvent.change(unitPriceInput, { target: { value: '3.5' } });

    // 10 * 3.5 = 35.00 — proves the migrated NumberInput's onChange still flows
    // through the same parseFloat coercion into the live total computation.
    expect(screen.getByText('$35.00')).toBeInTheDocument();
    expect(screen.queryByText('$24.00')).not.toBeInTheDocument();
  });

  it('Enter key saves the edit via handleEditKeyDown on the quantity field (functional regression guard)', () => {
    const onSave = vi.fn();
    render(<BomTableHarness onSave={onSave} onCancel={vi.fn()} />);

    const quantityInput = screen.getByTestId('edit-quantity-1');
    fireEvent.keyDown(quantityInput, { key: 'Enter' });

    expect(onSave).toHaveBeenCalledTimes(1);
    // editingId reset to null -> edit row testids are gone, read-only cell testid appears
    expect(screen.queryByTestId('edit-quantity-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('text-quantity-1')).toBeInTheDocument();
  });

  it('Escape key cancels the edit via handleEditKeyDown on the unit-price field without saving (functional regression guard)', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<BomTableHarness onSave={onSave} onCancel={onCancel} />);

    const unitPriceInput = screen.getByTestId('edit-unit-price-1');
    fireEvent.keyDown(unitPriceInput, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByTestId('edit-unit-price-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('text-unit-price-1')).toBeInTheDocument();
  });
});
