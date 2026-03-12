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
 *   import { adminNavPlugin } from '@consilioweb/admin-nav'
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

import type { Config, Plugin } from 'payload'
import { deepMergeSimple } from 'payload/shared'
import type { AdminNavPluginConfig } from './types.js'
import { createAdminNavPreferencesCollection } from './collections/AdminNavPreferences.js'
import {
  createGetPreferencesHandler,
  createSavePreferencesHandler,
  createResetPreferencesHandler,
} from './endpoints/preferences.js'
import { translations } from './translations/index.js'
import { autoDiscoverNav } from './autoDiscover.js'
import { rateLimit, rateLimitResponse } from './utils/rateLimiter.js'
import { computeNavFingerprint } from './utils.js'

export const adminNavPlugin =
  (pluginConfig?: AdminNavPluginConfig): Plugin =>
  (incomingConfig: Config): Config => {
    const config = { ...incomingConfig }
    const safeConfig = pluginConfig ?? {}
    const collectionSlug = safeConfig.collectionSlug ?? 'admin-nav-preferences'
    const userCollectionSlug = safeConfig.userCollectionSlug ?? 'users'
    const basePath = safeConfig.endpointBasePath ?? '/admin-nav'

    // Resolve defaultNav: use provided config or auto-discover from Payload config
    const defaultNav = safeConfig.defaultNav ?? autoDiscoverNav(incomingConfig)

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
    ]

    // 4. Inject AdminNav into beforeNavLinks
    if (!config.admin) config.admin = {}
    if (!config.admin.components) config.admin.components = {}

    // Replace existing beforeNavLinks with our AdminNav
    const navComponent = safeConfig.navComponentPath ?? '@consilioweb/admin-nav/client#AdminNav'
    const existingBeforeNav = config.admin.components.beforeNavLinks || []
    config.admin.components.beforeNavLinks = [
      navComponent,
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

    // 5. Add the customizer admin view
    if (safeConfig.addCustomizerView !== false) {
      if (!config.admin.components.views) config.admin.components.views = {}
      ;(config.admin.components.views as Record<string, unknown>)['nav-customizer'] = {
        Component: '@consilioweb/admin-nav/views#NavCustomizerView',
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
          if (!req.user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
          }

          const userId = typeof req.user === 'object' ? (req.user as any).id : req.user
          const { allowed, retryAfter } = rateLimit(`admin-nav:default:${userId}`, 60, 60_000)
          if (!allowed) return rateLimitResponse(retryAfter)

          try {
            return Response.json({
              defaultNav,
              navVersion,
              afterNav: safeConfig.afterNav || [],
              basePath: `/api${basePath}`,
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
          if (!req.user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
          }

          const userId = typeof req.user === 'object' ? (req.user as any).id : req.user
          const { allowed, retryAfter } = rateLimit(`admin-nav:discover:${userId}`, 30, 60_000)
          if (!allowed) return rateLimitResponse(retryAfter)

          try {
            const runtimeNav = autoDiscoverNav(req.payload.config as unknown as Config)
            return Response.json({ groups: runtimeNav })
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
