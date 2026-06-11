/// <reference lib="dom" />

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';

import BaudRateSelector from '../BaudRateSelector';
import { createTestQueryClient } from '@/test-utils/createTestQueryClient';

// Radix Select doesn't open reliably in happy-dom (no real pointer-capture / portal),
// so we replace it with a minimal pass-through that wires onValueChange onto the
// SelectItem button. This keeps the test focused on the BL-0781 ARIA contract
// rather than on Radix Select's interactive behaviour.
vi.mock('@/components/ui/select', () => {
  const SelectContext = React.createContext<{ onValueChange?: (v: string) => void }>({});
  return {
    Select: ({
      children,
      onValueChange,
    }: {
      children: React.ReactNode;
      onValueChange?: (v: string) => void;
    }) => (
      <SelectContext.Provider value={{ onValueChange }}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    SelectValue: () => <span />,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => {
      const ctx = React.useContext(SelectContext);
      return (
        <button type="button" onClick={() => ctx.onValueChange?.(value)}>
          {children}
        </button>
      );
    },
  };
});

describe('BaudRateSelector — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min/max to aria-valuemin/aria-valuemax on baud-rate-custom-input', async () => {
    const user = userEvent.setup();
    const qc = createTestQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <BaudRateSelector />
      </QueryClientProvider>,
    );

    // The mocked Select renders all SelectItems inline; click "Custom..." to
    // flip showCustomInput=true and reveal the spinbutton.
    await user.click(screen.getByText('Custom...'));

    const input = await screen.findByTestId('baud-rate-custom-input') as HTMLInputElement;
    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('4000000');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('4000000');
  });
});
