/** Localizable string — plain string or per-language record */
export type LocalizedString = string | Record<string, string>

/**
 * Badge resolver — async function called server-side to compute a live
 * counter for a group or child item. Receives the Payload request and
 * must return a non-negative integer. Errors are caught and produce a
 * `null` badge (no display).
 *
 * NOTE: Type accepts `any` for `req` to avoid forcing consumers to import
 * `PayloadRequest` from `payload`. Cast inside your resolver if you need
 * stronger typing locally.
 */
export type NavBadgeFn = (req: any) => Promise<number | null | undefined>

/** A single navigation item */
export interface NavItemConfig {
  /** Unique item ID (e.g. 'pages', 'posts', 'seo-dashboard') */
  id: string
  /** Admin URL path (e.g. '/admin/collections/pages') */
  href: string
  /** Display label (string or { fr: '...', en: '...' }) */
  label: LocalizedString
  /** Icon name from the built-in icon registry */
  icon: string
  /** If true, pathname.startsWith(href) activates the item */
  matchPrefix?: boolean
  /** Nested child items (e.g. ticket status filters) */
  children?: NavChildConfig[]
  /** Whether this item is visible (default: true) */
  visible?: boolean
  /** Display a pulsing green dot next to the label (e.g. for live channels) */
  live?: boolean
}

/**
 * A child / sub-item of a NavItemConfig.
 * Extends NavItemConfig with badge support so sub-items can show live counters.
 */
export interface NavChildConfig extends Omit<NavItemConfig, 'children'> {
  /**
   * Optional async badge resolver — counter displayed next to the label.
   * Resolved server-side via the `/admin-nav/badges` endpoint.
   */
  childBadge?: NavBadgeFn
  /**
   * Mark the badge as an alert (renders the pill in error color instead of neutral).
   */
  alert?: boolean
}

/** A navigation group (section with a title) */
export interface NavGroupConfig {
  /** Unique group ID */
  id: string
  /** Group title displayed as section header (string or { fr: '...', en: '...' }) */
  title: LocalizedString
  /** Items in this group */
  items: NavItemConfig[]
  /** Whether this group is visible (default: true) */
  visible?: boolean
  /** Whether this group starts collapsed (default: false) */
  defaultCollapsed?: boolean
  /**
   * Optional async badge resolver — counter displayed next to the group title.
   * Resolved server-side via the `/admin-nav/badges` endpoint, refreshed
   * every 60 seconds on the client.
   */
  groupBadge?: NavBadgeFn
}

/** Full navigation layout stored per-user in the database */
export interface NavLayout {
  /** Ordered list of navigation groups */
  groups: NavGroupConfig[]
  /** Schema version for future migrations */
  version: number
}

/**
 * Live badge payload returned by the `/admin-nav/badges` endpoint.
 * - `groups[id]` → counter for the group title
 * - `children[id]` → counter for a child sub-item
 */
export interface NavBadgesPayload {
  groups: Record<string, number>
  children: Record<string, number>
}

/** Plugin configuration options */
export interface AdminNavPluginConfig {
  /**
   * Default navigation layout — the initial sidebar structure.
   * If not provided, the plugin auto-discovers collections, globals, and views
   * from the Payload config and generates a navigation layout automatically.
   */
  defaultNav?: NavGroupConfig[]
  /** Components to render after the nav (e.g. NotificationCenter paths) */
  afterNav?: string[]
  /** Collection slug for preferences storage (default: 'admin-nav-preferences') */
  collectionSlug?: string
  /** User collection slug to create the relationship (default: 'users') */
  userCollectionSlug?: string
  /** Base path for API endpoints (default: '/admin-nav') */
  endpointBasePath?: string
  /** Whether to add the /admin/nav-customizer view (default: true) */
  addCustomizerView?: boolean
  /**
   * Override the AdminNav component path for beforeNavLinks.
   * Use this when the package is installed via file: or link: protocol
   * to avoid webpack RSC resolution issues. Point to a local wrapper
   * that re-exports AdminNav from the package.
   * Example: '@/components/admin/AdminNavWrapper#AdminNav'
   * Default: '@consilioweb/payload-admin-nav/client#AdminNav'
   */
  navComponentPath?: string
  /**
   * Path (resolvable Payload component reference) to a React component
   * rendered at the bottom of the nav, replacing the default "Customize" button.
   * Example: '@/components/admin/AdminNavFooter#default'
   * If not set, the default Customize link is rendered.
   */
  navFooterSlot?: string
}
