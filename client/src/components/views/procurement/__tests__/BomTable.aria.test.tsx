/**
 * BomTable — BL-0781 ARIA spinbutton contract.
 *
 * Asserts that the inline edit-row number inputs (quantity, unit price)
 * mirror `min`/`max` props to `aria-valuemin`/`aria-valuemax` per the
 * WAI-ARIA 1.2 spinbutton spec — fixing the Chromium synthesized
 * `aria-valuemax="0"` accessibility bug (E2E-236/271/284).
 *
 * Migration plan: docs/audits/bl-0781-number-input-audit.md (Teammate 5 →
 * BomTable.tsx, HIGH visual risk). Action: raw <input> → NumberInput, KEEP
 * existing min/max (BomTable was already correct on bounds, only the
 * primitive switch is required). Tailwind `!` modifiers preserve the
 * compact 24/28px row appearance over shadcn Input's h-9 default.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DndContext } from '@dnd-kit/core';

// happy-dom reports clientHeight=0, so @tanstack/react-virtual renders no
// virtual rows. Stub useVirtualizer to always emit one row per item so the
// edit cells (the BL-0781 fix target) actually mount.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 52,
        size: 52,
      })),
    getTotalSize: () => count * 52,
    measureElement: () => {},
  }),
}));

import { BomTable } from '../BomTable';
import type { EnrichedBomItem, EditValues } from '../types';

const sampleItem: EnrichedBomItem = {
  id: '1',
  partNumber: 'STM32F407VGT6',
  manufacturer: 'STMicroelectronics',
  description: 'ARM Cortex-M4 MCU',
  quantity: 10,
  unitPrice: 12.5,
  totalPrice: 125,
  supplier: 'Digi-Key',
  stock: 1000,
  status: 'In Stock',
  _isEsd: false,
  _assemblyCategory: null,
};

const editValues: EditValues = {
  partNumber: 'STM32F407VGT6',
  manufacturer: 'STMicroelectronics',
  description: 'ARM Cortex-M4 MCU',
  quantity: 10,
  unitPrice: 12.5,
  supplier: 'Digi-Key',
};

function renderTable(): void {
  render(
    <TooltipProvider>
      <DndContext>
        <BomTable
          filteredBom={[sampleItem]}
          editingId={1}
          editValues={editValues}
          setEditValues={() => {}}
          handleEditKeyDown={() => {}}
          saveEdit={() => {}}
          cancelEdit={() => {}}
          startEdit={() => {}}
          deleteBomItem={() => {}}
          addOutputLog={() => {}}
          toast={() => ({ id: 'toast-1', dismiss: () => {}, update: () => {} })}
          highlightedItemId={null}
          handleHighlightItem={() => {}}
          onAssessDamage={() => {}}
        />
      </DndContext>
    </TooltipProvider>,
  );
}

describe('BomTable — BL-0781 ARIA spinbutton contract (inline edit row)', () => {
  it('mirrors min={1} max={999_999} for the edit-quantity input', () => {
    renderTable();
    const input = screen.getByTestId('edit-quantity-1') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('999999');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('999999');
  });

  it('mirrors min={0} max={99_999.99} step={0.01} for the edit-unit-price input', () => {
    renderTable();
    const input = screen.getByTestId('edit-unit-price-1') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('99999.99');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('99999.99');
    expect(input.getAttribute('step')).toBe('0.01');
  });
});
