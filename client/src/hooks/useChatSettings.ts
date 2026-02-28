import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { STORAGE_KEYS } from '@/lib/constants';
import { AI_MODELS, type RoutingStrategy } from '@/components/panels/chat/constants';

interface ChatSettings {
  aiProvider: 'anthropic' | 'gemini';
  aiModel: string;
  aiTemperature: number;
  customSystemPrompt: string;
  routingStrategy: RoutingStrategy;
}

const DEFAULTS: ChatSettings = {
  aiProvider: 'anthropic',
  aiModel: AI_MODELS.anthropic[0].id,
  aiTemperature: 0.7,
  customSystemPrompt: '',
  routingStrategy: 'user' as RoutingStrategy,
};

/** Read chat settings from localStorage with validation and fallback defaults. */
function readLocalStorage(): ChatSettings {
  try {
    const provider = (localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) as ChatSettings['aiProvider']) || DEFAULTS.aiProvider;
    const storedModel = localStorage.getItem(STORAGE_KEYS.AI_MODEL);
    const models = AI_MODELS[provider];
    const model = storedModel && models.some(m => m.id === storedModel) ? storedModel : models[0].id;
    const raw = localStorage.getItem(STORAGE_KEYS.AI_TEMPERATURE);
    const temperature = raw !== null ? parseFloat(raw) : DEFAULTS.aiTemperature;
    const customSystemPrompt = localStorage.getItem(STORAGE_KEYS.AI_SYSTEM_PROMPT) || '';
    const routingStrategy = (localStorage.getItem(STORAGE_KEYS.ROUTING_STRATEGY) as RoutingStrategy) || DEFAULTS.routingStrategy;
    return {
      aiProvider: provider,
      aiModel: model,
      aiTemperature: Number.isFinite(temperature) ? temperature : DEFAULTS.aiTemperature,
      customSystemPrompt,
      routingStrategy,
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
  } catch {
    // Quota exceeded — silently ignore, server is the durable store
  }
}

const DEBOUNCE_MS = 500;

/**
 * Chat settings hook with dual persistence: server-side (durable, auth-gated)
 * with localStorage fallback (for unauthenticated users or offline).
 *
 * - On mount: loads from localStorage immediately, then fetches from server.
 * - On server success: overrides local state with server values.
 * - On setting change: writes to localStorage immediately + debounced PATCH to server.
 */
export function useChatSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<ChatSettings>(readLocalStorage);

  // Accumulate changes and flush in a single PATCH after debounce
  const pendingRef = useRef<Partial<ChatSettings>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Fetch settings from server — returns null on 401 or any error (no toast)
  const settingsQuery = useQuery<ChatSettings | null>({
    queryKey: ['/api/settings/chat'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/settings/chat', { credentials: 'include' });
        if (!res.ok) return null;
        return await res.json() as ChatSettings;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

  // When server data arrives, sync local state + localStorage
  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
      writeLocalStorage(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  // Server save mutation — errors silently (localStorage is the fallback)
  const { mutate: saveToServer } = useMutation({
    mutationFn: async (patch: Partial<ChatSettings>) => {
      const res = await apiRequest('PATCH', '/api/settings/chat', patch);
      return res.json() as Promise<ChatSettings>;
    },
    onSuccess: (data: ChatSettings) => {
      queryClient.setQueryData(['/api/settings/chat'], data);
    },
    // Override global onError to suppress toast — localStorage is the fallback
    onError: () => {},
  });

  // Debounced save: accumulates changes and flushes in a single PATCH
  const scheduleSave = useCallback((patch: Partial<ChatSettings>) => {
    pendingRef.current = { ...pendingRef.current, ...patch };
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const toSave = pendingRef.current;
      pendingRef.current = {};
      saveToServer(toSave);
    }, DEBOUNCE_MS);
  }, [saveToServer]);

  // Flush pending changes on unmount
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      if (Object.keys(pendingRef.current).length > 0) {
        saveToServer(pendingRef.current);
      }
    };
  }, [saveToServer]);

  const setAiProvider = useCallback((v: 'anthropic' | 'gemini') => {
    setSettings(prev => {
      // Auto-reset model if it's not valid for the new provider
      const models = AI_MODELS[v];
      const model = models.some(m => m.id === prev.aiModel) ? prev.aiModel : models[0].id;
      const patch = { aiProvider: v, aiModel: model };
      writeLocalStorage(patch);
      scheduleSave(patch);
      return { ...prev, ...patch };
    });
  }, [scheduleSave]);

  const setAiModel = useCallback((v: string) => {
    setSettings(prev => {
      writeLocalStorage({ aiModel: v });
      scheduleSave({ aiModel: v });
      return { ...prev, aiModel: v };
    });
  }, [scheduleSave]);

  const setAiTemperature = useCallback((v: number) => {
    setSettings(prev => {
      writeLocalStorage({ aiTemperature: v });
      scheduleSave({ aiTemperature: v });
      return { ...prev, aiTemperature: v };
    });
  }, [scheduleSave]);

  const setCustomSystemPrompt = useCallback((v: string) => {
    setSettings(prev => {
      writeLocalStorage({ customSystemPrompt: v });
      scheduleSave({ customSystemPrompt: v });
      return { ...prev, customSystemPrompt: v };
    });
  }, [scheduleSave]);

  const setRoutingStrategy = useCallback((v: RoutingStrategy) => {
    setSettings(prev => {
      writeLocalStorage({ routingStrategy: v });
      scheduleSave({ routingStrategy: v });
      return { ...prev, routingStrategy: v };
    });
  }, [scheduleSave]);

  return {
    aiProvider: settings.aiProvider,
    setAiProvider,
    aiModel: settings.aiModel,
    setAiModel,
    aiTemperature: settings.aiTemperature,
    setAiTemperature,
    customSystemPrompt: settings.customSystemPrompt,
    setCustomSystemPrompt,
    routingStrategy: settings.routingStrategy,
    setRoutingStrategy,
    isLoaded: settingsQuery.isFetched,
  };
}
