/**
 * Reference designator utilities — shared between client and server.
 *
 * Maps part families to IEEE/IEC prefix letters and provides `nextRefdes()`
 * which scans existing reference designators to find the next available number.
 */

/** Maps part family to standard IEEE/IEC reference designator prefix. */
export const FAMILY_PREFIX: Record<string, string> = {
  resistor: 'R',
  capacitor: 'C',
  inductor: 'L',
  diode: 'D',
  led: 'D',
  transistor: 'Q',
  mosfet: 'Q',
  bjt: 'Q',
  jfet: 'Q',
  microcontroller: 'U',
  ic: 'U',
  opamp: 'U',
  regulator: 'U',
  sensor: 'U',
  module: 'U',
  connector: 'J',
  header: 'J',
  switch: 'SW',
  relay: 'K',
  crystal: 'Y',
  oscillator: 'Y',
  fuse: 'F',
  transformer: 'T',
  speaker: 'LS',
  buzzer: 'BZ',
  battery: 'BT',
  motor: 'M',
  potentiometer: 'RV',
  thermistor: 'RT',
  varistor: 'RV',
  ferrite: 'FB',
};

/**
 * Derive the reference designator prefix from part metadata.
 * Falls back to 'X' for unknown part families.
 */
export function getRefDesPrefix(meta: { family?: string; tags?: string[] } | undefined): string {
  if (!meta) { return 'X'; }
  const family = (meta.family || '').toLowerCase().trim();
  if (family && FAMILY_PREFIX[family]) { return FAMILY_PREFIX[family]; }

  // Fallback: check tags for a matching family keyword
  const tags = meta.tags ?? [];
  for (const tag of tags) {
    const prefix = FAMILY_PREFIX[tag.toLowerCase().trim()];
    if (prefix) { return prefix; }
  }

  return 'X';
}

/**
 * Given a prefix and a list of existing reference designators, return the next
 * available refdes (e.g. "R3" when existing are ["R1", "R2"]).
 */
export function nextRefdes(prefix: string, existingRefdes: string[]): string {
  const matching = existingRefdes.filter((rd) => rd.startsWith(prefix));
  let maxNum = 0;
  for (const rd of matching) {
    const numStr = rd.slice(prefix.length);
    const num = parseInt(numStr, 10);
    if (!isNaN(num) && num > maxNum) { maxNum = num; }
  }
  return `${prefix}${maxNum + 1}`;
}
