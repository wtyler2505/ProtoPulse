import { memo, useCallback, useState, useEffect } from 'react';
import { Settings2, Eye, EyeOff, ChevronDown, Trash2, Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { AI_MODELS, type RoutingStrategy } from './constants';
import type { KeyStatus } from '@/hooks/useApiKeyStatus';

interface AIModel {
  id: string;
  label: string;
}

interface SettingsPanelProps {
  aiProvider: 'gemini';
  setAiProvider: (provider: 'gemini') => void;
  aiModel: string;
  setAiModel: (model: string) => void;
  aiApiKey: string;
  setAiApiKey: (key: string) => void;
  googleWorkspaceToken: string;
  setGoogleWorkspaceToken: (token: string) => void;
  showApiKey: boolean;
  setShowApiKey: (show: boolean) => void;
  aiTemperature: number;
  setAiTemperature: (temp: number) => void;
  customSystemPrompt: string;
  setCustomSystemPrompt: (prompt: string) => void;
  routingStrategy: RoutingStrategy;
  setRoutingStrategy: (strategy: RoutingStrategy) => void;
  previewAiChanges: boolean;
  setPreviewAiChanges: (v: boolean) => void;
  apiKeyValid: () => boolean;
  onClearApiKey: () => void;
  onClose: () => void;
  keyStatus?: KeyStatus;
  keyErrorMessage?: string | null;
  onValidateKey?: () => void;
  isValidating?: boolean;
  settingsLoadError?: string | null;
  onRetrySettingsLoad?: () => void;
}

function SettingsPanel({
  aiProvider, setAiProvider, aiModel, setAiModel, aiApiKey, setAiApiKey,
  googleWorkspaceToken, setGoogleWorkspaceToken,
  showApiKey, setShowApiKey, aiTemperature, setAiTemperature,
  customSystemPrompt, setCustomSystemPrompt, routingStrategy, setRoutingStrategy,
  previewAiChanges, setPreviewAiChanges,
  apiKeyValid, onClearApiKey, onClose, keyStatus, keyErrorMessage, onValidateKey, isValidating,
  settingsLoadError, onRetrySettingsLoad,
}: SettingsPanelProps) {
  const [localKey, setLocalKey] = useState(aiApiKey || '');
  const [localWorkspaceToken, setLocalWorkspaceToken] = useState(googleWorkspaceToken || '');

  const handleSaveAndClose = useCallback(() => {
    setAiApiKey(localKey);
    setGoogleWorkspaceToken(localWorkspaceToken);
    onClose();
    toast({ title: 'Settings saved', description: 'Your AI settings have been updated.' });
  }, [onClose, setAiApiKey, localKey, setGoogleWorkspaceToken, localWorkspaceToken]);

  return (
    <section aria-labelledby="settings-heading" className="flex-1 overflow-y-auto bg-background/95 backdrop-blur-xl p-4 space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Settings2 className="w-4 h-4 text-primary" />
        <h2 id="settings-heading" className="font-display font-bold tracking-wider text-sm">AI Settings</h2>
      </div>

      {settingsLoadError && (
        <div
          className="flex items-start gap-2 p-3 border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs"
          role="alert"
          data-testid="settings-load-error"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Could not load saved settings. Using defaults.</p>
            <p className="text-amber-400/70 mt-0.5">Error: {settingsLoadError}</p>
            {onRetrySettingsLoad && (
              <button
                type="button"
                onClick={onRetrySettingsLoad}
                data-testid="retry-settings-load"
                className="flex items-center gap-1 mt-1.5 text-[11px] text-primary/80 hover:text-primary font-medium transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      

      <div>
        <label htmlFor="settings-model" className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">Model</label>
        <div className="relative">
          <select
            id="settings-model"
            data-testid="model-select"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="w-full bg-muted/30 border border-border text-foreground text-sm p-2.5 pr-8 appearance-none focus:outline-none focus:border-primary"
          >
            {AI_MODELS.gemini.map((m: AIModel) => (
              <option key={m.id} value={m.id} className="bg-background text-foreground">{m.label}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      <div>
        <label htmlFor="settings-routing-strategy" className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">Model Routing</label>
        <div className="relative">
          <select
            id="settings-routing-strategy"
            data-testid="routing-strategy-select"
            value={routingStrategy}
            onChange={(e) => setRoutingStrategy(e.target.value as RoutingStrategy)}
            className="w-full bg-muted/30 border border-border text-foreground text-sm p-2.5 pr-8 appearance-none focus:outline-none focus:border-primary"
          >
            <option value="user" className="bg-background text-foreground">Manual</option>
            <option value="auto" className="bg-background text-foreground">Auto</option>
            <option value="quality" className="bg-background text-foreground">Quality</option>
            <option value="speed" className="bg-background text-foreground">Speed</option>
            <option value="cost" className="bg-background text-foreground">Cost</option>
          </select>
          <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5">
          {routingStrategy === 'user' && 'Uses the exact model selected above.'}
          {routingStrategy === 'auto' && 'Picks fast/standard/premium based on message complexity.'}
          {routingStrategy === 'quality' && 'Always routes to the most capable model.'}
          {routingStrategy === 'speed' && 'Always routes to the fastest model.'}
          {routingStrategy === 'cost' && 'Always routes to the most affordable model.'}
        </p>
      </div>

      <div>
        <label htmlFor="settings-api-key" className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">API Key</label>
        <div className="relative">
          <input
            id="settings-api-key"
            data-testid="api-key-input"
            type={showApiKey ? 'text' : 'password'}
            value={localKey}
            onChange={(e) => setLocalKey(e.target.value)}
            placeholder={"Enter your API key..."}
            className={cn(
              "w-full bg-muted/30 border text-foreground text-sm p-2.5 pr-10 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40",
              localKey && localKey.length < 20 ? "border-destructive/70 ring-1 ring-destructive/30" : "border-border"
            )}
            aria-invalid={localKey && localKey.length < 20 ? "true" : "false"}
            aria-describedby={localKey && localKey.length < 20 ? "api-key-error" : undefined}
          />
          <button
            data-testid="toggle-api-key-visibility"
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            aria-label={showApiKey ? "Hide API Key" : "Show API Key"}
          >
            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {localKey && localKey.length < 20 && (
          <p id="api-key-error" className="text-xs text-destructive mt-1.5 flex items-center gap-1 font-medium" data-testid="api-key-error">
            <span className="w-1 h-1 bg-destructive rounded-full shrink-0" />
            {"API key appears too short"}
          </p>
        )}
        {localKey && (
          <button
            data-testid="clear-api-key"
            type="button"
            onClick={onClearApiKey}
            className="flex items-center gap-1.5 text-[11px] text-destructive/70 hover:text-destructive mt-1.5 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear saved key
          </button>
        )}
        {aiApiKey && apiKeyValid() && onValidateKey && (
          <button
            data-testid="test-connection-btn"
            type="button"
            onClick={onValidateKey}
            disabled={isValidating}
            className={cn(
              'flex items-center gap-1.5 text-[11px] mt-2 transition-colors font-medium',
              keyStatus === 'valid'
                ? 'text-emerald-400'
                : keyStatus === 'invalid' || keyStatus === 'error'
                  ? 'text-destructive'
                  : 'text-primary/70 hover:text-primary',
              isValidating && 'opacity-60 cursor-not-allowed',
            )}
          >
            {isValidating && <Loader2 className="w-3 h-3 animate-spin" />}
            {keyStatus === 'valid' && <CheckCircle2 className="w-3 h-3" />}
            {(keyStatus === 'invalid' || keyStatus === 'error') && <XCircle className="w-3 h-3" />}
            {isValidating ? 'Testing...' : keyStatus === 'valid' ? 'API key verified' : 'Test Connection'}
          </button>
        )}
        {(keyStatus === 'invalid' || keyStatus === 'error') && keyErrorMessage && (
          <p className="text-[10px] text-destructive mt-1" data-testid="settings-key-error">
            {keyErrorMessage}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-1.5">
          Need a key?{' '}
          <a href="https://aistudio.google.dev/apikeys" target="_blank" rel="noopener noreferrer" className="text-primary/70 underline hover:text-white">aistudio.google.dev/apikeys</a>
        </p>
        <p className="text-[11px] text-amber-500 font-medium mt-1">
          Key is stored in browser localStorage (unencrypted).
        </p>
      </div>

      <div>
        <label htmlFor="settings-workspace-token" className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block flex items-center gap-1">
          Google Workspace Token
        </label>
        <div className="relative">
          <input
            id="settings-workspace-token"
            type="password"
            value={localWorkspaceToken}
            onChange={(e) => setLocalWorkspaceToken(e.target.value)}
            placeholder="Enter an OAuth token for Docs/Sheets export..."
            className="w-full bg-muted/30 border text-foreground text-sm p-2.5 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40 border-border"
          />
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5">
          Required for Google Sheets BOM sync and Google Docs reports.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="settings-temperature" className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Temperature</label>
          <span className="text-xs text-primary font-mono" aria-hidden="true">{(Math.round(aiTemperature * 10) / 10).toFixed(1)}</span>
        </div>
        <input
          id="settings-temperature"
          data-testid="temperature-slider"
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={aiTemperature}
          onChange={(e) => setAiTemperature(Math.round(parseFloat(e.target.value) * 10) / 10)}
          aria-valuetext={(Math.round(aiTemperature * 10) / 10).toFixed(1)}
          className="w-full h-1.5 bg-muted/50 appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-0 focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-1" aria-hidden="true">
          <span>Precise</span>
          <span>Balanced</span>
          <span>Creative</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-4 mb-1.5">
          <label htmlFor="preview-changes-toggle" className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold cursor-pointer">Preview AI Changes</label>
          <Switch
            id="preview-changes-toggle"
            data-testid="preview-changes-toggle"
            checked={previewAiChanges}
            onCheckedChange={setPreviewAiChanges}
          />
        </div>
        <p className="text-[10px] text-muted-foreground/60" id="preview-changes-desc">
          Ask for confirmation before the AI modifies your design. Highly recommended for complex changes.
        </p>
      </div>

      <div>
        <label htmlFor="settings-custom-prompt" className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">Custom Instructions (optional)</label>
        <textarea
          id="settings-custom-prompt"
          data-testid="custom-system-prompt"
          value={customSystemPrompt}
          onChange={(e) => setCustomSystemPrompt(e.target.value)}
          placeholder="Add custom instructions for the AI..."
          rows={3}
          className="w-full bg-muted/30 border border-border text-foreground text-xs p-2.5 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40 resize-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <p className="text-[10px] text-muted-foreground/60 mt-1">These instructions are appended to the AI's system prompt.</p>
      </div>

      <button
        data-testid="save-settings"
        onClick={handleSaveAndClose}
        className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-sm tracking-wider hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary focus-visible:outline-none"
      >
        Save & Close
      </button>
    </section>
  );
}

export default memo(SettingsPanel);
