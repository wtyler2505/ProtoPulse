import { memo } from 'react';
import { Settings2, Eye, EyeOff, ChevronDown, Trash2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AI_MODELS, type RoutingStrategy } from './constants';
import type { KeyStatus } from '@/hooks/useApiKeyStatus';

interface AIModel {
  id: string;
  label: string;
}

interface SettingsPanelProps {
  aiProvider: 'anthropic' | 'gemini';
  setAiProvider: (provider: 'anthropic' | 'gemini') => void;
  aiModel: string;
  setAiModel: (model: string) => void;
  aiApiKey: string;
  setAiApiKey: (key: string) => void;
  showApiKey: boolean;
  setShowApiKey: (show: boolean) => void;
  aiTemperature: number;
  setAiTemperature: (temp: number) => void;
  customSystemPrompt: string;
  setCustomSystemPrompt: (prompt: string) => void;
  routingStrategy: RoutingStrategy;
  setRoutingStrategy: (strategy: RoutingStrategy) => void;
  apiKeyValid: () => boolean;
  onClearApiKey: () => void;
  onClose: () => void;
  keyStatus?: KeyStatus;
  keyErrorMessage?: string | null;
  onValidateKey?: () => void;
  isValidating?: boolean;
}

function SettingsPanel({
  aiProvider, setAiProvider, aiModel, setAiModel, aiApiKey, setAiApiKey,
  showApiKey, setShowApiKey, aiTemperature, setAiTemperature,
  customSystemPrompt, setCustomSystemPrompt, routingStrategy, setRoutingStrategy,
  apiKeyValid, onClearApiKey, onClose, keyStatus, keyErrorMessage, onValidateKey, isValidating,
}: SettingsPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-background/95 backdrop-blur-xl p-4 space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Settings2 className="w-4 h-4 text-primary" />
        <h4 className="font-display font-bold tracking-wider text-sm">AI Settings</h4>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">Provider</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            data-testid="provider-anthropic"
            onClick={() => { setAiProvider('anthropic'); setAiModel(AI_MODELS.anthropic[0].id); }}
            aria-pressed={aiProvider === 'anthropic'}
            className={cn(
              "p-3 border text-center text-sm font-bold transition-all",
              aiProvider === 'anthropic' ? "border-primary bg-primary/10 text-primary shadow-[0_0_12px_rgba(6,182,212,0.15)]" : "border-border bg-muted/20 text-muted-foreground hover:border-muted-foreground/50"
            )}
          >
            Anthropic
          </button>
          <button
            data-testid="provider-gemini"
            onClick={() => { setAiProvider('gemini'); setAiModel(AI_MODELS.gemini[0].id); }}
            aria-pressed={aiProvider === 'gemini'}
            className={cn(
              "p-3 border text-center text-sm font-bold transition-all",
              aiProvider === 'gemini' ? "border-primary bg-primary/10 text-primary shadow-[0_0_12px_rgba(6,182,212,0.15)]" : "border-border bg-muted/20 text-muted-foreground hover:border-muted-foreground/50"
            )}
          >
            Gemini
          </button>
        </div>
      </div>

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
            {AI_MODELS[aiProvider as keyof typeof AI_MODELS].map((m: AIModel) => (
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
            value={aiApiKey}
            onChange={(e) => setAiApiKey(e.target.value)}
            placeholder={aiProvider === 'anthropic' ? "sk-ant-..." : "Enter your API key..."}
            className={cn(
              "w-full bg-muted/30 border text-foreground text-sm p-2.5 pr-10 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40",
              aiApiKey && !apiKeyValid() ? "border-destructive/70 ring-1 ring-destructive/30" : "border-border"
            )}
          />
          <button
            data-testid="toggle-api-key-visibility"
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {aiApiKey && !apiKeyValid() && (
          <p className="text-xs text-destructive mt-1.5 flex items-center gap-1" data-testid="api-key-error">
            <span className="w-1 h-1 bg-destructive rounded-full shrink-0" />
            {aiProvider === 'anthropic' ? "Anthropic keys must start with 'sk-ant-'" : "API key appears too short"}
          </p>
        )}
        {aiApiKey && (
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
          {aiProvider === 'anthropic' ? (
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary/70 underline hover:text-white">console.anthropic.com/settings/keys</a>
          ) : (
            <a href="https://aistudio.google.dev/apikeys" target="_blank" rel="noopener noreferrer" className="text-primary/70 underline hover:text-white">aistudio.google.dev/apikeys</a>
          )}
        </p>
        <p className="text-[10px] text-amber-400/60 mt-1">
          Key is stored in browser localStorage (unencrypted).
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="settings-temperature" className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Temperature</label>
          <span className="text-xs text-primary font-mono">{aiTemperature.toFixed(1)}</span>
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
          aria-valuetext={aiTemperature.toFixed(1)}
          className="w-full h-1.5 bg-muted/50 appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-0"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-1">
          <span>Precise</span>
          <span>Balanced</span>
          <span>Creative</span>
        </div>
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
          className="w-full bg-muted/30 border border-border text-foreground text-xs p-2.5 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40 resize-none"
        />
        <p className="text-[10px] text-muted-foreground/60 mt-1">These instructions are appended to the AI's system prompt.</p>
      </div>

      <button
        data-testid="save-settings"
        onClick={onClose}
        className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-sm tracking-wider hover:bg-primary/90 transition-colors"
      >
        Save & Close
      </button>
    </div>
  );
}

export default memo(SettingsPanel);
