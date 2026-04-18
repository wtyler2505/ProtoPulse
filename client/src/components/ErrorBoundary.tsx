import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RotateCcw, Trash2, Settings } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    if (error.message?.match(/ResizeObserver loop (limit exceeded|completed with undelivered notifications)/)) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (error.message?.match(/ResizeObserver loop (limit exceeded|completed with undelivered notifications)/)) return;
    logger.warn('ErrorBoundary caught:', error.message, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleClearState = () => {
    queryClient.clear();
    this.setState({ hasError: false, error: null });
  };

  private handleOpenSettings = () => {
    // Attempt to navigate to settings by toggling the chat panel settings.
    // As a fallback the user can click the chat gear icon manually.
    const settingsBtn = document.querySelector<HTMLButtonElement>('[data-testid="chat-settings-button"]');
    if (settingsBtn) {
      settingsBtn.click();
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div
          data-testid="error-boundary-fallback"
          className="flex items-center justify-center h-full w-full bg-background text-muted-foreground p-8"
        >
          <div className="text-center space-y-4 max-w-md">
            <AlertTriangle className="w-10 h-10 text-primary mx-auto" />
            <p data-testid="error-boundary-title" className="text-sm font-medium text-foreground">
              Something went wrong rendering this section.
            </p>
            {this.state.error && (
              <p data-testid="error-boundary-detail" className="text-xs text-muted-foreground break-words">
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                data-testid="error-boundary-retry"
                onClick={this.handleRetry}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Try Again
              </button>
              <button
                data-testid="error-boundary-clear-state"
                onClick={this.handleClearState}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 hover:text-foreground transition-colors border border-border"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Cache
              </button>
              <button
                data-testid="error-boundary-settings"
                onClick={this.handleOpenSettings}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 hover:text-foreground transition-colors border border-border"
              >
                <Settings className="w-3.5 h-3.5" />
                Settings
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground/60 pt-2">
              If this keeps happening, try refreshing the page.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
