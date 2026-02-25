import { createContext, useContext, type ReactNode } from 'react';

const ProjectIdContext = createContext<number | undefined>(undefined);
ProjectIdContext.displayName = 'ProjectIdContext';

export function ProjectIdProvider({ projectId, children }: { projectId: number; children: ReactNode }) {
  return <ProjectIdContext.Provider value={projectId}>{children}</ProjectIdContext.Provider>;
}

export function useProjectId(): number {
  const context = useContext(ProjectIdContext);
  if (context === undefined) throw new Error('useProjectId must be used within ProjectIdProvider');
  return context;
}
