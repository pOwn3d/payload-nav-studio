/**
 * Auto-discover navigation structure from Payload config.
 *
 * When no `defaultNav` is provided, the plugin reads collections, globals,
 * and custom admin views from the Payload config and generates a reasonable
 * navigation layout automatically.
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

/**
 * Resolve a Payload label to a LocalizedString.
 * Payload labels can be string | Record<string, string> — same as our LocalizedString.
 */
function resolvePayloadLabel(
  labels: { singular?: string | Record<string, string>; plural?: string | Record<string, string> } | undefined,
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
 * Auto-discover navigation groups from a Payload config.
 *
 * Groups collections by their `admin.group` property.
 * Creates items for globals and custom admin views.
 * Assigns icons based on slug matching.
 */
export function autoDiscoverNav(config: Config): NavGroupConfig[] {
  const groupMap = new Map<string, NavItemConfig[]>()

  // Helper to add an item to a group
  const addToGroup = (groupName: string, item: NavItemConfig) => {
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, [])
    }
    groupMap.get(groupName)!.push(item)
  }

  // ── 1. Collections ──
  for (const collection of config.collections || []) {
    // Skip hidden collections and the plugin's own preferences collection
    if (collection.admin?.hidden) continue
    if (collection.slug === 'admin-nav-preferences') continue

    const groupName = (collection.admin as Record<string, unknown>)?.group as string || 'Collections'
    const label = resolvePayloadLabel(
      collection.labels as { singular?: string | Record<string, string>; plural?: string | Record<string, string> },
      collection.slug,
    )

    addToGroup(groupName, {
      id: collection.slug,
      href: `/admin/collections/${collection.slug}`,
      label,
      icon: guessIcon(collection.slug),
      matchPrefix: true,
    })
  }

  // ── 2. Globals ──
  for (const global of config.globals || []) {
    if ((global.admin as Record<string, unknown>)?.hidden) continue

    const groupName = (global.admin as Record<string, unknown>)?.group as string || 'Configuration'
    const label: LocalizedString = (global.label as LocalizedString) || global.slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    addToGroup(groupName, {
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

      addToGroup('Views', {
        id: `view-${key}`,
        href: `/admin${viewObj.path}`,
        label: key
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
        icon: guessIcon(key),
      })
    }
  }

  // ── Build final groups ──
  const groups: NavGroupConfig[] = []
  for (const [name, items] of groupMap) {
    groups.push({
      id: slugifyGroup(name),
      title: name,
      items,
    })
  }

  return groups
}
