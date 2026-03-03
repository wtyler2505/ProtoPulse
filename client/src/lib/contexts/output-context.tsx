import { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface OutputLogEntry {
  message: string;
  timestamp: number;
}

interface OutputState {
  outputLog: string[];
  outputLogEntries: OutputLogEntry[];
  addOutputLog: (log: string) => void;
  clearOutputLog: () => void;
}

const OutputContext = createContext<OutputState | undefined>(undefined);

const initialEntries: OutputLogEntry[] = [
  { message: "[SYSTEM] Initializing ProtoPulse Core...", timestamp: Date.now() - 2000 },
  { message: "[PROJECT] Smart_Agro_Node_v1 loaded.", timestamp: Date.now() - 1000 },
  { message: "[AI] Ready for queries.", timestamp: Date.now() },
];

export function OutputProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<OutputLogEntry[]>(initialEntries);

  const outputLog = useMemo(() => entries.map(e => e.message), [entries]);

  const addOutputLog = useCallback((log: string) => {
    setEntries(prev => [...prev, { message: log, timestamp: Date.now() }]);
  }, []);

  const clearOutputLog = useCallback(() => {
    setEntries([]);
  }, []);

  const contextValue = useMemo<OutputState>(() => ({
    outputLog,
    outputLogEntries: entries,
    addOutputLog,
    clearOutputLog,
  }), [
    outputLog,
    entries,
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
