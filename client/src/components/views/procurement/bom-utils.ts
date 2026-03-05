// ---------------------------------------------------------------------------
// ESD & Assembly Detection Utilities
// ---------------------------------------------------------------------------

const ESD_PATTERNS: RegExp[] = [
  /\bic\b/i, /\bmcu\b/i, /\bsoc\b/i, /\bmicrocontroller\b/i, /\bmicroprocessor\b/i,
  /\bfpga\b/i, /\bcpld\b/i, /\basic\b/i, /\bdsp\b/i,
  /\bmosfet\b/i, /\bjfet\b/i, /\bcmos\b/i, /\bmos\b/i, /\bigbt\b/i,
  /\bop[- ]?amp\b/i, /\bopamp\b/i, /\bcomparator\b/i, /\badc\b/i, /\bdac\b/i,
  /\buart\b/i, /\bspi\b/i, /\bi2c\b/i, /\busb\b/i,
  /\beeprom\b/i, /\bflash\b/i, /\bsram\b/i, /\bdram\b/i,
  /\besp32\b/i, /\besp8266\b/i, /\bstm32\b/i, /\batmega\b/i, /\battiny\b/i,
  /\brp2040\b/i, /\bnrf52\b/i, /\bsamd\b/i,
  /\bldo\b/i, /\bvoltage regulator\b/i, /\bdc[- ]?dc\b/i, /\bbuck\b/i, /\bboost converter\b/i,
];

export function detectEsdSensitivity(description: string, partNumber: string): boolean {
  const combined = `${description} ${partNumber}`;
  return ESD_PATTERNS.some((p) => p.test(combined));
}

export type AssemblyCategory = 'smt' | 'through_hole' | 'hand_solder' | 'mechanical';

const SMT_PATTERNS: RegExp[] = [
  /\b0201\b/, /\b0402\b/, /\b0603\b/, /\b0805\b/, /\b1206\b/, /\b1210\b/, /\b1812\b/, /\b2010\b/, /\b2512\b/,
  /\bsmd\b/i, /\bsmt\b/i, /\bsurface mount\b/i,
  /\bqfp\b/i, /\btqfp\b/i, /\blqfp\b/i, /\bqfn\b/i, /\bdfn\b/i, /\bson\b/i,
  /\bbga\b/i, /\bfbga\b/i, /\bwlcsp\b/i,
  /\bsop\b/i, /\bssop\b/i, /\btssop\b/i, /\bmsop\b/i, /\bsoic\b/i,
  /\bsot[- ]?23\b/i, /\bsot[- ]?223\b/i, /\bsc[- ]?70\b/i, /\bd[- ]?pak\b/i,
  /\bto[- ]?252\b/i, /\bto[- ]?263\b/i,
];

const THROUGH_HOLE_PATTERNS: RegExp[] = [
  /\bthrough[- ]?hole\b/i, /\btht\b/i, /\bdip\b/i, /\bpdip\b/i, /\bsip\b/i,
  /\bto[- ]?92\b/i, /\bto[- ]?220\b/i, /\bto[- ]?247\b/i, /\bto[- ]?3\b/i,
  /\bradial\b/i, /\baxial\b/i,
];

const HAND_SOLDER_PATTERNS: RegExp[] = [
  /\bconnector\b/i, /\bjst\b/i, /\bmolex\b/i, /\bheader\b/i, /\bterminal\b/i,
  /\bwire\b/i, /\bcable\b/i, /\bsocket\b/i, /\bplug\b/i, /\bjack\b/i,
  /\bdb9\b/i, /\bdb25\b/i, /\busb[- ]?[abc]\b/i, /\bhdmi\b/i, /\brj45\b/i,
  /\bswitch\b/i, /\bbutton\b/i, /\bpotentiometer\b/i, /\btrimmer\b/i,
  /\bbattery holder\b/i, /\bfuse holder\b/i, /\brelay\b/i, /\btransformer\b/i,
  /\bbuzzer\b/i, /\bspeaker\b/i, /\btest point\b/i,
];

const MECHANICAL_PATTERNS: RegExp[] = [
  /\bstandoff\b/i, /\bscrew\b/i, /\bnut\b/i, /\bwasher\b/i, /\bspacer\b/i,
  /\bbracket\b/i, /\bmounting\b/i, /\bheatsink\b/i, /\bheat sink\b/i,
  /\benclosure\b/i, /\bclip\b/i, /\brivet\b/i, /\bgasket\b/i,
  /\brubber feet\b/i, /\bbumper\b/i, /\bthermal pad\b/i, /\bthermal tape\b/i,
];

export function detectAssemblyCategory(description: string, partNumber: string): AssemblyCategory | null {
  const combined = `${description} ${partNumber}`;
  if (MECHANICAL_PATTERNS.some((p) => p.test(combined))) { return 'mechanical'; }
  if (HAND_SOLDER_PATTERNS.some((p) => p.test(combined))) { return 'hand_solder'; }
  if (THROUGH_HOLE_PATTERNS.some((p) => p.test(combined))) { return 'through_hole'; }
  if (SMT_PATTERNS.some((p) => p.test(combined))) { return 'smt'; }
  return null;
}

export interface AssemblyCategoryInfo {
  label: string;
  note: string;
  color: string;
  bgColor: string;
}

export const ASSEMBLY_CATEGORY_INFO: Record<AssemblyCategory | 'unassigned', AssemblyCategoryInfo> = {
  smt: {
    label: 'SMT (Surface Mount)',
    note: 'Requires solder paste stencil and reflow oven. Inspect with magnification after reflow.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
  },
  through_hole: {
    label: 'Through-Hole',
    note: 'Wave soldering or hand soldering. Trim leads after soldering. Check for cold joints.',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
  },
  hand_solder: {
    label: 'Hand-Solder',
    note: 'Connectors, wires, and large components. Solder by hand with appropriate tip size and temperature.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
  },
  mechanical: {
    label: 'Mechanical',
    note: 'Standoffs, screws, spacers, and enclosure parts. No soldering required — assemble with tools.',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
  },
  unassigned: {
    label: 'Unassigned',
    note: 'Category could not be auto-detected. Set manually or update the component description.',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/10 border-border',
  },
};
