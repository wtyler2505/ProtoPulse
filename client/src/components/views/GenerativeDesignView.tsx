/**
 * GenerativeDesignView — AI-powered evolutionary circuit design UI.
 *
 * Split layout:
 * - Left: Design spec input (description, constraint sliders, population/generation controls)
 * - Right: Candidate cards grid showing fitness scores, component counts, mini previews
 *
 * @module views/GenerativeDesignView
 */

import { useState, useCallback, useMemo } from 'react';
import { useGenerativeDesign } from '@/lib/generative-design/generative-engine';
import { defaultCriteria } from '@/lib/generative-design/fitness-scorer';
import {
  architectureToCurrentIR,
  compareCandidateWithCurrent,
  exportCandidate,
} from '@/lib/generative-design/generative-adopt';
import { AdoptCandidateDialog } from '@/components/dialogs/AdoptCandidateDialog';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { toast } from '@/hooks/use-toast';
import type { DesignSpec, CandidateEntry } from '@/lib/generative-design/generative-engine';
import type { ComparisonResult, AdoptResult } from '@/lib/generative-design/generative-adopt';
import type { CircuitIR } from '@/lib/circuit-dsl/circuit-ir';
import { VaultInfoIcon } from '@/components/ui/vault-info-icon';

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
  const { nodes: existingNodes, edges: existingEdges, setNodes, setEdges, pushUndoState } = useArchitecture();

  const [description, setDescription] = useState('');
  const [budgetUsd, setBudgetUsd] = useState(25);
  const [maxWatts, setMaxWatts] = useState(5);
  const [maxTempC, setMaxTempC] = useState(85);
  const [populationSize, setPopulationSize] = useState(6);
  const [generations, setGenerations] = useState(5);

  const [adoptDialogOpen, setAdoptDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateEntry | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [showComparison, setShowComparison] = useState<string | null>(null); // candidate id

  const isRunning = state === 'generating' || state === 'scoring' || state === 'evolving';

  // Derive the current project's CircuitIR from the live architecture graph.
  // This replaces the prior hardcoded `defaultBaseCircuit()` stub that caused
  // Adopt/Compare to always diff against a single fake resistor (audit C-1).
  const currentArchitectureIR = useMemo(
    () => architectureToCurrentIR(existingNodes, existingEdges),
    [existingNodes, existingEdges],
  );

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

  const handleCompare = useCallback((candidate: CandidateEntry) => {
    const result = compareCandidateWithCurrent(candidate, currentArchitectureIR);
    setComparisonResult(result);
    setShowComparison((prev) => (prev === candidate.id ? null : candidate.id));
  }, [currentArchitectureIR]);

  const handleAdoptClick = useCallback((candidate: CandidateEntry) => {
    setSelectedCandidate(candidate);
    setAdoptDialogOpen(true);
  }, []);

  const handleExport = useCallback((candidate: CandidateEntry) => {
    exportCandidate(candidate);
  }, []);

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
            <label htmlFor="constraint-budget-input" className="text-xs text-zinc-400">Budget: ${budgetUsd}</label>
            <input
              id="constraint-budget-input"
              type="range"
              min={1}
              max={200}
              value={budgetUsd}
              onChange={(e) => { setBudgetUsd(Number(e.target.value)); }}
              className="accent-cyan-400"
            />
          </div>

          <div data-testid="constraint-power" className="flex flex-col gap-1">
            <label htmlFor="constraint-power-input" className="text-xs text-zinc-400">Max Power: {maxWatts}W</label>
            <input
              id="constraint-power-input"
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
            <label htmlFor="constraint-temperature-input" className="text-xs text-zinc-400">Max Temp: {maxTempC}C</label>
            <input
              id="constraint-temperature-input"
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
            <label htmlFor="population-size-input" className="text-xs text-zinc-400 flex items-center gap-1">
              Population
              <VaultInfoIcon
                slug="genetic-algorithm-parameters-population-and-generations-explained"
                testId="population-vault-info"
                ariaLabel="About genetic algorithm population parameter"
              />
            </label>
            <input
              id="population-size-input"
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
            <label htmlFor="generations-input" className="text-xs text-zinc-400 flex items-center gap-1">
              Generations
              <VaultInfoIcon
                slug="genetic-algorithm-parameters-population-and-generations-explained"
                testId="generations-vault-info"
                ariaLabel="About genetic algorithm generations parameter"
              />
            </label>
            <input
              id="generations-input"
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
            disabled={isRunning || description.trim().length === 0}
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
          <div data-testid="generation-progress" className="text-xs text-zinc-400">
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
          <div data-testid="empty-state" className="flex h-full items-center justify-center text-zinc-400">
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
                  <span className="text-xs text-zinc-400">
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
                        <span className="text-zinc-400 w-24 truncate">{key}</span>
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

                {/* Action buttons */}
                <div className="mt-3 flex gap-1.5">
                  <button
                    data-testid={`compare-button-${candidate.id}`}
                    onClick={() => { handleCompare(candidate); }}
                    className="flex-1 rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 hover:border-cyan-600 transition-colors"
                  >
                    Compare
                  </button>
                  <button
                    data-testid={`adopt-button-${candidate.id}`}
                    onClick={() => { handleAdoptClick(candidate); }}
                    className="flex-1 rounded bg-cyan-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-600 transition-colors"
                  >
                    Adopt
                  </button>
                  <button
                    data-testid={`export-button-${candidate.id}`}
                    onClick={() => { handleExport(candidate); }}
                    className="flex-1 rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 hover:border-cyan-600 transition-colors"
                  >
                    Export
                  </button>
                </div>

                {/* Inline comparison */}
                {showComparison === candidate.id && comparisonResult && (
                  <div
                    data-testid={`comparison-panel-${candidate.id}`}
                    className="mt-2 rounded border border-zinc-700 bg-zinc-800/50 p-2 text-xs space-y-1"
                  >
                    <div className="text-zinc-300 font-medium">vs Current</div>
                    <div className="text-zinc-400">{comparisonResult.summary}</div>
                    {comparisonResult.componentDiffs
                      .filter((d) => d.status !== 'unchanged')
                      .map((d) => (
                        <div key={d.refdes} className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] uppercase font-medium ${
                              d.status === 'added'
                                ? 'text-green-400'
                                : d.status === 'removed'
                                  ? 'text-red-400'
                                  : 'text-yellow-400'
                            }`}
                          >
                            {d.status}
                          </span>
                          <span className="text-zinc-300 font-mono">{d.refdes}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adopt dialog */}
      <AdoptCandidateDialog
        open={adoptDialogOpen}
        onOpenChange={setAdoptDialogOpen}
        candidate={selectedCandidate}
        currentIR={currentArchitectureIR}
        onAdopt={(result: AdoptResult) => {
          pushUndoState();

          // Convert AdoptResult nodes to @xyflow/react Node format and merge with existing
          const newNodes = result.nodes.map((n) => ({
            id: n.nodeId,
            type: 'custom' as const,
            position: { x: n.positionX, y: n.positionY },
            data: {
              label: n.label,
              type: n.nodeType,
              description: (n.data.generatedFrom as string) || undefined,
            },
          }));

          // Convert AdoptResult edges to @xyflow/react Edge format and merge with existing
          const newEdges = result.edges.map((e) => ({
            id: e.edgeId,
            source: e.source,
            target: e.target,
            label: e.label,
          }));

          setNodes([...existingNodes, ...newNodes]);
          setEdges([...existingEdges, ...newEdges]);

          toast({
            title: 'Design adopted',
            description: `Added ${result.componentCount} component${result.componentCount !== 1 ? 's' : ''} and ${result.netCount} net${result.netCount !== 1 ? 's' : ''} to architecture.`,
          });
        }}
      />
    </div>
  );
}
