import { CORE_KINDS } from './types.js';

import type { CoreKind, DigitalLevel, EmuModule, McuCore, McuInspection, PinEvent } from './types.js';

/**
 * Firmware emulation session: wraps the LAZY '@protopulse/emu' import
 * (the package is built on a parallel track; never pay for it — or crash
 * on it — at app startup), and surfaces load errors as values — the
 * panel renders them, it never catches.
 *
 * The session owns the run loop's bookkeeping: the panel drives one
 * runFrame() per requestAnimationFrame; each frame steps the core toward
 * a ~clockHz/60 cycle budget in small chunks, bailing out when the
 * wall-time cap is hit so a heavy firmware can't freeze the UI. Pin
 * events accumulate into a bounded ring (the last RING_CAP transitions),
 * and UART output drains into a rolling ASCII text buffer (UART_CAP
 * tail). All of the math here is pure and unit-tested with a fake core.
 */

export type EmuLoadOutcome = { ok: true; clockHz: number } | { ok: false; error: string };

export interface EmuFrameResult {
  /** Cycles actually executed this frame (≤ the frame budget). */
  cycles: number;
  /** Pin events absorbed this frame. */
  events: number;
}

type EmuModuleLoader = () => Promise<Partial<EmuModule>>;

const defaultLoader: EmuModuleLoader = async () =>
  // Pinned API cast over the workspace specifier: the package is built on
  // a parallel track, so the shape is runtime-checked below.
  (await import('@protopulse/emu')) as unknown as Partial<EmuModule>;

/** Pin-event ring bound — old transitions fall off the front. */
export const RING_CAP = 100_000;

/** Serial-monitor text bound — we keep the tail. */
export const UART_CAP = 65_536;

/** Wall-clock cap per frame; the budget yields before the next paint. */
export const FRAME_WALL_BUDGET_MS = 8;

/** Cycle budget for one 60 fps frame of real time. */
export function frameCycleBudget(clockHz: number): number {
  return Math.max(1, Math.round(clockHz / 60));
}

/** Step-chunk size: ~10 wall-clock checks per frame budget. */
export function frameChunkSize(clockHz: number): number {
  return Math.max(1, Math.round(clockHz / 600));
}

/** Decode UART bytes as ASCII; non-printables (except \n \r \t) become U+FFFD. */
export function decodeAscii(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    const printable = (b >= 0x20 && b <= 0x7e) || b === 0x0a || b === 0x0d || b === 0x09;
    out += printable ? String.fromCharCode(b) : '�';
  }
  return out;
}

/** Append to a rolling text buffer, keeping the last `cap` characters. */
export function appendBounded(buffer: string, chunk: string, cap: number): string {
  const next = buffer + chunk;
  return next.length > cap ? next.slice(next.length - cap) : next;
}

export interface EmuSessionOpts {
  loader?: EmuModuleLoader;
  /** Wall clock in ms — injectable for tests. */
  now?: () => number;
}

export interface EmuSession {
  /** Lazily boots the core (rebuilt when `coreKind` changes) and loads
   *  Intel-HEX firmware. Errors come back as values — bad hex never
   *  throws into the panel. Default core: ATmega328P. */
  load(hex: Uint8Array | string, coreKind?: CoreKind): Promise<EmuLoadOutcome>;
  /** The core kind the session is currently running. */
  readonly coreKind: CoreKind;
  /** One animation frame of emulation; no-op before a successful load
   *  and while suspended. */
  runFrame(): EmuFrameResult;
  /** Write text into the core's UART receiver, byte by byte (7-bit ASCII). */
  sendSerial(text: string): void;
  setPin(pin: string, level: DigitalLevel): void;
  /** Reset the core and clear the session's buffers; firmware stays loaded. */
  reset(): void;
  /** True after a successful load (until a failed re-load). */
  readonly loaded: boolean;
  /** Total cycles executed since load/reset. */
  readonly cycles: number;
  /** Core clock, or null before the first successful load. */
  readonly clockHz: number | null;
  /** Rolling serial-monitor text (last UART_CAP chars). */
  readonly serialText: string;
  /** The bounded pin-event ring, oldest first. */
  readonly events: readonly PinEvent[];
  /** Every pin name seen in events since load/reset, sorted. */
  pins(): string[];
  inspect(): McuInspection | null;
  /** The loaded MCU core, for a borrower (co-sim) to step directly;
   *  null until firmware has loaded successfully. */
  getCore(): McuCore | null;
  /** Exclusive-borrow latch: while suspended, runFrame() is a no-op, so
   *  the Firmware panel's RAF loop (if any is alive) cannot advance the
   *  core underneath a borrower stepping it deterministically. */
  suspend(): void;
  resume(): void;
  readonly suspended: boolean;
}

