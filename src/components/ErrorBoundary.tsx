'use client'

import React from 'react'

/**
 * Render-error boundary for the components this plugin mounts inside somebody
 * else's admin panel.
 *
 * Why the plugin carries its own instead of relying on the host: Payload mounts
 * `beforeNavLinks` and custom views straight from the import map, so the plugin
 * never controls their parent and cannot be given an ancestor boundary. The
 * boundary therefore has to live *inside* the exported module — `AdminNav` is a
 * wrapper around `AdminNavInner` for exactly that reason.
 *
 * What it does NOT do, and what no boundary does: React only catches errors
 * thrown during *render*, in lifecycle methods and in constructors. A rejected
 * promise inside an async `useEffect` (this sidebar fetches `/preferences`,
 * `/default-nav` and `/badges`) and a throw inside an event handler both go
 * past it — those need a `try/catch` at the call site, which is where they are
 * handled.
 *
 * Deliberately not modelled on `SafeProvider` from the sibling admin-ui-pro
 * package: that one renders `fallback ?? children` on error, so without an
 * explicit `fallback` it replays the very children that just threw, they throw
 * again, and React ends up unmounting the whole root. Here a caught error never
 * re-renders `children` — only the `fallback`, or the built-in notice.
 */
interface ErrorBoundaryProps {
  children: React.ReactNode
  /**
   * What to render instead of the children once one has thrown.
   *
   * Pass `null` for a component mounted on every admin page: a permanent red
   * panel across the sidebar is worse than the missing feature, and the host's
   * own navigation keeps working underneath.
   */
  fallback?: React.ReactNode
  /** Named in the console log, so the failing mount point is identifiable. */
  componentName?: string
  /**
   * Values whose change means "the cause may be gone, try rendering again".
   * Compared with `Object.is` element by element.
   *
   * Without this, a boundary is a dead end: the retry button only clears the
   * flag, so an error caused by a prop or by persisted data throws again on the
   * next render and the user is back where they started.
   */
  resetKeys?: unknown[]
  /** Heading of the built-in fallback. English default; pass a translated string. */
  title?: string
  /** Label of the built-in fallback's retry button. */
  retryLabel?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  /**
   * Bumped on every reset so the children remount instead of being re-rendered
   * with the state that made them throw. Clearing `hasError` alone leaves a
   * subtree whose internal state is exactly the one that failed.
   */
  resetCount: number
}

const containerStyle: React.CSSProperties = {
  padding: '24px',
  margin: '8px',
  borderRadius: '8px',
  // Theme tokens, not hex: this is the one screen a user sees when everything
  // else broke, and hardcoded light-mode colours made it unreadable in dark.
  border: '1px solid var(--theme-elevation-150, #ebe6dc)',
  backgroundColor: 'var(--theme-elevation-50, #fbfaf7)',
  color: 'var(--theme-elevation-800, #21201f)',
  fontSize: '13px',
  lineHeight: 1.5,
}

const buttonStyle: React.CSSProperties = {
  marginTop: '12px',
  padding: '6px 14px',
  border: '1px solid var(--theme-elevation-250, #d8d2c6)',
  borderRadius: '6px',
  backgroundColor: 'var(--theme-elevation-100, #f1eee8)',
  color: 'var(--theme-elevation-800, #21201f)',
  cursor: 'pointer',
  font: 'inherit',
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, resetCount: 0 }
  }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    // The error itself is deliberately not kept in state: it must never reach
    // the screen (a server-side message can carry paths and implementation
    // detail), and `componentDidCatch` already puts it in the console.
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error(
      `[admin-nav] ${this.props.componentName ?? 'component'} crashed while rendering:`,
      error,
      errorInfo,
    )
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (!this.state.hasError) return
    if (!keysChanged(prevProps.resetKeys, this.props.resetKeys)) return
    this.reset()
  }

  reset = (): void => {
    this.setState((state) => ({ hasError: false, resetCount: state.resetCount + 1 }))
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // `fallback` is read with a `!== undefined` test, never `??`: `null` is a
      // legitimate value ("render nothing") and the nullish operator would fall
      // through to the notice below for exactly the callers that asked for
      // silent degradation.
      if (this.props.fallback !== undefined) return this.props.fallback

      return (
        <div role="alert" style={containerStyle} className="admin-nav-error-boundary">
          <strong>{this.props.title ?? 'Something went wrong'}</strong>
          <button type="button" onClick={this.reset} style={buttonStyle}>
            {this.props.retryLabel ?? 'Try again'}
          </button>
        </div>
      )
    }

    // The key is what turns "clear the flag" into a real remount.
    return <React.Fragment key={this.state.resetCount}>{this.props.children}</React.Fragment>
  }
}

/** `Object.is` element-by-element comparison; a length change counts as changed. */
function keysChanged(previous: unknown[] | undefined, next: unknown[] | undefined): boolean {
  if (previous === next) return false
  if (!previous || !next) return true
  if (previous.length !== next.length) return true
  return previous.some((value, index) => !Object.is(value, next[index]))
}

export default ErrorBoundary
