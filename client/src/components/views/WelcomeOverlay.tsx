import {
  LayoutGrid,
  CircuitBoard,
  Package,
  MessageCircle,
  Download,
  Zap,
  ArrowRight,
  Sparkles,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/lib/project-context';

const STORAGE_KEY = 'protopulse-onboarding-dismissed';

export function isOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function dismissOnboarding(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage unavailable — skip
  }
}

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: string;
  testId: string;
}

function FeatureCard({ icon: Icon, title, description, accent, testId }: FeatureCardProps) {
  return (
    <Card
      data-testid={testId}
      className="bg-card/40 backdrop-blur border-border/50 hover:border-primary/30 transition-colors"
    >
      <CardContent className="p-4 flex items-start gap-3">
        <div className={cn('p-2 rounded-lg shrink-0', accent)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const FEATURES: FeatureCardProps[] = [
  {
    icon: LayoutGrid,
    title: 'Architecture Diagrams',
    description: 'Visual block diagrams of your system. Drag components, draw connections, define signal types.',
    accent: 'bg-primary/15 text-primary',
    testId: 'welcome-feature-architecture',
  },
  {
    icon: CircuitBoard,
    title: 'Circuit Schematics',
    description: 'Full schematic capture with instances, nets, wires, and electrical rule checks (ERC).',
    accent: 'bg-emerald-500/15 text-emerald-500',
    testId: 'welcome-feature-schematics',
  },
  {
    icon: Package,
    title: 'BOM Management',
    description: 'Track parts, quantities, pricing, stock status, and suppliers in a unified bill of materials.',
    accent: 'bg-orange-500/15 text-orange-500',
    testId: 'welcome-feature-bom',
  },
  {
    icon: MessageCircle,
    title: 'AI Design Assistant',
    description: 'Chat with AI to generate architectures, suggest components, run validations, and manage your design.',
    accent: 'bg-violet-500/15 text-violet-500',
    testId: 'welcome-feature-ai',
  },
  {
    icon: Zap,
    title: 'Design Validation',
    description: 'Automated DRC/ERC checking catches errors before they reach fabrication.',
    accent: 'bg-yellow-500/15 text-yellow-500',
    testId: 'welcome-feature-validation',
  },
  {
    icon: Download,
    title: 'Multi-Format Export',
    description: 'Export to KiCad, Eagle, SPICE, Gerber, BOM CSV, PDF reports, and more.',
    accent: 'bg-cyan-500/15 text-cyan-500',
    testId: 'welcome-feature-export',
  },
];

interface QuickStartStep {
  number: number;
  title: string;
  description: string;
  action: string;
  view: ViewMode;
  testId: string;
}

const QUICK_START_STEPS: QuickStartStep[] = [
  {
    number: 1,
    title: 'Build your architecture',
    description: 'Add components like MCUs, sensors, and power supplies to your block diagram.',
    action: 'Open Architecture',
    view: 'architecture',
    testId: 'welcome-step-architecture',
  },
  {
    number: 2,
    title: 'Ask the AI for help',
    description: 'Try "Design a temperature monitoring system with ESP32" in the chat panel.',
    action: 'Open Chat',
    view: 'architecture',
    testId: 'welcome-step-ai',
  },
  {
    number: 3,
    title: 'Run validation',
    description: 'Check your design for errors, missing connections, and best practice violations.',
    action: 'Open Validation',
    view: 'validation',
    testId: 'welcome-step-validation',
  },
];

interface WelcomeOverlayProps {
  onNavigate: (view: ViewMode) => void;
  onDismiss: () => void;
}

export default function WelcomeOverlay({ onNavigate, onDismiss }: WelcomeOverlayProps) {
  const handleQuickStart = (step: QuickStartStep) => {
    onNavigate(step.view);
  };

  return (
    <div data-testid="welcome-overlay" className="h-full overflow-auto bg-background/50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div data-testid="welcome-header" className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
                Welcome to ProtoPulse
              </h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              AI-assisted electronic design automation. Build architecture diagrams, capture schematics,
              manage your BOM, validate designs, and export to industry formats — all in your browser.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            data-testid="welcome-dismiss"
            aria-label="Dismiss welcome screen"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Features grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What you can do
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.testId} {...feature} />
            ))}
          </div>
        </div>

        {/* Quick start steps */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Get started in 3 steps
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {QUICK_START_STEPS.map((step) => (
              <Card
                key={step.testId}
                data-testid={step.testId}
                className="bg-card/40 backdrop-blur border-border/50 hover:border-primary/30 transition-colors"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold">
                      {step.number}
                    </span>
                    <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5"
                    onClick={() => handleQuickStart(step)}
                    data-testid={`${step.testId}-action`}
                  >
                    {step.action}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Skip link */}
        <div className="text-center pt-2">
          <button
            onClick={onDismiss}
            data-testid="welcome-skip"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Skip and go to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
