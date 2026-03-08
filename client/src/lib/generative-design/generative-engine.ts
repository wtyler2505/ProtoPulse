/**
 * Generative Design Engine — Orchestrates evolutionary circuit design.
 *
 * Singleton+subscribe pattern. Takes a design spec (text + constraints),
 * generates N initial candidates via mutation from base circuits, scores them
 * with the fitness scorer, evolves top candidates through mutation/crossover,
 * and presents ranked results via an async generator.
 *
 * @module generative-design/generative-engine
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import type { CircuitIR } from '@/lib/circuit-dsl/circuit-ir';
import { scoreCircuit } from './fitness-scorer';
import type { FitnessCriteria, FitnessResult } from './fitness-scorer';
import { mutateCircuit, crossover } from './circuit-mutator';
import type { MutationType } from './circuit-mutator';
import { mulberry32 } from '@shared/prng';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DesignSpec {
  description: string;
  constraints: FitnessCriteria;
  populationSize: number;
  generations: number;
  seed?: number;
}

export interface CandidateEntry {
  ir: CircuitIR;
  fitness: FitnessResult;
  id: string;
}

export interface GenerationResult {
  generation: number;
  candidates: CandidateEntry[];
  bestFitness: number;
  averageFitness: number;
}

export type EngineState = 'idle' | 'generating' | 'scoring' | 'evolving' | 'complete';

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateId(prefix: string, rng: () => number): string {
  const hex = Math.floor(rng() * 0xffffffff).toString(16).padStart(8, '0');
  return `${prefix}-${hex}`;
}

// ---------------------------------------------------------------------------
// GenerativeDesignEngine — singleton + subscribe
// ---------------------------------------------------------------------------

export class GenerativeDesignEngine {
  private static instance: GenerativeDesignEngine | null = null;

  private state: EngineState = 'idle';
  private results: GenerationResult[] = [];
  private cancelled = false;
  private subscribers = new Set<() => void>();

  private constructor() {}

  static getInstance(): GenerativeDesignEngine {
    if (!GenerativeDesignEngine.instance) {
      GenerativeDesignEngine.instance = new GenerativeDesignEngine();
    }
    return GenerativeDesignEngine.instance;
  }

  /** Reset singleton for testing purposes. */
  static resetInstance(): void {
    if (GenerativeDesignEngine.instance) {
      GenerativeDesignEngine.instance.cancel();
      GenerativeDesignEngine.instance.subscribers.clear();
    }
    GenerativeDesignEngine.instance = null;
  }

  getState(): EngineState {
    return this.state;
  }

  getResults(): GenerationResult[] {
    return [...this.results];
  }

  getBestCandidate(): { ir: CircuitIR; fitness: FitnessResult } | null {
    if (this.results.length === 0) {
      return null;
    }

    const lastGen = this.results[this.results.length - 1];
    if (lastGen.candidates.length === 0) {
      return null;
    }

    const best = lastGen.candidates[0]; // Already sorted best-first
    return { ir: best.ir, fitness: best.fitness };
  }

  subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notify(): void {
    for (const cb of Array.from(this.subscribers)) {
      cb();
    }
  }

  private setState(s: EngineState): void {
    this.state = s;
    this.notify();
  }

  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Run the generative design loop as an async generator.
   *
   * Yields a GenerationResult after each generation completes.
   * The loop can be cancelled via `cancel()`.
   *
   * @param spec       - Design specification with constraints and population params
   * @param baseCircuits - One or more seed circuits to derive initial population from
   */
  async *run(spec: DesignSpec, baseCircuits: CircuitIR[]): AsyncGenerator<GenerationResult> {
    this.cancelled = false;
    this.results = [];
    const rng = mulberry32(spec.seed ?? Date.now());

    const allMutations: MutationType[] = [
      'value_change',
      'component_swap',
      'add_bypass_cap',
      'add_protection',
      'remove_component',
      'rewire_net',
    ];

    // --- Generate initial population ---
    this.setState('generating');

    let population: CircuitIR[] = [];

    // Use base circuits as seeds, mutating to fill population
    for (let i = 0; i < spec.populationSize; i++) {
      const baseIdx = i % Math.max(1, baseCircuits.length);
      const base = baseCircuits[baseIdx] ?? baseCircuits[0];
      if (!base) {
        // No base circuits at all — create empty
        population.push({
          meta: { name: spec.description, version: '1.0.0' },
          components: [],
          nets: [],
          wires: [],
        });
        continue;
      }

      if (i === 0) {
        // Keep first candidate as-is (the original)
        population.push(JSON.parse(JSON.stringify(base)) as CircuitIR);
      } else {
        // Mutate from base with increasing variation
        const mutated = mutateCircuit(base, {
          seed: Math.floor(rng() * 0xffffffff),
          mutationRate: 0.3 + (i / spec.populationSize) * 0.5,
          allowedMutations: allMutations,
        });
        population.push(mutated);
      }
    }

    // --- Evolutionary loop ---
    for (let gen = 0; gen < spec.generations; gen++) {
      if (this.cancelled) {
        break;
      }

      // Score
      this.setState('scoring');
      const scored: CandidateEntry[] = population.map((ir) => ({
        ir,
        fitness: scoreCircuit(ir, spec.constraints),
        id: generateId('cand', rng),
      }));

      // Sort by fitness descending and assign ranks directly
      const sortedCandidates = [...scored].sort(
        (a, b) => b.fitness.overall - a.fitness.overall,
      );
      for (let i = 0; i < sortedCandidates.length; i++) {
        sortedCandidates[i].fitness.rank = i + 1;
      }

      // Compute stats
      const bestFitness = sortedCandidates[0]?.fitness.overall ?? 0;
      const avgFitness =
        sortedCandidates.length > 0
          ? sortedCandidates.reduce((sum, c) => sum + c.fitness.overall, 0) / sortedCandidates.length
          : 0;

      const genResult: GenerationResult = {
        generation: gen,
        candidates: sortedCandidates,
        bestFitness,
        averageFitness: avgFitness,
      };

      this.results.push(genResult);
      this.notify();

      yield genResult;

      if (this.cancelled) {
        break;
      }

      // --- Evolve for next generation ---
      if (gen < spec.generations - 1) {
        this.setState('evolving');

        const nextPopulation: CircuitIR[] = [];

        // Elitism: keep top 2 (or fewer if population is small)
        const eliteCount = Math.min(2, sortedCandidates.length);
        for (let e = 0; e < eliteCount; e++) {
          nextPopulation.push(
            JSON.parse(JSON.stringify(sortedCandidates[e].ir)) as CircuitIR,
          );
        }

        // Fill rest with crossover + mutation
        while (nextPopulation.length < spec.populationSize) {
          // Tournament selection: pick 2 random, use better one
          const pick = () => {
            const a = Math.floor(rng() * sortedCandidates.length);
            const b = Math.floor(rng() * sortedCandidates.length);
            return sortedCandidates[a].fitness.overall >= sortedCandidates[b].fitness.overall
              ? sortedCandidates[a]
              : sortedCandidates[b];
          };

          const parent1 = pick();
          const parent2 = pick();

          // Crossover
          let child = crossover(
            parent1.ir,
            parent2.ir,
            Math.floor(rng() * 0xffffffff),
          );

          // Mutate child
          child = mutateCircuit(child, {
            seed: Math.floor(rng() * 0xffffffff),
            mutationRate: 0.3,
            allowedMutations: allMutations,
          });

          nextPopulation.push(child);
        }

        population = nextPopulation;
      }
    }

    this.setState('complete');
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * React hook wrapping the GenerativeDesignEngine singleton.
 *
 * Provides reactive access to engine state, results, best candidate,
 * and run/cancel functions.
 */
export function useGenerativeDesign(): {
  state: EngineState;
  results: GenerationResult[];
  best: { ir: CircuitIR; fitness: FitnessResult } | null;
  run: (spec: DesignSpec, baseCircuits: CircuitIR[]) => Promise<void>;
  cancel: () => void;
} {
  const engine = GenerativeDesignEngine.getInstance();

  const state = useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.getState(),
  );

  const [results, setResults] = useState<GenerationResult[]>([]);
  const [best, setBest] = useState<{ ir: CircuitIR; fitness: FitnessResult } | null>(null);

  useEffect(() => {
    const unsub = engine.subscribe(() => {
      setResults(engine.getResults());
      setBest(engine.getBestCandidate());
    });
    return unsub;
  }, [engine]);

  const run = useCallback(
    async (spec: DesignSpec, baseCircuits: CircuitIR[]) => {
      const gen = engine.run(spec, baseCircuits);
      for await (const _result of gen) {
        // Consuming the generator drives the engine
      }
    },
    [engine],
  );

  const cancel = useCallback(() => {
    engine.cancel();
  }, [engine]);

  return { state, results, best, run, cancel };
}
