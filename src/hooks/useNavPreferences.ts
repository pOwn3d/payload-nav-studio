import { useState, useEffect, useCallback, useRef } from 'react'
import type { NavLayout, NavGroupConfig } from '../types.js'
import { sanitizeNavGroups } from '../utils/navLayoutValidation.js'

const CACHE_KEY = 'admin-nav-layout'
const CACHE_DEFAULT_KEY = 'admin-nav-default'
const CACHE_CUSTOM_KEY = 'admin-nav-is-custom'
const CACHE_COLLAPSED_KEY = 'admin-nav-collapsed'
const CACHE_VERSION_KEY = 'admin-nav-version'
const CACHE_TIMESTAMP_KEY = 'admin-nav-cache-ts'
const CACHE_OWNER_KEY = 'admin-nav-owner'
const CACHE_TTL_MS = 60_000 // 60 seconds

/**
 * Identity the cache belongs to, or `null` when the viewer is unknown.
 *
 * Neither tier of the cache is scoped to a session: sessionStorage lives as
 * long as the tab and the module variables as long as the JS context, while a
 * Payload logout followed by a login is a same-tab client-side navigation. The
 * next viewer therefore inherited the previous one's sidebar *and* their
 * `defaultNav` — which `filterNavByPermissions` had already trimmed to what
 * that first user was allowed to see — and the 60 s freshness short-circuit
 * meant no fetch went out to correct it. Stamping the owner on the cache and
 * refusing to read one that belongs to somebody else is what makes the
 * permission filtering hold across a re-login.
 *
 * An unknown viewer (no auth context, or a caller that passes nothing) yields
 * `null`, which reads and writes nothing: the hook simply fetches.
 */
export function cacheOwnerKey(
  user: { collection?: unknown; id?: unknown } | null | undefined,
): string | null {
  if (!user || user.id === undefined || user.id === null || user.id === '') return null
  const collection = typeof user.collection === 'string' ? user.collection : ''
  return `${collection}:${String(user.id)}`
}

/** The slice of `Storage` this module uses — injectable so it can be tested. */
export interface NavCacheStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

/** `sessionStorage` when it exists and is reachable, `null` otherwise (SSR, blocked cookies). */
function defaultStorage(): NavCacheStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

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
/** Viewer the module cache above was filled for (see `cacheOwnerKey`). */
let _cachedOwner: string | null = null

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

export interface CachedNavPreferences {
  layout: NavGroupConfig[]
  defaultNav: NavGroupConfig[]
  isCustom: boolean
  collapsedGroups: string[]
  navVersion: number | null
}

/**
 * Read the cached layout, for this viewer only, and re-check what comes out.
 *
 * The cache was a hole straight through the read-side defense: the fetch is
 * the only place `sanitizeNavGroups` used to run, and the freshness
 * short-circuit below skips the fetch for a full minute. A layout poisoned
 * before the fix, loaded once by the victim, was written to sessionStorage and
 * then handed back verbatim to `<Link href>` on every reload of that tab — the
 * exact case the sanitization was added for. Whatever the cache holds is
 * therefore filtered again on the way out, and dropped when nothing survives.
 */
export function readCache(
  ownerKey: string | null,
  storage: NavCacheStorage | null = defaultStorage(),
): CachedNavPreferences | null {
  if (!storage || !ownerKey) return null
  try {
    if (storage.getItem(CACHE_OWNER_KEY) !== ownerKey) return null
    const raw = storage.getItem(CACHE_KEY)
    if (!raw) return null
    const layout = sanitizeNavGroups(JSON.parse(raw))
    if (!layout) return null
    const defaultRaw = storage.getItem(CACHE_DEFAULT_KEY)
    const defaultNav = defaultRaw ? sanitizeNavGroups(JSON.parse(defaultRaw)) ?? [] : []
    const isCustom = storage.getItem(CACHE_CUSTOM_KEY) === '1'
    const collapsedRaw = storage.getItem(CACHE_COLLAPSED_KEY)
    const parsedCollapsed: unknown = collapsedRaw ? JSON.parse(collapsedRaw) : []
    const collapsedGroups = Array.isArray(parsedCollapsed)
      ? parsedCollapsed.filter((id): id is string => typeof id === 'string')
      : []
    const versionRaw = storage.getItem(CACHE_VERSION_KEY)
    const navVersion = versionRaw ? Number(versionRaw) : null
    return { layout, defaultNav, isCustom, collapsedGroups, navVersion }
  } catch {
    return null
  }
}

