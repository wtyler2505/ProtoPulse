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
import PotentiometerSvg, { formatResistance } from '../breadboard-components/PotentiometerSvg';
import ButtonSvg from '../breadboard-components/ButtonSvg';
import SwitchSvg from '../breadboard-components/SwitchSvg';
import HeaderSvg from '../breadboard-components/HeaderSvg';
import RegulatorSvg, { formatVoltage } from '../breadboard-components/RegulatorSvg';
import CrystalSvg, { formatFrequency } from '../breadboard-components/CrystalSvg';
import BuzzerSvg from '../breadboard-components/BuzzerSvg';
import FuseSvg, { formatAmps } from '../breadboard-components/FuseSvg';
import SensorSvg from '../breadboard-components/SensorSvg';
import DisplaySvg, { SEGMENT_MAP } from '../breadboard-components/DisplaySvg';
import RelaySvg from '../breadboard-components/RelaySvg';
import MotorSvg from '../breadboard-components/MotorSvg';
import ConnectorSvg from '../breadboard-components/ConnectorSvg';

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

// ---------------------------------------------------------------------------
// PotentiometerSvg
// ---------------------------------------------------------------------------

describe('PotentiometerSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<PotentiometerSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-potentiometer-svg')).toBeTruthy();
  });

  it('renders three leads', () => {
    const { container } = renderInSvg(<PotentiometerSvg cx={50} cy={50} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it('renders body circle and knob', () => {
    const { container } = renderInSvg(<PotentiometerSvg cx={50} cy={50} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(2); // body + knob + highlight
  });

  it('shows value label', () => {
    const { container } = renderInSvg(<PotentiometerSvg cx={50} cy={50} ohms={47000} />);
    const text = container.querySelector('text');
    expect(text?.textContent).toContain('47');
  });
});

describe('formatResistance', () => {
  it('formats kilo-ohms', () => {
    expect(formatResistance(10000)).toBe('10k');
  });

  it('formats mega-ohms', () => {
    expect(formatResistance(1000000)).toBe('1M');
  });

  it('formats low ohms', () => {
    expect(formatResistance(100)).toBe('100');
  });
});

// ---------------------------------------------------------------------------
// ButtonSvg
// ---------------------------------------------------------------------------

describe('ButtonSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<ButtonSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-button-svg')).toBeTruthy();
  });

  it('renders four leads', () => {
    const { container } = renderInSvg(<ButtonSvg cx={50} cy={50} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(4);
  });

  it('renders pressed state differently', () => {
    const { container: normal } = renderInSvg(<ButtonSvg cx={50} cy={50} pressed={false} />);
    const { container: pressed } = renderInSvg(<ButtonSvg cx={50} cy={50} pressed={true} />);
    // Normal cap is lighter (#888), pressed cap is darker (#666)
    const normalCap = normal.querySelector('circle[fill="#888"]');
    const pressedCap = pressed.querySelector('circle[fill="#666"]');
    expect(normalCap).toBeTruthy();
    expect(pressedCap).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// SwitchSvg
// ---------------------------------------------------------------------------

describe('SwitchSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<SwitchSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-switch-svg')).toBeTruthy();
  });

  it('renders three leads', () => {
    const { container } = renderInSvg(<SwitchSvg cx={50} cy={50} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it('renders ON/OFF labels', () => {
    const { container } = renderInSvg(<SwitchSvg cx={50} cy={50} on={true} />);
    const texts = container.querySelectorAll('text');
    const textContents = Array.from(texts).map(t => t.textContent);
    expect(textContents).toContain('ON');
    expect(textContents).toContain('OFF');
  });
});

// ---------------------------------------------------------------------------
// HeaderSvg
// ---------------------------------------------------------------------------

describe('HeaderSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<HeaderSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-header-svg')).toBeTruthy();
  });

  it('renders correct number of pins', () => {
    const { container } = renderInSvg(<HeaderSvg cx={100} cy={50} pinCount={8} rows={1} />);
    // 8 pin rects + housing rect + highlight rect = 10
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThanOrEqual(9);
  });

  it('renders pin leads', () => {
    const { container } = renderInSvg(<HeaderSvg cx={50} cy={50} pinCount={4} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// RegulatorSvg
// ---------------------------------------------------------------------------

describe('RegulatorSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<RegulatorSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-regulator-svg')).toBeTruthy();
  });

  it('renders three leads', () => {
    const { container } = renderInSvg(<RegulatorSvg cx={50} cy={50} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(3);
  });

  it('shows voltage label', () => {
    const { container } = renderInSvg(<RegulatorSvg cx={50} cy={50} voltage={3.3} />);
    const texts = container.querySelectorAll('text');
    const voltText = Array.from(texts).find(t => t.textContent?.includes('3.3'));
    expect(voltText).toBeTruthy();
  });

  it('shows part number', () => {
    const { container } = renderInSvg(<RegulatorSvg cx={50} cy={50} partNumber="LM7805" />);
    const texts = container.querySelectorAll('text');
    const partText = Array.from(texts).find(t => t.textContent === 'LM7805');
    expect(partText).toBeTruthy();
  });
});

