/**
 * Adaptive Hints — skill-level-aware contextual guidance
 *
 * Integrates with the Learning Path to determine the user's skill level,
 * then selects hint content appropriate for beginner/intermediate/advanced.
 * Hints are context-sensitive — they fire based on the current view and
 * recent user actions (or inactions).
 *
 * Persists dismissed hints and skill preferences to localStorage.
 * Singleton+subscribe pattern for React integration.
 *
 * Usage:
 *   const advisor = AdaptiveHintAdvisor.getInstance();
 *   const hints = advisor.getHintsForView('schematic', 'beginner');
 *
 * React hook:
 *   const { hints, dismissHint, skillLevel } = useAdaptiveHints(activeView);
 */

import { useCallback, useEffect, useState } from 'react';
import type { SkillLevel } from './learning-path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdaptiveHint {
  id: string;
  view: string;
  /** Minimum skill level to show this hint. 'beginner' hints show for all levels. */
  minLevel: SkillLevel;
  /** Maximum skill level to show this hint. 'advanced' hints show for all levels. */
  maxLevel: SkillLevel;
  title: string;
  content: string;
  /** Optional action label for a CTA button. */
  actionLabel?: string;
  /** Optional view to navigate to when the CTA is clicked. */
  actionView?: string;
  /** Category for grouping. */
  category: 'tip' | 'safety' | 'workflow' | 'shortcut' | 'concept';
  /** Priority (lower = shown first). */
  priority: number;
}

export interface AdaptiveHintState {
  hints: AdaptiveHint[];
  dismissedIds: Set<string>;
}

// ---------------------------------------------------------------------------
// Hint catalog
// ---------------------------------------------------------------------------

const SKILL_ORDER: Record<SkillLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

