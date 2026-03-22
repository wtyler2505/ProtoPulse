import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StarterCircuitsPanel from '../StarterCircuitsPanel';
import {
  getAllStarterCircuits,
  getStarterCircuitsByCategory,
  getStarterCircuitsByDifficulty,
  searchStarterCircuits,
  STARTER_CATEGORIES,
  STARTER_DIFFICULTIES,
} from '@shared/starter-circuits';
import type { StarterCategory, StarterDifficulty } from '@shared/starter-circuits';

// ---------------------------------------------------------------------------
// Shared library unit tests
// ---------------------------------------------------------------------------

describe('shared/starter-circuits', () => {
  it('exports at least 15 starter circuits', () => {
    const circuits = getAllStarterCircuits();
    expect(circuits.length).toBeGreaterThanOrEqual(15);
  });

  it('each circuit has required fields', () => {
    for (const c of getAllStarterCircuits()) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(STARTER_CATEGORIES).toContain(c.category);
      expect(STARTER_DIFFICULTIES).toContain(c.difficulty);
      expect(c.arduinoCode.length).toBeGreaterThan(50);
      expect(c.components.length).toBeGreaterThan(0);
      expect(c.learningObjectives.length).toBeGreaterThan(0);
      expect(c.tags.length).toBeGreaterThan(0);
      expect(['uno', 'nano', 'mega']).toContain(c.boardType);
    }
  });

  it('all circuit IDs are unique', () => {
    const ids = getAllStarterCircuits().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each circuit has compilable-looking Arduino code (setup + loop)', () => {
    for (const c of getAllStarterCircuits()) {
      expect(c.arduinoCode).toContain('void setup()');
      expect(c.arduinoCode).toContain('void loop()');
    }
  });

  it('filters by category', () => {
    const basics = getStarterCircuitsByCategory('basics');
    expect(basics.length).toBeGreaterThan(0);
    for (const c of basics) {
      expect(c.category).toBe('basics');
    }
  });

  it('filters by difficulty', () => {
    const beginners = getStarterCircuitsByDifficulty('beginner');
    expect(beginners.length).toBeGreaterThan(0);
    for (const c of beginners) {
      expect(c.difficulty).toBe('beginner');
    }
  });

  it('search by name returns matching circuits', () => {
    const results = searchStarterCircuits('blink');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.name.toLowerCase().includes('blink'))).toBe(true);
  });

  it('search by tag returns matching circuits', () => {
    const results = searchStarterCircuits('servo');
    expect(results.length).toBeGreaterThan(0);
  });

  it('empty search returns all circuits', () => {
    expect(searchStarterCircuits('')).toHaveLength(getAllStarterCircuits().length);
    expect(searchStarterCircuits('   ')).toHaveLength(getAllStarterCircuits().length);
  });

  it('search with no match returns empty', () => {
    expect(searchStarterCircuits('xyznonexistent')).toHaveLength(0);
  });

  it('covers all 5 categories', () => {
    const categories = new Set(getAllStarterCircuits().map((c) => c.category));
    for (const cat of STARTER_CATEGORIES) {
      expect(categories.has(cat)).toBe(true);
    }
  });

  it('covers both difficulty levels', () => {
    const difficulties = new Set(getAllStarterCircuits().map((c) => c.difficulty));
    expect(difficulties.has('beginner')).toBe(true);
    expect(difficulties.has('intermediate')).toBe(true);
  });

  it('every component has a positive quantity', () => {
    for (const c of getAllStarterCircuits()) {
      for (const comp of c.components) {
        expect(comp.quantity).toBeGreaterThan(0);
        expect(comp.name).toBeTruthy();
      }
    }
  });

  it('circuits that use libraries include #include directives', () => {
    const servoCircuit = getAllStarterCircuits().find((c) => c.id === 'starter-servo-sweep');
    expect(servoCircuit?.arduinoCode).toContain('#include <Servo.h>');

    const lcdCircuit = getAllStarterCircuits().find((c) => c.id === 'starter-lcd-i2c');
    expect(lcdCircuit?.arduinoCode).toContain('#include <LiquidCrystal_I2C.h>');

    const dhtCircuit = getAllStarterCircuits().find((c) => c.id === 'starter-dht11');
    expect(dhtCircuit?.arduinoCode).toContain('#include <DHT.h>');
  });
});

// ---------------------------------------------------------------------------
// UI Component tests
// ---------------------------------------------------------------------------

