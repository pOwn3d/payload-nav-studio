import { useState, useEffect, useCallback, useRef } from 'react'
import type { NavLayout, NavGroupConfig } from '../types.js'

const CACHE_KEY = 'admin-nav-layout'
const CACHE_DEFAULT_KEY = 'admin-nav-default'
const CACHE_CUSTOM_KEY = 'admin-nav-is-custom'
const CACHE_COLLAPSED_KEY = 'admin-nav-collapsed'
const CACHE_VERSION_KEY = 'admin-nav-version'
const CACHE_TIMESTAMP_KEY = 'admin-nav-cache-ts'
const CACHE_TTL_MS = 60_000 // 60 seconds

// ── Module-level cache ──
// These variables live in the JS module scope and survive React component
// re-mounts during SPA navigation. On the server they are always null,
// which matches the empty initial state → no hydration mismatch.
// After the first successful fetch on the client, they are populated,
// so subsequent mounts get instant data without waiting for useEffect.
let _cachedLayout: NavGroupConfig[] | null = null
let _cachedDefaultNav: NavGroupConfig[] | null = null
let _cachedIsCustom: boolean | null = null
let _cachedCollapsedGroups: string[] | null = null
let _cachedNavVersion: number | null = null

interface UseNavPreferencesReturn {
  /** Current nav layout (user's custom or default) */
  layout: NavGroupConfig[]
  /** Whether the layout is loaded */
  isLoaded: boolean
  /** Whether a save/reset operation is in progress */
  isSaving: boolean
  /** Whether the current layout differs from default */
  isCustom: boolean
  /** Save the current layout to the server */
  save: (groups: NavGroupConfig[]) => Promise<boolean>
  /** Reset to default layout */
  reset: () => Promise<boolean>
  /** Reload preferences from server */
  reload: () => Promise<void>
  /** Collapsed group IDs persisted across sessions */
  collapsedGroups: string[]
  /** Update collapsed groups (debounced save to server) */
  setCollapsedGroups: (groups: string[]) => void
}

/** Read cached layout from sessionStorage */
function readCache(): { layout: NavGroupConfig[]; defaultNav: NavGroupConfig[]; isCustom: boolean; collapsedGroups: string[]; navVersion: number | null } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const layout = JSON.parse(raw)
    const defaultRaw = sessionStorage.getItem(CACHE_DEFAULT_KEY)
    const defaultNav = defaultRaw ? JSON.parse(defaultRaw) : []
    const isCustom = sessionStorage.getItem(CACHE_CUSTOM_KEY) === '1'
    const collapsedRaw = sessionStorage.getItem(CACHE_COLLAPSED_KEY)
    const collapsedGroups = collapsedRaw ? JSON.parse(collapsedRaw) : []
    const versionRaw = sessionStorage.getItem(CACHE_VERSION_KEY)
    const navVersion = versionRaw ? Number(versionRaw) : null
    return { layout, defaultNav, isCustom, collapsedGroups, navVersion }
  } catch {
    return null
  }
}

/** Write layout to both module cache and sessionStorage */
function writeCache(layout: NavGroupConfig[], defaultNav: NavGroupConfig[], isCustom: boolean, navVersion?: number): void {
  // Module cache (instant on re-mount)
  _cachedLayout = layout
  _cachedDefaultNav = defaultNav
  _cachedIsCustom = isCustom
  if (navVersion !== undefined) _cachedNavVersion = navVersion
  // sessionStorage (survives full page reload)
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(layout))
    sessionStorage.setItem(CACHE_DEFAULT_KEY, JSON.stringify(defaultNav))
    sessionStorage.setItem(CACHE_CUSTOM_KEY, isCustom ? '1' : '0')
    if (navVersion !== undefined) sessionStorage.setItem(CACHE_VERSION_KEY, String(navVersion))
    sessionStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()))
  } catch {
    // sessionStorage full or unavailable — module cache still works
  }
}

/** Write collapsed groups to both module cache and sessionStorage */
function writeCollapsedCache(collapsedGroups: string[]): void {
  _cachedCollapsedGroups = collapsedGroups
  try {
    sessionStorage.setItem(CACHE_COLLAPSED_KEY, JSON.stringify(collapsedGroups))
  } catch {
    // ignore
  }
}

/** Clear both module cache and sessionStorage */
function clearCache(): void {
  _cachedLayout = null
  _cachedDefaultNav = null
  _cachedIsCustom = null
  _cachedCollapsedGroups = null
  _cachedNavVersion = null
  try {
    sessionStorage.removeItem(CACHE_KEY)
    sessionStorage.removeItem(CACHE_DEFAULT_KEY)
    sessionStorage.removeItem(CACHE_CUSTOM_KEY)
    sessionStorage.removeItem(CACHE_COLLAPSED_KEY)
    sessionStorage.removeItem(CACHE_VERSION_KEY)
    sessionStorage.removeItem(CACHE_TIMESTAMP_KEY)
  } catch {
    // ignore
  }
}

