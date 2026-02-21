import { useState, useEffect, useCallback, useRef } from 'react'
import type { NavLayout, NavGroupConfig } from '../types.js'

const CACHE_KEY = 'admin-nav-layout'
const CACHE_DEFAULT_KEY = 'admin-nav-default'
const CACHE_CUSTOM_KEY = 'admin-nav-is-custom'

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

/** Write layout to sessionStorage cache */
function writeCache(layout: NavGroupConfig[], defaultNav: NavGroupConfig[], isCustom: boolean): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(layout))
    sessionStorage.setItem(CACHE_DEFAULT_KEY, JSON.stringify(defaultNav))
    sessionStorage.setItem(CACHE_CUSTOM_KEY, isCustom ? '1' : '0')
  } catch {
    // sessionStorage full or unavailable — not critical
  }
}

/** Clear the nav cache */
function clearCache(): void {
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
 * Uses sessionStorage to cache the layout, so navigation between pages
 * is instant (no loading flash). Syncs with the server in the background.
 *
 * Cache is read inside useEffect (not useState) to avoid React hydration
 * mismatch — sessionStorage is only available on the client.
 */
export function useNavPreferences(basePath: string = '/api/admin-nav'): UseNavPreferencesReturn {
  // Always start with empty state (matches server render — avoids hydration error #418)
  const [layout, setLayout] = useState<NavGroupConfig[]>([])
  const [defaultNav, setDefaultNav] = useState<NavGroupConfig[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCustom, setIsCustom] = useState(false)
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

      // Persist to cache for instant render on next navigation
      writeCache(newLayout, newDefaultNav, newIsCustom)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.warn('[admin-nav] Error loading preferences:', err)
        setIsLoaded(true)
      }
    }
  }, [basePath])

  useEffect(() => {
    // Read from cache first for instant display (client-only, post-hydration)
    const cached = readCache()
    if (cached) {
      setLayout(cached.layout)
      setDefaultNav(cached.defaultNav)
      setIsCustom(cached.isCustom)
      setIsLoaded(true)
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
