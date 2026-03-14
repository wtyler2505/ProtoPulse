import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type {
  ArduinoWorkspace,
  ArduinoBuildProfile,
  ArduinoJob,
  ArduinoSketchFile,
  InsertArduinoBuildProfile,
} from '@shared/schema';

// ---------------------------------------------------------------------------
// Shared arg types
// ---------------------------------------------------------------------------
interface CompileArgs { fqbn: string; sketchPath: string; }
interface UploadArgs { fqbn: string; port: string; sketchPath: string; }

interface ArduinoHealth { status: string; version: string; supported: boolean; }

interface ArduinoContextType {
  // Server data
  health: ArduinoHealth | undefined;
  workspace: ArduinoWorkspace | undefined;
  profiles: ArduinoBuildProfile[];
  jobs: ArduinoJob[];
  files: ArduinoSketchFile[];
  installedLibraries: unknown[];
  installedCores: unknown[];

  // Loading states
  isHealthLoading: boolean;
  isWorkspaceLoading: boolean;
  isFilesLoading: boolean;
  isLibrariesLoading: boolean;
  isCoresLoading: boolean;

  // Stable mutation functions (not whole mutation objects — avoids re-render loops)
  createProfile: (data: Partial<InsertArduinoBuildProfile>) => Promise<ArduinoBuildProfile>;
  updateProfile: (id: number, data: Partial<InsertArduinoBuildProfile>) => Promise<ArduinoBuildProfile>;
  deleteProfile: (id: number) => Promise<void>;
  compileJob: (args: CompileArgs) => Promise<ArduinoJob>;
  uploadJob: (args: UploadArgs) => Promise<ArduinoJob>;
  cancelJob: (jobId: number) => Promise<void>;
  downloadArtifact: (jobId: number) => Promise<void>;
  generateSketch: (intent: string) => Promise<string>;
  searchLibraries: (query: string) => Promise<unknown>;
  installLibrary: (name: string) => Promise<{ success: boolean; output: string }>;
  uninstallLibrary: (name: string) => Promise<{ success: boolean; output: string }>;
  listBoards: () => Promise<unknown[]>;
  searchCores: (query: string) => Promise<unknown>;
  installCore: (platform: string) => Promise<{ success: boolean; output: string }>;
  uninstallCore: (platform: string) => Promise<{ success: boolean; output: string }>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  createFile: (path: string, content?: string) => Promise<void>;
  deleteFile: (fileId: number) => Promise<boolean>;
  refreshLibraries: () => void;
  refreshCores: () => void;
}

const ArduinoContext = createContext<ArduinoContextType | null>(null);