export function createEmuSession(opts: EmuSessionOpts = {}): EmuSession {
  const loader = opts.loader ?? defaultLoader;
  const now = opts.now ?? (() => performance.now());

  let modulePromise: Promise<Partial<EmuModule>> | null = null;
  let core: McuCore | null = null;
  let kind: CoreKind = 'atmega328p';
  let loaded = false;
  let suspended = false;
  let cycles = 0;
  let ring: PinEvent[] = [];
  let serial = '';
  let pinSet = new Set<string>();

  const loadModule = (): Promise<Partial<EmuModule>> => (modulePromise ??= loader());

  const clearBuffers = (): void => {
    cycles = 0;
    ring = [];
    serial = '';
    pinSet = new Set();
  };

  const absorbEvents = (events: PinEvent[]): void => {
    if (events.length === 0) return;
    for (const e of events) {
      pinSet.add(e.pin);
      ring.push(e);
    }
    if (ring.length > RING_CAP) ring.splice(0, ring.length - RING_CAP);
  };

  const absorbUart = (bytes: Uint8Array): void => {
    if (bytes.length === 0) return;
    serial = appendBounded(serial, decodeAscii(bytes), UART_CAP);
  };

  const load = async (hex: Uint8Array | string, coreKind: CoreKind = 'atmega328p'): Promise<EmuLoadOutcome> => {
    try {
      if (core === null || coreKind !== kind) {
        const mod = await loadModule();
        const ctorName = CORE_KINDS[coreKind].ctor;
        const Ctor = mod[ctorName];
        if (typeof Ctor !== 'function') {
          throw new Error(
            `MCU emulation not available yet — @protopulse/emu has no ${ctorName} in this build`,
          );
        }
        core = new Ctor();
        kind = coreKind;
      }
      core.reset();
      core.loadFirmware(hex);
      clearBuffers();
      loaded = true;
      return { ok: true, clockHz: core.clockHz };
    } catch (err) {
      loaded = false;
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  };

  const runFrame = (): EmuFrameResult => {
    if (core === null || !loaded || suspended) return { cycles: 0, events: 0 };
    const budget = frameCycleBudget(core.clockHz);
    const chunk = frameChunkSize(core.clockHz);
    const deadline = now() + FRAME_WALL_BUDGET_MS;
    let done = 0;
    let eventCount = 0;
    while (done < budget) {
      const res = core.step(Math.min(chunk, budget - done));
      done += res.cycles;
      eventCount += res.events.length;
      absorbEvents(res.events);
      absorbUart(core.drainUart());
      // A halted core makes no progress — don't spin on it.
      if (res.cycles === 0) break;
      // Wall-time cap: yield to the next paint, finish the budget later.
      if (now() >= deadline) break;
    }
    cycles += done;
    return { cycles: done, events: eventCount };
  };

  const sendSerial = (text: string): void => {
    if (core === null || !loaded) return;
    for (let i = 0; i < text.length; i++) {
      core.uartWrite(text.charCodeAt(i) & 0x7f);
    }
  };

  const setPin = (pin: string, level: DigitalLevel): void => {
    if (core === null || !loaded) return;
    core.setPin(pin, level);
  };

  const reset = (): void => {
    core?.reset();
    clearBuffers();
  };

  return {
    load,
    runFrame,
    sendSerial,
    setPin,
    reset,
    get loaded() {
      return loaded;
    },
    get coreKind() {
      return kind;
    },
    get cycles() {
      return cycles;
    },
    get clockHz() {
      return core?.clockHz ?? null;
    },
    get serialText() {
      return serial;
    },
    get events(): readonly PinEvent[] {
      return ring;
    },
    pins: () => [...pinSet].sort(),
    inspect: () => (core !== null && loaded ? core.inspect() : null),
    getCore: () => (core !== null && loaded ? core : null),
    suspend: () => {
      suspended = true;
    },
    resume: () => {
      suspended = false;
    },
    get suspended() {
      return suspended;
    },
  };
}

/**
 * The app-wide shared session. Module-level so firmware, cycles, and
 * serial history survive tab switches; the Firmware panel drives its run
 * loop, and the co-sim runner borrows its loaded core (suspending the
 * run loop for the duration — see src/cosim/runner.ts).
 */
export const sharedEmuSession: EmuSession = createEmuSession();
