'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useNavPreferences } from '../hooks/useNavPreferences.js'
import { usePluginTranslation } from '../hooks/usePluginTranslation.js'
import { StyleInjector } from './StyleInjector.js'
import { NavUserProfile } from './NavUserProfile.js'
import NavFooterSlot from './NavFooterSlot.js'
import { getIconPath } from '../icons.js'
import type { NavItemConfig, NavGroupConfig, NavChildConfig } from '../types.js'
import { resolveLabel } from '../utils.js'

/** localStorage key for the persisted collapsed-rail state (per-browser) */
const RAIL_STORAGE_KEY = 'admin-nav-rail-collapsed'

/** Inline SVG icon component using the icon registry */
const NavIcon: React.FC<{ name: string; size?: number; strokeWidth?: number }> = ({
  name,
  size = 17,
  strokeWidth = 1.9,
}) => {
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
      strokeWidth={strokeWidth}
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

/** Chevron used by the collapse / expand buttons (design-system style) */
const ChevronIcon: React.FC<{ direction: 'left' | 'right' }> = ({ direction }) => (
  <svg
    width={15}
    height={15}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
)

/** Brand logo: ink square + teal ring (matches design system v2) */
const NavLogo: React.FC = () => (
  <span className="admin-nav__logo" aria-hidden="true">
    <span className="admin-nav__logo-ring" />
  </span>
)

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

/** Strongly-typed badge payload returned by `/admin-nav/badges` */
interface BadgesResponse {
  groups: Record<string, number>
  children: Record<string, number>
}

/** Plugin runtime config received from `/admin-nav/default-nav` */
interface DefaultNavMeta {
  hasBadges?: boolean
  navFooterSlot?: string | null
}

/**
 * AdminNav — The main sidebar navigation component.
 * Replaces the default Payload admin nav with the plugin's customizable navigation.
 *
 * Features:
 * - Brand header (logo + wordmark) + collapse toggle (persistent 72px rail)
 * - Per-user preferences (drag/drop, hide/show, custom groups)
 * - Live counters on groups and children via `/admin-nav/badges` (polls every 60s)
 * - Top filter input ("Jump to…") with ⌘K shortcut
 * - User profile + availability popover above the footer
 * - Optional consumer-provided footer slot replacing the Customize link
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

  // ── Collapsed rail (72px) — persisted per-browser in localStorage ──
  // Initial render is always expanded (SSR-safe, matches server). The
  // persisted value is read post-hydration in the effect below to avoid
  // a React hydration mismatch.
  const [railCollapsed, setRailCollapsed] = useState(false)

  useEffect(() => {
    try {
      setRailCollapsed(localStorage.getItem(RAIL_STORAGE_KEY) === '1')
    } catch {
      /* localStorage unavailable — stay expanded */
    }
  }, [])

  const toggleRail = useCallback(() => {
    setRailCollapsed((v) => {
      const next = !v
      try {
        localStorage.setItem(RAIL_STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  // ── Filter / jump-to ─────────────────────────────────────────────
  const [filter, setFilter] = useState('')
  const filterInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K → focus filter
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        filterInputRef.current?.focus()
        filterInputRef.current?.select()
        return
      }
      // Esc on the filter input → clear & blur (handled also at input level
      // so this only triggers when input has focus)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setFilter('')
      filterInputRef.current?.blur()
    }
  }

  // ── Badges ───────────────────────────────────────────────────────
  const [badges, setBadges] = useState<BadgesResponse>({ groups: {}, children: {} })
  const [meta, setMeta] = useState<DefaultNavMeta>({})

  // Fetch meta (hasBadges flag + navFooterSlot path) once at mount.
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin-nav/default-nav')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setMeta({ hasBadges: !!data.hasBadges, navFooterSlot: data.navFooterSlot ?? null })
      })
      .catch(() => {
        /* silent */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Poll badges every 60s when the plugin reports at least one resolver.
  useEffect(() => {
    if (!meta.hasBadges) return

    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/admin-nav/badges')
        if (!res.ok) return
        const data = (await res.json()) as BadgesResponse
        if (cancelled) return
        setBadges({
          groups: data.groups ?? {},
          children: data.children ?? {},
        })
      } catch {
        /* silent */
      }
    }

    load()
    const id = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [meta.hasBadges])

  // ── Layout filtering (visibility + jump-to filter) ───────────────
  const trimmedFilter = filter.trim().toLowerCase()

  const visibleGroups = useMemo(() => {
    return layout
      .filter((g) => g.visible !== false)
      .map((g) => {
        const items = g.items
          .filter((item) => item.visible !== false)
          .filter((item) => {
            if (!trimmedFilter) return true
            const label = resolveLabel(item.label, lang, fallbackLang).toLowerCase()
            if (label.includes(trimmedFilter)) return true
            // Keep item if any child matches
            return (item.children ?? []).some((c) =>
              resolveLabel(c.label, lang, fallbackLang).toLowerCase().includes(trimmedFilter),
            )
          })
        return { ...g, items }
      })
      .filter((g) => g.items.length > 0)
  }, [layout, trimmedFilter, lang, fallbackLang])

  // Build collapsed record from persisted collapsedGroups array + defaults
  const collapsed = useMemo(() => {
    const record: Record<string, boolean> = {}
    layout.forEach((g) => {
      if (g.defaultCollapsed) record[g.id] = true
    })
    if (collapsedGroups.length > 0) {
      layout.forEach((g) => {
        record[g.id] = false
      })
      collapsedGroups.forEach((id) => {
        record[id] = true
      })
    }
    return record
  }, [layout, collapsedGroups])

  const toggleGroup = useCallback(
    (groupId: string) => {
      const isCurrentlyCollapsed = collapsed[groupId] ?? false
      let newCollapsed: string[]
      if (isCurrentlyCollapsed) {
        newCollapsed = collapsedGroups.filter((id) => id !== groupId)
      } else {
        newCollapsed = [...collapsedGroups, groupId]
      }
      setCollapsedGroups(newCollapsed)
    },
    [collapsed, collapsedGroups, setCollapsedGroups],
  )

  // Default Customize link rendered both as the standalone footer and
  // as the fallback for navFooterSlot if its import fails.
  const customizeLink = (
    <Link href="/admin/nav-customizer" prefetch={false} className="admin-nav__customize-link">
      <NavIcon name="settings" size={12} />
      {t('plugin-admin-nav:customize')}
    </Link>
  )

  // ── Collapsed rail (icons only, badges/dots preserved as overlays) ──
  const renderRail = () => (
    <>
      <button
        type="button"
        className="admin-nav__rail-expand"
        onClick={toggleRail}
        aria-label={t('plugin-admin-nav:expandSidebar')}
        title={t('plugin-admin-nav:expandSidebar')}
      >
        <ChevronIcon direction="right" />
      </button>

      <Link
        href="/admin"
        prefetch={false}
        className={`admin-nav__rail-item admin-nav__rail-item--dash${isDashboard ? ' admin-nav__rail-item--active' : ''}`}
        title={t('plugin-admin-nav:dashboard')}
        aria-label={t('plugin-admin-nav:dashboard')}
      >
        <NavIcon name="home" size={19} />
      </Link>

      {visibleGroups.map((group, gi) => (
        <React.Fragment key={group.id}>
          {group.items.map((item) => {
            const isActive = isItemActive(item, fullUrl, pathname)
            const hasActiveChild = item.children?.some((child) => fullUrl === child.href) ?? false
            const active = isActive || hasActiveChild
            const hasChildBadge =
              item.children?.some((c) => (badges.children[c.id] ?? 0) > 0) ?? false
            const hasGroupBadge = (badges.groups[group.id] ?? 0) > 0
            const label = resolveLabel(item.label, lang, fallbackLang)

            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={false}
                className={`admin-nav__rail-item${active ? ' admin-nav__rail-item--active' : ''}`}
                title={label}
                aria-label={label}
              >
                <NavIcon name={item.icon} size={19} />
                {item.live ? (
                  <span
                    className="admin-nav__rail-dot admin-nav__rail-dot--green"
                    aria-hidden="true"
                  />
                ) : hasChildBadge || hasGroupBadge ? (
                  <span
                    className="admin-nav__rail-dot admin-nav__rail-dot--amber"
                    aria-hidden="true"
                  />
                ) : null}
              </Link>
            )
          })}
          {gi < visibleGroups.length - 1 && (
            <span className="admin-nav__rail-divider" aria-hidden="true" />
          )}
        </React.Fragment>
      ))}

      {/* User avatar pinned to the bottom (compact, keeps availability popover) */}
      <NavUserProfile compact />
    </>
  )

  // ── Full sidebar (288px) ──
  const renderFull = () => (
    <>
      {/* Top filter / jump-to */}
      <div className="admin-nav__jumpto">
        <span className="admin-nav__jumpto-icon" aria-hidden="true">
          <NavIcon name="search" size={15} strokeWidth={2} />
        </span>
        <input
          ref={filterInputRef}
          type="search"
          className="admin-nav__jumpto-input"
          placeholder={t('plugin-admin-nav:jumpTo')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={onFilterKeyDown}
          aria-label={t('plugin-admin-nav:jumpTo')}
        />
        <kbd className="admin-nav__jumpto-kbd" aria-hidden="true">
          {t('plugin-admin-nav:jumpToShortcut')}
        </kbd>
      </div>

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
        const groupBadgeValue = badges.groups[group.id]

        return (
          <div key={group.id} className="admin-nav__group">
            {/* Group header */}
            <button
              type="button"
              className="admin-nav__group-title"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={!isCollapsed}
            >
              <span className="admin-nav__group-title-text">
                {resolveLabel(group.title, lang, fallbackLang)}
              </span>
              {typeof groupBadgeValue === 'number' && groupBadgeValue > 0 && (
                <span
                  className="admin-nav__group-badge"
                  aria-label={`${groupBadgeValue} pending`}
                >
                  {groupBadgeValue}
                </span>
              )}
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
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Group items */}
            {!isCollapsed &&
              group.items.map((item) => {
                const isActive = isItemActive(item, fullUrl, pathname)
                const hasActiveChild =
                  item.children?.some((child) => fullUrl === child.href) ?? false

                const itemClasses = [
                  'admin-nav__item-link',
                  isActive && 'admin-nav__item-link--active',
                  hasActiveChild && 'admin-nav__item-link--has-active-child',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <React.Fragment key={item.id}>
                    <Link href={item.href} prefetch={false} className={itemClasses}>
                      <NavIcon name={item.icon} />
                      <span className="admin-nav__item-label">
                        {resolveLabel(item.label, lang, fallbackLang)}
                      </span>
                      {item.live && (
                        <span
                          className="admin-nav__live-dot"
                          aria-label="Live"
                          title="Live"
                        />
                      )}
                    </Link>

                    {/* Child items */}
                    {item.children
                      ?.filter((c) => c.visible !== false)
                      .map((rawChild) => {
                        const child = rawChild as NavChildConfig
                        const isChildActive = fullUrl === child.href
                        const childBadge = badges.children[child.id]
                        const showBadge =
                          typeof childBadge === 'number' && childBadge > 0
                        return (
                          <Link
                            key={child.id}
                            href={child.href}
                            prefetch={false}
                            className={`admin-nav__child-link${isChildActive ? ' admin-nav__child-link--active' : ''}`}
                          >
                            <ChildIcon icon={child.icon} />
                            <span className="admin-nav__child-label">
                              {resolveLabel(child.label, lang, fallbackLang)}
                            </span>
                            {showBadge && (
                              <span
                                className={`admin-nav__child-badge${
                                  child.alert
                                    ? ' admin-nav__child-badge--alert'
                                    : ''
                                }`}
                                aria-label={`${childBadge} ${child.alert ? 'alerts' : 'items'}`}
                              >
                                {childBadge}
                              </span>
                            )}
                          </Link>
                        )
                      })}
                  </React.Fragment>
                )
              })}
          </div>
        )
      })}

      {trimmedFilter && visibleGroups.length === 0 && (
        <div className="admin-nav__no-results">{t('plugin-admin-nav:noResults')}</div>
      )}

      {/* User profile */}
      <NavUserProfile />

      {/* Footer slot or default Customize button */}
      {meta.navFooterSlot ? (
        <NavFooterSlot path={meta.navFooterSlot} fallback={customizeLink} />
      ) : (
        customizeLink
      )}
    </>
  )

  return (
    <>
      <StyleInjector />
      <div
        data-admin-nav=""
        className={`admin-nav${railCollapsed ? ' admin-nav--rail' : ''}${isLoaded ? '' : ' admin-nav--loading'}`}
      >
        {/* Header: collapse toggle + brand (hidden in rail; rail has its own expand button) */}
        {!railCollapsed && (
          <div className="admin-nav__header">
            <button
              type="button"
              className="admin-nav__collapse-btn"
              onClick={toggleRail}
              aria-label={t('plugin-admin-nav:collapseSidebar')}
              title={t('plugin-admin-nav:collapseSidebar')}
            >
              <ChevronIcon direction="left" />
            </button>
            <div className="admin-nav__brand">
              <NavLogo />
              <span className="admin-nav__wordmark">ConsilioWEB</span>
            </div>
          </div>
        )}

        {railCollapsed ? renderRail() : renderFull()}
      </div>
    </>
  )
}

export default AdminNav
