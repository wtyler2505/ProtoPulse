import type { OpBody, OpEnvelope } from '@protopulse/graph';

/**
 * Golden fixture definitions. `update-golden.ts` freezes these into
 * literal ops.json + expected exports; the test replays the JSON and
 * byte-compares. Editing a fixture means re-freezing deliberately and
 * reviewing the diff — exports are contracts.
 */
function envelopes(ops: OpBody[]): OpEnvelope[] {
  return ops.map((op, i) => ({ actor: 'golden', lamport: i + 1, ts: 0, op }));
}

/** Track 1, step 2: battery → resistor → LED, named rails. */
function ledResistor(): OpBody[] {
  return [
    { kind: 'add_component', id: 'bat', ref: 'BT1', partId: 'core:battery', partRev: 1, value: '9V' },
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '330' },
    { kind: 'add_component', id: 'd1', ref: 'D1', partId: 'core:led', partRev: 1, value: 'red' },
    { kind: 'connect', port: 'bat:+', newNetId: 'net-vbat' },
    { kind: 'connect', port: 'r1:1', netId: 'net-vbat' },
    { kind: 'connect', port: 'r1:2', newNetId: 'net-led' },
    { kind: 'connect', port: 'd1:A', netId: 'net-led' },
    { kind: 'connect', port: 'd1:K', newNetId: 'net-gnd' },
    { kind: 'connect', port: 'bat:-', netId: 'net-gnd' },
    { kind: 'rename_net', netId: 'net-vbat', name: 'VBAT' },
    { kind: 'rename_net', netId: 'net-led', name: 'LED_A' },
    { kind: 'rename_net', netId: 'net-gnd', name: 'GND' },
    { kind: 'place_symbol', componentId: 'bat', at: { x: 0, y: 0 }, rot: 0, mirror: false },
    { kind: 'place_symbol', componentId: 'r1', at: { x: 12700000, y: 0 }, rot: 0, mirror: false },
    { kind: 'place_symbol', componentId: 'd1', at: { x: 25400000, y: 0 }, rot: 0, mirror: false },
  ];
}

/**
 * led-resistor plus a routed PCB: R1 + D1 placed top-side, the LED_A
 * net routed on F.Cu from R1:2's pad (5.95mm, 0) through (10mm, 0) to
 * D1:A's pad (14.05mm, 0), with a via on the net at the midpoint.
 * Freezes the fab exports: Gerber F.Cu/B.Cu, Excellon, pick-and-place.
 */
function routedLed(): OpBody[] {
  return [
    ...ledResistor(),
    { kind: 'place_footprint', componentId: 'r1', at: { x: 5000000, y: 0 }, rotMilli: 0, side: 'top', locked: false },
    { kind: 'place_footprint', componentId: 'd1', at: { x: 15000000, y: 0 }, rotMilli: 0, side: 'top', locked: false },
    { kind: 'route_trace', id: 'trace-led-a', netId: 'net-led', layerId: 'F.Cu', widthNm: 250000, path: [{ x: 5950000, y: 0 }, { x: 10000000, y: 0 }, { x: 14050000, y: 0 }] },
    { kind: 'place_via', id: 'via-led', netId: 'net-led', at: { x: 10000000, y: 0 }, drillNm: 300000, padNm: 600000, span: ['F.Cu', 'B.Cu'] },
  ];
}