/** Inputs of the stored-layout decision, isolated from any I/O. */
export interface ResolveLayoutArgs {
  /** Version recorded alongside the stored layout (`null` when absent). */
  storedVersion: number | null
  /** Fingerprint of the nav currently served (`undefined` when unknown). */
  currentVersion: number | undefined
  /** Groups read back from the stored preferences (`null` when there are none). */
  storedGroups: NavGroupConfig[] | null
  /** Nav to fall back to. */
  defaultNav: NavGroupConfig[]
}

export interface ResolvedLayout {
  layout: NavGroupConfig[]
  isCustom: boolean
  /** True when the stored preferences are stale and must be deleted server-side. */
  discardStored: boolean
}

/**
 * Decide which layout to display, and whether the stored one is stale.
 *
 * Pure on purpose: the migration deletes the only thing this plugin persists,
 * so the decision must be readable and checkable on its own. The four cases:
 * current version unknown → never discard; no stored version → keep the stored
 * layout; versions equal → keep; versions differ → discard.
 */
export function resolveLayout({
  storedVersion,
  currentVersion,
  storedGroups,
  defaultNav,
}: ResolveLayoutArgs): ResolvedLayout {
  const versionMismatch =
    currentVersion !== undefined && storedVersion !== null && storedVersion !== currentVersion

  if (versionMismatch) {
    return { layout: defaultNav, isCustom: false, discardStored: true }
  }
  if (storedGroups) {
    return { layout: storedGroups, isCustom: true, discardStored: false }
  }
  return { layout: defaultNav, isCustom: false, discardStored: false }
}

/**
 * Hook to fetch, save, and reset nav preferences for the current user.
 * Falls back to the default nav from the plugin config endpoint.
 *
 * Uses a two-tier cache for instant rendering:
 * 1. Module-level variables — survive component re-mounts during SPA
 *    navigation (the common case). Available immediately in useState.
 * 2. sessionStorage — survives full page reloads. Read in useEffect
 *    (post-hydration) to avoid React hydration mismatch #418.
 *
 * On the server, module vars are null → layout=[] → matches client
 * first render. After the first fetch, module vars are populated →
 * subsequent mounts get instant data (no flash).
 */
