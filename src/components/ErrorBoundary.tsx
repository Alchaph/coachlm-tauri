import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // intentionally empty: error is captured in state via getDerivedStateFromError
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground gap-4 p-6 text-center">
          <h1 className="text-xl font-semibold">
            Something went wrong
          </h1>
          <p className="text-muted-foreground max-w-[400px] leading-relaxed">
            The app encountered an unexpected error. Reloading usually fixes it.
          </p>
           {this.state.error ? (
             <Alert variant="destructive" className="max-w-[500px] w-full">
               <AlertDescription>
                 <pre className="text-xs whitespace-pre-wrap break-words overflow-auto">
                   {this.state.error.message}
                 </pre>
               </AlertDescription>
             </Alert>
           ) : null}
          <Button onClick={this.handleReload} className="mt-2">
            Reload App
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