describe('formatVoltage', () => {
  it('formats integer voltage', () => {
    expect(formatVoltage(5)).toBe('5V');
  });

  it('formats decimal voltage', () => {
    expect(formatVoltage(3.3)).toBe('3.3V');
  });
});

// ---------------------------------------------------------------------------
// CrystalSvg
// ---------------------------------------------------------------------------

describe('CrystalSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<CrystalSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-crystal-svg')).toBeTruthy();
  });

  it('renders two leads', () => {
    const { container } = renderInSvg(<CrystalSvg cx={50} cy={50} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('shows frequency label', () => {
    const { container } = renderInSvg(<CrystalSvg cx={50} cy={50} frequency={8_000_000} />);
    const text = container.querySelector('text');
    expect(text?.textContent).toContain('8');
  });
});

describe('formatFrequency', () => {
  it('formats MHz', () => {
    expect(formatFrequency(16_000_000)).toBe('16MHz');
  });

  it('formats kHz', () => {
    expect(formatFrequency(32_768)).toBe('32.8kHz');
  });

  it('formats Hz', () => {
    expect(formatFrequency(50)).toBe('50Hz');
  });
});

// ---------------------------------------------------------------------------
// BuzzerSvg
// ---------------------------------------------------------------------------

describe('BuzzerSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<BuzzerSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-buzzer-svg')).toBeTruthy();
  });

  it('renders two leads', () => {
    const { container } = renderInSvg(<BuzzerSvg cx={50} cy={50} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(2);
  });

  it('renders sound waves when active', () => {
    const { container } = renderInSvg(<BuzzerSvg cx={50} cy={50} active={true} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(2); // sound wave arcs
  });

  it('does not render sound waves when inactive', () => {
    const { container } = renderInSvg(<BuzzerSvg cx={50} cy={50} active={false} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FuseSvg
// ---------------------------------------------------------------------------

describe('FuseSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<FuseSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-fuse-svg')).toBeTruthy();
  });

  it('renders two leads', () => {
    const { container } = renderInSvg(<FuseSvg cx={50} cy={50} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('shows intact wire when not blown', () => {
    const { container } = renderInSvg(<FuseSvg cx={50} cy={50} blown={false} />);
    // Single continuous internal wire line (plus 2 leads)
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(3); // 2 leads + 1 fuse wire
  });

  it('shows broken wire and scorch when blown', () => {
    const { container } = renderInSvg(<FuseSvg cx={50} cy={50} blown={true} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(4); // 2 leads + 2 broken stubs
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(1); // scorch mark
  });

  it('shows rating label', () => {
    const { container } = renderInSvg(<FuseSvg cx={50} cy={50} amps={2} />);
    const text = container.querySelector('text');
    expect(text?.textContent).toBe('2A');
  });
});

describe('formatAmps', () => {
  it('formats amps', () => {
    expect(formatAmps(5)).toBe('5A');
  });

  it('formats milliamps', () => {
    expect(formatAmps(0.5)).toBe('500mA');
  });
});

// ---------------------------------------------------------------------------
// SensorSvg
// ---------------------------------------------------------------------------

describe('SensorSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<SensorSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-sensor-svg')).toBeTruthy();
  });

  it('renders pin leads', () => {
    const { container } = renderInSvg(<SensorSvg cx={50} cy={50} pinCount={4} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(4);
  });

  it('renders green PCB body', () => {
    const { container } = renderInSvg(<SensorSvg cx={50} cy={50} />);
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThanOrEqual(2); // body + sensing area + highlight
  });

  it('renders different icons per sensor type', () => {
    const { container: temp } = renderInSvg(<SensorSvg cx={50} cy={50} sensorType="temperature" />);
    const { container: light } = renderInSvg(<SensorSvg cx={50} cy={50} sensorType="light" />);
    // Temperature has a rect (thermometer), light has circles
    const tempRects = temp.querySelectorAll('rect');
    const lightCircles = light.querySelectorAll('circle');
    expect(tempRects.length).toBeGreaterThan(0);
    expect(lightCircles.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// DisplaySvg
// ---------------------------------------------------------------------------

describe('DisplaySvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<DisplaySvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-display-svg')).toBeTruthy();
  });

  it('renders pin leads on top and bottom', () => {
    const { container } = renderInSvg(<DisplaySvg cx={50} cy={50} pinCount={10} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(10);
  });

  it('renders 7 segment rects', () => {
    const { container } = renderInSvg(<DisplaySvg cx={50} cy={50} digit={8} />);
    // 7 segments + housing + display window + highlight border + pin1 dot-related rects
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThanOrEqual(9); // 7 segs + housing + window
  });

  it('lights correct segments for digit 1', () => {
    // Digit 1 = segments b and c only
    const segs = SEGMENT_MAP[1];
    expect(segs[0]).toBe(false); // a off
    expect(segs[1]).toBe(true);  // b on
    expect(segs[2]).toBe(true);  // c on
    expect(segs[3]).toBe(false); // d off
    expect(segs[4]).toBe(false); // e off
    expect(segs[5]).toBe(false); // f off
    expect(segs[6]).toBe(false); // g off
  });
});

// ---------------------------------------------------------------------------
// RelaySvg
// ---------------------------------------------------------------------------

describe('RelaySvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<RelaySvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-relay-svg')).toBeTruthy();
  });

  it('renders five leads', () => {
    const { container } = renderInSvg(<RelaySvg cx={50} cy={50} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(5);
  });

  it('shows indicator LED glow when energized', () => {
    const { container } = renderInSvg(<RelaySvg cx={50} cy={50} energized={true} />);
    const circles = container.querySelectorAll('circle');
    // LED circle + glow circle
    expect(circles.length).toBeGreaterThanOrEqual(2);
  });

  it('shows voltage marking', () => {
    const { container } = renderInSvg(<RelaySvg cx={50} cy={50} voltage={12} />);
    const text = container.querySelector('text');
    expect(text?.textContent).toContain('12');
  });
});

