import { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface OutputState {
  outputLog: string[];
  addOutputLog: (log: string) => void;
  clearOutputLog: () => void;
}

const OutputContext = createContext<OutputState | undefined>(undefined);

export function OutputProvider({ children }: { children: React.ReactNode }) {
  const [outputLog, setOutputLog] = useState<string[]>([
    "[SYSTEM] Initializing ProtoPulse Core...",
    "[PROJECT] Smart_Agro_Node_v1 loaded.",
    "[AI] Ready for queries."
  ]);

  const addOutputLog = useCallback((log: string) => {
    setOutputLog(prev => [...prev, log]);
  }, []);

  const clearOutputLog = useCallback(() => {
    setOutputLog([]);
  }, []);

  const contextValue = useMemo<OutputState>(() => ({
    outputLog,
    addOutputLog,
    clearOutputLog,
  }), [
    outputLog,
    addOutputLog,
    clearOutputLog,
  ]);

  return (
    <OutputContext.Provider value={contextValue}>
      {children}
    </OutputContext.Provider>
  );
}

export function useOutput() {
  const context = useContext(OutputContext);
  if (!context) throw new Error('useOutput must be used within OutputProvider');
  return context;
}