describe('StarterCircuitsPanel', () => {
  const mockWriteText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    // Mock clipboard API — navigator.clipboard is getter-only in happy-dom
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });
    mockWriteText.mockClear();
  });

  it('renders the panel with all circuits', () => {
    render(<StarterCircuitsPanel />);
    expect(screen.getByTestId('starter-circuits-panel')).toBeDefined();
  });

  it('shows the correct count', () => {
    render(<StarterCircuitsPanel />);
    const count = screen.getByTestId('starter-circuits-count');
    const total = getAllStarterCircuits().length;
    expect(count.textContent).toContain(`${total} / ${total}`);
  });

  it('renders a card for each circuit', () => {
    render(<StarterCircuitsPanel />);
    for (const c of getAllStarterCircuits()) {
      expect(screen.getByTestId(`starter-card-${c.id}`)).toBeDefined();
    }
  });

  it('renders search input', () => {
    render(<StarterCircuitsPanel />);
    expect(screen.getByTestId('starter-circuits-search')).toBeDefined();
  });

  it('filters by search query', () => {
    render(<StarterCircuitsPanel />);
    const search = screen.getByTestId('starter-circuits-search');
    fireEvent.change(search, { target: { value: 'servo' } });

    const allCircuits = getAllStarterCircuits();
    const expected = allCircuits.filter(
      (c) =>
        c.name.toLowerCase().includes('servo') ||
        c.description.toLowerCase().includes('servo') ||
        c.tags.some((t) => t.includes('servo')),
    );

    // Cards matching should be visible
    for (const c of expected) {
      expect(screen.getByTestId(`starter-card-${c.id}`)).toBeDefined();
    }
  });

  it('filters by category', () => {
    render(<StarterCircuitsPanel />);
    const sensorsBtn = screen.getByTestId('starter-filter-category-sensors');
    fireEvent.click(sensorsBtn);

    const sensorCircuits = getStarterCircuitsByCategory('sensors');
    const nonSensorCircuits = getAllStarterCircuits().filter((c) => c.category !== 'sensors');

    for (const c of sensorCircuits) {
      expect(screen.getByTestId(`starter-card-${c.id}`)).toBeDefined();
    }
    for (const c of nonSensorCircuits) {
      expect(screen.queryByTestId(`starter-card-${c.id}`)).toBeNull();
    }
  });

  it('filters by difficulty', () => {
    render(<StarterCircuitsPanel />);
    const intermediateBtn = screen.getByTestId('starter-filter-difficulty-intermediate');
    fireEvent.click(intermediateBtn);

    const intermediateCircuits = getStarterCircuitsByDifficulty('intermediate');
    const beginnerCircuits = getAllStarterCircuits().filter((c) => c.difficulty !== 'intermediate');

    for (const c of intermediateCircuits) {
      expect(screen.getByTestId(`starter-card-${c.id}`)).toBeDefined();
    }
    for (const c of beginnerCircuits) {
      expect(screen.queryByTestId(`starter-card-${c.id}`)).toBeNull();
    }
  });

  it('"All" category button resets category filter', () => {
    render(<StarterCircuitsPanel />);
    fireEvent.click(screen.getByTestId('starter-filter-category-motors'));
    fireEvent.click(screen.getByTestId('starter-filter-category-all'));

    const total = getAllStarterCircuits().length;
    const count = screen.getByTestId('starter-circuits-count');
    expect(count.textContent).toContain(`${total} / ${total}`);
  });

  it('"All Levels" button resets difficulty filter', () => {
    render(<StarterCircuitsPanel />);
    fireEvent.click(screen.getByTestId('starter-filter-difficulty-beginner'));
    fireEvent.click(screen.getByTestId('starter-filter-difficulty-all'));

    const total = getAllStarterCircuits().length;
    const count = screen.getByTestId('starter-circuits-count');
    expect(count.textContent).toContain(`${total} / ${total}`);
  });

  it('shows empty state when no circuits match filters', () => {
    render(<StarterCircuitsPanel />);
    const search = screen.getByTestId('starter-circuits-search');
    fireEvent.change(search, { target: { value: 'xyznonexistent' } });

    expect(screen.getByTestId('starter-circuits-empty')).toBeDefined();
  });

  it('clear filters button resets all filters', () => {
    render(<StarterCircuitsPanel />);
    const search = screen.getByTestId('starter-circuits-search');
    fireEvent.change(search, { target: { value: 'xyznonexistent' } });
    fireEvent.click(screen.getByTestId('starter-filter-category-motors'));

    fireEvent.click(screen.getByTestId('starter-circuits-clear-filters'));

    const total = getAllStarterCircuits().length;
    const count = screen.getByTestId('starter-circuits-count');
    expect(count.textContent).toContain(`${total} / ${total}`);
  });

  it('expands circuit details on click', () => {
    render(<StarterCircuitsPanel />);
    const firstCircuit = getAllStarterCircuits()[0];
    const card = screen.getByTestId(`starter-card-${firstCircuit.id}`);

    // Click to expand — the card header area
    fireEvent.click(card.querySelector('[class*="cursor-pointer"]')!);

    expect(screen.getByTestId(`starter-details-${firstCircuit.id}`)).toBeDefined();
  });

  it('shows components list when expanded', () => {
    render(<StarterCircuitsPanel />);
    const firstCircuit = getAllStarterCircuits()[0];
    const expandBtn = screen.getByTestId(`starter-expand-${firstCircuit.id}`);
    fireEvent.click(expandBtn);

    const details = screen.getByTestId(`starter-details-${firstCircuit.id}`);
    for (const comp of firstCircuit.components) {
      expect(details.textContent).toContain(comp.name);
    }
  });

  it('shows learning objectives when expanded', () => {
    render(<StarterCircuitsPanel />);
    const firstCircuit = getAllStarterCircuits()[0];
    fireEvent.click(screen.getByTestId(`starter-expand-${firstCircuit.id}`));

    const details = screen.getByTestId(`starter-details-${firstCircuit.id}`);
    for (const obj of firstCircuit.learningObjectives) {
      expect(details.textContent).toContain(obj);
    }
  });

  it('shows Arduino code when expanded', () => {
    render(<StarterCircuitsPanel />);
    const firstCircuit = getAllStarterCircuits()[0];
    fireEvent.click(screen.getByTestId(`starter-expand-${firstCircuit.id}`));

    const codeBlock = screen.getByTestId(`starter-code-${firstCircuit.id}`);
    expect(codeBlock.textContent).toContain('void setup()');
  });

  it('collapses on second click', () => {
    render(<StarterCircuitsPanel />);
    const firstCircuit = getAllStarterCircuits()[0];
    const expandBtn = screen.getByTestId(`starter-expand-${firstCircuit.id}`);

    fireEvent.click(expandBtn);
    expect(screen.getByTestId(`starter-details-${firstCircuit.id}`)).toBeDefined();

    fireEvent.click(expandBtn);
    expect(screen.queryByTestId(`starter-details-${firstCircuit.id}`)).toBeNull();
  });

  it('copy code button copies to clipboard', async () => {
    render(<StarterCircuitsPanel />);
    const firstCircuit = getAllStarterCircuits()[0];
    fireEvent.click(screen.getByTestId(`starter-expand-${firstCircuit.id}`));

    const copyBtn = screen.getByTestId(`starter-copy-${firstCircuit.id}`);
    fireEvent.click(copyBtn);

    expect(mockWriteText).toHaveBeenCalledWith(firstCircuit.arduinoCode);
  });

  it('open circuit button copies code to clipboard', () => {
    render(<StarterCircuitsPanel />);
    const firstCircuit = getAllStarterCircuits()[0];
    fireEvent.click(screen.getByTestId(`starter-expand-${firstCircuit.id}`));

    const openBtn = screen.getByTestId(`starter-open-${firstCircuit.id}`);
    fireEvent.click(openBtn);

    expect(mockWriteText).toHaveBeenCalledWith(firstCircuit.arduinoCode);
  });

  it('displays difficulty badge for each circuit', () => {
    render(<StarterCircuitsPanel />);
    for (const c of getAllStarterCircuits()) {
      const badge = screen.getByTestId(`starter-difficulty-${c.id}`);
      expect(badge.textContent).toBe(c.difficulty);
    }
  });

  it('renders all category filter buttons', () => {
    render(<StarterCircuitsPanel />);
    expect(screen.getByTestId('starter-filter-category-all')).toBeDefined();
    for (const cat of STARTER_CATEGORIES) {
      expect(screen.getByTestId(`starter-filter-category-${cat}`)).toBeDefined();
    }
  });

  it('renders all difficulty filter buttons', () => {
    render(<StarterCircuitsPanel />);
    expect(screen.getByTestId('starter-filter-difficulty-all')).toBeDefined();
    for (const diff of STARTER_DIFFICULTIES) {
      expect(screen.getByTestId(`starter-filter-difficulty-${diff}`)).toBeDefined();
    }
  });

  it('combined category + difficulty filter narrows results', () => {
    render(<StarterCircuitsPanel />);
    fireEvent.click(screen.getByTestId('starter-filter-category-sensors'));
    fireEvent.click(screen.getByTestId('starter-filter-difficulty-beginner'));

    const expected = getAllStarterCircuits().filter(
      (c) => c.category === 'sensors' && c.difficulty === 'beginner',
    );

    const count = screen.getByTestId('starter-circuits-count');
    expect(count.textContent).toContain(`${expected.length} /`);
  });

  it('combined search + category filter narrows results', () => {
    render(<StarterCircuitsPanel />);
    fireEvent.click(screen.getByTestId('starter-filter-category-basics'));
    fireEvent.change(screen.getByTestId('starter-circuits-search'), {
      target: { value: 'led' },
    });

    const all = getAllStarterCircuits();
    const expected = all.filter(
      (c) =>
        c.category === 'basics' &&
        (c.name.toLowerCase().includes('led') ||
          c.description.toLowerCase().includes('led') ||
          c.tags.some((t) => t.includes('led'))),
    );

    const count = screen.getByTestId('starter-circuits-count');
    expect(count.textContent).toContain(`${expected.length} /`);
  });
});
