import {
  getVerificationLevel,
  getVerificationStatus,
  inferPartFamily,
  type ExactPartFamily,
  type PartVerificationLevel,
  type PartVerificationStatus,
} from './component-trust';
import type { PartMeta } from './component-types';
import type { ComponentPart } from './schema';

export type ExactPartResolutionKind =
  | 'empty'
  | 'verified-match'
  | 'candidate-match'
  | 'ambiguous-match'
  | 'needs-draft';

export interface ExactPartRequestPlaybook {
  draftSeed: ExactPartDraftSeed;
  evidenceChecklist: string[];
  id: string;
  title: string;
}

export interface ExactPartDraftSeed {
  communitySourceUrl?: string;
  description: string;
  marketplaceSourceUrl?: string;
  officialSourceUrl?: string;
}

export interface ExactPartResolutionMatch {
  family: ExactPartFamily;
  level: PartVerificationLevel;
  matchReasons: string[];
  manufacturer?: string;
  mpn?: string;
  part: ComponentPart;
  score: number;
  status: PartVerificationStatus;
  title: string;
}

export interface ExactPartResolution {
  draftSeed: ExactPartDraftSeed;
  evidenceChecklist: string[];
  kind: ExactPartResolutionKind;
  matches: ExactPartResolutionMatch[];
  message: string;
  playbook: ExactPartRequestPlaybook | null;
  query: string;
  recommendedDraftDescription: string;
  topMatch: ExactPartResolutionMatch | null;
}

interface ExactPartPlaybookDefinition {
  draftSeed: ExactPartDraftSeed;
  evidenceChecklist: string[];
  id: string;
  requiredTokens: string[];
  title: string;
}

const GENERIC_EVIDENCE_CHECKLIST = [
  'Official product page or datasheet link for the exact revision',
  'Mechanical outline with real connector and mounting-hole positions',
  'Pinout or silkscreen reference that confirms terminal names and orientation',
];

const REQUEST_STOP_WORDS = new Set([
  'a',
  'add',
  'and',
  'bench',
  'board',
  'build',
  'canvas',
  'exact',
  'for',
  'help',
  'how',
  'i',
  'it',
  'me',
  'module',
  'my',
  'on',
  'onto',
  'part',
  'parts',
  'place',
  'please',
  'show',
  'the',
  'this',
  'to',
  'up',
  'using',
  'want',
  'wire',
  'with',
]);

const BOARD_LIKE_FAMILIES = new Set<ExactPartFamily>([
  'board-module',
  'breakout',
  'driver',
  'sensor-module',
  'shield',
]);

const EXACT_PART_PLAYBOOKS: ExactPartPlaybookDefinition[] = [
  {
    id: 'arduino-mega-2560-r3',
    title: 'Arduino Mega 2560 R3',
    requiredTokens: ['arduino', 'mega', '2560'],
    draftSeed: {
      description:
        'Arduino Mega 2560 R3 with the exact PCB outline, USB-B connector, barrel jack, reset button, ATmega2560 package, power header, digital headers, analog header, ICSP header, and silkscreened pin labels. Preserve the real board proportions and header spacing instead of a generic microcontroller placeholder.',
    },
    evidenceChecklist: [
      'Official Arduino Mega 2560 R3 board page or datasheet for the exact header layout',
      'Top-down board image showing USB-B, barrel jack, reset button, and ICSP placement',
      'Pinout reference confirming header labels and board orientation',
    ],
  },
  {
    id: 'arduino-uno-r3',
    title: 'Arduino Uno R3',
    requiredTokens: ['arduino', 'uno'],
    draftSeed: {
      description:
        'Arduino Uno R3 with the real PCB outline, USB-B connector, barrel jack, reset button, ATmega328P package, female headers, ICSP header, power header, and exact silkscreen labels. Keep the asymmetrical header spacing and orientation cues accurate.',
    },
    evidenceChecklist: [
      'Official Arduino Uno R3 page or datasheet with board dimensions',
      'Top-down board image showing the asymmetric header spacing',
      'Pinout reference for power, analog, digital, and ICSP headers',
    ],
  },
  {
    id: 'riorand-motor-controller',
    title: 'RioRand Motor Controller',
    requiredTokens: ['riorand', 'motor', 'controller'],
    draftSeed: {
      description:
        'RioRand KJL-01 brushless motor controller module for 120-degree 3-phase BLDC motors with Hall sensors. Model the exact board outline, red PCB, terminal block order, heatsink or power transistor arrangement, supply input terminals, U/V/W motor outputs, Hall connector, on-board potentiometer, and any stop / brake / forward / reverse / PWM or 0-5V control terminals printed on the real silkscreen. Preserve the real terminal naming, connector spacing, and mounting-hole positions so bench wiring can be reviewed accurately and low-voltage bring-up can follow the real hardware.',
      marketplaceSourceUrl: 'https://www.amazon.com/RioRand-6-60V-Brushless-Electric-Controller/dp/B087M2378D',
    },
    evidenceChecklist: [
      'Seller or marketplace listing for the exact RioRand KJL-01 hall-sensor controller variant',
      'Clear top-down photo or drawing of terminal labels, Hall connector order, and control inputs',
      'Pinout or wiring diagram confirming supply, U/V/W motor outputs, Hall pins, PWM / analog speed input, and stop / brake / direction terminals',
    ],
  },
  {
    id: 'nodemcu-esp32',
    title: 'NodeMCU / ESP32 Dev Board',
    requiredTokens: ['esp32'],
    draftSeed: {
      description:
        'ESP32 development board with the exact module outline, USB connector, boot and reset buttons, pin headers, antenna keepout, silkscreen labels, and breadboard-facing header spacing. Keep the real board shape and orientation cues instead of a generic MCU body.',
    },
    evidenceChecklist: [
      'Official ESP32 dev board page or vendor page for the exact module variant',
      'Top-down board image showing USB, buttons, and header labels',
      'Pinout reference for the exact board revision',
    ],
  },
];

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenizeSearchText(value: string): string[] {
  return normalizeSearchText(value)
    .split(' ')
    .filter((token) => token.length > 0 && !REQUEST_STOP_WORDS.has(token));
}

function dedupeStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim())));
}

function getAliases(meta: PartMeta): string[] {
  if (!Array.isArray(meta.aliases)) {
    return [];
  }

  return dedupeStrings(meta.aliases);
}

function buildCandidateStrings(meta: PartMeta): {
  aliases: string[];
  manufacturerTitle: string | null;
  title: string;
  titleWithMpn: string | null;
} {
  const title = meta.title.trim();
  const manufacturerTitle = meta.manufacturer ? `${meta.manufacturer} ${title}` : null;
  const titleWithMpn = meta.mpn ? `${title} ${meta.mpn}` : null;

  return {
    aliases: getAliases(meta),
    manufacturerTitle,
    title,
    titleWithMpn,
  };
}

function isBoardLikeRequest(tokens: string[]): boolean {
  return tokens.some((token) => ['arduino', 'esp32', 'nodemcu', 'mega', 'uno', 'driver', 'controller', 'shield', 'breakout'].includes(token));
}

function buildGenericDraftDescription(query: string): string {
  return `${query.trim()} with the exact board or module outline, real connector positions, visible orientation cues, silkscreen labels, and breadboard-relevant pin anchors. Preserve the actual physical appearance instead of falling back to a generic placeholder.`;
}

function buildGenericDraftSeed(query: string): ExactPartDraftSeed {
  return {
    description: buildGenericDraftDescription(query),
  };
}

function matchesPlaybook(tokens: string[], playbook: ExactPartPlaybookDefinition): boolean {
  return playbook.requiredTokens.every((token) => tokens.includes(token));
}

function clonePlaybook(playbook: ExactPartPlaybookDefinition): ExactPartRequestPlaybook {
  return {
    draftSeed: { ...playbook.draftSeed },
    evidenceChecklist: [...playbook.evidenceChecklist],
    id: playbook.id,
    title: playbook.title,
  };
}

export function findExactPartPlaybooksInText(query: string): ExactPartRequestPlaybook[] {
  const tokens = tokenizeSearchText(query);
  if (tokens.length === 0) {
    return [];
  }

  return EXACT_PART_PLAYBOOKS
    .filter((playbook) => matchesPlaybook(tokens, playbook))
    .map(clonePlaybook);
}

function findMatchingPlaybook(tokens: string[]): ExactPartRequestPlaybook | null {
  const match = EXACT_PART_PLAYBOOKS.find((playbook) => matchesPlaybook(tokens, playbook));
  return match ? clonePlaybook(match) : null;
}

