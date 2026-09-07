/**
 * Payload CMS Admin Nav Plugin.
 *
 * Adds a fully customizable sidebar navigation to the Payload admin UI:
 * - Per-user navigation preferences stored in the database
 * - Drag & drop reordering (groups + items) via @dnd-kit
 * - Show/hide items, create custom groups, edit labels/icons
 * - API endpoints for preferences CRUD
 * - Admin view at /admin/nav-customizer
 * - i18n support (FR/EN, extensible)
 * - Auto-discovery: generates nav from collections/globals/views if no defaultNav
 *
 * Usage:
 *   import { adminNavPlugin } from '@consilioweb/payload-admin-nav'
 *
 *   // Minimal — auto-discovers nav from Payload config
 *   export default buildConfig({
 *     plugins: [adminNavPlugin()],
 *   })
 *
 *   // Custom — provide your own nav layout
 *   export default buildConfig({
 *     plugins: [
 *       adminNavPlugin({
 *         defaultNav: [
 *           { id: 'content', title: 'Content', items: [...] },
 *         ],
 *       }),
 *     ],
 *   })
 */

import type { Config, PayloadRequest, Plugin, SanitizedPermissions } from 'payload'
import { getAccessResults } from 'payload'
import { deepMergeSimple } from 'payload/shared'
import type { AdminNavBrandConfig, AdminNavPluginConfig, NavGroupConfig } from './types.js'
import { createAdminNavPreferencesCollection } from './collections/AdminNavPreferences.js'
import {
  createGetPreferencesHandler,
  createSavePreferencesHandler,
  createResetPreferencesHandler,
} from './endpoints/preferences.js'
import { createBadgesHandler } from './endpoints/badges.js'
import { translations } from './translations/index.js'
import { autoDiscoverNav } from './autoDiscover.js'
import { rateLimit, rateLimitResponse } from './utils/rateLimiter.js'
import { requireAdmin } from './utils/requireAdmin.js'
import { computeNavFingerprint, dedupeNavItems } from './utils.js'

/**
 * A sanitized permission entry is either `true` (unrestricted) or, when the
 * access function returned a query constraint, `{ permission: true, where }`.
 * When access is denied the key is stripped from the object entirely, so an
 * absent value means "no access" — not "unknown".
 */
function canRead(perm: unknown): boolean {
  if (perm === true) return true
  return (
    typeof perm === 'object' &&
    perm !== null &&
    (perm as { permission?: unknown }).permission === true
  )
}

/**
 * Filter navigation groups/items based on user permissions.
 * Removes collections/globals the user cannot read, preventing structure enumeration.
 *
 * Permissions come from `getAccessResults` — `payload.auth` is a plain function
 * and has no `.permissions` property, so the previous acquisition path was a
 * silent no-op that always returned the unfiltered nav.
 */
