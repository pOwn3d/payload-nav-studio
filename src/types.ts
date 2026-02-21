/** A single navigation item */
export interface NavItemConfig {
  /** Unique item ID (e.g. 'pages', 'posts', 'seo-dashboard') */
  id: string
  /** Admin URL path (e.g. '/admin/collections/pages') */
  href: string
  /** Display label */
  label: string
  /** Icon name from the built-in icon registry */
  icon: string
  /** If true, pathname.startsWith(href) activates the item */
  matchPrefix?: boolean
  /** Nested child items (e.g. ticket status filters) */
  children?: NavItemConfig[]
  /** Whether this item is visible (default: true) */
  visible?: boolean
}

/** A navigation group (section with a title) */
export interface NavGroupConfig {
  /** Unique group ID */
  id: string
  /** Group title displayed as section header */
  title: string
  /** Items in this group */
  items: NavItemConfig[]
  /** Whether this group is visible (default: true) */
  visible?: boolean
  /** Whether this group starts collapsed (default: false) */
  defaultCollapsed?: boolean
}

/** Full navigation layout stored per-user in the database */
export interface NavLayout {
  /** Ordered list of navigation groups */
  groups: NavGroupConfig[]
  /** Schema version for future migrations */
  version: number
}

/** Plugin configuration options */
export interface AdminNavPluginConfig {
  /** Default navigation layout — the initial sidebar structure */
  defaultNav: NavGroupConfig[]
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
   * Default: '@consilioweb/admin-nav/client#AdminNav'
   */
  navComponentPath?: string
}
