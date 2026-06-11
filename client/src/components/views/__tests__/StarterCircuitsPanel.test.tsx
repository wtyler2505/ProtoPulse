import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import StarterCircuitsPanel from '../StarterCircuitsPanel';
import { PENDING_STARTER_CIRCUIT_LAUNCH_KEY } from '@/lib/starter-circuit-launch';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';
import { RADIAL_AI_CHAT_DRAFT_EVENT } from '@/lib/radial-ai-commands';
import {
  getAllStarterCircuits,
  getStarterCircuitsByCategory,
  getStarterCircuitsByDifficulty,
  searchStarterCircuits,
  STARTER_CATEGORIES,
  STARTER_DIFFICULTIES,
} from '@shared/starter-circuits';
import type { StarterCategory, StarterDifficulty } from '@shared/starter-circuits';

const mockSetActiveView = vi.fn();
const mockToast = vi.fn();

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({
    setActiveView: mockSetActiveView,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

function dispatchStarterRadialCommand(
  commandId: string,
  targetId?: string,
  targetLabel?: string,
  activation?: RadialCommandEventDetail['activation'],
): RadialCommandEventDetail {
  const detail: RadialCommandEventDetail = {
    commandId,
    context: {
      view: 'starter_circuits',
      target: 'starter_circuit',
      targetId,
      targetLabel,
    },
    source: 'radial-menu',
  };
  if (activation) {
    detail.activation = activation;
  }
  act(() => {
    window.dispatchEvent(new CustomEvent(RADIAL_COMMAND_EVENT, { detail }));
  });
  return detail;
}

function dispatchStarterCanvasRadialCommand(
  commandId: string,
  activation?: RadialCommandEventDetail['activation'],
): RadialCommandEventDetail {
  const detail: RadialCommandEventDetail = {
    commandId,
    context: {
      view: 'starter_circuits',
      target: 'canvas',
      targetLabel: 'Starter gallery',
    },
    source: 'radial-menu',
  };
  if (activation) {
    detail.activation = activation;
  }
  act(() => {
    window.dispatchEvent(new CustomEvent(RADIAL_COMMAND_EVENT, { detail }));
  });
  return detail;
}

type TestStarterCircuit = ReturnType<typeof getAllStarterCircuits>[number];

function starterPartsText(circuit: TestStarterCircuit): string {
  return [
    `${circuit.name} parts`,
    ...circuit.components.map(
      (component) =>
        `${String(component.quantity)}x ${component.name}${component.value ? ` (${component.value})` : ''}`,
    ),
  ].join('\n');
}

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
    mockSetActiveView.mockClear();
    mockToast.mockClear();
    sessionStorage.clear();
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

  it('exposes starter circuit metadata for radial targeting', () => {
    render(<StarterCircuitsPanel />);
    const firstCircuit = getAllStarterCircuits()[0];
    const card = screen.getByTestId(`starter-card-${firstCircuit.id}`);

    expect(card).toHaveAttribute('data-starter-circuit-id', firstCircuit.id);
    expect(card).toHaveAttribute('data-starter-circuit-label', firstCircuit.name);
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

  it('open circuit button queues the sketch and switches to Arduino', () => {
    render(<StarterCircuitsPanel />);
    const firstCircuit = getAllStarterCircuits()[0];
    fireEvent.click(screen.getByTestId(`starter-expand-${firstCircuit.id}`));

    const openBtn = screen.getByTestId(`starter-open-${firstCircuit.id}`);
    fireEvent.click(openBtn);

    expect(mockWriteText).not.toHaveBeenCalled();
    expect(mockSetActiveView).toHaveBeenCalledWith('arduino');

    const queued = sessionStorage.getItem(PENDING_STARTER_CIRCUIT_LAUNCH_KEY);
    expect(queued).not.toBeNull();

    const parsed = JSON.parse(queued ?? '{}') as {
      id?: string;
      name?: string;
      arduinoCode?: string;
    };
    expect(parsed.id).toBe(firstCircuit.id);
    expect(parsed.name).toBe(firstCircuit.name);
    expect(parsed.arduinoCode).toBe(firstCircuit.arduinoCode);
  });

  it('drafts starter learning context to AI chat from a radial command', () => {
    const firstCircuit = getAllStarterCircuits()[0];
    const chatOpenListener = vi.fn();
    const chatDraftListener = vi.fn();
    window.addEventListener('protopulse:open-chat-panel', chatOpenListener);
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);

    try {
      render(<StarterCircuitsPanel />);

      const detail = dispatchStarterRadialCommand('ai_starter_learn', firstCircuit.id, firstCircuit.name);

      expect(detail.handled).toBe(true);
      expect(chatOpenListener).toHaveBeenCalledTimes(1);
      expect((chatOpenListener.mock.calls[0]?.[0] as CustomEvent<{ designAgent?: boolean }>).detail.designAgent).toBe(
        false,
      );
      expect(chatDraftListener).toHaveBeenCalledTimes(1);
      const message = (chatDraftListener.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message;
      expect(message).toContain('AI intent: starter_learn.');
      expect(message).toContain(`Starter circuit learning prompt: ${firstCircuit.name}`);
      expect(message).toContain(`Target: starter_circuit "${firstCircuit.name}"`);
      expect(message).toContain(`Selected starter: ${firstCircuit.name}`);
      expect(message).toContain('Components needed:');
      expect(message).toContain(firstCircuit.components[0].name);
      expect(message).toContain('What Tyler will learn:');
      expect(message).toContain(firstCircuit.learningObjectives[0]);
      expect(message).toContain('Arduino code preview:');
      expect(message).toContain('Gallery state:');
      expect(message).toContain('Search filter: none');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'AI Starter Drafted',
          description: `Drafted ${firstCircuit.name} learning prompt in AI chat.`,
        }),
      );
    } finally {
      window.removeEventListener('protopulse:open-chat-panel', chatOpenListener);
      window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);
    }
  });

  it('sends starter learning context immediately when radial AI command is shift-activated', () => {
    const firstCircuit = getAllStarterCircuits()[0];
    const chatDraftListener = vi.fn();
    const chatSendListener = vi.fn();
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);
    window.addEventListener('protopulse:chat-send', chatSendListener);

    try {
      render(<StarterCircuitsPanel />);

      const detail = dispatchStarterRadialCommand('ai_starter_learn', firstCircuit.id, firstCircuit.name, {
        input: 'mouse',
        sendNow: true,
        modifier: 'shift',
      });

      expect(detail.handled).toBe(true);
      expect(chatDraftListener).not.toHaveBeenCalled();
      expect(chatSendListener).toHaveBeenCalledTimes(1);
      const event = chatSendListener.mock.calls[0]?.[0] as CustomEvent<{
        message: string;
        source: string;
        delivery: string;
      }>;
      expect(event.detail.source).toBe('radial-ai');
      expect(event.detail.delivery).toBe('send-now');
      expect(event.detail.message).toContain('AI intent: starter_learn.');
      expect(event.detail.message).toContain(`Selected starter: ${firstCircuit.name}`);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'AI Starter Sent',
          description: `Sent ${firstCircuit.name} learning prompt to AI chat.`,
        }),
      );
    } finally {
      window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);
      window.removeEventListener('protopulse:chat-send', chatSendListener);
    }
  });

  it('opens and copies a starter circuit from radial commands', () => {
    const firstCircuit = getAllStarterCircuits()[0];
    render(<StarterCircuitsPanel />);

    const openDetail = dispatchStarterRadialCommand('open_starter_circuit', firstCircuit.id, firstCircuit.name);

    expect(openDetail.handled).toBe(true);
    expect(mockSetActiveView).toHaveBeenCalledWith('arduino');
    expect(sessionStorage.getItem(PENDING_STARTER_CIRCUIT_LAUNCH_KEY)).not.toBeNull();

    const copyDetail = dispatchStarterRadialCommand('copy_starter_code', firstCircuit.id, firstCircuit.name);

    expect(copyDetail.handled).toBe(true);
    expect(mockWriteText).toHaveBeenCalledWith(firstCircuit.arduinoCode);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Starter code copied',
        description: `Copied ${firstCircuit.name} code from the radial menu.`,
      }),
    );
  });

  it('uses target-aware starter radial commands for filters, details, and parts', () => {
    const firstCircuit = getAllStarterCircuits()[0];
    render(<StarterCircuitsPanel />);

    const categoryDetail = dispatchStarterRadialCommand('starter_show_category', firstCircuit.id, firstCircuit.name);
    expect(categoryDetail.handled).toBe(true);
    expect(screen.getByTestId('starter-circuits-count').textContent).toContain(
      `${getStarterCircuitsByCategory(firstCircuit.category).length} / ${getAllStarterCircuits().length}`,
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: `Filtered starter circuits to ${firstCircuit.name}'s category.`,
      }),
    );

    const difficultyDetail = dispatchStarterRadialCommand(
      'starter_show_difficulty',
      firstCircuit.id,
      firstCircuit.name,
    );
    expect(difficultyDetail.handled).toBe(true);
    expect(screen.getByTestId('starter-circuits-count').textContent).toContain(
      `${getStarterCircuitsByDifficulty(firstCircuit.difficulty).length} / ${getAllStarterCircuits().length}`,
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: `Filtered starter circuits to ${firstCircuit.name}'s difficulty level.`,
      }),
    );

    const expandDetail = dispatchStarterRadialCommand('starter_toggle_details', firstCircuit.id, firstCircuit.name);
    expect(expandDetail.handled).toBe(true);
    expect(screen.getByTestId(`starter-details-${firstCircuit.id}`)).toBeDefined();

    const collapseDetail = dispatchStarterRadialCommand('starter_toggle_details', firstCircuit.id, firstCircuit.name);
    expect(collapseDetail.handled).toBe(true);
    expect(screen.queryByTestId(`starter-details-${firstCircuit.id}`)).toBeNull();

    const partsDetail = dispatchStarterRadialCommand('copy_starter_parts', firstCircuit.id, firstCircuit.name);
    expect(partsDetail.handled).toBe(true);
    expect(mockWriteText).toHaveBeenCalledWith(starterPartsText(firstCircuit));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Starter parts copied',
        description: `Copied ${firstCircuit.name} parts list from the radial menu.`,
      }),
    );
  });

  it('uses the first visible starter circuit for canvas radial AI, open, and copy commands', () => {
    const firstCircuit = getAllStarterCircuits()[0];
    const chatDraftListener = vi.fn();
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);

    try {
      render(<StarterCircuitsPanel />);

      const aiDetail = dispatchStarterCanvasRadialCommand('ai_starter_learn');

      expect(aiDetail.handled).toBe(true);
      expect(chatDraftListener).toHaveBeenCalledTimes(1);
      const message = (chatDraftListener.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message;
      expect(message).toContain(`Starter circuit learning prompt: ${firstCircuit.name}`);
      expect(message).toContain('Target: canvas "Starter gallery"');
      expect(message).toContain(`Selected starter: ${firstCircuit.name}`);

      const openDetail = dispatchStarterCanvasRadialCommand('open_starter_circuit');
      expect(openDetail.handled).toBe(true);
      expect(mockSetActiveView).toHaveBeenCalledWith('arduino');

      const copyDetail = dispatchStarterCanvasRadialCommand('copy_starter_code');
      expect(copyDetail.handled).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith(firstCircuit.arduinoCode);
    } finally {
      window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);
    }
  });

  it('filters and resets starter circuits from canvas radial commands', () => {
    render(<StarterCircuitsPanel />);

    const beginnerDetail = dispatchStarterCanvasRadialCommand('starter_filter_beginner');
    expect(beginnerDetail.handled).toBe(true);
    expect(screen.getByTestId('starter-circuits-count').textContent).toContain(
      `${getStarterCircuitsByDifficulty('beginner').length} / ${getAllStarterCircuits().length}`,
    );
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Beginner Starters' }));

    const resetDetail = dispatchStarterCanvasRadialCommand('starter_reset_filters');
    expect(resetDetail.handled).toBe(true);
    expect(screen.getByTestId('starter-circuits-count').textContent).toContain(
      `${getAllStarterCircuits().length} / ${getAllStarterCircuits().length}`,
    );

    const sensorDetail = dispatchStarterCanvasRadialCommand('starter_filter_sensors');
    expect(sensorDetail.handled).toBe(true);
    expect(screen.getByTestId('starter-circuits-count').textContent).toContain(
      `${getStarterCircuitsByCategory('sensors').length} / ${getAllStarterCircuits().length}`,
    );
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sensor Starters' }));

    const motorDetail = dispatchStarterCanvasRadialCommand('starter_filter_motors');
    expect(motorDetail.handled).toBe(true);
    expect(screen.getByTestId('starter-circuits-count').textContent).toContain(
      `${getStarterCircuitsByCategory('motors').length} / ${getAllStarterCircuits().length}`,
    );
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Motor Starters' }));

    const displayDetail = dispatchStarterCanvasRadialCommand('starter_filter_displays');
    expect(displayDetail.handled).toBe(true);
    expect(screen.getByTestId('starter-circuits-count').textContent).toContain(
      `${getStarterCircuitsByCategory('displays').length} / ${getAllStarterCircuits().length}`,
    );
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Display Starters' }));
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

    const expected = getAllStarterCircuits().filter((c) => c.category === 'sensors' && c.difficulty === 'beginner');

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
