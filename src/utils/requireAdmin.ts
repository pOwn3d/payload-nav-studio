import type { PayloadRequest } from 'payload'

/**
 * Guard for every admin-nav endpoint.
 *
 * `req.user` alone is not enough: a user authenticated against a front-office
 * auth collection (customers, members, subscribers…) would otherwise obtain the
 * full map of the admin panel through `/default-nav` and `/discover`, and could
 * trigger `/badges`, whose resolvers run through the Local API without access
 * control.
 *
 * The check mirrors what Payload itself does to gate the admin panel (see
 * `getAccessResults`): the user must belong to `config.admin.user`, and must
 * pass that collection's `access.admin` function when one is declared. It is
 * computed directly instead of going through `getAccessResults` so the badge
 * polling endpoint does not recompute permissions for every collection, global
 * and field on each poll.
 *
 * @returns a Response to return immediately, or `null` when the request may proceed.
 */
export async function requireAdmin(req: PayloadRequest): Promise<Response | null> {
  const user = req.user

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminUserSlug = req.payload?.config?.admin?.user
  if (!adminUserSlug || user.collection !== adminUserSlug) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminAccess = req.payload.collections?.[user.collection]?.config?.access?.admin
  if (typeof adminAccess === 'function') {
    let canAccessAdmin = false
    try {
      canAccessAdmin = Boolean(await adminAccess({ req }))
    } catch (error) {
      // A throwing access function means "no" — never fail open here.
      req.payload.logger?.warn(
        `[admin-nav] access.admin threw for collection "${user.collection}": ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      )
      canAccessAdmin = false
    }
    if (!canAccessAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return null
}
