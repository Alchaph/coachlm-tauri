import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            fontFamily: "inherit",
            gap: "16px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "20px", fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              maxWidth: "400px",
              lineHeight: 1.5,
            }}
          >
            The app encountered an unexpected error. Reloading usually fixes it.
          </p>
          {this.state.error ? (
            <pre
              style={{
                background: "var(--bg-tertiary)",
                padding: "12px 16px",
                borderRadius: "6px",
                fontSize: "12px",
                color: "var(--danger)",
                maxWidth: "500px",
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              marginTop: "8px",
              padding: "10px 24px",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
