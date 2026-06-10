import type { PinElectricalType } from '@protopulse/parts';

/**
 * The pin-conflict matrix — Vol II §C.1. Symmetric 10×10 over pin
 * electrical types; the worst pairwise verdict on a net is the net's
 * matrix verdict. Codes index into the concepts wiki (codes.ts).
 */
export interface Verdict {
  severity: 'ok' | 'warn' | 'error';
  code?: string;
  reason?: string;
}

const OK: Verdict = { severity: 'ok' };

function err(code: string, reason: string): Verdict {
  return { severity: 'error', code, reason };
}
function warn(code: string, reason: string): Verdict {
  return { severity: 'warn', code, reason };
}

const DRIVE = err('ERC-DRIVE-CONFLICT', 'two push-pull drivers fight on the same net');
const RAIL = err('ERC-RAIL-SHORT', 'two power outputs shorted together');
const OUT_PWR = err('ERC-OUTPUT-ON-RAIL', 'a logic output is wired to a power output');
const NC = err('ERC-NC-CONNECTED', 'a no-connect pin is wired to something');
const TRI = warn('ERC-TRISTATE-DRIVEN', 'a push-pull output drives a tri-state bus');
const OC_DRIVEN = warn('ERC-OC-DRIVEN', 'a push-pull output drives an open-collector net');
const OUT_PWRIN = warn('ERC-OUTPUT-POWERS-PIN', 'a logic output feeds a supply pin');

type Row = Partial<Record<PinElectricalType, Verdict>>;

/**
 * Upper triangle of the symmetric matrix; lookup() mirrors it.
 * Anything not listed is OK.
 */
const UPPER: Partial<Record<PinElectricalType, Row>> = {
  input: {},
  output: {
    output: DRIVE,
    tristate: TRI,
    power_in: OUT_PWRIN,
    power_out: OUT_PWR,
    open_collector: OC_DRIVEN,
    open_emitter: OC_DRIVEN,
  },
  bidi: {
    output: { severity: 'warn', code: 'ERC-BIDI-DRIVEN', reason: 'a push-pull output on a bidirectional net can fight the peer' },
    power_out: OUT_PWR,
  },
  tristate: {
    power_out: err('ERC-TRISTATE-ON-RAIL', 'tri-state pin wired to a power output'),
  },
  passive: {},
  power_in: {},
  power_out: {
    power_out: RAIL,
    open_collector: warn('ERC-OC-ON-RAIL', 'open-collector pin wired straight to a rail'),
    open_emitter: warn('ERC-OC-ON-RAIL', 'open-emitter pin wired straight to a rail'),
  },
  open_collector: {},
  open_emitter: {},
  nc: {
    input: NC,
    output: NC,
    bidi: NC,
    tristate: NC,
    passive: NC,
    power_in: NC,
    power_out: NC,
    open_collector: NC,
    open_emitter: NC,
    nc: NC,
  },
};

export function pinPairVerdict(a: PinElectricalType, b: PinElectricalType): Verdict {
  return UPPER[a]?.[b] ?? UPPER[b]?.[a] ?? OK;
}
