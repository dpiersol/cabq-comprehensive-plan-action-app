import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("App error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="app-shell">
          <header className="site-header">
            <h1>CABQ Comprehensive Plan — Action documentation</h1>
          </header>
          <main className="site-main">
            <div className="error-banner" role="alert">
              <p>Something went wrong. Refresh the page to continue.</p>
              <p className="error-detail">{this.state.error.message}</p>
            </div>
          </main>
        </div>
      );
    }
    return this.props.children;
  }
}
