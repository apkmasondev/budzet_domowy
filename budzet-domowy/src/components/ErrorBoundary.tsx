import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 text-center shadow-xl">
            <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-2xl font-bold mb-4">Wystąpił błąd krytyczny</h1>
            <p className="text-muted-foreground mb-6 text-sm">
              Niestety, aplikacja napotkała niespodziewany błąd i nie może kontynuować działania.
            </p>
            {this.state.error && (
              <div className="bg-muted p-4 rounded-xl text-left overflow-auto text-xs text-muted-foreground mb-6 max-h-32">
                <code>{this.state.error.message}</code>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors"
            >
              <RefreshCw size={20} />
              Odśwież Aplikację
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