async function filterNavByPermissions(
  groups: NavGroupConfig[],
  req: PayloadRequest,
): Promise<NavGroupConfig[]> {
  let permissions: SanitizedPermissions
  try {
    permissions = await getAccessResults({ req })
  } catch {
    // If we can't compute permissions, return the full nav (fail-open for admin UX)
    return groups
  }

  const collectionPerms = permissions.collections ?? {}
  const globalPerms = permissions.globals ?? {}

  // Only entities actually registered in the config are subject to filtering;
  // hrefs pointing at custom routes are left untouched.
  const knownCollections = new Set((req.payload.config.collections ?? []).map((c) => c.slug))
  const knownGlobals = new Set((req.payload.config.globals ?? []).map((g) => g.slug))

  /** Permission predicate for a single nav entry, whatever its depth. */
  const isEntryAllowed = (rawHref: string | undefined): boolean => {
    const href = rawHref || ''

    // Check collection-based items: /admin/collections/<slug>
    const collMatch = href.match(/\/admin\/collections\/([^/?#]+)/)
    if (collMatch) {
      const slug = collMatch[1] as string
      if (knownCollections.has(slug)) {
        return canRead(collectionPerms[slug]?.read)
      }
    }

    // Check global-based items: /admin/globals/<slug>
    const globalMatch = href.match(/\/admin\/globals\/([^/?#]+)/)
    if (globalMatch) {
      const slug = globalMatch[1] as string
      if (knownGlobals.has(slug)) {
        return canRead(globalPerms[slug]?.read)
      }
    }

    // Custom views and other items: allow by default
    return true
  }

  /**
   * Filter entries and their children. Sub-items may point at collections too
   * (the customizer creates them, and the PATCH validator accepts them), so the
   * predicate has to run at every depth: filtering only the first level left
   * children of unreadable collections visible in the sidebar.
   */
  const filterEntries = <T extends { href?: string; children?: unknown }>(entries: T[]): T[] => {
    const kept: T[] = []

    for (const entry of entries) {
      if (!isEntryAllowed(entry.href)) continue

      const children = entry.children
      if (Array.isArray(children) && children.length > 0) {
        const filteredChildren = filterEntries(children as { href?: string; children?: unknown }[])
        // A parent kept only to hold now-hidden children disappears with them.
        if (filteredChildren.length === 0 && !(entry.href || '').trim()) continue
        kept.push({ ...entry, children: filteredChildren } as unknown as T)
      } else {
        kept.push(entry)
      }
    }

    return kept
  }

  const filtered: NavGroupConfig[] = []

  for (const group of groups) {
    const filteredItems = filterEntries(group.items ?? [])

    // Only include groups that have at least one visible item
    if (filteredItems.length > 0) {
      filtered.push({ ...group, items: filteredItems })
    }
  }

  return filtered
}

/** Resolved branding shipped to the client by `/default-nav`. */
interface ResolvedBrand {
  wordmark: string | null
  logoPath: string | null
}

/** Suffix Payload's own sanitization injects when the host declares none. */
const PAYLOAD_DEFAULT_TITLE_SUFFIX = '- Payload'

/**
 * Minimal shape required to read the host identity. Satisfied both by the raw
 * `Config` and by the final `SanitizedConfig` reachable at `req.payload.config`.
 */
interface BrandSourceConfig {
  admin?: {
    meta?: {
      title?: unknown
      titleSuffix?: unknown
    }
  }
}

/**
 * Resolve the sidebar header branding.
 *
 * The plugin used to hardcode its author's wordmark in every consumer's admin
 * panel. It now falls back to the host's own identity and displays nothing when
 * the host declares none.
 *
 * Resolved per request against the final `SanitizedConfig`, never against the
 * config captured while the plugin is being applied: Payload sanitizes the
 * config afterwards, and plugins registered after admin-nav (admin-ui-pro
 * branding, admin-theme, ...) declare their `admin.meta` later still.
 */
function resolveBrand(
  brand: AdminNavBrandConfig | undefined,
  config: BrandSourceConfig,
): ResolvedBrand {
  let wordmark: string | null
  if (brand?.wordmark === false) {
    wordmark = null
  } else if (typeof brand?.wordmark === 'string' && brand.wordmark.trim()) {
    wordmark = brand.wordmark.trim()
  } else {
    const meta = config.admin?.meta
    const title = typeof meta?.title === 'string' ? meta.title.trim() : ''
    // titleSuffix is written as a separator + name (e.g. " - Acme").
    // The sanitized config always carries one, so the framework default has to
    // be discarded: it is Payload's identity, not the host's.
    const rawSuffix = typeof meta?.titleSuffix === 'string' ? meta.titleSuffix.trim() : ''
    const suffix =
      rawSuffix === PAYLOAD_DEFAULT_TITLE_SUFFIX
        ? ''
        : rawSuffix.replace(/^[\s\-–—|·:]+/, '').trim()
    wordmark = title || suffix || null
  }

  // The logo is only ever an explicit consumer-provided path: the host's
  // `admin.components.graphics.Logo` is resolved by Payload's server-side
  // importMap and is meaningless to the client-side dynamic import used here,
  // so defaulting to it produced a failed import on every mount.
  let logoPath: string | null = null
  if (typeof brand?.logoPath === 'string' && brand.logoPath.trim()) {
    logoPath = brand.logoPath.trim()
  }

  return { wordmark, logoPath }
}

export const adminNavPlugin =
  (pluginConfig?: AdminNavPluginConfig): Plugin =>
  (incomingConfig: Config): Config => {
    const config = { ...incomingConfig }
    const safeConfig = pluginConfig ?? {}
    const collectionSlug = safeConfig.collectionSlug ?? 'admin-nav-preferences'
    const userCollectionSlug = safeConfig.userCollectionSlug ?? 'users'
    const basePath = safeConfig.endpointBasePath ?? '/admin-nav'

    // Resolve defaultNav: use provided config or auto-discover from Payload config.
    // Deduplicate items that may have been declared in multiple groups
    // (warns in console on duplicates — keeps the first occurrence).
    const rawDefaultNav = safeConfig.defaultNav ?? autoDiscoverNav(incomingConfig)
    const defaultNav = dedupeNavItems(rawDefaultNav)

    // Compute a structural fingerprint of the defaultNav for preference migration.
    // When the nav structure changes, stored preferences with an old version
    // are automatically reset so users get the updated navigation.
    const navVersion = computeNavFingerprint(defaultNav)

    // 1. Merge i18n translations
    config.i18n = {
      ...config.i18n,
      translations: deepMergeSimple(translations, config.i18n?.translations ?? {}),
    }

    // 2. Add the preferences collection
    config.collections = [
      ...(config.collections || []),
      createAdminNavPreferencesCollection(collectionSlug, userCollectionSlug),
    ]

    // 3. Add API endpoints
    config.endpoints = [
      ...(config.endpoints || []),
      {
        path: `${basePath}/preferences`,
        method: 'get' as const,
        handler: createGetPreferencesHandler(collectionSlug),
      },
      {
        path: `${basePath}/preferences`,
        method: 'patch' as const,
        handler: createSavePreferencesHandler(collectionSlug),
      },
      {
        path: `${basePath}/preferences`,
        method: 'delete' as const,
        handler: createResetPreferencesHandler(collectionSlug),
      },
      {
        path: `${basePath}/badges`,
        method: 'get' as const,
        handler: createBadgesHandler(defaultNav),
      },
    ]

    // 4. Inject AdminNav into beforeNavLinks
    if (!config.admin) config.admin = {}
    if (!config.admin.components) config.admin.components = {}

    // Replace existing beforeNavLinks with our AdminNav.
    //
    // basePath travels as a clientProp rather than being fetched: the client
    // would otherwise have to call an endpoint to learn where the endpoints
    // are. Until 0.16.0 it simply hardcoded `/api/admin-nav`, which made
    // `endpointBasePath` a dead option — setting it registered the routes
    // elsewhere and the sidebar stopped loading.
    const navComponent = safeConfig.navComponentPath ?? '@consilioweb/payload-admin-nav/client#AdminNav'
    const existingBeforeNav = config.admin.components.beforeNavLinks || []
    config.admin.components.beforeNavLinks = [
      { path: navComponent, clientProps: { basePath: `/api${basePath}` } },
      ...(Array.isArray(existingBeforeNav) ? existingBeforeNav : [existingBeforeNav]),
    ]
    // beforeNavLinks configured

    // Add afterNav components if specified
    if (safeConfig.afterNav?.length) {
      const existingAfterNav = config.admin.components.afterNavLinks || []
      config.admin.components.afterNavLinks = [
        ...(Array.isArray(existingAfterNav) ? existingAfterNav : [existingAfterNav]),
        ...safeConfig.afterNav,
      ]
    }

    // Publish the resolved endpoint prefix on the sanitized config so server
    // components (the customizer view) can hand it to their client tree. The
    // client cannot discover it on its own: it would need an endpoint to learn
    // where the endpoints live.
    config.custom = {
      ...(config.custom || {}),
      adminNav: { ...((config.custom as Record<string, any>)?.adminNav || {}), basePath: `/api${basePath}` },
    }

    // 5. Add the customizer admin view
    if (safeConfig.addCustomizerView !== false) {
      if (!config.admin.components.views) config.admin.components.views = {}
      ;(config.admin.components.views as Record<string, unknown>)['nav-customizer'] = {
        Component: '@consilioweb/payload-admin-nav/views#NavCustomizerView',
        path: '/nav-customizer',
      }
    }

    // 6. Store plugin config as a global for the client to read
    // We inject it via a custom endpoint that returns the default nav
    config.endpoints = [
      ...(config.endpoints || []),
      {
        path: `${basePath}/default-nav`,
        method: 'get' as const,
        handler: async (req) => {
          const denied = await requireAdmin(req)
          if (denied) return denied

          const userId = typeof req.user === 'object' ? (req.user as any).id : req.user
          const { allowed, retryAfter } = rateLimit(`admin-nav:default:${userId}`, 60, 60_000)
          if (!allowed) return rateLimitResponse(retryAfter)

          try {
            // Filter nav items based on user permissions to avoid structure enumeration
            const filteredNav = await filterNavByPermissions(defaultNav, req)

            // Sidebar header branding — host identity by default, never the
            // plugin author's. Read from the final SanitizedConfig (see resolveBrand).
            const brand = resolveBrand(safeConfig.brand, req.payload.config)

            // Detect whether any badge resolver is configured so the client
            // can decide to start the live polling. Functions are not
            // serializable so we only ship a boolean flag.
            const hasBadges = defaultNav.some(
              (g) =>
                typeof g.groupBadge === 'function' ||
                (g.items ?? []).some((it) =>
                  (it.children ?? []).some(
                    (c) => typeof (c as { childBadge?: unknown }).childBadge === 'function',
                  ),
                ),
            )

            return Response.json({
              defaultNav: filteredNav,
              navVersion,
              afterNav: safeConfig.afterNav || [],
              basePath: `/api${basePath}`,
              hasBadges,
              navFooterSlot: safeConfig.navFooterSlot ?? null,
              brand,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Internal server error'
            return Response.json({ error: message }, { status: 500 })
          }
        },
      },
      // Runtime discover endpoint — runs autoDiscover against the final
      // Payload config (after all plugins have registered their views,
      // collections, and globals). Returns ALL available nav items.
      {
        path: `${basePath}/discover`,
        method: 'get' as const,
        handler: async (req) => {
          const denied = await requireAdmin(req)
          if (denied) return denied

          const userId = typeof req.user === 'object' ? (req.user as any).id : req.user
          const { allowed, retryAfter } = rateLimit(`admin-nav:discover:${userId}`, 30, 60_000)
          if (!allowed) return rateLimitResponse(retryAfter)

          try {
            const runtimeNav = autoDiscoverNav(req.payload.config as unknown as Config)
            // Filter discovered nav items based on user permissions
            const filteredNav = await filterNavByPermissions(runtimeNav, req)
            return Response.json({ groups: filteredNav })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Internal server error'
            req.payload.logger.error(`[admin-nav] Discover failed: ${message}`)
            return Response.json({ error: message }, { status: 500 })
          }
        },
      },
    ]

    return config
  }
