import { useState, useEffect, useCallback, useRef } from 'react'
import type { NavLayout, NavGroupConfig } from '../types.js'

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

/**
 * Hook to fetch, save, and reset nav preferences for the current user.
 * Falls back to the default nav from the plugin config endpoint.
 */
export function useNavPreferences(basePath: string = '/api/admin-nav'): UseNavPreferencesReturn {
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

      setDefaultNav(defaultData.defaultNav || [])

      if (prefsData.navLayout && prefsData.navLayout.groups) {
        setLayout(prefsData.navLayout.groups)
        setIsCustom(true)
      } else {
        setLayout(defaultData.defaultNav || [])
        setIsCustom(false)
      }

      setIsLoaded(true)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.warn('[admin-nav] Error loading preferences:', err)
        setIsLoaded(true)
      }
    }
  }, [basePath])

  useEffect(() => {
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
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setIsSaving(false)
    }
  }, [basePath])

  const reset = useCallback(async (): Promise<boolean> => {
    setIsSaving(true)
    try {
      const res = await fetch(`${basePath}/preferences`, { method: 'DELETE' })
      if (res.ok) {
        setLayout(defaultNav)
        setIsCustom(false)
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
