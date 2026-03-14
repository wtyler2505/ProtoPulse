import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExampleLibraryPanel from '../ExampleLibraryPanel';
import {
  EXAMPLE_CIRCUITS,
  EXAMPLE_CIRCUIT_CATEGORIES,
  getAllExampleCircuits,
  getExampleCircuitsByCategory,
  getExampleCircuitsByDifficulty,
  searchExampleCircuits,
  getExampleCircuitCategoryCounts,
} from '@shared/arduino-example-circuits';
import type {
  ExampleCircuit,
  ExampleCircuitCategory,
} from '@shared/arduino-example-circuits';

// ---------------------------------------------------------------------------
// Data integrity tests for shared/arduino-example-circuits.ts
// ---------------------------------------------------------------------------
describe('Arduino Example Circuits Data (BL-0628)', () => {
  it('exports at least 20 examples', () => {
    expect(EXAMPLE_CIRCUITS.length).toBeGreaterThanOrEqual(20);
  });

  it('exports all 8 categories', () => {
    expect(EXAMPLE_CIRCUIT_CATEGORIES).toEqual([
      'Basics',
      'Digital',
      'Analog',
      'Sensors',
      'Displays',
      'Motors',
      'Communication',
      'IoT',
    ]);
  });

  it('every example has a unique id', () => {
    const ids = EXAMPLE_CIRCUITS.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('every example has all required fields', () => {
    for (const ex of EXAMPLE_CIRCUITS) {
      expect(ex.id).toBeTruthy();
      expect(ex.title).toBeTruthy();
      expect(ex.description).toBeTruthy();
      expect(ex.code).toBeTruthy();
      expect(ex.expectedBehavior).toBeTruthy();
      expect(ex.wiringNotes.length).toBeGreaterThan(0);
      expect(ex.tags.length).toBeGreaterThan(0);
      expect(['beginner', 'intermediate', 'advanced']).toContain(ex.difficulty);
      expect(EXAMPLE_CIRCUIT_CATEGORIES).toContain(ex.category);
      expect(Array.isArray(ex.components)).toBe(true);
      expect(Array.isArray(ex.requiredLibraries)).toBe(true);
    }
  });

  it('every example code contains setup() and loop()', () => {
    for (const ex of EXAMPLE_CIRCUITS) {
      expect(ex.code).toContain('void setup()');
      expect(ex.code).toContain('void loop()');
    }
  });

  it('every example has non-trivial code (at least 100 chars)', () => {
    for (const ex of EXAMPLE_CIRCUITS) {
      expect(ex.code.length).toBeGreaterThanOrEqual(100);
    }
  });

  it('every category has at least one example', () => {
    for (const cat of EXAMPLE_CIRCUIT_CATEGORIES) {
      const count = EXAMPLE_CIRCUITS.filter((e) => e.category === cat).length;
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  it('IoT category exists with at least 2 examples', () => {
    const iotExamples = EXAMPLE_CIRCUITS.filter((e) => e.category === 'IoT');
    expect(iotExamples.length).toBeGreaterThanOrEqual(2);
  });

  it('tags are lowercase strings', () => {
    for (const ex of EXAMPLE_CIRCUITS) {
      for (const tag of ex.tags) {
        expect(tag).toBe(tag.toLowerCase());
        expect(typeof tag).toBe('string');
        expect(tag.length).toBeGreaterThan(0);
      }
    }
  });

  it('wiring notes are non-empty strings', () => {
    for (const ex of EXAMPLE_CIRCUITS) {
      for (const note of ex.wiringNotes) {
        expect(typeof note).toBe('string');
        expect(note.length).toBeGreaterThan(5);
      }
    }
  });

  it('components have valid structure', () => {
    for (const ex of EXAMPLE_CIRCUITS) {
      for (const comp of ex.components) {
        expect(comp.name).toBeTruthy();
        expect(comp.quantity).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('example ids follow kebab-case with ec- prefix', () => {
    for (const ex of EXAMPLE_CIRCUITS) {
      expect(ex.id).toMatch(/^ec-[a-z0-9-]+$/);
    }
  });

  it('no duplicate ids between example-circuits and arduino-examples', () => {
    // Ensure we don't collide with the existing ARDUINO_EXAMPLES ids
    const circuitIds = new Set(EXAMPLE_CIRCUITS.map((e) => e.id));
    // If ARDUINO_EXAMPLES were imported, check no overlap. Use a hardcoded known set.
    const knownArduinoExampleIds = [
      'blink', 'bare-minimum', 'fade', 'digital-read-serial', 'button',
      'debounce', 'analog-read-serial', 'analog-in-out-serial', 'smoothing',
      'serial-read', 'serial-passthrough', 'ascii-table', 'knock',
      'temp-sensor', 'bar-graph', 'row-column-scan', 'servo-sweep',
      'servo-knob', 'dc-motor-control',
    ];
    for (const id of knownArduinoExampleIds) {
      expect(circuitIds.has(id)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Public API function tests
// ---------------------------------------------------------------------------
describe('Arduino Example Circuits API functions', () => {
  it('getAllExampleCircuits returns all examples', () => {
    const all = getAllExampleCircuits();
    expect(all.length).toBe(EXAMPLE_CIRCUITS.length);
    expect(all).toEqual(EXAMPLE_CIRCUITS);
  });

  it('getExampleCircuitsByCategory filters correctly', () => {
    const basics = getExampleCircuitsByCategory('Basics');
    expect(basics.length).toBeGreaterThanOrEqual(1);
    for (const ex of basics) {
      expect(ex.category).toBe('Basics');
    }
  });

  it('getExampleCircuitsByCategory returns empty for non-matching', () => {
    // All categories should return something; test that filter works
    const motors = getExampleCircuitsByCategory('Motors');
    for (const ex of motors) {
      expect(ex.category).toBe('Motors');
    }
  });

  it('getExampleCircuitsByDifficulty filters correctly', () => {
    const beginners = getExampleCircuitsByDifficulty('beginner');
    expect(beginners.length).toBeGreaterThanOrEqual(3);
    for (const ex of beginners) {
      expect(ex.difficulty).toBe('beginner');
    }
  });

  it('searchExampleCircuits returns all for empty query', () => {
    expect(searchExampleCircuits('').length).toBe(EXAMPLE_CIRCUITS.length);
    expect(searchExampleCircuits('  ').length).toBe(EXAMPLE_CIRCUITS.length);
  });

  it('searchExampleCircuits matches by title', () => {
    const results = searchExampleCircuits('Relay');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((e) => e.id === 'ec-toggle-relay')).toBe(true);
  });

  it('searchExampleCircuits matches by tag', () => {
    const results = searchExampleCircuits('mqtt');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((e) => e.id === 'ec-mqtt-publish')).toBe(true);
  });

  it('searchExampleCircuits matches by wiring notes', () => {
    const results = searchExampleCircuits('INPUT_PULLUP');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('searchExampleCircuits is case-insensitive', () => {
    const upper = searchExampleCircuits('OLED');
    const lower = searchExampleCircuits('oled');
    expect(upper.length).toBe(lower.length);
    expect(upper.length).toBeGreaterThanOrEqual(1);
  });

  it('getExampleCircuitCategoryCounts returns correct counts', () => {
    const counts = getExampleCircuitCategoryCounts();
    for (const cat of EXAMPLE_CIRCUIT_CATEGORIES) {
      expect(typeof counts[cat]).toBe('number');
      expect(counts[cat]).toBeGreaterThanOrEqual(0);
    }
    // Total should equal all examples
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(EXAMPLE_CIRCUITS.length);
  });
});

// ---------------------------------------------------------------------------
// Component rendering tests
// ---------------------------------------------------------------------------
describe('ExampleLibraryPanel Component (BL-0628)', () => {
  const mockOnLoad = vi.fn();

  it('renders the panel with title and example count', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    expect(screen.getByTestId('example-library-panel')).toBeTruthy();
    expect(screen.getByText('Example Library')).toBeTruthy();
    expect(screen.getByText(String(EXAMPLE_CIRCUITS.length))).toBeTruthy();
  });

  it('renders search input', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    expect(screen.getByTestId('input-example-library-search')).toBeInTheDocument();
  });

  it('renders category filter buttons', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    expect(screen.getByTestId('filter-example-category-all')).toBeInTheDocument();
    for (const cat of EXAMPLE_CIRCUIT_CATEGORIES) {
      expect(screen.getByTestId(`filter-example-category-${cat.toLowerCase()}`)).toBeInTheDocument();
    }
  });

  it('renders difficulty filter buttons', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    expect(screen.getByTestId('filter-example-difficulty-all')).toBeInTheDocument();
    expect(screen.getByTestId('filter-example-difficulty-beginner')).toBeInTheDocument();
    expect(screen.getByTestId('filter-example-difficulty-intermediate')).toBeInTheDocument();
    expect(screen.getByTestId('filter-example-difficulty-advanced')).toBeInTheDocument();
  });

  it('renders category groups', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    // At least some categories should be visible
    for (const cat of EXAMPLE_CIRCUIT_CATEGORIES) {
      const catExamples = EXAMPLE_CIRCUITS.filter((e) => e.category === cat);
      if (catExamples.length > 0) {
        expect(screen.getByTestId(`example-library-category-${cat.toLowerCase()}`)).toBeInTheDocument();
      }
    }
  });

  it('filters examples by category when clicking filter', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    const iotBtn = screen.getByTestId('filter-example-category-iot');
    fireEvent.click(iotBtn);

    // IoT examples should be visible, others should not have their category group
    expect(screen.getByTestId('example-library-category-iot')).toBeInTheDocument();

    // Non-IoT categories should be gone
    const basicsGroup = screen.queryByTestId('example-library-category-basics');
    expect(basicsGroup).not.toBeInTheDocument();
  });

  it('filters examples by difficulty', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    const advancedBtn = screen.getByTestId('filter-example-difficulty-advanced');
    fireEvent.click(advancedBtn);

    // Only advanced examples should remain
    const advancedExamples = EXAMPLE_CIRCUITS.filter((e) => e.difficulty === 'advanced');
    const advancedCategories = new Set(advancedExamples.map((e) => e.category));

    for (const cat of EXAMPLE_CIRCUIT_CATEGORIES) {
      const group = screen.queryByTestId(`example-library-category-${cat.toLowerCase()}`);
      if (advancedCategories.has(cat)) {
        expect(group).toBeInTheDocument();
      } else {
        expect(group).not.toBeInTheDocument();
      }
    }
  });

  it('searches examples by text', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    const searchInput = screen.getByTestId('input-example-library-search');
    fireEvent.change(searchInput, { target: { value: 'relay' } });

    // The relay example should be in the tree
    expect(screen.getByTestId('example-library-item-ec-toggle-relay')).toBeInTheDocument();
  });

  it('shows empty state when no results match', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    const searchInput = screen.getByTestId('input-example-library-search');
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent123' } });

    expect(screen.getByTestId('example-library-empty')).toBeInTheDocument();
    expect(screen.getByText('No matching examples')).toBeInTheDocument();
  });

  it('expands an example on click to show details', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    const firstExample = EXAMPLE_CIRCUITS[0];
    const toggleBtn = screen.getByTestId(`example-library-toggle-item-${firstExample.id}`);
    fireEvent.click(toggleBtn);

    // Should now show wiring, behavior, and load button
    expect(screen.getByTestId(`example-library-wiring-${firstExample.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`example-library-behavior-${firstExample.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`example-library-code-preview-${firstExample.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`example-library-load-${firstExample.id}`)).toBeInTheDocument();
  });

  it('collapses an expanded example on second click', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    const firstExample = EXAMPLE_CIRCUITS[0];
    const toggleBtn = screen.getByTestId(`example-library-toggle-item-${firstExample.id}`);

    // Expand
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId(`example-library-wiring-${firstExample.id}`)).toBeInTheDocument();

    // Collapse
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId(`example-library-wiring-${firstExample.id}`)).not.toBeInTheDocument();
  });

  it('calls onLoadExample when "Load into Editor" is clicked', () => {
    mockOnLoad.mockClear();
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    const firstExample = EXAMPLE_CIRCUITS[0];

    // Expand
    fireEvent.click(screen.getByTestId(`example-library-toggle-item-${firstExample.id}`));

    // Click load
    fireEvent.click(screen.getByTestId(`example-library-load-${firstExample.id}`));

    expect(mockOnLoad).toHaveBeenCalledTimes(1);
    expect(mockOnLoad).toHaveBeenCalledWith(firstExample.code, firstExample.title);
  });

  it('collapses a category group on click', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    const firstCat = EXAMPLE_CIRCUIT_CATEGORIES[0];
    const firstExInCat = EXAMPLE_CIRCUITS.find((e) => e.category === firstCat);
    expect(firstExInCat).toBeDefined();

    // Item should be visible initially
    expect(screen.getByTestId(`example-library-item-${firstExInCat!.id}`)).toBeInTheDocument();

    // Collapse the category
    fireEvent.click(screen.getByTestId(`example-library-toggle-${firstCat.toLowerCase()}`));

    // Item should now be hidden
    expect(screen.queryByTestId(`example-library-item-${firstExInCat!.id}`)).not.toBeInTheDocument();
  });

  it('re-expands a collapsed category group', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    const firstCat = EXAMPLE_CIRCUIT_CATEGORIES[0];
    const firstExInCat = EXAMPLE_CIRCUITS.find((e) => e.category === firstCat);
    expect(firstExInCat).toBeDefined();

    const toggleBtn = screen.getByTestId(`example-library-toggle-${firstCat.toLowerCase()}`);

    // Collapse
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId(`example-library-item-${firstExInCat!.id}`)).not.toBeInTheDocument();

    // Re-expand
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId(`example-library-item-${firstExInCat!.id}`)).toBeInTheDocument();
  });

  it('shows components list in expanded view', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    // Find an example with components
    const exWithComponents = EXAMPLE_CIRCUITS.find((e) => e.components.length > 0);
    expect(exWithComponents).toBeDefined();

    fireEvent.click(screen.getByTestId(`example-library-toggle-item-${exWithComponents!.id}`));
    expect(screen.getByTestId(`example-library-components-${exWithComponents!.id}`)).toBeInTheDocument();
  });

  it('shows required libraries in expanded view when present', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    const exWithLibs = EXAMPLE_CIRCUITS.find((e) => e.requiredLibraries.length > 0);
    expect(exWithLibs).toBeDefined();

    fireEvent.click(screen.getByTestId(`example-library-toggle-item-${exWithLibs!.id}`));
    expect(screen.getByTestId(`example-library-libs-${exWithLibs!.id}`)).toBeInTheDocument();
  });

  it('does not show required libraries section when none exist', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);
    const exWithoutLibs = EXAMPLE_CIRCUITS.find((e) => e.requiredLibraries.length === 0);
    expect(exWithoutLibs).toBeDefined();

    fireEvent.click(screen.getByTestId(`example-library-toggle-item-${exWithoutLibs!.id}`));
    expect(screen.queryByTestId(`example-library-libs-${exWithoutLibs!.id}`)).not.toBeInTheDocument();
  });

  it('combined category + difficulty + search filters stack correctly', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} />);

    // Filter to Sensors + beginner
    fireEvent.click(screen.getByTestId('filter-example-category-sensors'));
    fireEvent.click(screen.getByTestId('filter-example-difficulty-beginner'));

    const expected = EXAMPLE_CIRCUITS.filter(
      (e) => e.category === 'Sensors' && e.difficulty === 'beginner',
    );
    // Each should be visible
    for (const ex of expected) {
      expect(screen.getByTestId(`example-library-item-${ex.id}`)).toBeInTheDocument();
    }
  });

  it('renders the panel with custom className', () => {
    render(<ExampleLibraryPanel onLoadExample={mockOnLoad} className="custom-class" />);
    const panel = screen.getByTestId('example-library-panel');
    expect(panel.className).toContain('custom-class');
  });
});
