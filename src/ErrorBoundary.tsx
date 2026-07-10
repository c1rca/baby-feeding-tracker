import { Component, type ErrorInfo, type ReactNode } from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled Feedr UI error', { error, errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell app-error-shell" role="alert" aria-labelledby="app-error-title">
          <section className="app-error-card">
            <p className="eyebrow">Feedr</p>
            <h1 id="app-error-title">Something went wrong</h1>
            <p>Refresh the app to reload your latest saved tracker state.</p>
            <button type="button" onClick={() => window.location.reload()}>Refresh app</button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}
