/**
 * Tests for photorealistic breadboard SVG components (BL-0590).
 *
 * Validates rendering, color band computation, capacitor type switching,
 * LED brightness/glow, IC pin generation, and prop forwarding.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResistorSvg, { ohmsToBands, BAND_COLORS, MULTIPLIER_COLORS } from '../breadboard-components/ResistorSvg';
import CapacitorSvg from '../breadboard-components/CapacitorSvg';
import LedSvg from '../breadboard-components/LedSvg';
import IcSvg from '../breadboard-components/IcSvg';
import DiodeSvg from '../breadboard-components/DiodeSvg';
import TransistorSvg from '../breadboard-components/TransistorSvg';
import WireSvg from '../breadboard-components/WireSvg';

// Helper to wrap SVG components in an <svg> for DOM rendering
function renderInSvg(ui: React.ReactElement) {
  return render(<svg>{ui}</svg>);
}

// ---------------------------------------------------------------------------
// ResistorSvg
// ---------------------------------------------------------------------------

describe('ResistorSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<ResistorSvg cx={50} cy={50} ohms={1000} />);
    expect(screen.getByTestId('bb-resistor-svg')).toBeTruthy();
  });

  it('renders wire leads and body rect', () => {
    const { container } = renderInSvg(<ResistorSvg cx={100} cy={100} ohms={4700} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(2); // two leads
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThanOrEqual(5); // body + 4 bands + highlight
  });
});

describe('ohmsToBands', () => {
  it('computes 1kΩ = brown-black-red-gold', () => {
    const bands = ohmsToBands(1000);
    expect(bands.band1).toBe(BAND_COLORS[1]); // brown
    expect(bands.band2).toBe(BAND_COLORS[0]); // black
    expect(bands.band3).toBe(MULTIPLIER_COLORS[2]); // red (×100)
  });

  it('computes 4.7kΩ = yellow-violet-red-gold', () => {
    const bands = ohmsToBands(4700);
    expect(bands.band1).toBe(BAND_COLORS[4]); // yellow
    expect(bands.band2).toBe(BAND_COLORS[7]); // violet
    expect(bands.band3).toBe(MULTIPLIER_COLORS[2]); // red (×100)
  });

  it('computes 10Ω = brown-black-black-gold', () => {
    const bands = ohmsToBands(10);
    expect(bands.band1).toBe(BAND_COLORS[1]); // brown
    expect(bands.band2).toBe(BAND_COLORS[0]); // black
    expect(bands.band3).toBe(MULTIPLIER_COLORS[0]); // black (×1)
  });

  it('computes 1MΩ = brown-black-green-gold', () => {
    const bands = ohmsToBands(1_000_000);
    expect(bands.band1).toBe(BAND_COLORS[1]); // brown
    expect(bands.band2).toBe(BAND_COLORS[0]); // black
    expect(bands.band3).toBe(MULTIPLIER_COLORS[5]); // green (×100k)
  });

  it('returns fallback bands for invalid values', () => {
    const bands = ohmsToBands(0);
    expect(bands.band1).toBe(BAND_COLORS[1]); // fallback brown
  });

  it('tolerance band is always gold (±5%)', () => {
    const bands = ohmsToBands(220);
    expect(bands.band4).toBe('#FFD700');
  });
});

// ---------------------------------------------------------------------------
// CapacitorSvg
// ---------------------------------------------------------------------------

describe('CapacitorSvg', () => {
  it('renders ceramic disc for small values', () => {
    const { container } = renderInSvg(<CapacitorSvg cx={50} cy={50} farads={100e-9} />);
    expect(screen.getByTestId('bb-capacitor-svg')).toBeTruthy();
    // Ceramic disc uses ellipse
    const ellipses = container.querySelectorAll('ellipse');
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
  });

  it('renders electrolytic barrel for large values', () => {
    const { container } = renderInSvg(<CapacitorSvg cx={50} cy={50} farads={100e-6} />);
    expect(screen.getByTestId('bb-capacitor-svg')).toBeTruthy();
    // Electrolytic uses rects (barrel), no ellipse for body
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThanOrEqual(2);
  });

  it('displays value marking text', () => {
    const { container } = renderInSvg(<CapacitorSvg cx={50} cy={50} farads={10e-6} />);
    const text = container.querySelector('text');
    expect(text?.textContent).toContain('10');
  });
});

// ---------------------------------------------------------------------------
// LedSvg
// ---------------------------------------------------------------------------

describe('LedSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<LedSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-led-svg')).toBeTruthy();
  });

  it('renders glow circle when brightness > 0.1', () => {
    const { container } = renderInSvg(<LedSvg cx={50} cy={50} brightness={0.8} />);
    // Glow circle has large radius
    const circles = container.querySelectorAll('circle');
    const glowCircle = Array.from(circles).find(c => {
      const r = Number(c.getAttribute('r'));
      return r > 10;
    });
    expect(glowCircle).toBeTruthy();
  });

  it('does not render glow when off', () => {
    const { container } = renderInSvg(<LedSvg cx={50} cy={50} brightness={0} />);
    const circles = container.querySelectorAll('circle');
    const glowCircle = Array.from(circles).find(c => {
      const r = Number(c.getAttribute('r'));
      return r > 10;
    });
    expect(glowCircle).toBeFalsy();
  });

  it('renders leads', () => {
    const { container } = renderInSvg(<LedSvg cx={50} cy={50} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThanOrEqual(2); // anode + cathode leads
  });
});

// ---------------------------------------------------------------------------
// IcSvg
// ---------------------------------------------------------------------------

describe('IcSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<IcSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-ic-svg')).toBeTruthy();
  });

  it('renders pins for both sides', () => {
    const { container } = renderInSvg(<IcSvg cx={50} cy={50} pinCount={16} />);
    // 8 pins per side = 16 pin rects
    const rects = container.querySelectorAll('rect');
    // body rect + pin rects + highlight rect
    expect(rects.length).toBeGreaterThanOrEqual(17);
  });

  it('renders part number text', () => {
    const { container } = renderInSvg(<IcSvg cx={50} cy={50} partNumber="ATmega" />);
    const text = container.querySelector('text');
    expect(text?.textContent).toBe('ATmega');
  });

  it('truncates long part numbers', () => {
    const { container } = renderInSvg(<IcSvg cx={50} cy={50} partNumber="ATmega328P-PU" />);
    const text = container.querySelector('text');
    expect(text?.textContent).toContain('…');
  });

  it('renders pin-1 notch and dot', () => {
    const { container } = renderInSvg(<IcSvg cx={50} cy={50} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(1); // notch arc
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(1); // pin-1 dot
  });
});

// ---------------------------------------------------------------------------
// DiodeSvg
// ---------------------------------------------------------------------------

describe('DiodeSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<DiodeSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-diode-svg')).toBeTruthy();
  });

  it('renders wire leads and glass body', () => {
    const { container } = renderInSvg(<DiodeSvg cx={50} cy={50} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(2); // two leads
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThanOrEqual(3); // body + cathode band + inner + highlight
  });
});

// ---------------------------------------------------------------------------
// TransistorSvg
// ---------------------------------------------------------------------------

describe('TransistorSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<TransistorSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-transistor-svg')).toBeTruthy();
  });

  it('renders 3 leads', () => {
    const { container } = renderInSvg(<TransistorSvg cx={50} cy={50} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(3); // E, B, C
  });

  it('renders part number text', () => {
    const { container } = renderInSvg(<TransistorSvg cx={50} cy={50} partNumber="2N2222" />);
    const text = container.querySelector('text');
    expect(text?.textContent).toBe('2N2222');
  });
});

// ---------------------------------------------------------------------------
// WireSvg
// ---------------------------------------------------------------------------

describe('WireSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<WireSvg x1={10} y1={10} x2={100} y2={10} />);
    expect(screen.getByTestId('bb-wire-svg')).toBeTruthy();
  });

  it('renders exposed copper ends and insulated body', () => {
    const { container } = renderInSvg(<WireSvg x1={0} y1={0} x2={100} y2={0} color="#3498db" />);
    const lines = container.querySelectorAll('line');
    // 2 copper ends + 1 insulated body + 1 highlight = 4
    expect(lines.length).toBe(4);
  });

  it('returns null for zero-length wire', () => {
    const { container } = renderInSvg(<WireSvg x1={50} y1={50} x2={50} y2={50} />);
    const g = container.querySelector('[data-testid="bb-wire-svg"]');
    expect(g).toBeNull();
  });
});