export function ArduinoProvider({ children, projectId }: { children: ReactNode; projectId: number }) {
  const queryClient = useQueryClient();
  const prefix = `/api/projects/${projectId}/arduino`;

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------
  const healthQuery = useQuery({
    queryKey: ['arduino-health', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `${prefix}/health`);
      return res.json() as Promise<ArduinoHealth>;
    },
    enabled: projectId > 0,
  });

  const workspaceQuery = useQuery({
    queryKey: ['arduino-workspace', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `${prefix}/workspace`);
      return res.json() as Promise<ArduinoWorkspace>;
    },
    enabled: projectId > 0,
  });

  const profilesQuery = useQuery({
    queryKey: ['arduino-profiles', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `${prefix}/profiles`);
      const json = await res.json();
      return json.data as ArduinoBuildProfile[];
    },
    enabled: projectId > 0,
  });

  const jobsQuery = useQuery({
    queryKey: ['arduino-jobs', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `${prefix}/jobs`);
      const json = await res.json();
      return json.data as ArduinoJob[];
    },
    enabled: projectId > 0,
    // Only poll when there's an active (pending/running) job — avoids 429 rate limit storms
    refetchInterval: (query) => {
      const data = query.state.data as ArduinoJob[] | undefined;
      const hasActiveJob = data?.some((j) => j.status === 'pending' || j.status === 'running');
      return hasActiveJob ? 2000 : false;
    },
  });

  const filesQuery = useQuery({
    queryKey: ['arduino-files', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `${prefix}/files`);
      const json = await res.json();
      return json.data as ArduinoSketchFile[];
    },
    enabled: projectId > 0,
  });

  const installedLibrariesQuery = useQuery({
    queryKey: ['arduino-libraries-installed', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `${prefix}/libraries/installed`);
      const json = await res.json();
      return (json.data ?? []) as unknown[];
    },
    enabled: projectId > 0,
  });

  const installedCoresQuery = useQuery({
    queryKey: ['arduino-cores-installed', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `${prefix}/cores/list`);
      const json = await res.json();
      return (json.data ?? []) as unknown[];
    },
    enabled: projectId > 0,
  });

  // ---------------------------------------------------------------------------
  // Mutations (raw)
  // ---------------------------------------------------------------------------
  const { mutateAsync: createProfileAsync } = useMutation({
    mutationFn: async (data: Partial<InsertArduinoBuildProfile>) => {
      const res = await apiRequest('POST', `${prefix}/profiles`, data);
      return res.json() as Promise<ArduinoBuildProfile>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arduino-profiles', projectId] }),
  });

  const { mutateAsync: updateProfileAsync } = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertArduinoBuildProfile> }) => {
      const res = await apiRequest('PATCH', `${prefix}/profiles/${id}`, data);
      return res.json() as Promise<ArduinoBuildProfile>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arduino-profiles', projectId] }),
  });

  const { mutateAsync: deleteProfileAsync } = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `${prefix}/profiles/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arduino-profiles', projectId] }),
  });

  const { mutateAsync: compileJobAsync } = useMutation({
    mutationFn: async (args: CompileArgs) => {
      const res = await apiRequest('POST', `${prefix}/jobs/compile`, args);
      return res.json() as Promise<ArduinoJob>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arduino-jobs', projectId] }),
  });

  const { mutateAsync: uploadJobAsync } = useMutation({
    mutationFn: async (args: UploadArgs) => {
      const res = await apiRequest('POST', `${prefix}/jobs/upload`, args);
      return res.json() as Promise<ArduinoJob>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arduino-jobs', projectId] }),
  });

  const { mutateAsync: cancelJobAsync } = useMutation({
    mutationFn: async (jobId: number) => {
      await apiRequest('POST', `${prefix}/jobs/${jobId}/cancel`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arduino-jobs', projectId] }),
  });

  const { mutateAsync: downloadArtifactAsync } = useMutation({
    mutationFn: async (jobId: number) => {
      const res = await fetch(`${prefix}/jobs/${jobId}/artifact`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Download failed' }));
        throw new Error((err as Record<string, string>).message || 'Download failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="(.+?)"/);
      const filename = filenameMatch?.[1] || `firmware-${jobId}.hex`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });

  const { mutateAsync: generateSketchAsync } = useMutation({
    mutationFn: async (intent: string) => {
      const res = await apiRequest('POST', `${prefix}/generate-sketch`, { intent });
      const json = await res.json();
      return json.sketch as string;
    },
  });

  const { mutateAsync: searchLibrariesAsync } = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest('GET', `${prefix}/libraries/search?q=${encodeURIComponent(query)}`);
      return res.json() as Promise<unknown>;
    },
  });

  const { mutateAsync: installLibraryAsync } = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest('POST', `${prefix}/libraries/install`, { name });
      return res.json() as Promise<{ success: boolean; output: string }>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arduino-libraries-installed', projectId] }),
  });

  const { mutateAsync: uninstallLibraryAsync } = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest('POST', `${prefix}/libraries/uninstall`, { name });
      return res.json() as Promise<{ success: boolean; output: string }>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arduino-libraries-installed', projectId] }),
  });

  const { mutateAsync: listBoardsAsync } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('GET', `${prefix}/boards/discover`);
      const json = await res.json();
      return (json.data ?? []) as unknown[];
    },
  });

  const { mutateAsync: searchCoresAsync } = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest('GET', `${prefix}/cores/search?q=${encodeURIComponent(query)}`);
      return res.json() as Promise<unknown>;
    },
  });

  const { mutateAsync: installCoreAsync } = useMutation({
    mutationFn: async (platform: string) => {
      const res = await apiRequest('POST', `${prefix}/cores/install`, { platform });
      return res.json() as Promise<{ success: boolean; output: string }>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arduino-cores-installed', projectId] }),
  });

  const { mutateAsync: uninstallCoreAsync } = useMutation({
    mutationFn: async (platform: string) => {
      const res = await apiRequest('POST', `${prefix}/cores/uninstall`, { platform });
      return res.json() as Promise<{ success: boolean; output: string }>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arduino-cores-installed', projectId] }),
  });

  const { mutateAsync: readFileAsync } = useMutation({
    mutationFn: async (path: string) => {
      const res = await apiRequest('GET', `${prefix}/files/read?path=${encodeURIComponent(path)}`);
      const json = await res.json();
      return json.content as string;
    },
  });

  const { mutateAsync: writeFileAsync } = useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }) => {
      await apiRequest('POST', `${prefix}/files/write`, { path, content });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arduino-files', projectId] }),
  });

  const { mutateAsync: createFileAsync } = useMutation({
    mutationFn: async ({ path, content }: { path: string; content?: string }) => {
      await apiRequest('POST', `${prefix}/files/create`, { path, content });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arduino-files', projectId] }),
  });

  const { mutateAsync: deleteFileAsync } = useMutation({
    mutationFn: async (fileId: number) => {
      const res = await apiRequest('DELETE', `${prefix}/files/${fileId}`);
      return res.status === 204;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['arduino-files', projectId] }),
  });

  // ---------------------------------------------------------------------------
  // Stable callback wrappers — these never change identity between renders,
  // which is critical to prevent useEffect infinite loops in consumers.
  // ---------------------------------------------------------------------------
  const createProfile = useCallback(
    (data: Partial<InsertArduinoBuildProfile>) => createProfileAsync(data),
    [createProfileAsync],
  );
  const updateProfile = useCallback(
    (id: number, data: Partial<InsertArduinoBuildProfile>) => updateProfileAsync({ id, data }),
    [updateProfileAsync],
  );
  const deleteProfile = useCallback((id: number) => deleteProfileAsync(id), [deleteProfileAsync]);
  const compileJob = useCallback((args: CompileArgs) => compileJobAsync(args), [compileJobAsync]);
  const uploadJob = useCallback((args: UploadArgs) => uploadJobAsync(args), [uploadJobAsync]);
  const cancelJob = useCallback((jobId: number) => cancelJobAsync(jobId), [cancelJobAsync]);
  const downloadArtifact = useCallback((jobId: number) => downloadArtifactAsync(jobId), [downloadArtifactAsync]);
  const generateSketch = useCallback((intent: string) => generateSketchAsync(intent), [generateSketchAsync]);
  const searchLibraries = useCallback((query: string) => searchLibrariesAsync(query), [searchLibrariesAsync]);
  const installLibrary = useCallback((name: string) => installLibraryAsync(name), [installLibraryAsync]);
  const uninstallLibrary = useCallback((name: string) => uninstallLibraryAsync(name), [uninstallLibraryAsync]);
  const listBoards = useCallback(() => listBoardsAsync(), [listBoardsAsync]);
  const searchCores = useCallback((query: string) => searchCoresAsync(query), [searchCoresAsync]);
  const installCore = useCallback((platform: string) => installCoreAsync(platform), [installCoreAsync]);
  const uninstallCore = useCallback((platform: string) => uninstallCoreAsync(platform), [uninstallCoreAsync]);
  const refreshLibraries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['arduino-libraries-installed', projectId] });
  }, [queryClient, projectId]);
  const refreshCores = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['arduino-cores-installed', projectId] });
  }, [queryClient, projectId]);
  const readFile = useCallback((path: string) => readFileAsync(path), [readFileAsync]);
  const writeFile = useCallback(
    (path: string, content: string) => writeFileAsync({ path, content }),
    [writeFileAsync],
  );
  const createFile = useCallback(
    (path: string, content?: string) => createFileAsync({ path, content }),
    [createFileAsync],
  );
  const deleteFile = useCallback((fileId: number) => deleteFileAsync(fileId), [deleteFileAsync]);

  // ---------------------------------------------------------------------------
  // Context value — only data/loading states in useMemo deps (stable callbacks
  // don't need to be listed as they never change).
  // ---------------------------------------------------------------------------
  const value = useMemo<ArduinoContextType>(
    () => ({
      health: healthQuery.data,
      workspace: workspaceQuery.data,
      profiles: profilesQuery.data ?? [],
      jobs: jobsQuery.data ?? [],
      files: filesQuery.data ?? [],
      installedLibraries: installedLibrariesQuery.data ?? [],
      installedCores: installedCoresQuery.data ?? [],
      isHealthLoading: healthQuery.isLoading,
      isWorkspaceLoading: workspaceQuery.isLoading,
      isFilesLoading: filesQuery.isLoading,
      isLibrariesLoading: installedLibrariesQuery.isLoading,
      isCoresLoading: installedCoresQuery.isLoading,
      createProfile,
      updateProfile,
      deleteProfile,
      compileJob,
      uploadJob,
      cancelJob,
      downloadArtifact,
      generateSketch,
      searchLibraries,
      installLibrary,
      uninstallLibrary,
      listBoards,
      searchCores,
      installCore,
      uninstallCore,
      readFile,
      writeFile,
      createFile,
      deleteFile,
      refreshLibraries,
      refreshCores,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      healthQuery.data, workspaceQuery.data, profilesQuery.data, jobsQuery.data, filesQuery.data,
      installedLibrariesQuery.data, installedCoresQuery.data,
      healthQuery.isLoading, workspaceQuery.isLoading, filesQuery.isLoading,
      installedLibrariesQuery.isLoading, installedCoresQuery.isLoading,
    ],
  );

  return <ArduinoContext.Provider value={value}>{children}</ArduinoContext.Provider>;
}

export function useArduino() {
  const context = useContext(ArduinoContext);
  if (!context) throw new Error('useArduino must be used within ArduinoProvider');
  return context;
}

// ---------------------------------------------------------------------------
// SSE Job Stream Hook
// ---------------------------------------------------------------------------

interface JobStreamEvent {
  type: 'log' | 'status' | 'error' | 'done';
  content: string;
  timestamp: number;
}

interface UseJobStreamResult {
  lines: string[];
  status: string;
  isStreaming: boolean;
}

const MAX_RECONNECT_RETRIES = 3;
const RECONNECT_DELAY_MS = 2000;

/**
 * Hook that connects to the SSE endpoint for a specific Arduino job.
 * Returns real-time log lines, job status, and whether the stream is active.
 * Auto-reconnects on connection loss (up to MAX_RECONNECT_RETRIES).
 * Pass jobId = null to disable the stream.
 */
export function useJobStream(projectId: number, jobId: number | null): UseJobStreamResult {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('pending');
  const [isStreaming, setIsStreaming] = useState(false);
  const retriesRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (jobId === null || projectId <= 0) {
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (cancelled) { return; }

      const url = `/api/projects/${projectId}/arduino/jobs/${jobId}/stream`;
      const es = new EventSource(url);
      eventSourceRef.current = es;
      setIsStreaming(true);

      es.onmessage = (event: MessageEvent) => {
        if (cancelled) { return; }
        try {
          const data = JSON.parse(event.data as string) as JobStreamEvent;
          switch (data.type) {
            case 'log':
              setLines((prev) => [...prev, data.content]);
              break;
            case 'error':
              setLines((prev) => [...prev, `ERROR: ${data.content}`]);
              break;
            case 'status':
              setStatus(data.content);
              break;
            case 'done':
              setIsStreaming(false);
              es.close();
              eventSourceRef.current = null;
              break;
          }
          // Reset retry count on successful message
          retriesRef.current = 0;
        } catch {
          // Ignore parse errors (e.g. heartbeat comments)
        }
      };

      es.onerror = () => {
        if (cancelled) { return; }
        es.close();
        eventSourceRef.current = null;

        if (retriesRef.current < MAX_RECONNECT_RETRIES) {
          retriesRef.current += 1;
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        } else {
          setIsStreaming(false);
        }
      };
    };

    // Reset state on new job
    setLines([]);
    setStatus('pending');
    retriesRef.current = 0;
    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== undefined) {
        clearTimeout(reconnectTimer);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsStreaming(false);
    };
  }, [projectId, jobId]);

  return { lines, status, isStreaming };
}
