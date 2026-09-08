import type { PayloadHandler } from 'payload'
import { rateLimit, rateLimitResponse } from '../utils/rateLimiter.js'
import { requireAdmin } from '../utils/requireAdmin.js'
import { filterNavByPermissions } from '../utils/navPermissions.js'
import type { NavGroupConfig, NavChildConfig } from '../types.js'

/** Extract user ID from request (works with object or primitive) */
function getUserId(req: { user?: unknown }): string | number {
  if (!req.user) return ''
  if (typeof req.user === 'object' && req.user !== null) return (req.user as any).id
  return req.user as string | number
}

/**
 * GET /admin-nav/badges
 *
 * Resolves every `groupBadge` and `childBadge` resolver declared in the
 * plugin's `defaultNav` and returns a flat mapping `{ groups, children }`.
 *
 * Resolvers run in parallel. Individual failures are caught and surface as
 * `null` so a single buggy counter doesn't break the whole nav. Negative
 * or non-integer values are clamped to zero. Total time is bounded by the
 * slowest resolver — keep your queries fast (1 SQL count per resolver max).
 *
 * The nav is filtered by permissions first, with the same primitive
 * `/default-nav` and `/discover` use. Being admin-panel staff is not being
 * allowed to read every collection: without that filtering this endpoint
 * answered from the whole `defaultNav` and returned both the ids of the entries
 * `/default-nav` hides from that user and the counter behind each of them —
 * open tickets, pending orders — since resolvers query through the Local API
 * with `overrideAccess: true`. One `getAccessResults` per poll is the price of
 * the two endpoints agreeing; memoizing it per user would trade a confirmed
 * leak for a cache keyed on an authenticated identity, which is how stale
 * permissions get served after a role change.
 */
export function createBadgesHandler(defaultNav: NavGroupConfig[]): PayloadHandler {
  return async (req) => {
    // Badge resolvers run through the Local API without access control:
    // restrict the endpoint to admin-panel users.
    const denied = await requireAdmin(req)
    if (denied) return denied

    const userId = getUserId(req)
    const { allowed, retryAfter } = rateLimit(`admin-nav:badges:${userId}`, 120, 60_000)
    if (!allowed) return rateLimitResponse(retryAfter)

    const groups: Record<string, number> = {}
    const children: Record<string, number> = {}

    // Collect all badge tasks (group + children) for parallel resolution
    type Task =
      | { kind: 'group'; id: string; fn: NonNullable<NavGroupConfig['groupBadge']> }
      | { kind: 'child'; id: string; fn: NonNullable<NavChildConfig['childBadge']> }

    const tasks: Task[] = []

    // Same source of truth as `/default-nav`: resolve only what this user may see.
    const visibleNav = await filterNavByPermissions(defaultNav, req)

    for (const group of visibleNav) {
      if (typeof group.groupBadge === 'function') {
        tasks.push({ kind: 'group', id: group.id, fn: group.groupBadge })
      }
      for (const item of group.items ?? []) {
        const itemChildren = (item.children as NavChildConfig[] | undefined) ?? []
        for (const child of itemChildren) {
          if (typeof child.childBadge === 'function') {
            tasks.push({ kind: 'child', id: child.id, fn: child.childBadge })
          }
        }
      }
    }

    // Resolve all tasks in parallel; isolate each so one rejection doesn't kill all
    const settled = await Promise.allSettled(
      tasks.map(async (t) => {
        const raw = await t.fn(req)
        if (raw === null || raw === undefined) return null
        const n = Number(raw)
        if (!Number.isFinite(n) || n < 0) return 0
        return Math.floor(n)
      }),
    )

    settled.forEach((res, idx) => {
      const task = tasks[idx]!
      if (res.status === 'fulfilled' && res.value !== null) {
        if (task.kind === 'group') groups[task.id] = res.value
        else children[task.id] = res.value
      } else if (res.status === 'rejected') {
        req.payload.logger.warn(
          `[admin-nav] Badge resolver "${task.id}" failed: ${(res.reason as Error)?.message ?? 'unknown'}`,
        )
      }
    })

    return Response.json({ groups, children })
  }
}
