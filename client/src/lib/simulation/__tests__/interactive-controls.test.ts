import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  InteractiveControlManager,
  getControlTypeForComponent,
} from '../interactive-controls';
import type {
  InteractiveControlType,
  ControlChangeCallback,
} from '../interactive-controls';

describe('getControlTypeForComponent', () => {
  it('maps switch types to toggle', () => {
    expect(getControlTypeForComponent('switch')).toBe('toggle');
    expect(getControlTypeForComponent('SPST')).toBe('toggle');
    expect(getControlTypeForComponent('spdt')).toBe('toggle');
    expect(getControlTypeForComponent('relay')).toBe('toggle');
  });

  it('maps momentary button types to momentary', () => {
    expect(getControlTypeForComponent('pushbutton')).toBe('momentary');
    expect(getControlTypeForComponent('push_button')).toBe('momentary');
    expect(getControlTypeForComponent('momentary')).toBe('momentary');
  });

  it('maps potentiometer types to slider', () => {
    expect(getControlTypeForComponent('potentiometer')).toBe('slider');
    expect(getControlTypeForComponent('pot')).toBe('slider');
    expect(getControlTypeForComponent('variable_resistor')).toBe('slider');
    expect(getControlTypeForComponent('rheostat')).toBe('slider');
    expect(getControlTypeForComponent('dimmer')).toBe('slider');
  });

  it('maps LED and indicator types to indicator', () => {
    expect(getControlTypeForComponent('led')).toBe('indicator');
    expect(getControlTypeForComponent('diode_led')).toBe('indicator');
    expect(getControlTypeForComponent('lamp')).toBe('indicator');
    expect(getControlTypeForComponent('buzzer')).toBe('indicator');
  });

  it('returns undefined for unmapped component types', () => {
    expect(getControlTypeForComponent('resistor')).toBeUndefined();
    expect(getControlTypeForComponent('capacitor')).toBeUndefined();
    expect(getControlTypeForComponent('inductor')).toBeUndefined();
    expect(getControlTypeForComponent('voltage_source')).toBeUndefined();
  });

  it('handles case insensitivity and dash/space normalization', () => {
    expect(getControlTypeForComponent('Push-Button')).toBe('momentary');
    expect(getControlTypeForComponent('VARIABLE RESISTOR')).toBe('slider');
    expect(getControlTypeForComponent('Diode-LED')).toBe('indicator');
  });
});