/** Track 1 deliverable shape: 555 astable blinking LEDs. */
function trafficLight555(): OpBody[] {
  return [
    { kind: 'add_component', id: 'u1', ref: 'U1', partId: 'core:ne555', partRev: 1 },
    { kind: 'add_component', id: 'vcc', ref: 'PWR1', partId: 'core:pwr-vcc', partRev: 1 },
    { kind: 'add_component', id: 'gnd', ref: 'PWR2', partId: 'core:pwr-gnd', partRev: 1 },
    { kind: 'add_component', id: 'ra', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '10k' },
    { kind: 'add_component', id: 'rb', ref: 'R2', partId: 'core:resistor', partRev: 1, value: '47k' },
    { kind: 'add_component', id: 'ct', ref: 'C1', partId: 'core:capacitor', partRev: 1, value: '10uF' },
    { kind: 'add_component', id: 'rg', ref: 'R3', partId: 'core:resistor', partRev: 1, value: '330' },
    { kind: 'add_component', id: 'ry', ref: 'R4', partId: 'core:resistor', partRev: 1, value: '330' },
    { kind: 'add_component', id: 'rr', ref: 'R5', partId: 'core:resistor', partRev: 1, value: '330' },
    { kind: 'add_component', id: 'dg', ref: 'D1', partId: 'core:led', partRev: 1, value: 'green' },
    { kind: 'add_component', id: 'dy', ref: 'D2', partId: 'core:led', partRev: 1, value: 'yellow' },
    { kind: 'add_component', id: 'dr', ref: 'D3', partId: 'core:led', partRev: 1, value: 'red' },
    // Rails
    { kind: 'connect', port: 'vcc:1', newNetId: 'net-vcc' },
    { kind: 'connect', port: 'u1:8', netId: 'net-vcc' },
    { kind: 'connect', port: 'u1:4', netId: 'net-vcc' },
    { kind: 'connect', port: 'ra:1', netId: 'net-vcc' },
    { kind: 'connect', port: 'gnd:1', newNetId: 'net-gnd' },
    { kind: 'connect', port: 'u1:1', netId: 'net-gnd' },
    { kind: 'connect', port: 'ct:2', netId: 'net-gnd' },
    // Astable network: VCC —RA— DISCH —RB— THRES/TRIG/CT
    { kind: 'connect', port: 'ra:2', newNetId: 'net-disch' },
    { kind: 'connect', port: 'u1:7', netId: 'net-disch' },
    { kind: 'connect', port: 'rb:1', netId: 'net-disch' },
    { kind: 'connect', port: 'rb:2', newNetId: 'net-timing' },
    { kind: 'connect', port: 'u1:2', netId: 'net-timing' },
    { kind: 'connect', port: 'u1:6', netId: 'net-timing' },
    { kind: 'connect', port: 'ct:1', netId: 'net-timing' },
    // Output stage: OUT → R → LED → GND, three lamps
    { kind: 'connect', port: 'u1:3', newNetId: 'net-out' },
    { kind: 'connect', port: 'rg:1', netId: 'net-out' },
    { kind: 'connect', port: 'ry:1', netId: 'net-out' },
    { kind: 'connect', port: 'rr:1', netId: 'net-out' },
    { kind: 'connect', port: 'rg:2', newNetId: 'net-ag' },
    { kind: 'connect', port: 'dg:A', netId: 'net-ag' },
    { kind: 'connect', port: 'ry:2', newNetId: 'net-ay' },
    { kind: 'connect', port: 'dy:A', netId: 'net-ay' },
    { kind: 'connect', port: 'rr:2', newNetId: 'net-ar' },
    { kind: 'connect', port: 'dr:A', netId: 'net-ar' },
    { kind: 'connect', port: 'dg:K', netId: 'net-gnd' },
    { kind: 'connect', port: 'dy:K', netId: 'net-gnd' },
    { kind: 'connect', port: 'dr:K', netId: 'net-gnd' },
    // Names
    { kind: 'rename_net', netId: 'net-vcc', name: 'VCC' },
    { kind: 'rename_net', netId: 'net-gnd', name: 'GND' },
    { kind: 'rename_net', netId: 'net-disch', name: 'DISCH' },
    { kind: 'rename_net', netId: 'net-timing', name: 'TIMING' },
    { kind: 'rename_net', netId: 'net-out', name: 'OUT_555' },
    { kind: 'rename_net', netId: 'net-ag', name: 'LED_G' },
    { kind: 'rename_net', netId: 'net-ay', name: 'LED_Y' },
    { kind: 'rename_net', netId: 'net-ar', name: 'LED_R' },
  ];
}

