/**
 * InteractiveControlManager — manages interactive controls that appear on
 * components during live simulation (BL-0621).
 *
 * Click switches to toggle, drag potentiometer knobs to change resistance,
 * view LED voltage/brightness indicators. Control value changes feed back
 * into the simulation state via callbacks.
 *
 * Singleton + subscribe pattern for UI integration.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InteractiveControlType =
  | 'toggle'       // switches, relays, push buttons
  | 'slider'       // potentiometers, variable resistors, dimmers
  | 'indicator'    // LEDs, lamps, buzzers (read-only visual feedback)
  | 'momentary';   // momentary push buttons (active while held)

export interface InteractiveControl {
  /** The control type determines the UI widget rendered. */
  controlType: InteractiveControlType;
  /** Current value: boolean for toggle/momentary, number 0-1 for slider, number for indicator. */
  value: boolean | number;
  /** Human-readable label for the control. */
  label: string;
  /** Unit for display (e.g. 'Ω', 'V'). */
  unit?: string;
  /** Min value for slider controls. */
  min?: number;
  /** Max value for slider controls. */
  max?: number;
}

export type ControlChangeCallback = (
  instanceId: string,
  controlType: InteractiveControlType,
  value: boolean | number,
) => void;

type Listener = () => void;

// ---------------------------------------------------------------------------
// Component type → control type mapping
// ---------------------------------------------------------------------------

const COMPONENT_CONTROL_MAP: Record<string, InteractiveControlType> = {
  switch: 'toggle',
  spst: 'toggle',
  spdt: 'toggle',
  relay: 'toggle',
  pushbutton: 'momentary',
  push_button: 'momentary',
  momentary: 'momentary',
  potentiometer: 'slider',
  pot: 'slider',
  variable_resistor: 'slider',
  rheostat: 'slider',
  dimmer: 'slider',
  led: 'indicator',
  diode_led: 'indicator',
  lamp: 'indicator',
  buzzer: 'indicator',
  indicator: 'indicator',
};

/**
 * Determine the interactive control type for a given component type string.
 * Returns undefined if the component type has no interactive control.
 */
export function getControlTypeForComponent(componentType: string): InteractiveControlType | undefined {
  const lower = componentType.toLowerCase().replace(/[\s-]/g, '_');
  return COMPONENT_CONTROL_MAP[lower];
}

// ---------------------------------------------------------------------------
// Default control factories
// ---------------------------------------------------------------------------

function createDefaultControl(
  controlType: InteractiveControlType,
  componentType: string,
  refDes: string,
): InteractiveControl {
  switch (controlType) {
    case 'toggle':
      return {
        controlType: 'toggle',
        value: false,
        label: refDes,
      };
    case 'momentary':
      return {
        controlType: 'momentary',
        value: false,
        label: refDes,
      };
    case 'slider': {
      // Default potentiometer: 0-100% range
      const isPot = /pot|potentiometer|rheostat/i.test(componentType);
      return {
        controlType: 'slider',
        value: 0.5,
        label: refDes,
        unit: isPot ? 'Ω' : '%',
        min: 0,
        max: 1,
      };
    }
    case 'indicator':
      return {
        controlType: 'indicator',
        value: 0,
        label: refDes,
        unit: 'V',
      };
  }
}

// ---------------------------------------------------------------------------
// InteractiveControlManager (singleton + subscribe)
// ---------------------------------------------------------------------------

export class InteractiveControlManager {
  private static _instance: InteractiveControlManager | null = null;

  /** Active controls keyed by instanceId (referenceDesignator). */
  private controls = new Map<string, InteractiveControl>();

  /** Registered listeners for state changes. */
  private listeners = new Set<Listener>();

  /** Callback invoked when a user changes a control value. */
  private onChangeCallback: ControlChangeCallback | null = null;

  private constructor() {}

  static getInstance(): InteractiveControlManager {
    if (!InteractiveControlManager._instance) {
      InteractiveControlManager._instance = new InteractiveControlManager();
    }
    return InteractiveControlManager._instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    InteractiveControlManager._instance = null;
  }

  // -------------------------------------------------------------------------
  // Subscribe pattern
  // -------------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    Array.from(this.listeners).forEach((listener) => {
      listener();
    });
  }

  // -------------------------------------------------------------------------
  // Callback registration
  // -------------------------------------------------------------------------

  /**
   * Register a callback that fires when the user interacts with a control.
   * The simulation engine should listen here to re-run with updated values.
   */
  setOnChange(callback: ControlChangeCallback | null): void {
    this.onChangeCallback = callback;
  }

  // -------------------------------------------------------------------------
  // Control lifecycle
  // -------------------------------------------------------------------------

  /**
   * Register controls for circuit instances. Typically called when simulation
   * starts or circuit instances change.
   */
  registerInstances(
    instances: Array<{ referenceDesignator: string; componentType: string }>,
  ): void {
    this.controls.clear();

    instances.forEach((inst) => {
      const controlType = getControlTypeForComponent(inst.componentType);
      if (controlType) {
        this.controls.set(
          inst.referenceDesignator,
          createDefaultControl(controlType, inst.componentType, inst.referenceDesignator),
        );
      }
    });

    this.notify();
  }

  /**
   * Get the interactive control for a specific instance, or undefined if none.
   */
  getControlForInstance(instanceId: string): InteractiveControl | undefined {
    return this.controls.get(instanceId);
  }

  /**
   * Get all registered controls.
   */
  getAllControls(): ReadonlyMap<string, InteractiveControl> {
    return this.controls;
  }

  /**
   * Apply a user interaction to a control. Updates internal state and fires
   * the onChange callback so the simulation can re-evaluate.
   */
  applyControl(instanceId: string, controlType: InteractiveControlType, value: boolean | number): void {
    const existing = this.controls.get(instanceId);
    if (!existing) { return; }
    if (existing.controlType !== controlType) { return; }

    // Clamp slider values
    let clamped = value;
    if (controlType === 'slider' && typeof value === 'number') {
      const min = existing.min ?? 0;
      const max = existing.max ?? 1;
      clamped = Math.max(min, Math.min(max, value));
    }

    this.controls.set(instanceId, {
      ...existing,
      value: clamped,
    });

    this.notify();

    if (this.onChangeCallback) {
      this.onChangeCallback(instanceId, controlType, clamped);
    }
  }

  /**
   * Update an indicator's displayed value (e.g., LED voltage from sim results).
   * Does NOT fire onChange — this is a sim-to-UI update, not a user action.
   */
  updateIndicator(instanceId: string, value: number): void {
    const existing = this.controls.get(instanceId);
    if (!existing || existing.controlType !== 'indicator') { return; }

    this.controls.set(instanceId, {
      ...existing,
      value,
    });

    this.notify();
  }

  /**
   * Reset all controls to their default values.
   */
  resetAll(): void {
    for (const [id, control] of Array.from(this.controls.entries())) {
      switch (control.controlType) {
        case 'toggle':
        case 'momentary':
          this.controls.set(id, { ...control, value: false });
          break;
        case 'slider':
          this.controls.set(id, { ...control, value: 0.5 });
          break;
        case 'indicator':
          this.controls.set(id, { ...control, value: 0 });
          break;
      }
    }

    this.notify();
  }

  /**
   * Clear all controls (typically when simulation stops).
   */
  clear(): void {
    this.controls.clear();
    this.notify();
  }

  /**
   * Get the count of registered controls.
   */
  get size(): number {
    return this.controls.size;
  }
}