function scoreMatch(query: string, tokens: string[], part: ComponentPart): ExactPartResolutionMatch | null {
  const meta = ((part.meta ?? {}) as Partial<PartMeta>) ?? {};
  const title = typeof meta.title === 'string' ? meta.title.trim() : '';
  if (title.length === 0) {
    return null;
  }

  const status = getVerificationStatus(meta);
  const level = getVerificationLevel(meta);
  const family = inferPartFamily(meta);
  const candidateStrings = buildCandidateStrings({
    title,
    aliases: getAliases(meta as PartMeta),
    family: meta.family,
    manufacturer: meta.manufacturer,
    mountingType: meta.mountingType ?? '',
    mpn: meta.mpn,
    packageType: meta.packageType,
    properties: meta.properties ?? [],
    tags: Array.isArray(meta.tags) ? meta.tags : [],
  });

  const searchableStrings = dedupeStrings([
    candidateStrings.title,
    candidateStrings.manufacturerTitle,
    candidateStrings.titleWithMpn,
    meta.mpn,
    ...(Array.isArray(meta.tags) ? meta.tags : []),
    ...candidateStrings.aliases,
  ]);

  const normalizedTitle = normalizeSearchText(candidateStrings.title);
  const normalizedAliases = candidateStrings.aliases.map((alias) => normalizeSearchText(alias));
  const normalizedMpn = meta.mpn ? normalizeSearchText(meta.mpn) : '';
  const normalizedManufacturerTitle = candidateStrings.manufacturerTitle ? normalizeSearchText(candidateStrings.manufacturerTitle) : '';
  const normalizedCorpus = searchableStrings.map((value) => normalizeSearchText(value)).join(' ');

  let score = 0;
  const matchReasons: string[] = [];

  if (normalizedTitle === query) {
    score += 190;
    matchReasons.push('Exact title match');
  } else if (normalizedAliases.includes(query)) {
    score += 180;
    matchReasons.push('Exact alias match');
  } else if (normalizedMpn.length > 0 && normalizedMpn === query) {
    score += 185;
    matchReasons.push('Exact part-number match');
  }

  if (normalizedTitle.includes(query) && normalizedTitle !== query) {
    score += 90;
    matchReasons.push('Title contains the full request');
  }

  if (normalizedManufacturerTitle.includes(query) && normalizedManufacturerTitle !== query) {
    score += 70;
    matchReasons.push('Manufacturer and title line up with the request');
  }

  if (normalizedMpn.length > 0 && query.includes(normalizedMpn)) {
    score += 65;
    matchReasons.push('Part number appears in the request');
  }

  const tokenHits = tokens.filter((token) => normalizedCorpus.includes(token));
  if (tokenHits.length > 0) {
    score += tokenHits.length * 12;
    matchReasons.push(`${String(tokenHits.length)}/${String(tokens.length)} request tokens matched`);
  }

  if (tokens.length > 1 && tokenHits.length === tokens.length) {
    score += 40;
    matchReasons.push('All key request tokens matched');
  }

  if (tokens.length > 0 && tokens.every((token) => normalizedTitle.includes(token))) {
    score += 30;
    matchReasons.push('Title covers every key token');
  }

  if (isBoardLikeRequest(tokens) && BOARD_LIKE_FAMILIES.has(family)) {
    score += 16;
    matchReasons.push('Board-like exact part family matches the request');
  }

  if (status === 'verified') {
    score += 18;
    matchReasons.push('Verified exact part');
  } else {
    score += 6;
  }

  if (level === 'official-backed') {
    score += 10;
    matchReasons.push('Official-backed evidence');
  } else if (level === 'mixed-source') {
    score += 5;
  }

  if (score < 55) {
    return null;
  }

  return {
    family,
    level,
    manufacturer: typeof meta.manufacturer === 'string' ? meta.manufacturer : undefined,
    matchReasons,
    mpn: typeof meta.mpn === 'string' ? meta.mpn : undefined,
    part,
    score,
    status,
    title,
  };
}

export function resolveExactPartRequest(query: string, parts: ComponentPart[]): ExactPartResolution {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    return {
      draftSeed: buildGenericDraftSeed(trimmedQuery),
      evidenceChecklist: [...GENERIC_EVIDENCE_CHECKLIST],
      kind: 'empty',
      matches: [],
      message: 'Describe the exact board or module you want on the bench.',
      playbook: null,
      query: '',
      recommendedDraftDescription: '',
      topMatch: null,
    };
  }

  const normalizedQuery = normalizeSearchText(trimmedQuery);
  const tokens = tokenizeSearchText(trimmedQuery);
  const playbook = findMatchingPlaybook(tokens);
  const matches = parts
    .map((part) => scoreMatch(normalizedQuery, tokens, part))
    .filter((match): match is ExactPartResolutionMatch => match != null)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  const draftSeed = playbook?.draftSeed ?? buildGenericDraftSeed(trimmedQuery);
  const recommendedDraftDescription = draftSeed.description;
  const evidenceChecklist = playbook?.evidenceChecklist ?? [...GENERIC_EVIDENCE_CHECKLIST];
  const topMatch = matches[0] ?? null;
  const secondMatch = matches[1] ?? null;

  if (!topMatch) {
    return {
      draftSeed,
      evidenceChecklist,
      kind: 'needs-draft',
      matches: [],
      message: 'No trustworthy exact part match exists in this project yet. Start a candidate exact draft before asking ProtoPulse for exact wiring guidance.',
      playbook,
      query: trimmedQuery,
      recommendedDraftDescription,
      topMatch: null,
    };
  }

  const ambiguous = secondMatch != null && topMatch.score - secondMatch.score <= 8;
  if (ambiguous) {
    return {
      draftSeed,
      evidenceChecklist,
      kind: 'ambiguous-match',
      matches,
      message: 'Multiple exact parts look plausible. Choose the right board or controller before you place anything on the bench.',
      playbook,
      query: trimmedQuery,
      recommendedDraftDescription,
      topMatch,
    };
  }

  if (topMatch.status === 'verified') {
    return {
      draftSeed,
      evidenceChecklist,
      kind: 'verified-match',
      matches,
      message: 'ProtoPulse found a verified exact part that is ready for bench placement and authoritative wiring work.',
      playbook,
      query: trimmedQuery,
      recommendedDraftDescription,
      topMatch,
    };
  }

  return {
    draftSeed,
    evidenceChecklist,
    kind: 'candidate-match',
    matches,
    message: 'ProtoPulse found a candidate exact part. You can place it visually, but exact hookup guidance should stay provisional until review is complete.',
    playbook,
    query: trimmedQuery,
    recommendedDraftDescription,
    topMatch,
  };
}