/** Whether the freshness short-circuit may skip the fetch for this viewer. */
export function isCacheFresh(
  ownerKey: string | null,
  now: number,
  storage: NavCacheStorage | null = defaultStorage(),
): boolean {
  if (!storage || !ownerKey) return false
  try {
    if (storage.getItem(CACHE_OWNER_KEY) !== ownerKey) return false
    const tsRaw = storage.getItem(CACHE_TIMESTAMP_KEY)
    if (!tsRaw) return false
    const elapsed = now - Number(tsRaw)
    return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < CACHE_TTL_MS
  } catch {
    return false
  }
}

/**
 * Write layout to both module cache and sessionStorage.
 *
 * Nothing is cached for an unknown viewer: an entry with no owner could not be
 * refused to the next one.
 */
function writeCache(
  ownerKey: string | null,
  layout: NavGroupConfig[],
  defaultNav: NavGroupConfig[],
  isCustom: boolean,
  navVersion?: number,
): void {
  if (!ownerKey) return
  // Module cache (instant on re-mount)
  _cachedOwner = ownerKey
  _cachedLayout = layout
  _cachedDefaultNav = defaultNav
  _cachedIsCustom = isCustom
  if (navVersion !== undefined) _cachedNavVersion = navVersion
  // sessionStorage (survives full page reload)
  const storage = defaultStorage()
  if (!storage) return
  try {
    storage.setItem(CACHE_OWNER_KEY, ownerKey)
    storage.setItem(CACHE_KEY, JSON.stringify(layout))
    storage.setItem(CACHE_DEFAULT_KEY, JSON.stringify(defaultNav))
    storage.setItem(CACHE_CUSTOM_KEY, isCustom ? '1' : '0')
    if (navVersion !== undefined) storage.setItem(CACHE_VERSION_KEY, String(navVersion))
    storage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()))
  } catch {
    // sessionStorage full or unavailable — module cache still works
  }
}

/** Write collapsed groups to both module cache and sessionStorage */
function writeCollapsedCache(ownerKey: string | null, collapsedGroups: string[]): void {
  if (!ownerKey) return
  _cachedCollapsedGroups = collapsedGroups
  const storage = defaultStorage()
  if (!storage) return
  try {
    storage.setItem(CACHE_COLLAPSED_KEY, JSON.stringify(collapsedGroups))
  } catch {
    // ignore
  }
}

/** Clear both module cache and sessionStorage */
function clearCache(): void {
  _cachedOwner = null
  _cachedLayout = null
  _cachedDefaultNav = null
  _cachedIsCustom = null
  _cachedCollapsedGroups = null
  _cachedNavVersion = null
  const storage = defaultStorage()
  if (!storage) return
  try {
    storage.removeItem(CACHE_OWNER_KEY)
    storage.removeItem(CACHE_KEY)
    storage.removeItem(CACHE_DEFAULT_KEY)
    storage.removeItem(CACHE_CUSTOM_KEY)
    storage.removeItem(CACHE_COLLAPSED_KEY)
    storage.removeItem(CACHE_VERSION_KEY)
    storage.removeItem(CACHE_TIMESTAMP_KEY)
  } catch {
    // ignore
  }
}

