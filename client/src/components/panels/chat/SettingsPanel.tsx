import { Settings2, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AI_MODELS } from './constants';

export default function SettingsPanel({
  aiProvider, setAiProvider, aiModel, setAiModel, aiApiKey, setAiApiKey,
  showApiKey, setShowApiKey, aiTemperature, setAiTemperature,
  customSystemPrompt, setCustomSystemPrompt, apiKeyValid, onClose,
}: any) {
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
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">Model</label>
        <div className="relative">
          <select
            data-testid="model-select"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="w-full bg-muted/30 border border-border text-foreground text-sm p-2.5 pr-8 appearance-none focus:outline-none focus:border-primary"
          >
            {AI_MODELS[aiProvider as keyof typeof AI_MODELS].map((m: any) => (
              <option key={m.id} value={m.id} className="bg-background text-foreground">{m.label}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">API Key</label>
        <div className="relative">
          <input
            data-testid="api-key-input"
            type={showApiKey ? 'text' : 'password'}
            value={aiApiKey}
            onChange={(e) => setAiApiKey(e.target.value)}
            placeholder={aiProvider === 'anthropic' ? "sk-ant-..." : "Enter your API key..."}
            className={cn(
              "w-full bg-muted/30 border text-foreground text-sm p-2.5 pr-10 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40",
              aiApiKey && !apiKeyValid() ? "border-amber-500/50" : "border-border"
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
          <p className="text-[10px] text-amber-400/80 mt-1">
            {aiProvider === 'anthropic' ? "Anthropic keys start with 'sk-ant-'" : "Key appears too short"}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-1.5">
          Get your key at{' '}
          <span className="text-primary/70">console.anthropic.com</span> or{' '}
          <span className="text-primary/70">aistudio.google.dev</span>
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Temperature</label>
          <span className="text-xs text-primary font-mono">{aiTemperature.toFixed(1)}</span>
        </div>
        <input
          data-testid="temperature-slider"
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={aiTemperature}
          onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-muted/50 appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-0"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-1">
          <span>Precise</span>
          <span>Balanced</span>
          <span>Creative</span>
        </div>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">Custom Instructions (optional)</label>
        <textarea
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
