import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ViewMode } from '@/lib/project-context';
import { useProjectId } from '@/lib/contexts/project-id-context';

/** API response shape for project metadata. */
interface ProjectApiResponse {
  name?: string;
  description?: string;
}

interface ProjectMetaState {
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
  projectName: string;
  setProjectName: (name: string) => void;
  projectDescription: string;
  setProjectDescription: (desc: string) => void;
  schematicSheets: { id: string; name: string; content: Record<string, unknown> }[];
  activeSheetId: string;
  setActiveSheetId: (id: string) => void;
  isLoading: boolean;
}

const ProjectMetaContext = createContext<ProjectMetaState | undefined>(undefined);

export function ProjectMetaProvider({ seeded, children }: { seeded: boolean; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const projectId = useProjectId();

  const [activeView, setActiveView] = useState<ViewMode>('architecture');
  const [projectName, setProjectNameState] = useState('Smart_Agro_Node_v1');
  const [projectDescription, setProjectDescriptionState] = useState('IoT Agriculture Sensor Node');

  const [schematicSheets] = useState([
    { id: 'top', name: 'Top Level.sch', content: {} },
    { id: 'power', name: 'Power.sch', content: {} },
    { id: 'mcu', name: 'MCU_Core.sch', content: {} },
  ]);
  const [activeSheetId, setActiveSheetId] = useState('top');

  const projectQuery = useQuery({
    queryKey: [`/api/projects/${projectId}`],
    enabled: seeded,
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: { name?: string; description?: string }) => {
      await apiRequest('PATCH', `/api/projects/${projectId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
    },
  });

  const setProjectName = useCallback((name: string) => {
    setProjectNameState(name);
    updateProjectMutation.mutate({ name });
  }, [updateProjectMutation]);

  const setProjectDescription = useCallback((desc: string) => {
    setProjectDescriptionState(desc);
    updateProjectMutation.mutate({ description: desc });
  }, [updateProjectMutation]);

  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data as ProjectApiResponse;
      if (p.name && p.name !== projectName) setProjectNameState(p.name);
      if (p.description !== undefined && p.description !== projectDescription) setProjectDescriptionState(p.description ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectQuery.data]);

  const isLoading = !seeded || projectQuery.isLoading;

  const contextValue = useMemo<ProjectMetaState>(() => ({
    activeView,
    setActiveView,
    projectName,
    setProjectName,
    projectDescription,
    setProjectDescription,
    schematicSheets,
    activeSheetId,
    setActiveSheetId,
    isLoading,
  }), [
    activeView,
    setActiveView,
    projectName,
    setProjectName,
    projectDescription,
    setProjectDescription,
    schematicSheets,
    activeSheetId,
    setActiveSheetId,
    isLoading,
  ]);

  return (
    <ProjectMetaContext.Provider value={contextValue}>
      {children}
    </ProjectMetaContext.Provider>
  );
}

export function useProjectMeta() {
  const context = useContext(ProjectMetaContext);
  if (!context) throw new Error('useProjectMeta must be used within ProjectMetaProvider');
  return context;
}
