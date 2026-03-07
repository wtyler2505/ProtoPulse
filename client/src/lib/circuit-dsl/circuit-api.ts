/**
 * Circuit DSL Builder API — fluent interface for defining circuits programmatically.
 *
 * Inspired by SKiDL's fluent style. Each method call builds up the CircuitIR
 * incrementally. Call `.export()` to produce the final IR.
 *
 * Usage:
 *   const c = circuit('Voltage Divider');
 *   const vcc = c.net('VCC', { voltage: 5 });
 *   const gnd = c.net('GND', { ground: true });
 *   const r1 = c.resistor({ value: '10k' });
 *   const r2 = c.resistor({ value: '10k' });
 *   c.chain(vcc, r1, r2, gnd);
 *   const ir = c.export();
 */

import type {
  CircuitIR,
  CircuitIRComponent,
  CircuitIRNet,
} from './circuit-ir';

// ---------------------------------------------------------------------------
// Public ref types
// ---------------------------------------------------------------------------

export interface PinRef {
  readonly kind: 'pin';
  readonly componentId: string;
  readonly pinName: string;
}

export interface NetRef {
  readonly kind: 'net';
  readonly netId: string;
}

export type ConnectableRef = PinRef | NetRef;

// ---------------------------------------------------------------------------
// Component handle — returned from factory methods
// ---------------------------------------------------------------------------

export class ComponentHandle {
  readonly id: string;
  private readonly pinNames: string[];
  private readonly refdes: string;

  constructor(id: string, refdes: string, pinNames: string[]) {
    this.id = id;
    this.refdes = refdes;
    this.pinNames = pinNames;
  }

  pin(nameOrNumber: string | number): PinRef {
    if (typeof nameOrNumber === 'number') {
      // Numeric pin access — convert to 1-based index into pinNames
      const idx = nameOrNumber - 1;
      if (idx < 0 || idx >= this.pinNames.length) {
        throw new Error(
          `${this.refdes} has ${this.pinNames.length} pins (1..${this.pinNames.length}), ` +
            `no pin ${nameOrNumber}`,
        );
      }
      return { kind: 'pin', componentId: this.id, pinName: this.pinNames[idx] };
    }
    const name = String(nameOrNumber);
    if (!this.pinNames.includes(name)) {
      throw new Error(`${this.refdes} has no pin "${name}" (available: ${this.pinNames.join(', ')})`);
    }
    return { kind: 'pin', componentId: this.id, pinName: name };
  }
}

// ---------------------------------------------------------------------------
// Option types for factory methods
// ---------------------------------------------------------------------------

interface BaseComponentOpts {
  refdes?: string;
  footprint?: string;
}

interface PassiveOpts extends BaseComponentOpts {
  value: string;
  part?: string;
}

interface ActiveOpts extends BaseComponentOpts {
  part: string;
  value?: string;
}

interface ConnectorOpts extends BaseComponentOpts {
  part: string;
  pins: string[];
  value?: string;
}

interface GenericOpts extends BaseComponentOpts {
  part: string;
  refdesPrefix: string;
  pins: string[];
  value?: string;
}

interface NetOpts {
  voltage?: number;
  ground?: boolean;
}

// ---------------------------------------------------------------------------
// Built-in pin definitions for common component types
// ---------------------------------------------------------------------------

const TWO_TERMINAL_PINS = ['1', '2'];
const DIODE_PINS = ['A', 'K'];
const BJT_PINS = ['B', 'C', 'E'];

