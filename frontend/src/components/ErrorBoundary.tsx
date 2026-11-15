import { Component, ErrorInfo, ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("UI error", error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="card m-6 p-6">
        <h2 className="font-display text-xl font-semibold">This page hit an unexpected problem</h2>
        <p className="mt-2 text-sm text-ink-soft">Your Jira data is unaffected. Reload the page to try again.</p>
        <button type="button" className="btn-primary mt-4" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    );
  }
}
