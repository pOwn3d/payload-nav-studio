/**
 * Auto-discover navigation structure from Payload config.
 *
 * When no `defaultNav` is provided, the plugin reads collections, globals,
 * and custom admin views from the Payload config and generates a reasonable
 * navigation layout automatically.
 *
 * Plugin-aware grouping:
 * - Detects installed plugins by inspecting view component package paths
 * - Groups collections, globals, and views belonging to the same plugin together
 * - Hidden collections/globals are included (they are hidden for default nav
 *   compatibility, but admin-nav replaces the entire nav system)
 */

import type { Config } from 'payload'
import type { NavGroupConfig, NavItemConfig, LocalizedString } from './types.js'

// ── Icon guessing ──

const SLUG_ICON_MAP: Record<string, string> = {
  // Content
  pages: 'file-text',
  posts: 'newspaper',
  articles: 'newspaper',
  blog: 'newspaper',
  media: 'image',
  images: 'image',
  files: 'file-up',
  categories: 'tag',
  tags: 'tag',
  // Users
  users: 'user-cog',
  members: 'users',
  authors: 'users',
  // Forms
  forms: 'clipboard-list',
  'form-submissions': 'clipboard-list',
  // Support
  tickets: 'ticket',
  comments: 'message-square',
  messages: 'message-square',
  'chat-messages': 'message-square',
  // Projects
  projects: 'folder-kanban',
  // Commerce
  products: 'box',
  orders: 'receipt',
  // SEO
  redirects: 'shuffle',
  'custom-redirects': 'shuffle',
  search: 'search',
  'seo-logs': 'search-check',
  'seo-score-history': 'bar-chart-3',
  'seo-settings': 'settings',
  'seo-redirects': 'shuffle',
  'seo-performance': 'gauge',
  seo: 'search-check',
  'sitemap-audit': 'sitemap',
  'seo-config': 'settings',
  cannibalization: 'target',
  performance: 'gauge',
  'keyword-research': 'target',
  'schema-builder': 'code',
  'link-graph': 'link',
  // Maintenance
  maintenance: 'wrench',
  'maintenance-subscribers': 'bell',
  'maintenance-history': 'history',
  'maintenance-analytics': 'bar-chart-3',
  'maintenance-webhook-logs': 'webhook',
  // Config
  header: 'panel-top',
  footer: 'panel-bottom',
  settings: 'settings',
  navigation: 'link',
  menus: 'link',
  // Misc
  emails: 'mail',
  'email-logs': 'mail-search',
  'auth-logs': 'shield-check',
  notifications: 'activity',
  'admin-notifications': 'activity',
  logs: 'activity',
}

/** Guess an icon name from a collection/global slug */
function guessIcon(slug: string): string {
  if (SLUG_ICON_MAP[slug]) return SLUG_ICON_MAP[slug]

  // Partial match — check if slug contains a known keyword
  for (const [key, icon] of Object.entries(SLUG_ICON_MAP)) {
    if (slug.includes(key)) return icon
  }

  return 'box' // default fallback
}

