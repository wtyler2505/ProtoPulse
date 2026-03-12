import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';

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
}

const SimulationContext = createContext<SimulationState | undefined>(undefined);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [isLive, setIsLive] = useState(false);
  const [componentStates, setComponentStates] = useState<Record<string, ComponentLiveState>>({});

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
  }, []);

  const value = useMemo(() => ({
    isLive,
    setIsLive,
    componentStates,
    updateComponentState,
    clearStates
  }), [isLive, componentStates, updateComponentState, clearStates]);

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('useSimulation must be used within SimulationProvider');
  return context;
}