export const HINT_CATALOG: AdaptiveHint[] = [
  // Architecture — Beginner
  {
    id: 'arch-start-with-blocks',
    view: 'architecture',
    minLevel: 'beginner',
    maxLevel: 'beginner',
    title: 'Start with the Big Picture',
    content: 'Before diving into schematics, lay out your system as blocks. What components do you need? How do they connect? This makes the schematic phase much easier.',
    category: 'workflow',
    priority: 1,
  },
  {
    id: 'arch-use-ai',
    view: 'architecture',
    minLevel: 'beginner',
    maxLevel: 'intermediate',
    title: 'Let the AI Help',
    content: 'Describe what you want to build in the chat panel and the AI will generate an architecture for you. Try "Design a temperature monitoring system with ESP32."',
    category: 'tip',
    priority: 2,
  },

  // Schematic — Beginner
  {
    id: 'sch-power-ground',
    view: 'schematic',
    minLevel: 'beginner',
    maxLevel: 'beginner',
    title: 'Don\'t Forget Power & Ground',
    content: 'Every circuit needs power (VCC) and ground (GND) connections. Without them, simulation won\'t work and your design won\'t be valid.',
    category: 'safety',
    priority: 1,
  },
  {
    id: 'sch-drc-early',
    view: 'schematic',
    minLevel: 'beginner',
    maxLevel: 'intermediate',
    title: 'Run DRC Early and Often',
    content: 'The Design Rule Check catches wiring errors before they become hard to find. Run it after connecting a few components — don\'t wait until the end.',
    category: 'workflow',
    priority: 2,
  },
  {
    id: 'sch-net-names',
    view: 'schematic',
    minLevel: 'intermediate',
    maxLevel: 'advanced',
    title: 'Name Your Nets',
    content: 'Meaningful net names (SDA, SCK, MOTOR_PWM) make your schematic self-documenting and simplify PCB layout. Right-click a wire to assign a net name.',
    category: 'tip',
    priority: 3,
  },

  // Simulation
  {
    id: 'sim-dc-first',
    view: 'simulation',
    minLevel: 'beginner',
    maxLevel: 'beginner',
    title: 'Start with DC Analysis',
    content: 'DC Operating Point analysis shows the steady-state voltages and currents at every node. It\'s the simplest and most useful first simulation to run.',
    category: 'concept',
    priority: 1,
  },
  {
    id: 'sim-probes',
    view: 'simulation',
    minLevel: 'intermediate',
    maxLevel: 'advanced',
    title: 'Place Probes Before Running',
    content: 'Add voltage probes to the nodes you care about before running transient analysis. This makes the results panel show exactly the waveforms you need.',
    category: 'tip',
    priority: 2,
  },

  // PCB
  {
    id: 'pcb-placement-first',
    view: 'pcb',
    minLevel: 'beginner',
    maxLevel: 'beginner',
    title: 'Place Before Routing',
    content: 'Good component placement is 80% of PCB design. Arrange components logically — keep related parts close together — before routing any traces.',
    category: 'concept',
    priority: 1,
  },
  {
    id: 'pcb-decoupling',
    view: 'pcb',
    minLevel: 'intermediate',
    maxLevel: 'advanced',
    title: 'Decoupling Capacitors Close to ICs',
    content: 'Place 100nF decoupling capacitors as close as possible to each IC\'s power pin. Short traces to the cap, then to the power plane.',
    category: 'safety',
    priority: 2,
  },
  {
    id: 'pcb-ground-plane',
    view: 'pcb',
    minLevel: 'intermediate',
    maxLevel: 'advanced',
    title: 'Use a Ground Plane',
    content: 'A continuous ground plane on the bottom layer reduces noise, provides shielding, and simplifies routing. Avoid splitting it with signal traces.',
    category: 'concept',
    priority: 3,
  },

  // Validation
  {
    id: 'val-fix-p0-first',
    view: 'validation',
    minLevel: 'beginner',
    maxLevel: 'intermediate',
    title: 'Fix Critical Issues First',
    content: 'Focus on Error-severity issues before Warnings. Errors indicate real problems (shorts, unconnected pins) while warnings are often suggestions for improvement.',
    category: 'workflow',
    priority: 1,
  },

  // Export
  {
    id: 'exp-gerber-preview',
    view: 'output',
    minLevel: 'beginner',
    maxLevel: 'intermediate',
    title: 'Preview Before Ordering',
    content: 'Always preview your Gerber files in a viewer before sending them to a fab house. Most fabricators offer free online Gerber viewers.',
    category: 'workflow',
    priority: 1,
  },

  // BOM / Procurement
  {
    id: 'bom-check-stock',
    view: 'procurement',
    minLevel: 'beginner',
    maxLevel: 'intermediate',
    title: 'Check Availability Before Committing',
    content: 'Use the Compare Suppliers feature to check stock levels and lead times. Out-of-stock parts can delay your entire project.',
    category: 'tip',
    priority: 1,
  },
  {
    id: 'bom-alternates',
    view: 'procurement',
    minLevel: 'intermediate',
    maxLevel: 'advanced',
    title: 'Define Alternate Parts',
    content: 'For every critical component, define at least one alternate part. This protects against supply chain disruptions and gives you pricing flexibility.',
    category: 'safety',
    priority: 2,
  },

  // Arduino / Firmware
  {
    id: 'ard-start-simple',
    view: 'arduino',
    minLevel: 'beginner',
    maxLevel: 'beginner',
    title: 'Start with a Starter Circuit',
    content: 'Check the Starter Circuits tab for pre-built examples. They\'re a great way to learn how code maps to circuit behavior.',
    actionLabel: 'Browse Starters',
    actionView: 'starter_circuits',
    category: 'tip',
    priority: 1,
  },

  // Circuit Code
  {
    id: 'code-try-examples',
    view: 'circuit_code',
    minLevel: 'beginner',
    maxLevel: 'intermediate',
    title: 'Try the Code Snippets',
    content: 'Use the snippet menu to insert common patterns like voltage dividers, filters, and amplifiers. You can customize them after insertion.',
    category: 'tip',
    priority: 1,
  },

  // Breadboard
  {
    id: 'bb-power-rails',
    view: 'breadboard',
    minLevel: 'beginner',
    maxLevel: 'beginner',
    title: 'Use the Power Rails',
    content: 'The red (+) and blue (-) strips along the edges of the breadboard are power rails. Connect them to VCC and GND first, then branch out to your components.',
    category: 'concept',
    priority: 1,
  },

  // Global shortcuts
  {
    id: 'global-keyboard',
    view: 'architecture',
    minLevel: 'intermediate',
    maxLevel: 'advanced',
    title: 'Keyboard Shortcuts',
    content: 'Press ? anywhere to see all keyboard shortcuts. Ctrl+K opens the command palette for quick navigation.',
    category: 'shortcut',
    priority: 10,
  },
];

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const DISMISSED_KEY = 'protopulse-adaptive-hints-dismissed';

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(dismissed: Set<string>): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(dismissed)));
  } catch {
    // localStorage may be full or unavailable
  }
}

