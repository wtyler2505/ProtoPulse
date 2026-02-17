import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (error.message?.includes('ResizeObserver')) return;
    console.warn('ErrorBoundary caught:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center h-full w-full bg-background text-muted-foreground p-8">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium">Something went wrong rendering this section.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
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
