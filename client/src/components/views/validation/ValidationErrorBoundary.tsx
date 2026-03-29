import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ValidationBoundaryProps {
  children: ReactNode;
}

interface ValidationBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ValidationErrorBoundary extends Component<ValidationBoundaryProps, ValidationBoundaryState> {
  constructor(props: ValidationBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ValidationBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[ValidationView] Error caught by boundary:', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      return (
        <div
          data-testid="validation-error-boundary"
          className="flex items-center justify-center h-full w-full bg-background text-muted-foreground p-8"
        >
          <div className="text-center space-y-4 max-w-md">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />
            <h3 className="text-base font-semibold text-foreground">
              Something went wrong loading the Validation view
            </h3>
            <p className="text-sm text-muted-foreground">
              The validation engine encountered an unexpected error. This may be caused by
              malformed component data or a missing resource. Try again, or check the browser
              console for details.
            </p>
            {isDev && this.state.error && (
              <pre className="mt-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs text-left overflow-auto max-h-32 rounded">
                {this.state.error.message}
              </pre>
            )}
            <button
              data-testid="validation-retry-button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors focus-ring"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