// ---------------------------------------------------------------------------
// Manager (singleton+subscribe)
// ---------------------------------------------------------------------------

type Listener = () => void;

function levelInRange(level: SkillLevel, min: SkillLevel, max: SkillLevel): boolean {
  return SKILL_ORDER[level] >= SKILL_ORDER[min] && SKILL_ORDER[level] <= SKILL_ORDER[max];
}

export class AdaptiveHintAdvisor {
  private static instance: AdaptiveHintAdvisor | null = null;
  private listeners = new Set<Listener>();
  private dismissed: Set<string>;

  private constructor() {
    this.dismissed = loadDismissed();
  }

  static getInstance(): AdaptiveHintAdvisor {
    if (!AdaptiveHintAdvisor.instance) {
      AdaptiveHintAdvisor.instance = new AdaptiveHintAdvisor();
    }
    return AdaptiveHintAdvisor.instance;
  }

  /** For testing — reset the singleton. */
  static resetInstance(): void {
    AdaptiveHintAdvisor.instance = null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  /**
   * Get hints appropriate for the current view and skill level.
   * Returns hints sorted by priority, excluding dismissed ones.
   */
  getHintsForView(view: string, skillLevel: SkillLevel): AdaptiveHint[] {
    return HINT_CATALOG
      .filter((h) => h.view === view)
      .filter((h) => levelInRange(skillLevel, h.minLevel, h.maxLevel))
      .filter((h) => !this.dismissed.has(h.id))
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get all undismissed hints for a skill level across all views.
   */
  getAllHints(skillLevel: SkillLevel): AdaptiveHint[] {
    return HINT_CATALOG
      .filter((h) => levelInRange(skillLevel, h.minLevel, h.maxLevel))
      .filter((h) => !this.dismissed.has(h.id))
      .sort((a, b) => a.priority - b.priority);
  }

  dismissHint(hintId: string): void {
    if (this.dismissed.has(hintId)) return;
    this.dismissed.add(hintId);
    saveDismissed(this.dismissed);
    this.notify();
  }

  isDismissed(hintId: string): boolean {
    return this.dismissed.has(hintId);
  }

  resetDismissals(): void {
    this.dismissed.clear();
    saveDismissed(this.dismissed);
    this.notify();
  }

  getDismissedCount(): number {
    return this.dismissed.size;
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useAdaptiveHints(activeView: string, skillLevel: SkillLevel = 'beginner') {
  const advisor = AdaptiveHintAdvisor.getInstance();
  const [hints, setHints] = useState<AdaptiveHint[]>(
    advisor.getHintsForView(activeView, skillLevel),
  );

  useEffect(() => {
    const update = () => setHints(advisor.getHintsForView(activeView, skillLevel));
    update(); // re-evaluate on view/level change
    return advisor.subscribe(update);
  }, [advisor, activeView, skillLevel]);

  const dismissHint = useCallback(
    (hintId: string) => advisor.dismissHint(hintId),
    [advisor],
  );

  const resetDismissals = useCallback(
    () => advisor.resetDismissals(),
    [advisor],
  );

  return { hints, dismissHint, resetDismissals, advisor };
}
