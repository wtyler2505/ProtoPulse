/**
 * GenerativeDesignView — AI-powered evolutionary circuit design UI.
 *
 * Split layout:
 * - Left: Design spec input (description, constraint sliders, population/generation controls)
 * - Right: Candidate cards grid showing fitness scores, component counts, mini previews
 *
 * @module views/GenerativeDesignView
 */

import { useState, useCallback } from 'react';
import { useGenerativeDesign } from '@/lib/generative-design/generative-engine';
import type { DesignSpec } from '@/lib/generative-design/generative-engine';
import { defaultCriteria } from '@/lib/generative-design/fitness-scorer';
import type { CircuitIR } from '@/lib/circuit-dsl/circuit-ir';

// ---------------------------------------------------------------------------
// Default base circuit for seeding the generation
// ---------------------------------------------------------------------------

function defaultBaseCircuit(): CircuitIR {
  return {
    meta: { name: 'Seed', version: '1.0.0' },
    components: [
      { id: 'r1', refdes: 'R1', partId: 'resistor', value: '10k', pins: { pin1: 'VCC', pin2: 'OUT' } },
    ],
    nets: [
      { id: 'n1', name: 'VCC', type: 'power' },
      { id: 'n2', name: 'GND', type: 'ground' },
      { id: 'n3', name: 'OUT', type: 'signal' },
    ],
    wires: [],
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GenerativeDesignView() {
  const { state, results, run, cancel } = useGenerativeDesign();

  const [description, setDescription] = useState('');
  const [budgetUsd, setBudgetUsd] = useState(25);
  const [maxWatts, setMaxWatts] = useState(5);
  const [maxTempC, setMaxTempC] = useState(85);
  const [populationSize, setPopulationSize] = useState(6);
  const [generations, setGenerations] = useState(5);

  const isRunning = state === 'generating' || state === 'scoring' || state === 'evolving';

  const handleGenerate = useCallback(() => {
    const criteria = defaultCriteria();
    criteria.estimatedCost.budgetUsd = budgetUsd;
    criteria.powerBudget.maxWatts = maxWatts;
    criteria.thermalMargin.maxTempC = maxTempC;

    const spec: DesignSpec = {
      description,
      constraints: criteria,
      populationSize,
      generations,
      seed: Date.now(),
    };

    void run(spec, [defaultBaseCircuit()]);
  }, [description, budgetUsd, maxWatts, maxTempC, populationSize, generations, run]);

  const latestResult = results.length > 0 ? results[results.length - 1] : null;

  return (
    <div data-testid="generative-design-view" className="flex h-full gap-4 p-4 overflow-hidden">
      {/* Left panel — Spec input */}
      <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto">
        <h2 className="text-lg font-semibold text-cyan-400">Generative Design</h2>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-400" htmlFor="spec-desc">
            Circuit Description
          </label>
          <textarea
            id="spec-desc"
            data-testid="spec-description-input"
            className="rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-100 resize-none"
            rows={3}
            placeholder="e.g., LED driver for 12V, 350mA"
            value={description}
            onChange={(e) => { setDescription(e.target.value); }}
          />
        </div>

        {/* Constraint sliders */}
        <div className="flex flex-col gap-3">
          <div data-testid="constraint-budget" className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Budget: ${budgetUsd}</label>
            <input
              type="range"
              min={1}
              max={200}
              value={budgetUsd}
              onChange={(e) => { setBudgetUsd(Number(e.target.value)); }}
              className="accent-cyan-400"
            />
          </div>

          <div data-testid="constraint-power" className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Max Power: {maxWatts}W</label>
            <input
              type="range"
              min={0.1}
              max={50}
              step={0.1}
              value={maxWatts}
              onChange={(e) => { setMaxWatts(Number(e.target.value)); }}
              className="accent-cyan-400"
            />
          </div>

          <div data-testid="constraint-temperature" className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Max Temp: {maxTempC}C</label>
            <input
              type="range"
              min={25}
              max={150}
              value={maxTempC}
              onChange={(e) => { setMaxTempC(Number(e.target.value)); }}
              className="accent-cyan-400"
            />
          </div>
        </div>

        {/* Population / generation controls */}
        <div className="flex gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-zinc-400">Population</label>
            <input
              data-testid="population-size-input"
              type="number"
              min={2}
              max={20}
              value={populationSize}
              onChange={(e) => { setPopulationSize(Number(e.target.value)); }}
              className="rounded border border-zinc-700 bg-zinc-900 p-1.5 text-sm text-zinc-100"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-zinc-400">Generations</label>
            <input
              data-testid="generations-input"
              type="number"
              min={1}
              max={50}
              value={generations}
              onChange={(e) => { setGenerations(Number(e.target.value)); }}
              className="rounded border border-zinc-700 bg-zinc-900 p-1.5 text-sm text-zinc-100"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            data-testid="generate-button"
            onClick={handleGenerate}
            disabled={isRunning}
            className="flex-1 rounded bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === 'complete' ? 'Regenerate' : 'Generate'}
          </button>
          {isRunning && (
            <button
              data-testid="cancel-button"
              onClick={cancel}
              className="rounded border border-zinc-600 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Progress */}
        {isRunning && (
          <div data-testid="loading-indicator" className="text-xs text-zinc-400">
            {state === 'generating' && 'Generating candidates...'}
            {state === 'scoring' && 'Scoring fitness...'}
            {state === 'evolving' && 'Evolving next generation...'}
          </div>
        )}

        {results.length > 0 && (
          <div data-testid="generation-progress" className="text-xs text-zinc-500">
            Generation {results.length} / {generations}
            {latestResult && (
              <> — Best: {(latestResult.bestFitness * 100).toFixed(1)}% | Avg: {(latestResult.averageFitness * 100).toFixed(1)}%</>
            )}
          </div>
        )}
      </div>

      {/* Right panel — Candidates */}
      <div className="flex-1 overflow-y-auto">
        {!latestResult ? (
          <div data-testid="empty-state" className="flex h-full items-center justify-center text-zinc-500">
            <div className="text-center">
              <p className="text-lg">No candidates yet</p>
              <p className="text-sm mt-1">Describe your circuit and click Generate to start</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {latestResult.candidates.map((candidate) => (
              <div
                key={candidate.id}
                data-testid={`candidate-card-${candidate.id}`}
                className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 hover:border-cyan-600 transition-colors"
              >
                {/* Fitness score */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    data-testid={`fitness-score-${candidate.id}`}
                    className="text-lg font-bold text-cyan-400"
                  >
                    {(candidate.fitness.overall * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs text-zinc-500">
                    #{candidate.fitness.rank ?? '-'}
                  </span>
                </div>

                {/* Fitness bar */}
                <div className="h-1.5 rounded-full bg-zinc-800 mb-2">
                  <div
                    className="h-full rounded-full bg-cyan-500"
                    style={{ width: `${candidate.fitness.overall * 100}%` }}
                  />
                </div>

                {/* Component count */}
                <div
                  data-testid={`component-count-${candidate.id}`}
                  className="text-xs text-zinc-400"
                >
                  {candidate.ir.components.length} component{candidate.ir.components.length !== 1 ? 's' : ''}
                </div>

                {/* Breakdown */}
                {Object.keys(candidate.fitness.breakdown).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(candidate.fitness.breakdown).map(([key, entry]) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="text-zinc-500 w-24 truncate">{key}</span>
                        <div className="flex-1 h-1 rounded bg-zinc-800">
                          <div
                            className="h-full rounded bg-zinc-500"
                            style={{ width: `${entry.score * 100}%` }}
                          />
                        </div>
                        <span className="text-zinc-400 w-8 text-right">
                          {(entry.score * 100).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
