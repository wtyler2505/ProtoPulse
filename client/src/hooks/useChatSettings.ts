import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { STORAGE_KEYS } from '@/lib/constants';
import { AI_MODELS, type RoutingStrategy } from '@/components/panels/chat/constants';

interface ChatSettings {
  aiProvider: 'gemini';
  aiModel: string;
  aiTemperature: number;
  customSystemPrompt: string;
  routingStrategy: RoutingStrategy;
  previewAiChanges: boolean;
  googleWorkspaceToken: string;
}

const DEFAULTS: ChatSettings = {
  aiProvider: 'gemini',
  aiModel: AI_MODELS.gemini[0].id,
  aiTemperature: 0.7,
  customSystemPrompt: '',
  routingStrategy: 'auto' as RoutingStrategy,
  previewAiChanges: true,
  googleWorkspaceToken: '',
};

/** Read chat settings from localStorage with validation and fallback defaults. */
function readLocalStorage(): ChatSettings {
  try {
    const provider = 'gemini';
    const storedModel = localStorage.getItem(STORAGE_KEYS.AI_MODEL);
    const models = AI_MODELS[provider];
    const model = storedModel && models.some(m => m.id === storedModel) ? storedModel : models[0].id;
    const raw = localStorage.getItem(STORAGE_KEYS.AI_TEMPERATURE);
    const temperature = raw !== null ? parseFloat(raw) : DEFAULTS.aiTemperature;
    const customSystemPrompt = localStorage.getItem(STORAGE_KEYS.AI_SYSTEM_PROMPT) || '';
    const routingStrategy = (localStorage.getItem(STORAGE_KEYS.ROUTING_STRATEGY) as RoutingStrategy) || DEFAULTS.routingStrategy;
    const previewRaw = localStorage.getItem(STORAGE_KEYS.AI_PREVIEW_CHANGES);
    const previewAiChanges = previewRaw !== null ? previewRaw === 'true' : DEFAULTS.previewAiChanges;
    const googleWorkspaceToken = localStorage.getItem('protopulse-google-workspace-token') || '';
    
    return {
      aiProvider: provider,
      aiModel: model,
      aiTemperature: Number.isFinite(temperature) ? temperature : DEFAULTS.aiTemperature,
      customSystemPrompt,
      routingStrategy,
      previewAiChanges,
      googleWorkspaceToken,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Write individual settings to localStorage (immediate local persistence). */
function writeLocalStorage(patch: Partial<ChatSettings>) {
  try {
    if (patch.aiProvider !== undefined) localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, patch.aiProvider);
    if (patch.aiModel !== undefined) localStorage.setItem(STORAGE_KEYS.AI_MODEL, patch.aiModel);
    if (patch.aiTemperature !== undefined) localStorage.setItem(STORAGE_KEYS.AI_TEMPERATURE, String(patch.aiTemperature));
    if (patch.customSystemPrompt !== undefined) localStorage.setItem(STORAGE_KEYS.AI_SYSTEM_PROMPT, patch.customSystemPrompt);
    if (patch.routingStrategy !== undefined) localStorage.setItem(STORAGE_KEYS.ROUTING_STRATEGY, patch.routingStrategy);
    if (patch.previewAiChanges !== undefined) localStorage.setItem(STORAGE_KEYS.AI_PREVIEW_CHANGES, String(patch.previewAiChanges));
    if (patch.googleWorkspaceToken !== undefined) localStorage.setItem('protopulse-google-workspace-token', patch.googleWorkspaceToken);
  } catch {
    // Quota exceeded — silently ignore, server is the durable store
  }
}

const DEBOUNCE_MS = 500;

export function useChatSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<ChatSettings>(readLocalStorage);

  const pendingRef = useRef<Partial<ChatSettings>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const settingsQuery = useQuery<ChatSettings | null>({
    queryKey: ['/api/settings/chat'],
    queryFn: async () => {
      try {
        const sessionId = localStorage.getItem('protopulse-session-id') ?? '';
        const res = await fetch('/api/settings/chat', {
          credentials: 'include',
          headers: { 'X-Session-Id': sessionId },
        });
        if (!res.ok) return null;
        return await res.json() as ChatSettings;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings({ ...settingsQuery.data, aiProvider: 'gemini' });
      writeLocalStorage({ ...settingsQuery.data, aiProvider: 'gemini' });
    }
  }, [settingsQuery.data]);

  const { mutate: saveToServer } = useMutation({
    mutationFn: async (patch: Partial<ChatSettings>) => {
      const res = await apiRequest('PATCH', '/api/settings/chat', patch);
      return res.json() as Promise<ChatSettings>;
    },
    onSuccess: (data: ChatSettings) => {
      queryClient.setQueryData(['/api/settings/chat'], data);
    },
    onError: () => {},
  });

  const scheduleSave = useCallback((patch: Partial<ChatSettings>) => {
    pendingRef.current = { ...pendingRef.current, ...patch };
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const toSave = pendingRef.current;
      pendingRef.current = {};
      saveToServer(toSave);
    }, DEBOUNCE_MS);
  }, [saveToServer]);

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      if (Object.keys(pendingRef.current).length > 0) {
        saveToServer(pendingRef.current);
      }
    };
  }, [saveToServer]);

  const setAiProvider = useCallback((v: 'gemini') => {
    setSettings(prev => {
      const models = AI_MODELS[v];
      const model = models.some(m => m.id === prev.aiModel) ? prev.aiModel : models[0].id;
      const next = { ...prev, aiProvider: v, aiModel: model };
      writeLocalStorage({ aiProvider: v, aiModel: model });
      scheduleSave({ aiProvider: v, aiModel: model });
      return next;
    });
  }, [scheduleSave]);

  const setAiModel = useCallback((v: string) => {
    setSettings(prev => {
      const next = { ...prev, aiModel: v };
      writeLocalStorage({ aiModel: v });
      scheduleSave({ aiModel: v });
      return next;
    });
  }, [scheduleSave]);

  const setAiTemperature = useCallback((v: number) => {
    setSettings(prev => {
      const next = { ...prev, aiTemperature: v };
      writeLocalStorage({ aiTemperature: v });
      scheduleSave({ aiTemperature: v });
      return next;
    });
  }, [scheduleSave]);

  const setCustomSystemPrompt = useCallback((v: string) => {
    setSettings(prev => {
      const next = { ...prev, customSystemPrompt: v };
      writeLocalStorage({ customSystemPrompt: v });
      scheduleSave({ customSystemPrompt: v });
      return next;
    });
  }, [scheduleSave]);

  const setRoutingStrategy = useCallback((v: RoutingStrategy) => {
    setSettings(prev => {
      const next = { ...prev, routingStrategy: v };
      writeLocalStorage({ routingStrategy: v });
      scheduleSave({ routingStrategy: v });
      return next;
    });
  }, [scheduleSave]);

  const setPreviewAiChanges = useCallback((v: boolean) => {
    setSettings(prev => {
      const next = { ...prev, previewAiChanges: v };
      writeLocalStorage({ previewAiChanges: v });
      scheduleSave({ previewAiChanges: v });
      return next;
    });
  }, [scheduleSave]);

  const setGoogleWorkspaceToken = useCallback((v: string) => {
    setSettings(prev => {
      const next = { ...prev, googleWorkspaceToken: v };
      writeLocalStorage({ googleWorkspaceToken: v });
      scheduleSave({ googleWorkspaceToken: v });
      return next;
    });
  }, [scheduleSave]);

  return {
    ...settings,
    setAiProvider,
    setAiModel,
    setAiTemperature,
    setCustomSystemPrompt,
    setRoutingStrategy,
    setPreviewAiChanges,
    setGoogleWorkspaceToken,
    settingsQuery,
  };
}