/**
 * The Probe's input-protection stage (Vol II §F.1): channel in via the
 * 2×10 header → 100k series → BAT54S clamp to the rails (pin 3 is the
 * series midpoint) → protected node back out to the analog front end.
 */
function probeInputProtection(): OpBody[] {
  return [
    { kind: 'add_component', id: 'j1', ref: 'J1', partId: 'core:header-2x10', partRev: 1 },
    { kind: 'add_component', id: 'rs', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '100k' },
    { kind: 'add_component', id: 'dclamp', ref: 'D1', partId: 'core:bat54s', partRev: 1 },
    { kind: 'add_component', id: 'dtvs', ref: 'D2', partId: 'core:tvs-unidirectional', partRev: 1, value: '24V' },
    { kind: 'add_component', id: 'vcc', ref: 'PWR1', partId: 'core:pwr-vcc', partRev: 1 },
    { kind: 'add_component', id: 'gnd', ref: 'PWR2', partId: 'core:pwr-gnd', partRev: 1 },
    // Rails
    { kind: 'connect', port: 'vcc:1', newNetId: 'net-3v3' },
    { kind: 'connect', port: 'gnd:1', newNetId: 'net-gnd' },
    { kind: 'connect', port: 'j1:19', netId: 'net-gnd' },
    { kind: 'connect', port: 'j1:20', netId: 'net-gnd' },
    // CH1 in on header pin 1, TVS across the raw input
    { kind: 'connect', port: 'j1:1', newNetId: 'net-ch1-in' },
    { kind: 'connect', port: 'rs:1', netId: 'net-ch1-in' },
    { kind: 'connect', port: 'dtvs:K', netId: 'net-ch1-in' },
    { kind: 'connect', port: 'dtvs:A', netId: 'net-gnd' },
    // Series R into the clamped node; BAT54S midpoint (pin 3) clamps it
    { kind: 'connect', port: 'rs:2', newNetId: 'net-ch1-prot' },
    { kind: 'connect', port: 'dclamp:3', netId: 'net-ch1-prot' },
    { kind: 'connect', port: 'dclamp:1', netId: 'net-gnd' },
    { kind: 'connect', port: 'dclamp:2', netId: 'net-3v3' },
    // Protected node feeds the front end (header pin 2 stands in for it)
    { kind: 'connect', port: 'j1:2', netId: 'net-ch1-prot' },
    // Intent lives in the graph
    {
      kind: 'add_constraint',
      id: 'k-ch1-budget',
      body: { kind: 'current_max', netId: 'net-ch1-prot', amps: 0.001 },
      rationale: 'protected ADC node — clamp diodes carry fault current, not the AFE',
    },
    // Names
    { kind: 'rename_net', netId: 'net-3v3', name: '3V3' },
    { kind: 'rename_net', netId: 'net-gnd', name: 'GND' },
    { kind: 'rename_net', netId: 'net-ch1-in', name: 'CH1_IN' },
    { kind: 'rename_net', netId: 'net-ch1-prot', name: 'CH1_PROT' },
    { kind: 'place_symbol', componentId: 'j1', at: { x: 0, y: 0 }, rot: 0, mirror: false },
    { kind: 'place_symbol', componentId: 'rs', at: { x: 12700000, y: 0 }, rot: 0, mirror: false },
    { kind: 'place_symbol', componentId: 'dclamp', at: { x: 25400000, y: -12700000 }, rot: 0, mirror: false },
    { kind: 'place_symbol', componentId: 'dtvs', at: { x: 6350000, y: -12700000 }, rot: 90, mirror: false },
  ];
}

export const FIXTURES: Record<string, OpEnvelope[]> = {
  'led-resistor': envelopes(ledResistor()),
  'routed-led': envelopes(routedLed()),
  'traffic-light-555': envelopes(trafficLight555()),
  'probe-input-protection': envelopes(probeInputProtection()),
};
