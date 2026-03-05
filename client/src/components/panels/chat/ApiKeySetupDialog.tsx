import { useState, useCallback } from 'react';
import { KeyRound, ExternalLink, Eye, EyeOff, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useApiKeyStatus } from '@/hooks/useApiKeyStatus';

interface ApiKeySetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiProvider: 'anthropic' | 'gemini';
  onApiKeySet: (key: string) => void;
}

const PROVIDER_CONFIG = {
  anthropic: {
    name: 'Anthropic',
    url: 'https://console.anthropic.com/settings/keys',
    urlLabel: 'console.anthropic.com',
    placeholder: 'sk-ant-...',
    instructions: 'Sign in to your Anthropic account and create a new API key.',
  },
  gemini: {
    name: 'Google AI',
    url: 'https://aistudio.google.dev/apikeys',
    urlLabel: 'aistudio.google.dev',
    placeholder: 'Enter your API key...',
    instructions: 'Sign in to Google AI Studio and create a new API key.',
  },
} as const;

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 pt-4" data-testid="setup-step-dots">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'w-2 h-2 rounded-full transition-colors',
            i === current ? 'bg-primary' : 'bg-muted-foreground/30',
          )}
        />
      ))}
    </div>
  );
}

export default function ApiKeySetupDialog({ open, onOpenChange, aiProvider, onApiKeySet }: ApiKeySetupDialogProps) {
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const { status, errorMessage, validate, reset } = useApiKeyStatus();

  const config = PROVIDER_CONFIG[aiProvider];

  const handleClose = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setStep(0);
      setApiKey('');
      setShowKey(false);
      reset();
    }
    onOpenChange(nextOpen);
  }, [onOpenChange, reset]);

  const handleTestConnection = useCallback(async () => {
    await validate(aiProvider, apiKey);
  }, [validate, aiProvider, apiKey]);

  const handleComplete = useCallback(() => {
    onApiKeySet(apiKey);
    handleClose(false);
  }, [onApiKeySet, apiKey, handleClose]);

  // Auto-advance to success step when validation succeeds
  const effectiveStep = status === 'valid' && step === 2 ? 3 : step;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px] bg-card border-border" data-testid="api-key-setup-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display tracking-wider">
            <KeyRound className="w-5 h-5 text-primary" />
            Set Up AI Assistant
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {effectiveStep === 0 && 'Connect your AI provider to start designing with AI assistance.'}
            {effectiveStep === 1 && `Get your ${config.name} API key.`}
            {effectiveStep === 2 && 'Paste your API key and verify the connection.'}
            {effectiveStep === 3 && 'You\'re all set!'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {effectiveStep === 0 && (
            <div className="space-y-4" data-testid="setup-step-intro">
              <p className="text-sm text-muted-foreground leading-relaxed">
                ProtoPulse uses AI to help you design circuits, generate architectures, optimize BOMs, and more. You need an API key from your AI provider to enable these features.
              </p>
              <p className="text-xs text-muted-foreground/60">
                Your key stays in your browser and is sent directly to the AI provider. ProtoPulse never stores or logs your key on our servers.
              </p>
              <button
                data-testid="setup-get-started"
                onClick={() => { setStep(1); }}
                className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-sm tracking-wider hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {effectiveStep === 1 && (
            <div className="space-y-4" data-testid="setup-step-get-key">
              <div className="bg-muted/30 border border-border p-4 space-y-3">
                <p className="text-sm font-medium">{config.instructions}</p>
                <a
                  href={config.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 underline transition-colors"
                  data-testid="setup-provider-link"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {config.urlLabel}
                </a>
              </div>
              <button
                data-testid="setup-have-key"
                onClick={() => { setStep(2); }}
                className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-sm tracking-wider hover:bg-primary/90 transition-colors"
              >
                I Have My Key
              </button>
            </div>
          )}

          {effectiveStep === 2 && (
            <div className="space-y-4" data-testid="setup-step-paste-test">
              <div>
                <label htmlFor="setup-api-key" className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2 block">
                  {config.name} API Key
                </label>
                <div className="relative">
                  <input
                    id="setup-api-key"
                    data-testid="setup-api-key-input"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); reset(); }}
                    placeholder={config.placeholder}
                    autoFocus
                    className="w-full bg-muted/30 border border-border text-foreground text-sm p-2.5 pr-10 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
                  />
                  <button
                    type="button"
                    data-testid="setup-toggle-key-visibility"
                    onClick={() => { setShowKey(!showKey); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {(status === 'invalid' || status === 'error') && errorMessage && (
                <p className="text-xs text-destructive flex items-center gap-1.5" data-testid="setup-error-message">
                  <span className="w-1 h-1 bg-destructive rounded-full shrink-0" />
                  {errorMessage}
                </p>
              )}

              <button
                data-testid="setup-test-connection"
                onClick={() => { void handleTestConnection(); }}
                disabled={!apiKey.trim() || status === 'validating'}
                className={cn(
                  'w-full py-2.5 font-bold text-sm tracking-wider transition-colors flex items-center justify-center gap-2',
                  status === 'valid'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  (!apiKey.trim() || status === 'validating') && 'opacity-50 cursor-not-allowed',
                )}
              >
                {status === 'validating' && <Loader2 className="w-4 h-4 animate-spin" />}
                {status === 'valid' && <CheckCircle2 className="w-4 h-4" />}
                {status === 'validating' ? 'Testing...' : status === 'valid' ? 'Verified!' : 'Test Connection'}
              </button>
            </div>
          )}

          {effectiveStep === 3 && (
            <div className="space-y-4 text-center" data-testid="setup-step-success">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Your API key is verified and ready to use.</p>
                <p className="text-xs text-muted-foreground mt-1">You can update it anytime in AI Settings.</p>
              </div>
              <button
                data-testid="setup-start-chatting"
                onClick={handleComplete}
                className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-sm tracking-wider hover:bg-primary/90 transition-colors"
              >
                Start Chatting
              </button>
            </div>
          )}

          <StepDots current={effectiveStep} total={4} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
