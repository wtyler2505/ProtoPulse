// Deep import: the content package's index re-exports node:fs loaders,
// which the browser bundle must never see. schemas.js is pure zod.
import { DeckSchema } from '@protopulse/content/src/schemas.js';

import type { Deck } from '@protopulse/content/src/schemas.js';
import type { Finding } from '@protopulse/erc';
import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * DRC runner: wraps the LAZY '@protopulse/drc' import (the package is
 * built on a parallel track — never pay for it, or crash on it, at app
 * startup), caches outcomes per (branch, opsVersion), and surfaces
 * errors as values — the DRC panel renders them, it never catches.
 *
 * The drc module is discovered via import.meta.glob over the workspace
 * path (like ConceptViewer does for articles): while packages/drc does
 * not exist the glob is empty and Run DRC reports "not in this build";
 * the moment it lands, the same glob bundles it. The rule deck ships as
 * raw JSON the same way and validates against @protopulse/content's
 * DeckSchema at the boundary.
 */

/** Browser-safe twin of @protopulse/content's parseDeck (node-only pkg index). */
export function parseDeckJson(json: string): Deck {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new Error(`deck is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  return DeckSchema.parse(raw);
}

/** PINNED v0.4 contract: runDrc(graph, parts, deck) → erc-shaped findings. */
export interface DrcModule {
  runDrc: (graph: DesignGraph, parts: PartDb, deck: Deck) => Finding[];
}

export type DrcOutcome =
  | { ok: true; findings: Finding[]; deck: string; deckRev: string }
  | { ok: false; error: string };

export interface DrcRunKey {
  branch: string;
  opsVersion: number;
}

type DrcModuleLoader = () => Promise<Partial<DrcModule>>;
type DeckLoader = () => Promise<Deck>;

const drcModules = import.meta.glob('../../../drc/src/index.ts') as Record<
  string,
  () => Promise<unknown>
>;

const defaultModuleLoader: DrcModuleLoader = async () => {
  const load = Object.values(drcModules)[0];
  if (!load) {
    throw new Error('DRC not available yet — @protopulse/drc is not in this build');
  }
  return (await load()) as Partial<DrcModule>;
};

const deckFiles = import.meta.glob('../../../../content/decks/*.json', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

export const DEFAULT_DECK_FILE = 'jlcpcb-2layer-standard.json';

// ── Fab deck selection ───────────────────────────────────────────────
// One selected fab per session, app-wide: the DRC panel, the Router's
// direct runs, walk/shove clearance, and zone pours all answer to the
// SAME deck — checking against one fab while routing against another
// would be quiet dishonesty. Persisted so the choice sticks.

const FAB_DECK_KEY = 'pp-fab-deck';

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Every bundled fab deck file, sorted (the default first). */
export function listFabDecks(): string[] {
  const names = Object.keys(deckFiles).map(basename).sort();
  return [DEFAULT_DECK_FILE, ...names.filter((n) => n !== DEFAULT_DECK_FILE)];
}

let selectedDeckFile: string = (() => {
  try {
    const stored = localStorage.getItem(FAB_DECK_KEY);
    if (stored !== null && Object.keys(deckFiles).some((p) => basename(p) === stored)) return stored;
  } catch {
    // node test environment — default
  }
  return DEFAULT_DECK_FILE;
})();

export function fabDeckFile(): string {
  return selectedDeckFile;
}

export function setFabDeckFile(name: string): void {
  if (!Object.keys(deckFiles).some((p) => basename(p) === name)) {
    throw new Error(`unknown fab deck ${name} — bundled: ${listFabDecks().join(', ')}`);
  }
  selectedDeckFile = name;
  try {
    localStorage.setItem(FAB_DECK_KEY, name);
  } catch {
    // session-only selection is fine
  }
}

const defaultDeckLoader: DeckLoader = async () => {
  const file = selectedDeckFile;
  for (const [path, load] of Object.entries(deckFiles)) {
    if (basename(path) === file) return parseDeckJson(await load());
  }
  throw new Error(`rule deck ${file} is missing from content/decks`);
};

/** The SELECTED fab deck, for callers outside the DRC cache (the trace
 *  tool's walk/shove modes need min_clearance_nm). */
export const loadDefaultDeck: DeckLoader = defaultDeckLoader;

/** One-shot DRC for callers the cached runner can't serve — the
 *  Router's working copies churn too fast for (branch, opsVersion)
 *  keys. Loads module + deck lazily like everything else here. */
export async function runDrcDirect(graph: DesignGraph, parts: PartDb): Promise<Finding[]> {
  const mod = await defaultModuleLoader();
  if (typeof mod.runDrc !== 'function') {
    throw new Error('DRC not available yet — @protopulse/drc is not in this build');
  }
  return mod.runDrc(graph, parts, await defaultDeckLoader());
}

/** Primary branch + a few alternates without unbounded growth. */
const CACHE_LIMIT = 16;

export interface DrcRunner {
  run: (graph: DesignGraph, parts: PartDb, key: DrcRunKey) => Promise<DrcOutcome>;
}

export function createDrcRunner(
  loader: DrcModuleLoader = defaultModuleLoader,
  deckLoader: DeckLoader = defaultDeckLoader,
): DrcRunner {
  let modulePromise: Promise<Partial<DrcModule>> | null = null;
  let deckPromise: { file: string; promise: Promise<Deck> } | null = null;
  const cache = new Map<string, DrcOutcome>();

  const loadModule = (): Promise<Partial<DrcModule>> => (modulePromise ??= loader());
  // The deck promise is keyed on the selected fab — switching fabs
  // reloads instead of serving the old deck forever.
  const loadDeck = (): Promise<Deck> => {
    const file = selectedDeckFile;
    if (deckPromise?.file !== file) {
      deckPromise = { file, promise: deckLoader() };
    }
    return deckPromise.promise;
  };

  const run = async (graph: DesignGraph, parts: PartDb, key: DrcRunKey): Promise<DrcOutcome> => {
    // The fab deck is part of the report's identity, like the branch.
    const cacheKey = `drc:${selectedDeckFile}:${key.branch}@${String(key.opsVersion)}`;
    const hit = cache.get(cacheKey);
    // Errors are remembered but never served from cache — a retry re-runs.
    if (hit?.ok) return hit;

    let outcome: DrcOutcome;
    try {
      const mod = await loadModule();
      if (typeof mod.runDrc !== 'function') {
        throw new Error('DRC not available yet — @protopulse/drc is not in this build');
      }
      const deck = await loadDeck();
      outcome = { ok: true, findings: mod.runDrc(graph, parts, deck), deck: deck.deck, deckRev: deck.rev };
    } catch (err) {
      // A failed module load must not poison every later retry.
      modulePromise = null;
      deckPromise = null;
      outcome = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(cacheKey, outcome);
    return outcome;
  };

  return { run };
}

/** The app-wide runner instance. */
export const drcRunner: DrcRunner = createDrcRunner();

/** Cached panel entry point. */
export function runDrcCheck(graph: DesignGraph, parts: PartDb, key: DrcRunKey): Promise<DrcOutcome> {
  return drcRunner.run(graph, parts, key);
}
