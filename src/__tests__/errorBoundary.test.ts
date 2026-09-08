import { describe, expect, it, vi } from 'vitest'
import React from 'react'

import { ErrorBoundary } from '../components/ErrorBoundary.js'

/**
 * The test environment is `node` with no DOM, so nothing is mounted: the class
 * is driven through its own contract instead — the static hook React calls on a
 * throw, `render()`, and `componentDidUpdate`. That is enough to pin the two
 * behaviours that actually matter and that a mounted smoke test would not
 * distinguish: what is rendered *after* a catch, and whether the subtree is
 * remounted rather than merely re-rendered.
 */

type Props = React.ComponentProps<typeof ErrorBoundary>

function make(props: Partial<Props> = {}) {
  const merged = { children: React.createElement('div'), ...props } as Props
  const instance = new ErrorBoundary(merged)
  // `setState` outside a mounted tree is a no-op that warns; the class only
  // uses the updater form, so applying it by hand reproduces React exactly.
  instance.setState = ((updater: unknown) => {
    const next =
      typeof updater === 'function'
        ? (updater as (s: typeof instance.state) => Partial<typeof instance.state>)(instance.state)
        : (updater as Partial<typeof instance.state>)
    instance.state = { ...instance.state, ...next }
  }) as typeof instance.setState
  return instance
}

/** Walk a rendered element tree and collect every string leaf. */
function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  const element = node as { props?: { children?: unknown } }
  return textOf(element.props?.children)
}

describe('ErrorBoundary — render contract', () => {
  it('flags the error through the static hook React calls', () => {
    expect(ErrorBoundary.getDerivedStateFromError()).toMatchObject({ hasError: true })
  })

  it('renders children while nothing has thrown', () => {
    const child = React.createElement('span', null, 'sidebar')
    const rendered = make({ children: child }).render()
    expect(textOf(rendered)).toContain('sidebar')
  })

  it('NEVER replays the children after a catch, even with no fallback', () => {
    // This is the exact defect of the sibling `SafeProvider`, whose render()
    // returns `fallback ?? children ?? null`: with no `fallback` it re-renders
    // the subtree that just threw, it throws again, and React eventually
    // unmounts the whole root. A boundary that re-rendered its children here
    // would pass a naive "does it catch?" test and still take the panel down.
    const child = React.createElement('span', null, 'this-must-not-come-back')
    const boundary = make({ children: child })
    boundary.state = { hasError: true, resetCount: 0 }
    expect(textOf(boundary.render())).not.toContain('this-must-not-come-back')
  })

  it('renders `fallback={null}` as nothing, not as the built-in notice', () => {
    // `??` instead of an explicit undefined test would turn the silent
    // degradation AdminNav asks for into a permanent panel on every admin page.
    const boundary = make({ children: React.createElement('span'), fallback: null })
    boundary.state = { hasError: true, resetCount: 0 }
    expect(boundary.render()).toBeNull()
  })

  it('renders a supplied fallback', () => {
    const boundary = make({
      children: React.createElement('span'),
      fallback: React.createElement('p', null, 'nav unavailable'),
    })
    boundary.state = { hasError: true, resetCount: 0 }
    expect(textOf(boundary.render())).toContain('nav unavailable')
  })
})

describe('ErrorBoundary — the built-in notice', () => {
  const crashed = () => {
    const boundary = make({ children: React.createElement('span') })
    boundary.state = { hasError: true, resetCount: 0 }
    return boundary.render() as React.ReactElement
  }

  it('announces itself with role="alert"', () => {
    expect((crashed().props as { role?: string }).role).toBe('alert')
  })

  it('uses theme tokens rather than hardcoded colours', () => {
    // Hardcoded hex made the one screen a user sees when everything broke
    // unreadable in dark mode.
    const style = (crashed().props as { style?: Record<string, string> }).style ?? {}
    const values = Object.values(style).join(' ')
    expect(values).toContain('var(--theme-')
    expect(values).not.toMatch(/#[0-9a-f]{6}\b(?![^(]*\))/i)
  })

  it('never puts the error message on screen', () => {
    // A server-side message can carry filesystem paths and implementation
    // detail; the console is where it belongs.
    const boundary = make({ children: React.createElement('span') })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('ENOENT /srv/app/.env.production')
    boundary.componentDidCatch(error, { componentStack: '' } as React.ErrorInfo)
    boundary.state = { hasError: true, resetCount: 0 }
    expect(textOf(boundary.render())).not.toContain('/srv/app/.env.production')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('names the failing mount point in the console', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    make({ children: React.createElement('span'), componentName: 'AdminNav' }).componentDidCatch(
      new Error('boom'),
      { componentStack: '' } as React.ErrorInfo,
    )
    expect(String(spy.mock.calls[0]?.[0])).toContain('AdminNav')
    spy.mockRestore()
  })

  it('takes translated strings when the caller has them', () => {
    const boundary = make({
      children: React.createElement('span'),
      retryLabel: 'Réessayer',
      title: "Cette vue n'a pas pu s'afficher",
    })
    boundary.state = { hasError: true, resetCount: 0 }
    const text = textOf(boundary.render())
    expect(text).toContain("Cette vue n'a pas pu s'afficher")
    expect(text).toContain('Réessayer')
  })
})

describe('ErrorBoundary — recovery', () => {
  it('remounts the subtree on reset instead of only clearing the flag', () => {
    // Clearing `hasError` alone hands the children back the very state that
    // made them throw. The bumped key is what forces a fresh mount.
    const boundary = make({ children: React.createElement('span', null, 'x') })
    boundary.state = { hasError: true, resetCount: 0 }
    boundary.reset()
    expect(boundary.state).toEqual({ hasError: false, resetCount: 1 })
    const rendered = boundary.render() as React.ReactElement
    expect(rendered.key).toBe('1')
  })

  it('resets when a resetKey changes', () => {
    // React hands `componentDidUpdate` the PREVIOUS props while `this.props`
    // already holds the new ones, so the instance is built with the new keys
    // and the old ones are passed in.
    const boundary = make({ children: React.createElement('span'), resetKeys: ['/admin/media'] })
    boundary.state = { hasError: true, resetCount: 0 }
    boundary.componentDidUpdate({ ...boundary.props, resetKeys: ['/admin/users'] })
    expect(boundary.state.hasError).toBe(false)
    expect(boundary.state.resetCount).toBe(1)
  })

  it('stays in the error state when the resetKeys are unchanged', () => {
    // Otherwise every unrelated re-render would replay the crash in a loop.
    const boundary = make({ children: React.createElement('span'), resetKeys: ['a'] })
    boundary.state = { hasError: true, resetCount: 0 }
    boundary.componentDidUpdate({ ...boundary.props, resetKeys: ['a'] })
    expect(boundary.state.hasError).toBe(true)
  })

  it('does nothing on update while no error is pending', () => {
    const boundary = make({ children: React.createElement('span'), resetKeys: ['a'] })
    boundary.componentDidUpdate({ ...boundary.props, resetKeys: ['b'] })
    expect(boundary.state).toEqual({ hasError: false, resetCount: 0 })
  })
})