describe('InteractiveControlManager', () => {
  let manager: InteractiveControlManager;

  beforeEach(() => {
    InteractiveControlManager.resetInstance();
    manager = InteractiveControlManager.getInstance();
  });

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = InteractiveControlManager.getInstance();
      const b = InteractiveControlManager.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after reset', () => {
      const a = InteractiveControlManager.getInstance();
      InteractiveControlManager.resetInstance();
      const b = InteractiveControlManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('registerInstances', () => {
    it('creates controls for known component types', () => {
      manager.registerInstances([
        { referenceDesignator: 'SW1', componentType: 'switch' },
        { referenceDesignator: 'POT1', componentType: 'potentiometer' },
        { referenceDesignator: 'LED1', componentType: 'led' },
      ]);

      expect(manager.size).toBe(3);
      expect(manager.getControlForInstance('SW1')?.controlType).toBe('toggle');
      expect(manager.getControlForInstance('POT1')?.controlType).toBe('slider');
      expect(manager.getControlForInstance('LED1')?.controlType).toBe('indicator');
    });

    it('ignores component types without controls', () => {
      manager.registerInstances([
        { referenceDesignator: 'R1', componentType: 'resistor' },
        { referenceDesignator: 'C1', componentType: 'capacitor' },
      ]);

      expect(manager.size).toBe(0);
    });

    it('clears previous controls on re-register', () => {
      manager.registerInstances([
        { referenceDesignator: 'SW1', componentType: 'switch' },
      ]);
      expect(manager.size).toBe(1);

      manager.registerInstances([
        { referenceDesignator: 'LED1', componentType: 'led' },
      ]);
      expect(manager.size).toBe(1);
      expect(manager.getControlForInstance('SW1')).toBeUndefined();
      expect(manager.getControlForInstance('LED1')).toBeDefined();
    });

    it('sets default values for each control type', () => {
      manager.registerInstances([
        { referenceDesignator: 'SW1', componentType: 'switch' },
        { referenceDesignator: 'POT1', componentType: 'potentiometer' },
        { referenceDesignator: 'LED1', componentType: 'led' },
        { referenceDesignator: 'BTN1', componentType: 'pushbutton' },
      ]);

      expect(manager.getControlForInstance('SW1')?.value).toBe(false);
      expect(manager.getControlForInstance('POT1')?.value).toBe(0.5);
      expect(manager.getControlForInstance('LED1')?.value).toBe(0);
      expect(manager.getControlForInstance('BTN1')?.value).toBe(false);
    });

    it('sets slider unit based on component type', () => {
      manager.registerInstances([
        { referenceDesignator: 'POT1', componentType: 'potentiometer' },
        { referenceDesignator: 'DIM1', componentType: 'dimmer' },
      ]);

      expect(manager.getControlForInstance('POT1')?.unit).toBe('Ω');
      expect(manager.getControlForInstance('DIM1')?.unit).toBe('%');
    });
  });

  describe('applyControl', () => {
    beforeEach(() => {
      manager.registerInstances([
        { referenceDesignator: 'SW1', componentType: 'switch' },
        { referenceDesignator: 'POT1', componentType: 'potentiometer' },
        { referenceDesignator: 'LED1', componentType: 'led' },
      ]);
    });

    it('toggles a switch control', () => {
      manager.applyControl('SW1', 'toggle', true);
      expect(manager.getControlForInstance('SW1')?.value).toBe(true);

      manager.applyControl('SW1', 'toggle', false);
      expect(manager.getControlForInstance('SW1')?.value).toBe(false);
    });

    it('updates slider value', () => {
      manager.applyControl('POT1', 'slider', 0.75);
      expect(manager.getControlForInstance('POT1')?.value).toBe(0.75);
    });

    it('clamps slider value to min/max', () => {
      manager.applyControl('POT1', 'slider', -0.5);
      expect(manager.getControlForInstance('POT1')?.value).toBe(0);

      manager.applyControl('POT1', 'slider', 1.5);
      expect(manager.getControlForInstance('POT1')?.value).toBe(1);
    });

    it('ignores apply on non-existent instance', () => {
      manager.applyControl('NONEXISTENT', 'toggle', true);
      expect(manager.getControlForInstance('NONEXISTENT')).toBeUndefined();
    });

    it('ignores apply with mismatched control type', () => {
      manager.applyControl('SW1', 'slider', 0.5);
      // Switch value should remain unchanged (still false)
      expect(manager.getControlForInstance('SW1')?.value).toBe(false);
    });

    it('fires onChange callback', () => {
      const cb = vi.fn<ControlChangeCallback>();
      manager.setOnChange(cb);

      manager.applyControl('SW1', 'toggle', true);

      expect(cb).toHaveBeenCalledWith('SW1', 'toggle', true);
    });

    it('fires onChange with clamped value for sliders', () => {
      const cb = vi.fn<ControlChangeCallback>();
      manager.setOnChange(cb);

      manager.applyControl('POT1', 'slider', 1.5);

      expect(cb).toHaveBeenCalledWith('POT1', 'slider', 1);
    });

    it('does not fire onChange for non-existent controls', () => {
      const cb = vi.fn<ControlChangeCallback>();
      manager.setOnChange(cb);

      manager.applyControl('NONEXISTENT', 'toggle', true);

      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('updateIndicator', () => {
    it('updates indicator value without firing onChange', () => {
      manager.registerInstances([
        { referenceDesignator: 'LED1', componentType: 'led' },
      ]);

      const cb = vi.fn<ControlChangeCallback>();
      manager.setOnChange(cb);

      manager.updateIndicator('LED1', 3.3);

      expect(manager.getControlForInstance('LED1')?.value).toBe(3.3);
      expect(cb).not.toHaveBeenCalled();
    });

    it('ignores update on non-indicator controls', () => {
      manager.registerInstances([
        { referenceDesignator: 'SW1', componentType: 'switch' },
      ]);

      manager.updateIndicator('SW1', 5);
      expect(manager.getControlForInstance('SW1')?.value).toBe(false);
    });

    it('ignores update on non-existent instance', () => {
      manager.updateIndicator('NONEXISTENT', 1.0);
      expect(manager.getControlForInstance('NONEXISTENT')).toBeUndefined();
    });
  });

  describe('resetAll', () => {
    it('resets all controls to defaults', () => {
      manager.registerInstances([
        { referenceDesignator: 'SW1', componentType: 'switch' },
        { referenceDesignator: 'POT1', componentType: 'potentiometer' },
        { referenceDesignator: 'LED1', componentType: 'led' },
      ]);

      manager.applyControl('SW1', 'toggle', true);
      manager.applyControl('POT1', 'slider', 0.8);
      manager.updateIndicator('LED1', 3.3);

      manager.resetAll();

      expect(manager.getControlForInstance('SW1')?.value).toBe(false);
      expect(manager.getControlForInstance('POT1')?.value).toBe(0.5);
      expect(manager.getControlForInstance('LED1')?.value).toBe(0);
    });

    it('keeps controls registered after reset', () => {
      manager.registerInstances([
        { referenceDesignator: 'SW1', componentType: 'switch' },
      ]);
      manager.resetAll();
      expect(manager.size).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all controls', () => {
      manager.registerInstances([
        { referenceDesignator: 'SW1', componentType: 'switch' },
        { referenceDesignator: 'LED1', componentType: 'led' },
      ]);

      manager.clear();

      expect(manager.size).toBe(0);
      expect(manager.getControlForInstance('SW1')).toBeUndefined();
    });
  });

  describe('getAllControls', () => {
    it('returns a read-only map of all controls', () => {
      manager.registerInstances([
        { referenceDesignator: 'SW1', componentType: 'switch' },
        { referenceDesignator: 'POT1', componentType: 'potentiometer' },
      ]);

      const all = manager.getAllControls();
      expect(all.size).toBe(2);
      expect(all.get('SW1')?.controlType).toBe('toggle');
      expect(all.get('POT1')?.controlType).toBe('slider');
    });
  });

  describe('subscribe', () => {
    it('notifies listeners on registerInstances', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      manager.registerInstances([
        { referenceDesignator: 'SW1', componentType: 'switch' },
      ]);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on applyControl', () => {
      manager.registerInstances([
        { referenceDesignator: 'SW1', componentType: 'switch' },
      ]);

      const listener = vi.fn();
      manager.subscribe(listener);

      manager.applyControl('SW1', 'toggle', true);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on updateIndicator', () => {
      manager.registerInstances([
        { referenceDesignator: 'LED1', componentType: 'led' },
      ]);

      const listener = vi.fn();
      manager.subscribe(listener);

      manager.updateIndicator('LED1', 3.3);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on resetAll', () => {
      manager.registerInstances([
        { referenceDesignator: 'SW1', componentType: 'switch' },
      ]);

      const listener = vi.fn();
      manager.subscribe(listener);

      manager.resetAll();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on clear', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      manager.clear();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after unsubscribe', () => {
      const listener = vi.fn();
      const unsub = manager.subscribe(listener);

      manager.clear();
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();

      manager.clear();
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('setOnChange', () => {
    it('can clear the callback with null', () => {
      manager.registerInstances([
        { referenceDesignator: 'SW1', componentType: 'switch' },
      ]);

      const cb = vi.fn<ControlChangeCallback>();
      manager.setOnChange(cb);
      manager.setOnChange(null);

      manager.applyControl('SW1', 'toggle', true);

      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('momentary controls', () => {
    it('behaves like toggle but semantically represents press-and-hold', () => {
      manager.registerInstances([
        { referenceDesignator: 'BTN1', componentType: 'pushbutton' },
      ]);

      const control = manager.getControlForInstance('BTN1');
      expect(control?.controlType).toBe('momentary');
      expect(control?.value).toBe(false);

      // Press
      manager.applyControl('BTN1', 'momentary', true);
      expect(manager.getControlForInstance('BTN1')?.value).toBe(true);

      // Release
      manager.applyControl('BTN1', 'momentary', false);
      expect(manager.getControlForInstance('BTN1')?.value).toBe(false);
    });
  });
});