export function useNavPreferences(basePath: string = '/api/admin-nav'): UseNavPreferencesReturn {
  // Use module cache if available (SPA re-mount), otherwise empty (SSR-safe)
  const [layout, setLayout] = useState<NavGroupConfig[]>(_cachedLayout ?? [])
  const [defaultNav, setDefaultNav] = useState<NavGroupConfig[]>(_cachedDefaultNav ?? [])
  const [isLoaded, setIsLoaded] = useState(_cachedLayout !== null)
  const [isSaving, setIsSaving] = useState(false)
  const [isCustom, setIsCustom] = useState(_cachedIsCustom ?? false)
  const [collapsedGroups, setCollapsedGroupsState] = useState<string[]>(_cachedCollapsedGroups ?? [])
  const abortRef = useRef<AbortController | null>(null)
  const collapsedSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navVersionRef = useRef<number | undefined>(_cachedNavVersion ?? undefined)

  const loadPreferences = useCallback(async () => {
    // Abort any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Fetch default nav and user preferences in parallel
      const [defaultRes, prefsRes] = await Promise.all([
        fetch(`${basePath}/default-nav`, { signal: controller.signal }),
        fetch(`${basePath}/preferences`, { signal: controller.signal }),
      ])

      if (!defaultRes.ok || !prefsRes.ok) {
        console.warn('[admin-nav] Failed to fetch nav config')
        setIsLoaded(true)
        return
      }

      const defaultData = await defaultRes.json()
      const prefsData = await prefsRes.json()

      const newDefaultNav = defaultData.defaultNav || []
      const currentNavVersion: number | undefined = defaultData.navVersion
      navVersionRef.current = currentNavVersion
      setDefaultNav(newDefaultNav)

      // Version migration: if the stored preferences were saved against a
      // different nav structure (version mismatch), discard them so the
      // user gets the updated default navigation instead of a stale layout.
      const storedVersion: number | null = prefsData.version ?? null
      const storedGroups: NavGroupConfig[] | null = prefsData.navLayout?.groups ?? null
      const { layout: newLayout, isCustom: newIsCustom, discardStored } = resolveLayout({
        storedVersion,
        currentVersion: currentNavVersion,
        storedGroups,
        defaultNav: newDefaultNav,
      })

      if (discardStored) {
        console.info('[admin-nav] Nav structure changed (stored version %d, current %d) — resetting preferences to defaults', storedVersion, currentNavVersion)
        // Fire-and-forget: delete stale preferences on the server
        fetch(`${basePath}/preferences`, { method: 'DELETE' }).catch(() => {})
      }

      // Restore collapsed groups from server preferences (skip if version mismatch — groups may no longer exist)
      if (!discardStored) {
        const serverCollapsed: string[] = prefsData.collapsedGroups ?? []
        if (serverCollapsed.length > 0) {
          setCollapsedGroupsState(serverCollapsed)
          writeCollapsedCache(serverCollapsed)
        }
      }

      setLayout(newLayout)
      setIsCustom(newIsCustom)
      setIsLoaded(true)

      // Persist to both caches for instant render
      writeCache(newLayout, newDefaultNav, newIsCustom, currentNavVersion)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.warn('[admin-nav] Error loading preferences:', err)
        setIsLoaded(true)
      }
    }
  }, [basePath])

  useEffect(() => {
    // If module cache was empty (first mount / page reload),
    // try sessionStorage as fallback (client-only, post-hydration)
    if (!_cachedLayout) {
      const cached = readCache()
      if (cached) {
        setLayout(cached.layout)
        setDefaultNav(cached.defaultNav)
        setIsCustom(cached.isCustom)
        setCollapsedGroupsState(cached.collapsedGroups)
        setIsLoaded(true)
        // Populate module cache for future re-mounts
        _cachedLayout = cached.layout
        _cachedDefaultNav = cached.defaultNav
        _cachedIsCustom = cached.isCustom
        _cachedCollapsedGroups = cached.collapsedGroups
        _cachedNavVersion = cached.navVersion
        navVersionRef.current = cached.navVersion ?? undefined
      }
    }

    // Skip server fetch if cache is fresh (< TTL)
    try {
      const tsRaw = sessionStorage.getItem(CACHE_TIMESTAMP_KEY)
      if (tsRaw && _cachedLayout) {
        const elapsed = Date.now() - Number(tsRaw)
        if (elapsed < CACHE_TTL_MS) {
          // Cache is fresh, skip fetch
          return () => { abortRef.current?.abort() }
        }
      }
    } catch {
      // sessionStorage unavailable — proceed to fetch
    }

    // Fetch in background to stay in sync with server
    loadPreferences()
    return () => { abortRef.current?.abort() }
  }, [loadPreferences])

  const save = useCallback(async (groups: NavGroupConfig[]): Promise<boolean> => {
    setIsSaving(true)
    try {
      // Saving with a guessed version (the old `?? 1`) was destructive: the next
      // load compared 1 against the real nav fingerprint, called that a
      // migration and deleted the layout we had just stored. The version is
      // unknown whenever the fresh-cache short-circuit skipped the fetch, so
      // fetch it once rather than guessing — and give up rather than write it wrong.
      let version = navVersionRef.current
      if (version === undefined) {
        try {
          const metaRes = await fetch(`${basePath}/default-nav`)
          if (metaRes.ok) {
            const metaData = await metaRes.json()
            if (typeof metaData?.navVersion === 'number') {
              version = metaData.navVersion
              navVersionRef.current = version
            }
          }
        } catch {
          // handled below
        }
      }
      if (version === undefined) {
        console.warn('[admin-nav] Cannot save layout: nav version unknown (server unreachable?)')
        return false
      }

      const navLayout: NavLayout = { groups, version }
      const res = await fetch(`${basePath}/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ navLayout }),
      })

      if (res.ok) {
        setLayout(groups)
        setIsCustom(true)
        // Update cache immediately — including the version, otherwise the next
        // mount reads back a cache with no version and guesses again.
        writeCache(groups, defaultNav, true, version)
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setIsSaving(false)
    }
  }, [basePath, defaultNav])

  const reset = useCallback(async (): Promise<boolean> => {
    setIsSaving(true)
    try {
      const res = await fetch(`${basePath}/preferences`, { method: 'DELETE' })
      if (res.ok) {
        setLayout(defaultNav)
        setIsCustom(false)
        // Update cache with defaults, version included (see save()).
        writeCache(defaultNav, defaultNav, false, navVersionRef.current)
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setIsSaving(false)
    }
  }, [basePath, defaultNav])

  const setCollapsedGroups = useCallback((groups: string[]) => {
    setCollapsedGroupsState(groups)
    writeCollapsedCache(groups)

    // Debounced save to server (500ms)
    if (collapsedSaveTimerRef.current) {
      clearTimeout(collapsedSaveTimerRef.current)
    }
    collapsedSaveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`${basePath}/preferences`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collapsedGroups: groups }),
        })
      } catch {
        // Silent fail — cache still works
      }
    }, 500)
  }, [basePath])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    const timerRef = collapsedSaveTimerRef
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return {
    layout,
    isLoaded,
    isSaving,
    isCustom,
    save,
    reset,
    reload: loadPreferences,
    collapsedGroups,
    setCollapsedGroups,
  }
}
