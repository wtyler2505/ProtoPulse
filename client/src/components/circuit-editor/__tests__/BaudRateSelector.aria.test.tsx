/**
 * ARIA contract test for BaudRateSelector's NumberInput migration
 * (BL-0781 — docs/audits/bl-0781-number-input-audit.md).
 *
 * Single instance (custom baud rate), OMIT-MAX with existing min={1}. The
 * mirrored aria-valuemin is the RED->GREEN witness: a raw
 * `<input type="number" min={1}>` never gets an `aria-valuemin` DOM attribute
 * (Chromium synthesizes ARIA bounds only in the real accessibility tree,
 * which happy-dom doesn't reproduce), so this assertion is absent
 * pre-migration and present post-migration.
 *
 * BaudRateSelector renders a `VaultInfoIcon` elsewhere in the tree that calls
 * `useQuery`, so this test needs a `QueryClientProvider` wrapper even though
 * the field under test never touches the query — a plain render() throws
 * "No QueryClient set" without it.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import BaudRateSelector from '../BaudRateSelector';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('BaudRateSelector — NumberInput ARIA contract (BL-0781)', () => {
  it('custom baud rate field mirrors min={1} and omits aria-valuemax', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<BaudRateSelector />);

    await user.click(screen.getByTestId('baud-rate-select'));
    await user.click(await screen.findByText('Custom...'));

    const el = await screen.findByTestId('baud-rate-custom-input');
    expect(el.getAttribute('aria-valuemin')).toBe('1');
    expect(el.getAttribute('min')).toBe('1');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
  });
});
