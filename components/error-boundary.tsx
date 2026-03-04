import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    console.error(JSON.stringify({ tenant: 'error-boundary', error }));
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="rounded border border-red-400 bg-red-100 p-4 text-red-700">
          <h2 className="mb-2 text-lg font-semibold">Oops, there was an error!</h2>
          <p className="text-sm">{this.state.error?.message || 'Unknown error occurred'}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
