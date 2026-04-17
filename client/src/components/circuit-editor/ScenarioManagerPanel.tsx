/**
 * ScenarioManagerPanel — UI for managing simulation scenarios and presets.
 *
 * Shows built-in presets (non-deletable) and user-created scenarios with
 * inline creation form, search/filter, and active scenario indicator.
 */

import { useState, useMemo, useSyncExternalStore, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Trash2, Play, X, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scenarioManager } from '@/lib/simulation/scenario-manager';
import type { SimType, CreateScenarioData, SimulationParameters } from '@/lib/simulation/scenario-manager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScenarioManagerPanelProps {
  className?: string;
  /** Callback when a scenario is loaded (set active). */
  onScenarioLoad?: (scenario: { simType: SimType; parameters: SimulationParameters }) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SIM_TYPE_LABELS: Record<SimType, string> = {
  dc: 'DC',
  ac: 'AC',
  transient: 'Transient',
};

const SIM_TYPE_COLORS: Record<SimType, string> = {
  dc: 'bg-green-500/20 text-green-400 border-green-500/30',
  ac: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  transient: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

function formatParamSummary(simType: SimType, params: SimulationParameters): string {
  switch (simType) {
    case 'dc':
      return params.temperature !== undefined ? `${params.temperature}\u00B0C` : 'Default';
    case 'ac': {
      const start = params.frequencyStart ?? 0;
      const end = params.frequencyEnd ?? 0;
      const pts = params.frequencyPoints ?? 0;
      return `${formatFreq(start)} \u2013 ${formatFreq(end)}, ${pts} pts`;
    }
    case 'transient': {
      const span = params.timeSpan ?? 0;
      const step = params.timeStep ?? 0;
      return `${formatTime(span)}, \u0394t=${formatTime(step)}`;
    }
    default:
      return '';
  }
}

function formatFreq(hz: number): string {
  if (hz >= 1e6) {
    return `${(hz / 1e6).toFixed(hz % 1e6 === 0 ? 0 : 1)} MHz`;
  }
  if (hz >= 1e3) {
    return `${(hz / 1e3).toFixed(hz % 1e3 === 0 ? 0 : 1)} kHz`;
  }
  return `${hz} Hz`;
}

function formatTime(s: number): string {
  if (s >= 1) {
    return `${s} s`;
  }
  if (s >= 1e-3) {
    return `${(s * 1e3).toFixed(s * 1e3 % 1 === 0 ? 0 : 1)} ms`;
  }
  if (s >= 1e-6) {
    return `${(s * 1e6).toFixed(s * 1e6 % 1 === 0 ? 0 : 1)} \u00B5s`;
  }
  return `${(s * 1e9).toFixed(1)} ns`;
}

// ---------------------------------------------------------------------------
// Inline creation form
// ---------------------------------------------------------------------------

interface NewScenarioFormProps {
  onSubmit: (data: CreateScenarioData) => void;
  onCancel: () => void;
}

function NewScenarioForm({ onSubmit, onCancel }: NewScenarioFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [simType, setSimType] = useState<SimType>('dc');
  const [frequencyStart, setFrequencyStart] = useState('');
  const [frequencyEnd, setFrequencyEnd] = useState('');
  const [frequencyPoints, setFrequencyPoints] = useState('');
  const [timeSpan, setTimeSpan] = useState('');
  const [timeStep, setTimeStep] = useState('');
  const [temperature, setTemperature] = useState('');

  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      return;
    }

    const parameters: SimulationParameters = {};

    if (simType === 'dc') {
      if (temperature.trim()) {
        parameters.temperature = parseFloat(temperature);
      }
    } else if (simType === 'ac') {
      if (frequencyStart.trim()) {
        parameters.frequencyStart = parseFloat(frequencyStart);
      }
      if (frequencyEnd.trim()) {
        parameters.frequencyEnd = parseFloat(frequencyEnd);
      }
      if (frequencyPoints.trim()) {
        parameters.frequencyPoints = parseInt(frequencyPoints, 10);
      }
    } else if (simType === 'transient') {
      if (timeSpan.trim()) {
        parameters.timeSpan = parseFloat(timeSpan);
      }
      if (timeStep.trim()) {
        parameters.timeStep = parseFloat(timeStep);
      }
    }

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      simType,
      parameters,
    });
  }, [name, description, simType, frequencyStart, frequencyEnd, frequencyPoints, timeSpan, timeStep, temperature, onSubmit]);

  return (
    <div className="flex flex-col gap-2 p-2 border border-[var(--color-editor-accent)]/30 rounded-md bg-[var(--color-editor-accent)]/5" data-testid="scenario-new-form">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Scenario name"
        className="h-7 text-xs"
        data-testid="scenario-form-name"
        autoFocus
      />
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="h-7 text-xs"
        data-testid="scenario-form-description"
      />

      <Select value={simType} onValueChange={(v) => setSimType(v as SimType)}>
        <SelectTrigger className="h-7 text-xs" data-testid="scenario-form-simtype">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dc">DC Analysis</SelectItem>
          <SelectItem value="ac">AC Sweep</SelectItem>
          <SelectItem value="transient">Transient</SelectItem>
        </SelectContent>
      </Select>

      {/* Type-specific parameter fields */}
      {simType === 'dc' && (
        <Input
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
          placeholder="Temperature (\u00B0C)"
          type="number"
          className="h-7 text-xs"
          data-testid="scenario-form-temperature"
        />
      )}

      {simType === 'ac' && (
        <div className="flex flex-col gap-1">
          <Input
            value={frequencyStart}
            onChange={(e) => setFrequencyStart(e.target.value)}
            placeholder="Start freq (Hz)"
            type="number"
            className="h-7 text-xs"
            data-testid="scenario-form-freq-start"
          />
          <Input
            value={frequencyEnd}
            onChange={(e) => setFrequencyEnd(e.target.value)}
            placeholder="End freq (Hz)"
            type="number"
            className="h-7 text-xs"
            data-testid="scenario-form-freq-end"
          />
          <Input
            value={frequencyPoints}
            onChange={(e) => setFrequencyPoints(e.target.value)}
            placeholder="Points"
            type="number"
            className="h-7 text-xs"
            data-testid="scenario-form-freq-points"
          />
        </div>
      )}

      {simType === 'transient' && (
        <div className="flex flex-col gap-1">
          <Input
            value={timeSpan}
            onChange={(e) => setTimeSpan(e.target.value)}
            placeholder="Time span (s)"
            type="number"
            step="0.001"
            className="h-7 text-xs"
            data-testid="scenario-form-timespan"
          />
          <Input
            value={timeStep}
            onChange={(e) => setTimeStep(e.target.value)}
            placeholder="Time step (s)"
            type="number"
            step="0.0001"
            className="h-7 text-xs"
            data-testid="scenario-form-timestep"
          />
        </div>
      )}

      <div className="flex gap-1">
        <Button
          variant="default"
          size="sm"
          className="flex-1 h-6 text-[10px]"
          onClick={handleSubmit}
          disabled={!name.trim()}
          data-testid="scenario-form-submit"
        >
          Create
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px]"
          onClick={onCancel}
          data-testid="scenario-form-cancel"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScenarioManagerPanel({ className, onScenarioLoad }: ScenarioManagerPanelProps) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Subscribe to scenario manager state changes
  useSyncExternalStore(
    (cb) => scenarioManager.subscribe(cb),
    () => scenarioManager.version,
  );

  const allScenarios = scenarioManager.listScenarios();
  const activeId = scenarioManager.getActiveScenarioId();

  const filteredScenarios = useMemo(() => {
    if (!search.trim()) {
      return allScenarios;
    }
    const term = search.toLowerCase();
    return allScenarios.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term) ||
        s.simType.toLowerCase().includes(term),
    );
  }, [allScenarios, search]);

  // Split into presets and user scenarios for rendering
  const presets = useMemo(() => filteredScenarios.filter((s) => scenarioManager.isPreset(s.id)), [filteredScenarios]);
  const userScenarios = useMemo(
    () => filteredScenarios.filter((s) => !scenarioManager.isPreset(s.id)),
    [filteredScenarios],
  );

  const handleCreate = useCallback(
    (data: CreateScenarioData) => {
      const created = scenarioManager.createScenario(data);
      scenarioManager.setActiveScenario(created.id);
      setShowForm(false);
      onScenarioLoad?.({ simType: created.simType, parameters: created.parameters });
    },
    [onScenarioLoad],
  );

  const handleLoad = useCallback(
    (id: string) => {
      scenarioManager.setActiveScenario(id);
      const scenario = scenarioManager.getScenario(id);
      if (scenario) {
        onScenarioLoad?.({ simType: scenario.simType, parameters: scenario.parameters });
      }
    },
    [onScenarioLoad],
  );

  const handleDelete = useCallback((id: string) => {
    scenarioManager.deleteScenario(id);
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col gap-2 bg-card/90 backdrop-blur-xl border border-border rounded-md shadow-lg p-2 w-72',
        className,
      )}
      data-testid="scenario-manager-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-foreground flex items-center gap-1" data-testid="scenario-manager-title">
          <Zap className="w-3 h-3 text-[var(--color-editor-accent)]" />
          Simulation Scenarios
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums" data-testid="scenario-manager-count">
          {allScenarios.length}
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter scenarios..."
          className="h-7 pl-7 text-xs"
          data-testid="scenario-manager-search"
        />
      </div>

      {/* New scenario button / form */}
      {showForm ? (
        <NewScenarioForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 border-dashed border-[var(--color-editor-accent)]/30 text-[var(--color-editor-accent)] hover:bg-[var(--color-editor-accent)]/10"
          onClick={() => setShowForm(true)}
          data-testid="scenario-new-button"
        >
          <Plus className="w-3 h-3" />
          New Scenario
        </Button>
      )}

      {/* Scenario list */}
      <ScrollArea className="max-h-72">
        <div className="flex flex-col gap-1" data-testid="scenario-manager-list">
          {/* Presets section */}
          {presets.length > 0 && (
            <>
              <div className="flex items-center gap-1 px-1 pt-1">
                <Star className="w-3 h-3 text-yellow-400" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Presets
                </span>
              </div>
              {presets.map((scenario) => (
                <ScenarioRow
                  key={scenario.id}
                  scenario={scenario}
                  isActive={scenario.id === activeId}
                  isPreset
                  onLoad={handleLoad}
                  onDelete={handleDelete}
                />
              ))}
            </>
          )}

          {/* User scenarios section */}
          {userScenarios.length > 0 && (
            <>
              <div className="flex items-center gap-1 px-1 pt-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  My Scenarios
                </span>
              </div>
              {userScenarios.map((scenario) => (
                <ScenarioRow
                  key={scenario.id}
                  scenario={scenario}
                  isActive={scenario.id === activeId}
                  isPreset={false}
                  onLoad={handleLoad}
                  onDelete={handleDelete}
                />
              ))}
            </>
          )}

          {filteredScenarios.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-4" data-testid="scenario-manager-empty">
              {search.trim() ? 'No scenarios match your search' : 'No scenarios yet'}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenario row
// ---------------------------------------------------------------------------

interface ScenarioRowProps {
  scenario: {
    id: string;
    name: string;
    description: string;
    simType: SimType;
    parameters: SimulationParameters;
  };
  isActive: boolean;
  isPreset: boolean;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

function ScenarioRow({ scenario, isActive, isPreset, onLoad, onDelete }: ScenarioRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 px-2 py-1.5 rounded border transition-colors',
        isActive ? 'border-[var(--color-editor-accent)]/50 bg-[var(--color-editor-accent)]/10' : 'border-transparent hover:bg-muted/40',
      )}
      data-testid={`scenario-row-${scenario.id}`}
    >
      <div className="flex items-center gap-1.5">
        {/* Sim type badge */}
        <Badge
          variant="outline"
          className={cn('h-4 px-1 text-[9px] font-medium shrink-0', SIM_TYPE_COLORS[scenario.simType])}
          data-testid={`scenario-type-${scenario.id}`}
        >
          {SIM_TYPE_LABELS[scenario.simType]}
        </Badge>

        {/* Name */}
        <span className="flex-1 text-xs text-foreground truncate" title={scenario.name} data-testid={`scenario-name-${scenario.id}`}>
          {scenario.name}
        </span>

        {/* Active indicator */}
        {isActive && (
          <Badge variant="default" className="h-4 px-1 text-[9px] bg-[var(--color-editor-accent)] text-black" data-testid={`scenario-active-${scenario.id}`}>
            Active
          </Badge>
        )}
      </div>

      {/* Description + params summary */}
      {scenario.description && (
        <p className="text-[10px] text-muted-foreground truncate" title={scenario.description}>
          {scenario.description}
        </p>
      )}
      <p className="text-[10px] text-muted-foreground/70 tabular-nums">
        {formatParamSummary(scenario.simType, scenario.parameters)}
      </p>

      {/* Actions */}
      <div className="flex gap-1 mt-0.5">
        <Button
          variant="outline"
          size="sm"
          className="h-5 px-2 text-[9px] gap-0.5"
          onClick={() => onLoad(scenario.id)}
          disabled={isActive}
          data-testid={`scenario-load-${scenario.id}`}
        >
          <Play className="w-2.5 h-2.5" />
          {isActive ? 'Loaded' : 'Load'}
        </Button>
        {!isPreset && (
          <Button
            variant="outline"
            size="sm"
            className="h-5 px-2 text-[9px] gap-0.5 text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(scenario.id)}
            data-testid={`scenario-delete-${scenario.id}`}
          >
            <Trash2 className="w-2.5 h-2.5" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
