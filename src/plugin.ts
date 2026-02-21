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
 *
 * Usage:
 *   import { adminNavPlugin } from '@consilioweb/admin-nav'
 *
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

export const adminNavPlugin =
  (pluginConfig: AdminNavPluginConfig): Plugin =>
  (incomingConfig: Config): Config => {
    console.log('[admin-nav-plugin] Running plugin...')
    const config = { ...incomingConfig }
    const collectionSlug = pluginConfig.collectionSlug ?? 'admin-nav-preferences'
    const userCollectionSlug = pluginConfig.userCollectionSlug ?? 'users'
    const basePath = pluginConfig.endpointBasePath ?? '/admin-nav'

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
    const navComponent = pluginConfig.navComponentPath ?? '@consilioweb/admin-nav/client#AdminNav'
    const existingBeforeNav = config.admin.components.beforeNavLinks || []
    config.admin.components.beforeNavLinks = [
      navComponent,
      ...(Array.isArray(existingBeforeNav) ? existingBeforeNav : [existingBeforeNav]),
    ]
    console.log('[admin-nav-plugin] beforeNavLinks set to:', config.admin.components.beforeNavLinks)

    // Add afterNav components if specified
    if (pluginConfig.afterNav?.length) {
      const existingAfterNav = config.admin.components.afterNavLinks || []
      config.admin.components.afterNavLinks = [
        ...(Array.isArray(existingAfterNav) ? existingAfterNav : [existingAfterNav]),
        ...pluginConfig.afterNav,
      ]
    }

    // 5. Add the customizer admin view
    if (pluginConfig.addCustomizerView !== false) {
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
        handler: async () => {
          return Response.json({
            defaultNav: pluginConfig.defaultNav,
            afterNav: pluginConfig.afterNav || [],
            basePath: `/api${basePath}`,
          })
        },
      },
    ]

    return config
  }
