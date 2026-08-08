'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { usePluginTranslation } from '../hooks/usePluginTranslation.js'

type Availability = 'available' | 'busy' | 'away' | 'offline'

const STATUS_TONE: Record<Availability, 'success' | 'warning' | 'elevation-400'> = {
  available: 'success',
  busy: 'warning',
  away: 'elevation-400',
  offline: 'elevation-400',
}

/** Type guard — narrows a string to the Availability union */
function isAvailability(v: unknown): v is Availability {
  return v === 'available' || v === 'busy' || v === 'away' || v === 'offline'
}

/**
 * NavUserProfile — Avatar + name + availability indicator for the logged-in user.
 *
 * Reads the user from `useAuth()`. If `user.availability` is set, displays
 * a colored dot + label and lets the user change it via a popover. The
 * change is PATCHed to `/api/{userCollectionSlug}/${user.id}` with
 * `{ availability: newValue }`.
 *
 * If `availability` is missing on the user object, only the name + avatar
 * are rendered (no status row, no popover).
 */
export const NavUserProfile: React.FC<{ userCollectionSlug?: string; compact?: boolean }> = ({
  userCollectionSlug = 'users',
  compact = false,
}) => {
  const { user, setUser } = useAuth<{
    id: string | number
    email?: string
    name?: string
    firstName?: string
    lastName?: string
    availability?: Availability | string
    [k: string]: unknown
  }>()
  const { t } = usePluginTranslation()

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Close popover on outside click / Esc
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  const displayName: string =
    (user.name as string | undefined) ||
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    (user.email as string | undefined) ||
    'User'

  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const rawAvail = user.availability
  const availability: Availability | null = isAvailability(rawAvail) ? rawAvail : null

  async function setAvailability(next: Availability) {
    if (!user) return
    setSaving(true)
    try {
      const res = await fetch(`/api/${userCollectionSlug}/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability: next }),
      })
      if (res.ok) {
        // Optimistic local update via setUser to keep useAuth state in sync
        setUser({ ...user, availability: next } as never)
      }
    } catch {
      // Silent fail — UI will re-sync on next auth refresh
    } finally {
      setSaving(false)
      setOpen(false)
    }
  }

  const statuses: Availability[] = ['available', 'busy', 'away', 'offline']
  const canOpen = availability !== null

  return (
    <div className={`admin-nav__user${compact ? ' admin-nav__user--compact' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={`admin-nav__user-trigger${compact ? ' admin-nav__user-trigger--compact' : ''}`}
        onClick={() => canOpen && setOpen((v) => !v)}
        aria-haspopup={canOpen ? 'menu' : undefined}
        aria-expanded={canOpen ? open : undefined}
        aria-label={displayName}
        title={compact ? displayName : undefined}
        disabled={!canOpen}
      >
        <span className="admin-nav__user-avatar" aria-hidden="true">
          {initials || '?'}
          {compact && availability && (
            <span
              className={`admin-nav__user-avatar-dot admin-nav__user-status-dot--${STATUS_TONE[availability]}`}
              aria-hidden="true"
            />
          )}
        </span>
        {!compact && (
          <span className="admin-nav__user-info">
            <span className="admin-nav__user-name">{displayName}</span>
            {availability && (
              <span className="admin-nav__user-status">
                <span
                  className={`admin-nav__user-status-dot admin-nav__user-status-dot--${STATUS_TONE[availability]}`}
                  aria-hidden="true"
                />
                {t(`plugin-admin-nav:${availability}` as never)}
              </span>
            )}
          </span>
        )}
      </button>

      {open && availability && (
        <div className="admin-nav__user-popover" role="menu">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={s === availability}
              className={`admin-nav__user-popover-item${
                s === availability ? ' admin-nav__user-popover-item--active' : ''
              }`}
              onClick={() => setAvailability(s)}
              disabled={saving}
            >
              <span
                className={`admin-nav__user-status-dot admin-nav__user-status-dot--${STATUS_TONE[s]}`}
                aria-hidden="true"
              />
              {t(`plugin-admin-nav:${s}` as never)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default NavUserProfile
