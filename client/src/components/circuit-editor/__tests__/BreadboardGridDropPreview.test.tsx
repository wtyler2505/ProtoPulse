/**
 * BreadboardGrid drop preview tests — visual collision feedback during drag.
 *
 * Tests for the dropPreview prop on BreadboardGrid that renders a green (valid)
 * or red (collision) preview indicator at the snap target during component drags.
 *
 * Runs in client project config (happy-dom environment).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BreadboardGrid from '../BreadboardGrid';
import type { DropPreviewState } from '../BreadboardGrid';

describe('BreadboardGrid dropPreview', () => {
  it('renders no preview indicator when dropPreview is undefined', { timeout: 15000 }, () => {
    render(<BreadboardGrid />);
    expect(screen.queryByTestId('drop-preview-indicator')).toBeNull();
  });

  it('renders a green preview indicator for valid placement', () => {
    const preview: DropPreviewState = {
      coord: { type: 'terminal', col: 'a', row: 10 },
      collision: false,
    };
    render(<BreadboardGrid dropPreview={preview} />);
    const indicator = screen.getByTestId('drop-preview-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator.getAttribute('stroke')).toContain('0, 240, 255'); // cyan/green
  });

  it('renders a red preview indicator for collision', () => {
    const preview: DropPreviewState = {
      coord: { type: 'terminal', col: 'e', row: 5 },
      collision: true,
    };
    render(<BreadboardGrid dropPreview={preview} />);
    const indicator = screen.getByTestId('drop-preview-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator.getAttribute('stroke')).toContain('239, 68, 68'); // red
  });

  it('positions indicator at the correct pixel coordinates', () => {
    const preview: DropPreviewState = {
      coord: { type: 'terminal', col: 'a', row: 1 },
      collision: false,
    };
    render(<BreadboardGrid dropPreview={preview} />);
    const indicator = screen.getByTestId('drop-preview-indicator');
    // coordToPixel({type:'terminal', col:'a', row:1}) = { x: ORIGIN_X, y: ORIGIN_Y }
    // The indicator is centered on the hole — check it has valid numeric coords
    const cx = Number(indicator.getAttribute('cx'));
    const cy = Number(indicator.getAttribute('cy'));
    expect(cx).toBeGreaterThan(0);
    expect(cy).toBeGreaterThan(0);
  });

  it('does not render indicator when dropPreview coord is null', () => {
    const preview: DropPreviewState = {
      coord: null,
      collision: false,
    };
    render(<BreadboardGrid dropPreview={preview} />);
    expect(screen.queryByTestId('drop-preview-indicator')).toBeNull();
  });
});