/** Slugify a group name for use as an ID */
function slugifyGroup(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Words that should be fully uppercased in group names */
const UPPERCASE_WORDS = new Set(['seo', 'crm', 'api', 'cms', 'faq', 'url', 'ssl', 'dns', 'cdn'])

/** Capitalize a group name, uppercasing known abbreviations */
function capitalizeGroupName(name: string): string {
  return name
    .split(/[-_\s]+/)
    .map((w) =>
      UPPERCASE_WORDS.has(w.toLowerCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(' ')
}

/**
 * Resolve a Payload label to a LocalizedString.
 * Payload labels can be string | Record<string, string> — same as our LocalizedString.
 */
function resolvePayloadLabel(
  labels:
    | { singular?: string | Record<string, string>; plural?: string | Record<string, string> }
    | undefined,
  slug: string,
): LocalizedString {
  if (labels?.plural) return labels.plural as LocalizedString
  if (labels?.singular) return labels.singular as LocalizedString
  // Fallback: capitalize slug
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Extract the group key and title from a Payload admin.group value.
 * Handles both string and localized record { en: '...', fr: '...' }.
 */
function resolveAdminGroup(group: unknown): { key: string; title: LocalizedString } | null {
  if (typeof group === 'string') {
    return { key: slugifyGroup(group), title: group }
  }
  if (typeof group === 'object' && group !== null) {
    const record = group as Record<string, string>
    const firstValue = record.en || Object.values(record)[0] || ''
    if (!firstValue) return null
    return { key: slugifyGroup(firstValue), title: record as LocalizedString }
  }
  return null
}

/**
 * Detect plugin groups by inspecting custom view component paths.
 *
 * Views registered by plugins carry their package in the Component path:
 *   '@consilioweb/seo-analyzer/views#SeoView' → package 'seo-analyzer'
 *   '@consilioweb/payload-maintenance/views#MaintenanceView' → package 'payload-maintenance'
 *
 * Returns maps for:
 * - pluginPrefixes: slug prefix → group name (e.g., 'seo' → 'SEO', 'maintenance' → 'Maintenance')
 * - viewGroups: view key → group name
 */
function detectPluginGroups(config: Config): {
  pluginPrefixes: Map<string, string>
  viewGroups: Map<string, string>
} {
  const pluginPrefixes = new Map<string, string>()
  const viewGroups = new Map<string, string>()

  const views = config.admin?.components?.views
  if (!views || typeof views !== 'object') return { pluginPrefixes, viewGroups }

  // Group views by their source package
  const packageViews = new Map<string, string[]>()

  for (const [key, view] of Object.entries(views)) {
    if (!view || typeof view !== 'object') continue
    const viewObj = view as Record<string, unknown>
    const component = viewObj.Component as string | undefined
    if (!component || typeof component !== 'string') continue
    if (key === 'nav-customizer') continue

    const pkgMatch = component.match(/^@[^/]+\/([^/]+)/)
    if (pkgMatch) {
      const pkgSlug = pkgMatch[1]
      if (pkgSlug === 'admin-nav') continue // skip our own plugin
      if (!packageViews.has(pkgSlug)) packageViews.set(pkgSlug, [])
      packageViews.get(pkgSlug)!.push(key)
    }
  }

  // Build plugin groups from detected packages
  for (const [pkgSlug, viewKeys] of packageViews) {
    // Derive a clean group name from the package slug
    const cleaned = pkgSlug
      .replace(/^payload-/, '')
      .replace(/-(plugin|analyzer|manager|studio|kit|tools?)$/i, '')

    const groupName = capitalizeGroupName(cleaned)
    const prefix = cleaned.toLowerCase().replace(/\s+/g, '-')

    pluginPrefixes.set(prefix, groupName)

    for (const vk of viewKeys) {
      viewGroups.set(vk, groupName)
    }
  }

  return { pluginPrefixes, viewGroups }
}

/**
 * Auto-discover navigation groups from a Payload config.
 *
 * - Groups collections by their `admin.group` property or plugin prefix
 * - Includes hidden collections/globals (admin-nav replaces the default nav)
 * - Creates items for globals and custom admin views
 * - Detects plugins from view component paths and groups items accordingly
 * - Assigns icons based on slug matching
 */
export function autoDiscoverNav(config: Config): NavGroupConfig[] {
  const { pluginPrefixes, viewGroups } = detectPluginGroups(config)

  // Map: group key → { title, items }
  const groupMap = new Map<string, { title: LocalizedString; items: NavItemConfig[] }>()

  // Helper to add an item to a group
  const addToGroup = (key: string, title: LocalizedString, item: NavItemConfig) => {
    if (!groupMap.has(key)) {
      groupMap.set(key, { title, items: [] })
    }
    groupMap.get(key)!.items.push(item)
  }

  // Helper to resolve which group a slug belongs to
  const resolveGroup = (
    slug: string,
    adminGroup: unknown,
    fallbackGroup: string,
  ): { key: string; title: LocalizedString } => {
    // 1. Check if slug belongs to a detected plugin (prefix match)
    const slugPrefix = slug.split('-')[0]
    const pluginGroup = pluginPrefixes.get(slugPrefix)
    if (pluginGroup) {
      return { key: slugifyGroup(pluginGroup), title: pluginGroup }
    }

    // 2. Use admin.group if set
    const resolved = resolveAdminGroup(adminGroup)
    if (resolved) return resolved

    // 3. Fallback
    return { key: slugifyGroup(fallbackGroup), title: fallbackGroup }
  }

  // ── 1. Collections ──
  for (const collection of config.collections || []) {
    // Skip the plugin's own preferences collection
    if (collection.slug === 'admin-nav-preferences') continue

    const adminGroup = (collection.admin as Record<string, unknown>)?.group
    const { key, title } = resolveGroup(collection.slug, adminGroup, 'Collections')

    const label = resolvePayloadLabel(
      collection.labels as
        | { singular?: string | Record<string, string>; plural?: string | Record<string, string> }
        | undefined,
      collection.slug,
    )

    addToGroup(key, title, {
      id: collection.slug,
      href: `/admin/collections/${collection.slug}`,
      label,
      icon: guessIcon(collection.slug),
      matchPrefix: true,
    })
  }

  // ── 2. Globals ──
  for (const global of config.globals || []) {
    const adminGroup = (global.admin as Record<string, unknown>)?.group
    const { key, title } = resolveGroup(global.slug, adminGroup, 'Configuration')

    const label: LocalizedString =
      (global.label as LocalizedString) ||
      global.slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')

    addToGroup(key, title, {
      id: `global-${global.slug}`,
      href: `/admin/globals/${global.slug}`,
      label,
      icon: guessIcon(global.slug),
    })
  }

  // ── 3. Custom admin views ──
  const views = config.admin?.components?.views
  if (views && typeof views === 'object') {
    for (const [key, view] of Object.entries(views)) {
      if (!view || typeof view !== 'object') continue
      const viewObj = view as Record<string, unknown>
      if (!viewObj.path) continue

      // Skip the nav-customizer view (handled by plugin)
      if (key === 'nav-customizer') continue

      // Use plugin group if detected, otherwise fallback to 'Views'
      const pluginGroup = viewGroups.get(key)
      const groupKey = pluginGroup ? slugifyGroup(pluginGroup) : 'views'
      const groupTitle = pluginGroup || 'Views'

      addToGroup(groupKey, groupTitle, {
        id: `view-${key}`,
        href: `/admin${viewObj.path}`,
        label: key
          .split('-')
          .map((w) =>
            UPPERCASE_WORDS.has(w.toLowerCase())
              ? w.toUpperCase()
              : w.charAt(0).toUpperCase() + w.slice(1),
          )
          .join(' '),
        icon: guessIcon(key),
      })
    }
  }

  // ── Build final groups ──
  const groups: NavGroupConfig[] = []
  for (const [key, { title, items }] of groupMap) {
    groups.push({
      id: key,
      title,
      items,
    })
  }

  return groups
}
