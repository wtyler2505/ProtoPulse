import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';
import type { PartMeta } from '@shared/component-types';

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

export function getRefDesPrefix(part: ComponentPart | undefined): string {
  if (!part) return 'X';
  const meta = (part.meta ?? {}) as Partial<PartMeta>;
  const family = (meta.family || '').toLowerCase().trim();
  if (family && FAMILY_PREFIX[family]) return FAMILY_PREFIX[family];

  // Fallback: check tags for a matching family keyword
  const tags = meta.tags ?? [];
  for (const tag of tags) {
    const prefix = FAMILY_PREFIX[tag.toLowerCase().trim()];
    if (prefix) return prefix;
  }

  return 'X';
}

export function generateRefDes(
  existingInstances: CircuitInstanceRow[] | undefined,
  part: ComponentPart | undefined,
): string {
  const prefix = getRefDesPrefix(part);
  const existing = (existingInstances ?? [])
    .map((inst) => inst.referenceDesignator)
    .filter((rd) => rd.startsWith(prefix));

  // Extract numeric suffixes and find the max
  let maxNum = 0;
  for (const rd of existing) {
    const numStr = rd.slice(prefix.length);
    const num = parseInt(numStr, 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }

  return `${prefix}${maxNum + 1}`;
}
