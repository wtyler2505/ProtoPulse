import { useState, useCallback } from 'react';
import { Key, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { useApiKeys } from '@/hooks/useApiKeys';
import type { ApiKeyProvider } from '@/hooks/useApiKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FabricatorId } from '@/lib/pcb-ordering';

interface FabApiSettingsProps {
  fabId: FabricatorId;
  fabName: string;
}

export function FabApiSettings({ fabId, fabName }: FabApiSettingsProps) {
  const { providers, updateLocalKey, clearApiKey } = useApiKeys();
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Consider all known fab IDs as providers
  const hasKey = providers.includes(fabId as string);

  const handleSave = useCallback(() => {
    if (!keyInput.trim()) return;
    setIsSaving(true);
    try {
      updateLocalKey(fabId as unknown as ApiKeyProvider, keyInput.trim());
      setKeyInput('');
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  }, [keyInput, fabId, updateLocalKey]);

  const handleDelete = useCallback(() => {
    clearApiKey(fabId as unknown as ApiKeyProvider);
  }, [fabId, clearApiKey]);

  return (
    <div className="border border-border rounded-lg p-3 bg-muted/20 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Key className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">{fabName} API Key</h4>
      </div>
      
      {hasKey ? (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded p-2 text-sm">
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="w-4 h-4" />
            <span>API Key linked</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs">
            Remove Key
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Link your {fabName} API key to submit orders directly from ProtoPulse.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Enter API key..."
                className="pr-8 bg-background text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button
              onClick={handleSave}
              disabled={!keyInput.trim() || isSaving}
              className="shrink-0"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Key
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
