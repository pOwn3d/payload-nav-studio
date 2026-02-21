'use client'

import React, { useState, useMemo } from 'react'
import { useNavPreferences } from '../hooks/useNavPreferences.js'
import { usePluginTranslation } from '../hooks/usePluginTranslation.js'
import { getIconPath } from '../icons.js'
import type { NavItemConfig, NavGroupConfig } from '../types.js'
import { resolveLabel } from '../utils.js'

/** Inline SVG icon component using the icon registry */
const NavIcon: React.FC<{ name: string; size?: number }> = ({ name, size = 16 }) => {
  const pathData = getIconPath(name)
  if (!pathData) return null

  // Split compound paths (separated by M or Z followed by M)
  const paths = pathData.split(/(?= M)/).map((p) => p.trim())

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}

/** Hook to get the current URL (pathname + search) */
function useFullUrl(): string {
  const [fullUrl, setFullUrl] = useState('')
  React.useEffect(() => {
    const update = () => setFullUrl(window.location.pathname + window.location.search)
    update()
    // Listen for popstate (back/forward) and custom nav events
    window.addEventListener('popstate', update)
    // MutationObserver on body to catch SPA navigations
    const observer = new MutationObserver(update)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      window.removeEventListener('popstate', update)
      observer.disconnect()
    }
  }, [])
  return fullUrl
}

/** Check if a nav item is active based on the current URL */
function isItemActive(item: NavItemConfig, fullUrl: string, pathname: string): boolean {
  if (item.href.includes('?')) {
    return fullUrl === item.href
  }
  if (item.matchPrefix) {
    const pathMatches = pathname.startsWith(item.href)
    if (pathMatches && item.children?.length) {
      return !item.children.some((child) => fullUrl === child.href)
    }
    return pathMatches
  }
  return pathname === item.href
}

// ── Styles ──

const styles = {
  container: {
    paddingBottom: 12,
    marginBottom: 8,
    borderBottom: '1px solid var(--theme-elevation-200)',
  } as React.CSSProperties,
  dashboardLink: (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    margin: '0 8px 8px',
    borderRadius: 6,
    borderLeft: isActive ? '3px solid var(--bd-nav-active-border, var(--theme-elevation-500))' : '3px solid transparent',
    backgroundColor: isActive ? 'var(--bd-nav-active-bg, var(--theme-elevation-100))' : 'transparent',
    color: isActive ? 'var(--bd-nav-active-text, var(--theme-text))' : 'var(--theme-text)',
    fontWeight: 600,
    fontSize: 13,
    textDecoration: 'none',
    transition: 'background-color 0.15s, color 0.15s',
  } as React.CSSProperties),
  groupTitle: {
    padding: '4px 16px',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.5,
    color: 'var(--bd-nav-group-label, var(--theme-elevation-500))',
  } as React.CSSProperties,
  groupContainer: {
    marginBottom: 6,
  } as React.CSSProperties,
  itemLink: (isActive: boolean, hasActiveChild: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 16px',
    margin: '2px 8px',
    borderRadius: 6,
    borderLeft: (isActive || hasActiveChild) ? '3px solid var(--bd-nav-active-border, var(--theme-elevation-500))' : '3px solid transparent',
    backgroundColor: isActive ? 'var(--bd-nav-active-bg, var(--theme-elevation-100))' : 'transparent',
    color: (isActive || hasActiveChild) ? 'var(--bd-nav-active-text, var(--theme-text))' : 'var(--theme-text)',
    fontWeight: (isActive || hasActiveChild) ? 600 : 500,
    fontSize: 13,
    textDecoration: 'none',
    transition: 'background-color 0.15s, color 0.15s',
  } as React.CSSProperties),
  childLink: (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 16px 5px 36px',
    margin: '1px 8px',
    borderRadius: 6,
    borderLeft: isActive ? '3px solid var(--bd-nav-active-border, var(--theme-elevation-500))' : '3px solid transparent',
    backgroundColor: isActive ? 'var(--bd-nav-active-bg, var(--theme-elevation-100))' : 'transparent',
    color: isActive ? 'var(--bd-nav-active-text, var(--theme-text))' : 'var(--theme-elevation-500)',
    fontWeight: isActive ? 600 : 400,
    fontSize: 12,
    textDecoration: 'none',
    transition: 'background-color 0.15s, color 0.15s',
  } as React.CSSProperties),
  customizeLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '6px 16px',
    margin: '8px 8px 0',
    borderRadius: 6,
    fontSize: 11,
    color: 'var(--theme-elevation-500)',
    textDecoration: 'none',
    transition: 'color 0.15s',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    width: '100%',
  } as React.CSSProperties,
} as const

