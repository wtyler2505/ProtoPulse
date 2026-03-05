import { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

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
      const res = await apiRequest('POST', '/api/settings/api-keys/validate', { provider, apiKey });
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