/** Default pin lists for IC parts from the standard library */
const IC_PIN_DEFAULTS: Record<string, string[]> = {
  ATmega328P: ['VCC', 'GND', 'RESET', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'AREF', 'XTAL1', 'XTAL2'],
  ATmega2560: ['VCC', 'GND', 'RESET'],
  ESP32: ['VCC', 'GND', 'EN', 'IO0'],
  '7400': ['1A', '1B', '1Y', '2A', '2B', '2Y', '3A', '3B', '3Y', '4A', '4B', '4Y', 'VCC', 'GND'],
  '7402': ['1A', '1B', '1Y', 'VCC', 'GND'],
  '7404': ['1A', '1Y', 'VCC', 'GND'],
  '7408': ['1A', '1B', '1Y', 'VCC', 'GND'],
  '7432': ['1A', '1B', '1Y', 'VCC', 'GND'],
  LM358: ['IN1+', 'IN1-', 'OUT1', 'IN2+', 'IN2-', 'OUT2', 'VCC', 'GND'],
  LM741: ['IN+', 'IN-', 'OUT', 'V+', 'V-'],
  NE555: ['GND', 'TRIGGER', 'OUTPUT', 'RESET', 'CONTROL', 'THRESHOLD', 'DISCHARGE', 'VCC'],
};

// ---------------------------------------------------------------------------
// CircuitBuilder
// ---------------------------------------------------------------------------

export class CircuitBuilder {
  private readonly name: string;
  private readonly components: CircuitIRComponent[] = [];
  private readonly nets: CircuitIRNet[] = [];
  private readonly refdesCounts = new Map<string, number>();
  private readonly usedRefdes = new Set<string>();
  private readonly pinAssignments = new Map<string, Map<string, string>>();

  constructor(name: string) {
    this.name = name;
  }

  // --- Component factories ---

  resistor(opts: PassiveOpts): ComponentHandle {
    return this.addComponent('R', 'resistor', opts.value, TWO_TERMINAL_PINS, opts);
  }

  capacitor(opts: PassiveOpts): ComponentHandle {
    return this.addComponent('C', 'capacitor', opts.value, TWO_TERMINAL_PINS, opts);
  }

  inductor(opts: PassiveOpts): ComponentHandle {
    return this.addComponent('L', 'inductor', opts.value, TWO_TERMINAL_PINS, opts);
  }

  diode(opts: ActiveOpts): ComponentHandle {
    return this.addComponent('D', 'diode', opts.part, DIODE_PINS, opts);
  }

  led(opts: ActiveOpts): ComponentHandle {
    return this.addComponent('LED', 'led', opts.part, DIODE_PINS, opts);
  }

  transistor(opts: ActiveOpts): ComponentHandle {
    return this.addComponent('Q', 'transistor', opts.part, BJT_PINS, opts);
  }

  ic(opts: ActiveOpts): ComponentHandle {
    const pins = IC_PIN_DEFAULTS[opts.part] ?? ['1', '2'];
    return this.addComponent('U', 'ic', opts.part, pins, opts);
  }

  connector(opts: ConnectorOpts): ComponentHandle {
    return this.addComponent('J', 'connector', opts.part, opts.pins, opts);
  }

  generic(opts: GenericOpts): ComponentHandle {
    return this.addComponent(opts.refdesPrefix, 'generic', opts.part, opts.pins, opts);
  }

  // --- Net creation ---

  net(name: string, opts?: NetOpts): NetRef {
    const netType = opts?.ground ? 'ground' : opts?.voltage !== undefined ? 'power' : 'signal';
    const id = crypto.randomUUID();
    this.nets.push({ id, name, type: netType });
    return { kind: 'net', netId: id };
  }

  // --- Connection methods ---

  connect(...refs: ConnectableRef[]): void {
    if (refs.length < 2) {
      return;
    }

    // Find or create the target net
    const netId = this.resolveNetId(refs);

    // Assign all pin refs to this net
    for (const ref of refs) {
      if (ref.kind === 'pin') {
        this.assignPin(ref.componentId, ref.pinName, netId);
      }
    }
  }

  chain(...items: (ComponentHandle | NetRef)[]): void {
    if (items.length < 2) {
      return;
    }

    for (let i = 0; i < items.length - 1; i++) {
      const current = items[i];
      const next = items[i + 1];

      // Determine what pin/net to connect on each side
      const currentRef = this.exitRef(current);
      const nextRef = this.entryRef(next);

      this.connect(currentRef, nextRef);
    }
  }

  // --- Export ---

