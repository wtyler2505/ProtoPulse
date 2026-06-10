/**
 * Every ERC code maps to exactly one concepts-wiki article — the error
 * message IS the curriculum's index (Vol III §2.2).
 */
export interface CodeInfo {
  title: string;
  conceptSlug: string;
}

export const ERC_CODES: Record<string, CodeInfo> = {
  'ERC-DRIVE-CONFLICT': { title: 'Drive conflict', conceptSlug: 'push-pull-vs-open-collector' },
  'ERC-RAIL-SHORT': { title: 'Power rail short', conceptSlug: 'ground-three-meanings' },
  'ERC-OUTPUT-ON-RAIL': { title: 'Output wired to a rail', conceptSlug: 'push-pull-vs-open-collector' },
  'ERC-OUTPUT-POWERS-PIN': { title: 'Logic output feeding a supply pin', conceptSlug: 'voltage-vs-current' },
  'ERC-TRISTATE-DRIVEN': { title: 'Tri-state bus driven push-pull', conceptSlug: 'push-pull-vs-open-collector' },
  'ERC-OC-DRIVEN': { title: 'Open-collector net driven push-pull', conceptSlug: 'push-pull-vs-open-collector' },
  'ERC-OC-ON-RAIL': { title: 'Open-collector pin on a rail', conceptSlug: 'pull-up-pull-down' },
  'ERC-TRISTATE-ON-RAIL': { title: 'Tri-state pin on a rail', conceptSlug: 'push-pull-vs-open-collector' },
  'ERC-BIDI-DRIVEN': { title: 'Bidirectional pin driven push-pull', conceptSlug: 'push-pull-vs-open-collector' },
  'ERC-NC-CONNECTED': { title: 'No-connect pin connected', conceptSlug: 'reading-a-datasheet' },
  'ERC-FLOATING-INPUT': { title: 'Floating input', conceptSlug: 'floating-inputs' },
  'ERC-POWER-UNSOURCED': { title: 'Unpowered supply', conceptSlug: 'voltage-vs-current' },
  'ERC-SINGLE-PORT-NET': { title: 'Single-pin net', conceptSlug: 'series-vs-parallel' },
  'ERC-OC-NO-PULLUP': { title: 'Missing pull-up', conceptSlug: 'pull-up-pull-down' },
  'ERC-CURRENT-BUDGET': { title: 'Current budget exceeded', conceptSlug: 'power-and-heat' },
  'ERC-UNKNOWN-PART': { title: 'Unknown part', conceptSlug: 'reading-a-datasheet' },
  'ERC-UNKNOWN-PIN': { title: 'Unknown pin', conceptSlug: 'reading-a-datasheet' },
};

export function conceptFor(code: string): CodeInfo | undefined {
  return ERC_CODES[code];
}
