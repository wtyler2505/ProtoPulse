import { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { STORED_KEY_SENTINEL } from '@/hooks/useApiKeys';

export type KeyStatus = 'unchecked' | 'validating' | 'valid' | 'invalid' | 'error';

interface ApiKeyStatusResult {
  status: KeyStatus;
  errorMessage: string | null;
  validate: (provider: string, apiKey: string) => Promise<void>;
  reset: () => void;
}

export function useApiKeyStatus(): ApiKeyStatusResult {
  const [status, setStatus] = useState<KeyStatus>('unchecked');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validate = useCallback(async (provider: string, apiKey: string) => {
    setStatus('validating');
    setErrorMessage(null);
    try {
      // If the key is the server-stored sentinel, tell the server to use its stored copy
      const isSentinel = apiKey === STORED_KEY_SENTINEL;
      const body = isSentinel
        ? { provider, useStored: true }
        : { provider, apiKey };

      const res = await apiRequest('POST', '/api/settings/api-keys/validate', body);
      const data = await res.json() as { valid: boolean; error?: string };
      if (data.valid) {
        setStatus('valid');
        setErrorMessage(null);
      } else {
        setStatus('invalid');
        setErrorMessage(data.error ?? 'API key is invalid');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Failed to verify API key. Check your connection and try again.');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('unchecked');
    setErrorMessage(null);
  }, []);

  return { status, errorMessage, validate, reset };
}