  export(): CircuitIR {
    // Build final components with pin assignments
    const components = this.components.map((comp) => {
      const assignments = this.pinAssignments.get(comp.id);
      const pins: Record<string, string> = {};
      for (const pinName of Object.keys(comp.pins)) {
        pins[pinName] = assignments?.get(pinName) ?? '';
      }
      return { ...comp, pins };
    });

    return {
      meta: { name: this.name, version: '1.0' },
      components,
      nets: [...this.nets],
      wires: [],
    };
  }

  // --- Private helpers ---

  private addComponent(
    prefix: string,
    type: string,
    partOrValue: string,
    pinNames: string[],
    opts: BaseComponentOpts & { value?: string; part?: string },
  ): ComponentHandle {
    const refdes = opts.refdes ?? this.nextRefdes(prefix);

    if (this.usedRefdes.has(refdes)) {
      throw new Error(`Duplicate refdes "${refdes}" — each component must have a unique reference designator`);
    }
    this.usedRefdes.add(refdes);

    const id = crypto.randomUUID();
    const pins: Record<string, string> = {};
    for (const pn of pinNames) {
      pins[pn] = '';
    }

    const partId = `${type}:${partOrValue}`;
    const value = opts.value;

    const component: CircuitIRComponent = {
      id,
      refdes,
      partId,
      pins,
      ...(value !== undefined ? { value } : {}),
      ...(opts.footprint !== undefined ? { footprint: opts.footprint } : {}),
    };

    this.components.push(component);
    this.pinAssignments.set(id, new Map());

    return new ComponentHandle(id, refdes, pinNames);
  }

  private nextRefdes(prefix: string): string {
    let count = this.refdesCounts.get(prefix) ?? 0;
    let candidate: string;
    do {
      count++;
      candidate = `${prefix}${count}`;
    } while (this.usedRefdes.has(candidate));
    this.refdesCounts.set(prefix, count);
    return candidate;
  }

  private resolveNetId(refs: ConnectableRef[]): string {
    // Check if any ref is already a net
    for (const ref of refs) {
      if (ref.kind === 'net') {
        return ref.netId;
      }
    }

    // Check if any pin is already assigned to a net
    for (const ref of refs) {
      if (ref.kind === 'pin') {
        const existing = this.pinAssignments.get(ref.componentId)?.get(ref.pinName);
        if (existing) {
          return existing;
        }
      }
    }

    // Auto-create a signal net
    const id = crypto.randomUUID();
    const netNum = this.nets.length + 1;
    this.nets.push({ id, name: `_auto_${netNum}`, type: 'signal' });
    return id;
  }

  private assignPin(componentId: string, pinName: string, netId: string): void {
    let compPins = this.pinAssignments.get(componentId);
    if (!compPins) {
      compPins = new Map();
      this.pinAssignments.set(componentId, compPins);
    }
    compPins.set(pinName, netId);
  }

  private exitRef(item: ComponentHandle | NetRef): ConnectableRef {
    if ('kind' in item && item.kind === 'net') {
      return item;
    }
    // For components, "exit" is pin 2 (second pin) for two-terminal,
    // or last pin for multi-pin
    const handle = item as ComponentHandle;
    const comp = this.components.find((c) => c.id === handle.id);
    if (!comp) {
      throw new Error('Component not found in builder');
    }
    const pinNames = Object.keys(comp.pins);
    // For two-terminal passives, exit is pin 2
    return handle.pin(pinNames.length <= 2 ? pinNames[pinNames.length - 1] : pinNames[pinNames.length - 1]);
  }

  private entryRef(item: ComponentHandle | NetRef): ConnectableRef {
    if ('kind' in item && item.kind === 'net') {
      return item;
    }
    // For components, "entry" is pin 1 (first pin)
    const handle = item as ComponentHandle;
    const comp = this.components.find((c) => c.id === handle.id);
    if (!comp) {
      throw new Error('Component not found in builder');
    }
    const pinNames = Object.keys(comp.pins);
    return handle.pin(pinNames[0]);
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function circuit(name: string): CircuitBuilder {
  return new CircuitBuilder(name);
}