/** A single color dot icon (for ticket status filters) */
const DotIcon: React.FC<{ color: string }> = ({ color }) => (
  <span style={{
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: color,
    flexShrink: 0,
  }} />
)

/** Render a child nav item icon — either a dot or SVG */
const ChildIcon: React.FC<{ icon: string }> = ({ icon }) => {
  // If icon starts with '#' it's a dot color
  if (icon.startsWith('#')) return <DotIcon color={icon} />
  return <NavIcon name={icon} size={14} />
}

/**
 * AdminNav — The main sidebar navigation component.
 * Replaces the default Payload admin nav with the plugin's customizable navigation.
 * Reads per-user preferences from the API, falls back to the defaultNav config.
 */
const AdminNav: React.FC = () => {
  const { t, i18n } = usePluginTranslation()
  const { layout, isLoaded } = useNavPreferences()
  const fullUrl = useFullUrl()
  const pathname = fullUrl.split('?')[0]

  const isDashboard = pathname === '/admin' || pathname === '/admin/'

  const lang = i18n.language
  const fallbackLang = i18n.fallbackLanguage as string

  // Filter visible groups and items
  const visibleGroups = useMemo(() => {
    return layout
      .filter((g) => g.visible !== false)
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => item.visible !== false),
      }))
      .filter((g) => g.items.length > 0)
  }, [layout])

  // Collapsed groups state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  React.useEffect(() => {
    if (isLoaded && layout.length > 0) {
      const initial: Record<string, boolean> = {}
      layout.forEach((g) => {
        if (g.defaultCollapsed) initial[g.id] = true
      })
      setCollapsed(initial)
    }
  }, [isLoaded, layout])

  const toggleGroup = (groupId: string) => {
    setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  if (!isLoaded) {
    return (
      <div style={{ ...styles.container, opacity: 0.5 }}>
        <div style={{ padding: '16px', fontSize: 12, color: 'var(--theme-elevation-400)' }}>
          {t('plugin-admin-nav:loading')}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Dashboard link */}
      <a href="/admin" style={styles.dashboardLink(isDashboard)}>
        <NavIcon name="home" />
        {t('plugin-admin-nav:dashboard')}
      </a>

      {visibleGroups.map((group) => {
        const isCollapsed = collapsed[group.id]

        return (
          <div key={group.id} style={styles.groupContainer}>
            {/* Group header */}
            <div
              style={{
                ...styles.groupTitle,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                userSelect: 'none',
              }}
              onClick={() => toggleGroup(group.id)}
            >
              <span>{resolveLabel(group.title, lang, fallbackLang)}</span>
              <svg
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)',
                  transition: 'transform 0.15s',
                }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>

            {/* Group items */}
            {!isCollapsed && group.items.map((item) => {
              const isActive = isItemActive(item, fullUrl, pathname)
              const hasActiveChild = item.children?.some((child) => fullUrl === child.href) ?? false

              return (
                <React.Fragment key={item.id}>
                  <a href={item.href} style={styles.itemLink(isActive, hasActiveChild)}>
                    <NavIcon name={item.icon} />
                    {resolveLabel(item.label, lang, fallbackLang)}
                  </a>

                  {/* Child items */}
                  {item.children?.filter((c) => c.visible !== false).map((child) => {
                    const isChildActive = fullUrl === child.href
                    return (
                      <a key={child.id} href={child.href} style={styles.childLink(isChildActive)}>
                        <ChildIcon icon={child.icon} />
                        {resolveLabel(child.label, lang, fallbackLang)}
                      </a>
                    )
                  })}
                </React.Fragment>
              )
            })}
          </div>
        )
      })}

      {/* Customize button */}
      <a href="/admin/nav-customizer" style={styles.customizeLink}>
        <NavIcon name="settings" size={12} />
        {t('plugin-admin-nav:customize')}
      </a>
    </div>
  )
}

export default AdminNav