// ---------------------------------------------------------------------------
// MotorSvg
// ---------------------------------------------------------------------------

describe('MotorSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<MotorSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-motor-svg')).toBeTruthy();
  });

  it('renders two leads', () => {
    const { container } = renderInSvg(<MotorSvg cx={50} cy={50} />);
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('renders M marking', () => {
    const { container } = renderInSvg(<MotorSvg cx={50} cy={50} />);
    const texts = container.querySelectorAll('text');
    const mText = Array.from(texts).find(t => t.textContent === 'M');
    expect(mText).toBeTruthy();
  });

  it('renders spinning indicator when active', () => {
    const { container } = renderInSvg(<MotorSvg cx={50} cy={50} spinning={true} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(2); // rotation arc + arrow
  });

  it('does not render spinning indicator when stopped', () => {
    const { container } = renderInSvg(<MotorSvg cx={50} cy={50} spinning={false} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ConnectorSvg
// ---------------------------------------------------------------------------

describe('ConnectorSvg', () => {
  it('renders with data-testid', () => {
    renderInSvg(<ConnectorSvg cx={50} cy={50} />);
    expect(screen.getByTestId('bb-connector-svg')).toBeTruthy();
  });

  it('renders screw terminal with correct pin count', () => {
    const { container } = renderInSvg(<ConnectorSvg cx={50} cy={50} connectorType="screw-terminal" pinCount={3} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(3); // 3 screw heads
  });

  it('renders barrel jack with center pin', () => {
    const { container } = renderInSvg(<ConnectorSvg cx={50} cy={50} connectorType="barrel-jack" />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(2); // barrel + center pin
  });

  it('renders JST with locking tab', () => {
    const { container } = renderInSvg(<ConnectorSvg cx={50} cy={50} connectorType="jst" pinCount={3} />);
    const rects = container.querySelectorAll('rect');
    // Housing + contacts + locking tab
    expect(rects.length).toBeGreaterThanOrEqual(5);
  });

  it('renders generic connector', () => {
    const { container } = renderInSvg(<ConnectorSvg cx={50} cy={50} connectorType="generic" />);
    expect(screen.getByTestId('bb-connector-svg')).toBeTruthy();
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBe(2); // two leads
  });
});
