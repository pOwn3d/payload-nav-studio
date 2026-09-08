import { describe, expect, it, vi } from 'vitest'
import React from 'react'

/**
 * `AdminNav` is injected into `beforeNavLinks`, i.e. rendered on every page of
 * the admin panel, and Payload mounts it straight from the import map — the
 * plugin never controls its parent, so the boundary has to be inside the
 * exported module. These tests pin that, and pin the `fallback` it is given,
 * because both are invisible from the outside until something crashes in
 * production.
 *
 * The heavy imports are doubled: this suite must not need @payloadcms/ui's SCSS
 * or a DOM. `AdminNav` is called as a plain function — React elements are lazy,
 * so `AdminNavInner` is described but never executed and no hook runs.
 */
vi.mock('@payloadcms/ui', () => ({
  useAuth: () => ({ user: null }),
  useTranslation: () => ({ i18n: { fallbackLanguage: 'en', language: 'en' }, t: (k: string) => k }),
}))
vi.mock('next/link', () => ({ default: () => null }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams(),
}))

const { default: AdminNav, AdminNavInner } = await import('../components/AdminNav.js')
const { ErrorBoundary } = await import('../components/ErrorBoundary.js')

describe('AdminNav — the sidebar is behind a boundary', () => {
  it('exports the boundary, not the raw component', () => {
    const rendered = AdminNav({}) as React.ReactElement
    expect(rendered.type).toBe(ErrorBoundary)
  })

  it('degrades silently — a crash must not paint a panel on every admin page', () => {
    // `fallback: null` (not `undefined`) is the whole design: when the custom
    // sidebar fails, Payload's own navigation next to this slot keeps working.
    const props = (AdminNav({}) as React.ReactElement).props as { fallback?: unknown }
    expect(props.fallback).toBeNull()
  })

  it('renders the real sidebar inside it, with its props forwarded', () => {
    const props = (AdminNav({ basePath: '/api/custom-nav' }) as React.ReactElement).props as {
      children: React.ReactElement
    }
    expect(props.children.type).toBe(AdminNavInner)
    expect((props.children.props as { basePath?: string }).basePath).toBe('/api/custom-nav')
  })

  it('names itself so the console log points at the right mount point', () => {
    const props = (AdminNav({}) as React.ReactElement).props as { componentName?: string }
    expect(props.componentName).toBe('AdminNav')
  })
})
