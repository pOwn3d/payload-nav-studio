'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useNavPreferences } from '../hooks/useNavPreferences.js'
import { usePluginTranslation } from '../hooks/usePluginTranslation.js'
import { StyleInjector } from './StyleInjector.js'
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
      className="admin-nav__svg-icon"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
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

/** A single color dot icon (for ticket status filters) */
const DotIcon: React.FC<{ color: string }> = ({ color }) => (
  <span className="admin-nav__dot-icon" style={{ backgroundColor: color }} />
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
  const { layout, isLoaded, collapsedGroups, setCollapsedGroups } = useNavPreferences()

  // Next.js reactive hooks — update instantly on client-side navigation
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : ''
  const fullUrl = pathname + search

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

  // Build collapsed record from persisted collapsedGroups array + defaults
  const collapsed = useMemo(() => {
    const record: Record<string, boolean> = {}
    // Apply defaultCollapsed from layout config
    layout.forEach((g) => {
      if (g.defaultCollapsed) record[g.id] = true
    })
    // Override with persisted collapsed state (persisted takes priority)
    if (collapsedGroups.length > 0) {
      // Clear defaults and use only persisted state
      layout.forEach((g) => { record[g.id] = false })
      collapsedGroups.forEach((id) => { record[id] = true })
    }
    return record
  }, [layout, collapsedGroups])

  const toggleGroup = (groupId: string) => {
    const isCurrentlyCollapsed = collapsed[groupId] ?? false
    let newCollapsed: string[]
    if (isCurrentlyCollapsed) {
      newCollapsed = collapsedGroups.filter((id) => id !== groupId)
    } else {
      newCollapsed = [...collapsedGroups, groupId]
    }
    setCollapsedGroups(newCollapsed)
  }

  return (
    <>
    <StyleInjector />
    <div
      data-admin-nav=""
      className={`admin-nav${isLoaded ? '' : ' admin-nav--loading'}`}
    >
      {/* Dashboard link */}
      <Link
        href="/admin"
        prefetch={false}
        className={`admin-nav__dashboard-link${isDashboard ? ' admin-nav__dashboard-link--active' : ''}`}
      >
        <NavIcon name="home" />
        {t('plugin-admin-nav:dashboard')}
      </Link>

      {visibleGroups.map((group) => {
        const isCollapsed = collapsed[group.id]

        return (
          <div key={group.id} className="admin-nav__group">
            {/* Group header */}
            <div
              className="admin-nav__group-title"
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
                className={`admin-nav__group-chevron${isCollapsed ? ' admin-nav__group-chevron--collapsed' : ''}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>

            {/* Group items */}
            {!isCollapsed && group.items.map((item) => {
              const isActive = isItemActive(item, fullUrl, pathname)
              const hasActiveChild = item.children?.some((child) => fullUrl === child.href) ?? false

              const itemClasses = [
                'admin-nav__item-link',
                isActive && 'admin-nav__item-link--active',
                hasActiveChild && 'admin-nav__item-link--has-active-child',
              ].filter(Boolean).join(' ')

              return (
                <React.Fragment key={item.id}>
                  <Link href={item.href} prefetch={false} className={itemClasses}>
                    <NavIcon name={item.icon} />
                    {resolveLabel(item.label, lang, fallbackLang)}
                  </Link>

                  {/* Child items */}
                  {item.children?.filter((c) => c.visible !== false).map((child) => {
                    const isChildActive = fullUrl === child.href
                    return (
                      <Link
                        key={child.id}
                        href={child.href}
                        prefetch={false}
                        className={`admin-nav__child-link${isChildActive ? ' admin-nav__child-link--active' : ''}`}
                      >
                        <ChildIcon icon={child.icon} />
                        {resolveLabel(child.label, lang, fallbackLang)}
                      </Link>
                    )
                  })}
                </React.Fragment>
              )
            })}
          </div>
        )
      })}

      {/* Customize button */}
      <Link href="/admin/nav-customizer" prefetch={false} className="admin-nav__customize-link">
        <NavIcon name="settings" size={12} />
        {t('plugin-admin-nav:customize')}
      </Link>
    </div>
    </>
  )
}

export default AdminNav
