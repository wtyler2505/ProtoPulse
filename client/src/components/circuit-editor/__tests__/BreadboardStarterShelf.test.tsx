/**
 * Smoke tests for BreadboardStarterShelf (audit finding #334).
 * Covers: renders, draggable cards, dataTransfer payload on dragStart, a11y.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import BreadboardStarterShelf from '../BreadboardStarterShelf';

describe('BreadboardStarterShelf', () => {
  it('renders without crashing', () => {
    render(<BreadboardStarterShelf />);
    expect(screen.getByTestId('breadboard-starter-shelf')).toBeInTheDocument();
  });

  it('renders all 7 starter part cards', () => {
    render(<BreadboardStarterShelf />);
    const ids = ['microcontroller', 'dip-ic', 'led', 'resistor', 'capacitor', 'diode', 'switch'];
    for (const id of ids) {
      expect(screen.getByTestId(`breadboard-starter-${id}`)).toBeInTheDocument();
    }
  });

  it('each card is a draggable button (a11y: role=button, draggable)', () => {
    render(<BreadboardStarterShelf />);
    const led = screen.getByTestId('breadboard-starter-led');
    expect(led.tagName).toBe('BUTTON');
    expect(led.getAttribute('draggable')).toBe('true');
    expect(led.getAttribute('type')).toBe('button');
  });

  it('sets legacy drag payload on dragStart', () => {
    render(<BreadboardStarterShelf />);
    const card = screen.getByTestId('breadboard-starter-resistor');

    const setData = vi.fn();
    const dataTransfer = {
      setData,
      effectAllowed: '',
    } as unknown as DataTransfer;

    fireEvent.dragStart(card, { dataTransfer });

    expect(setData).toHaveBeenCalledWith('application/reactflow/type', 'resistor');
    expect(setData).toHaveBeenCalledWith('application/reactflow/label', 'Resistor');
    expect(setData).toHaveBeenCalledWith('text/plain', 'Resistor');
  });

  it('shows detail copy describing the part', () => {
    render(<BreadboardStarterShelf />);
    expect(screen.getByText(/Polarized indicator with live-state rendering/i)).toBeInTheDocument();
  });
});
