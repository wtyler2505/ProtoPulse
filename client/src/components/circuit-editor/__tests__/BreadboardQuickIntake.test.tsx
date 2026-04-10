import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BreadboardQuickIntake from '../BreadboardQuickIntake';

describe('BreadboardQuickIntake', () => {
  it('renders inline form with part name, quantity, and submit', () => {
    render(<BreadboardQuickIntake onAdd={vi.fn()} />);
    expect(screen.getByPlaceholderText(/part name/i)).toBeInTheDocument();
    expect(screen.getByTestId('quick-intake-quantity')).toBeInTheDocument();
    expect(screen.getByTestId('quick-intake-submit')).toBeInTheDocument();
  });

  it('renders storage location field', () => {
    render(<BreadboardQuickIntake onAdd={vi.fn()} />);
    expect(screen.getByTestId('quick-intake-storage')).toBeInTheDocument();
  });

  it('calls onAdd with part name and quantity on submit', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<BreadboardQuickIntake onAdd={onAdd} />);
    await user.type(screen.getByPlaceholderText(/part name/i), '10k Resistor');
    await user.clear(screen.getByTestId('quick-intake-quantity'));
    await user.type(screen.getByTestId('quick-intake-quantity'), '5');
    await user.click(screen.getByTestId('quick-intake-submit'));
    expect(onAdd).toHaveBeenCalledWith({ partName: '10k Resistor', quantity: 5, storageLocation: null });
  });

  it('includes storage location when provided', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<BreadboardQuickIntake onAdd={onAdd} />);
    await user.type(screen.getByPlaceholderText(/part name/i), 'LED Red');
    await user.type(screen.getByTestId('quick-intake-storage'), 'Drawer A1');
    await user.click(screen.getByTestId('quick-intake-submit'));
    expect(onAdd).toHaveBeenCalledWith({ partName: 'LED Red', quantity: 1, storageLocation: 'Drawer A1' });
  });

  it('clears form after successful submit', async () => {
    const user = userEvent.setup();
    render(<BreadboardQuickIntake onAdd={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/part name/i), 'LED');
    await user.click(screen.getByTestId('quick-intake-submit'));
    expect(screen.getByPlaceholderText(/part name/i)).toHaveValue('');
    expect(screen.getByTestId('quick-intake-quantity')).toHaveValue(1);
    expect(screen.getByTestId('quick-intake-storage')).toHaveValue('');
  });

  it('does not call onAdd when part name is empty', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<BreadboardQuickIntake onAdd={onAdd} />);
    await user.click(screen.getByTestId('quick-intake-submit'));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('does not call onAdd when quantity is zero', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<BreadboardQuickIntake onAdd={onAdd} />);
    await user.type(screen.getByPlaceholderText(/part name/i), 'Cap 100nF');
    await user.clear(screen.getByTestId('quick-intake-quantity'));
    await user.type(screen.getByTestId('quick-intake-quantity'), '0');
    await user.click(screen.getByTestId('quick-intake-submit'));
    expect(onAdd).not.toHaveBeenCalled();
  });
});
