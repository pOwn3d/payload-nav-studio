import { useState, useEffect, useCallback, useRef } from 'react'
import type { NavLayout, NavGroupConfig } from '../types.js'

const CACHE_KEY = 'admin-nav-layout'
const CACHE_DEFAULT_KEY = 'admin-nav-default'
const CACHE_CUSTOM_KEY = 'admin-nav-is-custom'

// ── Module-level cache ──
// These variables live in the JS module scope and survive React component
// re-mounts during SPA navigation. On the server they are always null,
// which matches the empty initial state → no hydration mismatch.
// After the first successful fetch on the client, they are populated,
// so subsequent mounts get instant data without waiting for useEffect.
let _cachedLayout: NavGroupConfig[] | null = null
let _cachedDefaultNav: NavGroupConfig[] | null = null
let _cachedIsCustom: boolean | null = null

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
}

/** Read cached layout from sessionStorage */
function readCache(): { layout: NavGroupConfig[]; defaultNav: NavGroupConfig[]; isCustom: boolean } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const layout = JSON.parse(raw)
    const defaultRaw = sessionStorage.getItem(CACHE_DEFAULT_KEY)
    const defaultNav = defaultRaw ? JSON.parse(defaultRaw) : []
    const isCustom = sessionStorage.getItem(CACHE_CUSTOM_KEY) === '1'
    return { layout, defaultNav, isCustom }
  } catch {
    return null
  }
}

/** Write layout to both module cache and sessionStorage */
function writeCache(layout: NavGroupConfig[], defaultNav: NavGroupConfig[], isCustom: boolean): void {
  // Module cache (instant on re-mount)
  _cachedLayout = layout
  _cachedDefaultNav = defaultNav
  _cachedIsCustom = isCustom
  // sessionStorage (survives full page reload)
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(layout))
    sessionStorage.setItem(CACHE_DEFAULT_KEY, JSON.stringify(defaultNav))
    sessionStorage.setItem(CACHE_CUSTOM_KEY, isCustom ? '1' : '0')
  } catch {
    // sessionStorage full or unavailable — module cache still works
  }
}

/** Clear both module cache and sessionStorage */
function clearCache(): void {
  _cachedLayout = null
  _cachedDefaultNav = null
  _cachedIsCustom = null
  try {
    sessionStorage.removeItem(CACHE_KEY)
    sessionStorage.removeItem(CACHE_DEFAULT_KEY)
    sessionStorage.removeItem(CACHE_CUSTOM_KEY)
  } catch {
    // ignore
  }
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
  const abortRef = useRef<AbortController | null>(null)

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
      setDefaultNav(newDefaultNav)

      let newLayout: NavGroupConfig[]
      let newIsCustom: boolean

      if (prefsData.navLayout && prefsData.navLayout.groups) {
        newLayout = prefsData.navLayout.groups
        newIsCustom = true
      } else {
        newLayout = newDefaultNav
        newIsCustom = false
      }

      setLayout(newLayout)
      setIsCustom(newIsCustom)
      setIsLoaded(true)

      // Persist to both caches for instant render
      writeCache(newLayout, newDefaultNav, newIsCustom)
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
        setIsLoaded(true)
        // Populate module cache for future re-mounts
        _cachedLayout = cached.layout
        _cachedDefaultNav = cached.defaultNav
        _cachedIsCustom = cached.isCustom
      }
    }

    // Always fetch in background to stay in sync with server
    loadPreferences()
    return () => { abortRef.current?.abort() }
  }, [loadPreferences])

  const save = useCallback(async (groups: NavGroupConfig[]): Promise<boolean> => {
    setIsSaving(true)
    try {
      const navLayout: NavLayout = { groups, version: 1 }
      const res = await fetch(`${basePath}/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ navLayout }),
      })

      if (res.ok) {
        setLayout(groups)
        setIsCustom(true)
        // Update cache immediately
        writeCache(groups, defaultNav, true)
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
        // Update cache with defaults
        writeCache(defaultNav, defaultNav, false)
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setIsSaving(false)
    }
  }, [basePath, defaultNav])

  return {
    layout,
    isLoaded,
    isSaving,
    isCustom,
    save,
    reset,
    reload: loadPreferences,
  }
}
