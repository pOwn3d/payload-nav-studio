import type { PayloadRequest, SanitizedPermissions } from 'payload'
import { getAccessResults } from 'payload'
import type { NavGroupConfig } from '../types.js'

/**
 * Permission filtering for the navigation tree.
 *
 * It used to live inside `plugin.ts`, where only the two endpoints declared in
 * that file could reach it. `/badges` — declared elsewhere — therefore answered
 * from the *unfiltered* `defaultNav`, handing back the ids of the very entries
 * `/default-nav` had just removed for that user, plus the business counter
 * behind each of them (badge resolvers run through the Local API, i.e. with
 * `overrideAccess: true`). Sharing the primitive is what makes the three
 * endpoints agree on what a given user is allowed to see.
 */

/**
 * A sanitized permission entry is either `true` (unrestricted) or, when the
 * access function returned a query constraint, `{ permission: true, where }`.
 * When access is denied the key is stripped from the object entirely, so an
 * absent value means "no access" — not "unknown".
 */
export function canRead(perm: unknown): boolean {
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
export async function filterNavByPermissions(
  groups: NavGroupConfig[],
  req: PayloadRequest,
): Promise<NavGroupConfig[]> {
  /**
   * `getAccessResults` is all-or-nothing: it fans out over every collection and
   * global with a single `Promise.all`, and `getEntityPermissions` runs the host's
   * access functions with no try/catch of its own. One host access function that
   * throws — an explicit `throw new Forbidden()`, or the far more common
   * `user.roles.includes('admin')` on a user whose `roles` is undefined — rejects
   * the whole computation for that user.
   *
   * Returning the unfiltered nav there handed the complete map of the panel
   * (every collection and global slug, including the ones `admin.hidden` keeps
   * out of the UI and `autoDiscoverNav` deliberately keeps in, plus every custom
   * admin view path) to whoever tripped it — silently, since the catch was empty.
   * So: fail closed on everything identifiable, keep the custom entries that are
   * not filtered anyway, and say so in the log.
   */
  let permissions: SanitizedPermissions | null = null
  try {
    permissions = await getAccessResults({ req })
  } catch (error) {
    req.payload?.logger?.warn(
      `[admin-nav] Permission computation failed — hiding every collection and global from the nav for this user: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    )
  }

  const collectionPerms = permissions?.collections ?? {}
  const globalPerms = permissions?.globals ?? {}

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
        return permissions !== null && canRead(collectionPerms[slug]?.read)
      }
    }

    // Check global-based items: /admin/globals/<slug>
    const globalMatch = href.match(/\/admin\/globals\/([^/?#]+)/)
    if (globalMatch) {
      const slug = globalMatch[1] as string
      if (knownGlobals.has(slug)) {
        return permissions !== null && canRead(globalPerms[slug]?.read)
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
