/**
 * ScenarioManager — singleton+subscribe manager for simulation scenarios.
 *
 * Provides CRUD for simulation scenarios with built-in presets.
 * User scenarios persist to localStorage; presets are always available.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SimType = 'dc' | 'ac' | 'transient';

export interface SimulationParameters {
  frequencyStart?: number;
  frequencyEnd?: number;
  frequencyPoints?: number;
  timeSpan?: number;
  timeStep?: number;
  temperature?: number;
  sourceType?: string;
  sourceAmplitude?: number;
}

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  simType: SimType;
  parameters: SimulationParameters;
  componentOverrides?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScenarioData {
  name: string;
  description: string;
  simType: SimType;
  parameters: SimulationParameters;
  componentOverrides?: Record<string, string>;
}

type Listener = () => void;

const STORAGE_KEY = 'protopulse-sim-scenarios';

// ---------------------------------------------------------------------------
// Built-in presets
// ---------------------------------------------------------------------------

const PRESET_IDS = new Set([
  'preset-quick-dc',
  'preset-audio-ac',
  'preset-power-on-transient',
  'preset-1mhz-rf',
]);

function createPresets(): SimulationScenario[] {
  const now = new Date(0).toISOString(); // Epoch — presets have no meaningful timestamp
  return [
    {
      id: 'preset-quick-dc',
      name: 'Quick DC Check',
      description: 'Basic DC operating point analysis at room temperature',
      simType: 'dc',
      parameters: { temperature: 25 },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'preset-audio-ac',
      name: 'Audio Band AC Sweep',
      description: 'AC frequency sweep across the audible range (20 Hz - 20 kHz)',
      simType: 'ac',
      parameters: { frequencyStart: 20, frequencyEnd: 20000, frequencyPoints: 100 },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'preset-power-on-transient',
      name: 'Power-On Transient',
      description: 'Transient analysis of the first 100 ms after power-on',
      simType: 'transient',
      parameters: { timeSpan: 0.1, timeStep: 0.0001 },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'preset-1mhz-rf',
      name: '1 MHz RF Sweep',
      description: 'AC frequency sweep from 1 kHz to 1 MHz for RF circuit analysis',
      simType: 'ac',
      parameters: { frequencyStart: 1000, frequencyEnd: 1000000, frequencyPoints: 200 },
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// ---------------------------------------------------------------------------
// ScenarioManager
// ---------------------------------------------------------------------------

class ScenarioManager {
  private presets: SimulationScenario[];
  private userScenarios: SimulationScenario[] = [];
  private activeScenarioId: string | null = null;
  private listeners = new Set<Listener>();
  private _version = 0;

  constructor() {
    this.presets = createPresets();
    this.load();
  }

  /** Monotonic version counter for useSyncExternalStore integration. */
  get version(): number {
    return this._version;
  }

  // ---- Query API ----

  /** List all scenarios: presets first, then user scenarios sorted by name. */
  listScenarios(): SimulationScenario[] {
    return [...this.presets, ...this.userScenarios];
  }

  /** Get a single scenario by ID (searches both presets and user scenarios). */
  getScenario(id: string): SimulationScenario | undefined {
    return this.presets.find((s) => s.id === id) ?? this.userScenarios.find((s) => s.id === id);
  }

  /** Check if a scenario ID is a built-in preset. */
  isPreset(id: string): boolean {
    return PRESET_IDS.has(id);
  }

  /** Get the currently active scenario, or undefined if none. */
  getActiveScenario(): SimulationScenario | undefined {
    if (this.activeScenarioId === null) {
      return undefined;
    }
    return this.getScenario(this.activeScenarioId);
  }

  /** Get the active scenario ID (or null). */
  getActiveScenarioId(): string | null {
    return this.activeScenarioId;
  }

  // ---- Mutation API ----

  /** Create a new user scenario. Returns the created scenario. */
  createScenario(data: CreateScenarioData): SimulationScenario {
    const now = new Date().toISOString();
    const scenario: SimulationScenario = {
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description,
      simType: data.simType,
      parameters: { ...data.parameters },
      componentOverrides: data.componentOverrides ? { ...data.componentOverrides } : undefined,
      createdAt: now,
      updatedAt: now,
    };
    this.userScenarios.push(scenario);
    this._version++;
    this.persist();
    this.notify();
    return scenario;
  }

  /** Update an existing user scenario. Cannot update presets. Returns the updated scenario or undefined. */
  updateScenario(id: string, data: Partial<CreateScenarioData>): SimulationScenario | undefined {
    if (this.isPreset(id)) {
      return undefined;
    }

    const index = this.userScenarios.findIndex((s) => s.id === id);
    if (index === -1) {
      return undefined;
    }

    const existing = this.userScenarios[index];
    const updated: SimulationScenario = {
      ...existing,
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      simType: data.simType ?? existing.simType,
      parameters: data.parameters ? { ...data.parameters } : existing.parameters,
      componentOverrides: data.componentOverrides !== undefined ? data.componentOverrides : existing.componentOverrides,
      updatedAt: new Date().toISOString(),
    };
    this.userScenarios[index] = updated;
    this._version++;
    this.persist();
    this.notify();
    return updated;
  }

  /** Delete a user scenario. Cannot delete presets. Returns true if deleted. */
  deleteScenario(id: string): boolean {
    if (this.isPreset(id)) {
      return false;
    }

    const index = this.userScenarios.findIndex((s) => s.id === id);
    if (index === -1) {
      return false;
    }

    this.userScenarios.splice(index, 1);

    // Clear active if deleting the active scenario
    if (this.activeScenarioId === id) {
      this.activeScenarioId = null;
    }

    this._version++;
    this.persist();
    this.notify();
    return true;
  }

  /** Set the active scenario by ID. */
  setActiveScenario(id: string): void {
    // Verify it exists
    if (this.getScenario(id) === undefined) {
      return;
    }
    this.activeScenarioId = id;
    this._version++;
    this.persist();
    this.notify();
  }

  /** Clear the active scenario. */
  clearActiveScenario(): void {
    if (this.activeScenarioId === null) {
      return;
    }
    this.activeScenarioId = null;
    this._version++;
    this.persist();
    this.notify();
  }

  // ---- Subscribe pattern ----

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---- Internal ----

  private notify(): void {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }

  private persist(): void {
    try {
      const payload = {
        scenarios: this.userScenarios,
        activeScenarioId: this.activeScenarioId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage may be unavailable
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as {
        scenarios?: SimulationScenario[];
        activeScenarioId?: string | null;
      };

      if (Array.isArray(parsed.scenarios)) {
        this.userScenarios = parsed.scenarios.filter(
          (s): s is SimulationScenario =>
            typeof s === 'object' &&
            s !== null &&
            typeof s.id === 'string' &&
            typeof s.name === 'string' &&
            typeof s.simType === 'string' &&
            !PRESET_IDS.has(s.id), // Never load presets from storage
        );
      }

      if (typeof parsed.activeScenarioId === 'string' || parsed.activeScenarioId === null) {
        this.activeScenarioId = parsed.activeScenarioId;
      }
    } catch {
      // Ignore corrupt data
    }
  }

  /** Reset all user scenarios and active state. For testing only. */
  _reset(): void {
    this.userScenarios = [];
    this.activeScenarioId = null;
    this._version++;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    this.notify();
  }
}

/** Singleton instance. */
export const scenarioManager = new ScenarioManager();