/** The module cache, but only when it was filled for this very viewer. */
function moduleCacheOwnedBy(ownerKey: string | null): NavGroupConfig[] | null {
  if (!ownerKey || _cachedOwner !== ownerKey) return null
  return _cachedLayout
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
/**
 * Default endpoint prefix, matching `endpointBasePath`'s own default.
 * Exported so the components and the hook cannot drift apart.
 */
export const DEFAULT_BASE_PATH = '/api/admin-nav'

export function useNavPreferences(
  basePath: string = DEFAULT_BASE_PATH,
  /**
   * Viewer the cache belongs to, built with `cacheOwnerKey(user)` from
   * `useAuth()`. Left out — or `null` while the viewer is unknown — the hook
   * caches nothing and always fetches, rather than risk serving one user's
   * permission-filtered nav to the next.
   */
  ownerKey: string | null = null,
): UseNavPreferencesReturn {
  // Use module cache if available (SPA re-mount), otherwise empty (SSR-safe)
  const ownedLayout = moduleCacheOwnedBy(ownerKey)
  const [layout, setLayout] = useState<NavGroupConfig[]>(ownedLayout ?? [])
  const [defaultNav, setDefaultNav] = useState<NavGroupConfig[]>(
    ownedLayout ? _cachedDefaultNav ?? [] : [],
  )
  const [isLoaded, setIsLoaded] = useState(ownedLayout !== null)
  const [isSaving, setIsSaving] = useState(false)
  const [isCustom, setIsCustom] = useState(ownedLayout ? _cachedIsCustom ?? false : false)
  const [collapsedGroups, setCollapsedGroupsState] = useState<string[]>(
    ownedLayout ? _cachedCollapsedGroups ?? [] : [],
  )
  const abortRef = useRef<AbortController | null>(null)
  const collapsedSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navVersionRef = useRef<number | undefined>(
    ownedLayout ? _cachedNavVersion ?? undefined : undefined,
  )

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
      // Re-check what comes back instead of trusting it because it is stored.
      // `isSafeHref` only ever ran on the write paths, so any layout that
      // reached the database another way — the collection's REST route, a
      // migration, a restored backup, a version of this plugin older than the
      // write-side validation — was rendered straight into `<Link href>` and
      // dereferenced by `item.href.includes('?')` / `icon.startsWith('#')`.
      // That is what turns a stored row into an off-site link wearing a
      // legitimate label, or into a crash of a component mounted in
      // `beforeNavLinks`, i.e. on every page of the panel.
      const rawStoredGroups: unknown = prefsData.navLayout?.groups ?? null
      const storedGroups: NavGroupConfig[] | null = sanitizeNavGroups(rawStoredGroups)
      if (Array.isArray(rawStoredGroups) && rawStoredGroups.length > 0 && !storedGroups) {
        console.warn('[admin-nav] Stored nav layout rejected (unsafe or malformed) — falling back to the default nav')
      }
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
          writeCollapsedCache(ownerKey, serverCollapsed)
        }
      }

      setLayout(newLayout)
      setIsCustom(newIsCustom)
      setIsLoaded(true)

      // Persist to both caches for instant render
      writeCache(ownerKey, newLayout, newDefaultNav, newIsCustom, currentNavVersion)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.warn('[admin-nav] Error loading preferences:', err)
        setIsLoaded(true)
      }
    }
  }, [basePath, ownerKey])

  useEffect(() => {
    // A cache filled for somebody else — the previous account in this tab —
    // must not survive into this session, not even as a stale module variable.
    // An *unknown* viewer clears nothing: nothing is served to them either, and
    // wiping on a transient `null` would drop a legitimate cache for nothing.
    if (ownerKey !== null && _cachedOwner !== null && _cachedOwner !== ownerKey) clearCache()

    // If module cache was empty (first mount / page reload),
    // try sessionStorage as fallback (client-only, post-hydration)
    if (!moduleCacheOwnedBy(ownerKey)) {
      const cached = readCache(ownerKey)
      if (cached) {
        setLayout(cached.layout)
        setDefaultNav(cached.defaultNav)
        setIsCustom(cached.isCustom)
        setCollapsedGroupsState(cached.collapsedGroups)
        setIsLoaded(true)
        // Populate module cache for future re-mounts
        _cachedOwner = ownerKey
        _cachedLayout = cached.layout
        _cachedDefaultNav = cached.defaultNav
        _cachedIsCustom = cached.isCustom
        _cachedCollapsedGroups = cached.collapsedGroups
        _cachedNavVersion = cached.navVersion
        navVersionRef.current = cached.navVersion ?? undefined
      }
    }

    // Skip server fetch if cache is fresh (< TTL) — and only if it is ours.
    if (moduleCacheOwnedBy(ownerKey) && isCacheFresh(ownerKey, Date.now())) {
      return () => { abortRef.current?.abort() }
    }

    // Fetch in background to stay in sync with server
    loadPreferences()
    return () => { abortRef.current?.abort() }
  }, [loadPreferences, ownerKey])

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
        writeCache(ownerKey, groups, defaultNav, true, version)
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setIsSaving(false)
    }
  }, [basePath, defaultNav, ownerKey])

  const reset = useCallback(async (): Promise<boolean> => {
    setIsSaving(true)
    try {
      const res = await fetch(`${basePath}/preferences`, { method: 'DELETE' })
      if (res.ok) {
        setLayout(defaultNav)
        setIsCustom(false)
        // Update cache with defaults, version included (see save()).
        writeCache(ownerKey, defaultNav, defaultNav, false, navVersionRef.current)
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setIsSaving(false)
    }
  }, [basePath, defaultNav, ownerKey])

  const setCollapsedGroups = useCallback((groups: string[]) => {
    setCollapsedGroupsState(groups)
    writeCollapsedCache(ownerKey, groups)

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
  }, [basePath, ownerKey])

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
