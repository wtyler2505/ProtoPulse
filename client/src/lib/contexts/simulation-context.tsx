import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { DCResult } from '@/lib/simulation/circuit-solver';
import type { ComponentVisualState, WireVisualState } from '@/lib/simulation/visual-state';
import type { AnalysisType } from '@/lib/simulation/auto-detect';

export type LogicState = 'LOW' | 'HIGH' | 'FLOATING' | 'PWM';

export interface ComponentLiveState {
  id: string; // referenceDesignator
  pins: Record<string, { voltage: number; state: LogicState }>;
  value?: number | string;
  isActive?: boolean;
  brightness?: number; // 0-1 for LEDs
}

interface SimulationState {
  isLive: boolean;
  setIsLive: (live: boolean) => void;
  componentStates: Record<string, ComponentLiveState>;
  updateComponentState: (id: string, state: Partial<ComponentLiveState>) => void;
  clearStates: () => void;
  /** DC operating point results from the last simulation run */
  dcResult: DCResult | null;
  setDCResult: (result: DCResult | null) => void;
  /** Computed visual states for components (keyed by referenceDesignator) */
  componentVisualStates: Map<string, ComponentVisualState>;
  setComponentVisualStates: (states: Map<string, ComponentVisualState>) => void;
  /** Computed visual states for wires/nets (keyed by wire/net ID) */
  wireVisualStates: Map<string, WireVisualState>;
  setWireVisualStates: (states: Map<string, WireVisualState>) => void;
  /** Whether a simulation is currently running (for unified play/stop button) */
  isSimRunning: boolean;
  setIsSimRunning: (running: boolean) => void;
  /** The analysis type currently being executed (null if idle) */
  activeAnalysisType: AnalysisType | null;
  setActiveAnalysisType: (type: AnalysisType | null) => void;
}

const SimulationContext = createContext<SimulationState | undefined>(undefined);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [isLive, setIsLive] = useState(false);
  const [componentStates, setComponentStates] = useState<Record<string, ComponentLiveState>>({});
  const [dcResult, setDCResult] = useState<DCResult | null>(null);
  const [componentVisualStates, setComponentVisualStates] = useState<Map<string, ComponentVisualState>>(new Map());
  const [wireVisualStates, setWireVisualStates] = useState<Map<string, WireVisualState>>(new Map());
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [activeAnalysisType, setActiveAnalysisType] = useState<AnalysisType | null>(null);

  const updateComponentState = useCallback((id: string, state: Partial<ComponentLiveState>) => {
    setComponentStates(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { id, pins: {} }),
        ...state
      }
    }));
  }, []);

  const clearStates = useCallback(() => {
    setComponentStates({});
    setDCResult(null);
    setComponentVisualStates(new Map());
    setWireVisualStates(new Map());
  }, []);

  const value = useMemo(() => ({
    isLive,
    setIsLive,
    componentStates,
    updateComponentState,
    clearStates,
    dcResult,
    setDCResult,
    componentVisualStates,
    setComponentVisualStates,
    wireVisualStates,
    setWireVisualStates,
    isSimRunning,
    setIsSimRunning,
    activeAnalysisType,
    setActiveAnalysisType,
  }), [isLive, componentStates, updateComponentState, clearStates, dcResult, componentVisualStates, wireVisualStates, isSimRunning, activeAnalysisType]);

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) { throw new Error('useSimulation must be used within SimulationProvider'); }
  return context;
}
