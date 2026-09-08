import type { PayloadRequest } from 'payload'

/**
 * Does this request belong to somebody who may see the admin panel?
 *
 * `req.user` alone is not enough: a user authenticated against a front-office
 * auth collection (customers, members, subscribers…) would otherwise obtain the
 * full map of the admin panel through `/default-nav`, `/discover` and the
 * `/nav-customizer` view, and could trigger `/badges`, whose resolvers run
 * through the Local API without access control.
 *
 * The check mirrors what Payload itself does to gate the admin panel (see
 * `getAccessResults`): the user must belong to `config.admin.user`, and must
 * pass that collection's `access.admin` function when one is declared. It is
 * computed directly instead of going through `getAccessResults` so the badge
 * polling endpoint does not recompute permissions for every collection, global
 * and field on each poll.
 *
 * Shared by the endpoints (through `requireAdmin`) and by the customizer view,
 * so a hardening on one side can never again leave the other behind.
 */
export async function hasAdminAccess(req: PayloadRequest): Promise<boolean> {
  const user = req?.user

  if (!user) {
    return false
  }

  const adminUserSlug = req.payload?.config?.admin?.user
  if (!adminUserSlug || user.collection !== adminUserSlug) {
    return false
  }

  const adminAccess = req.payload.collections?.[user.collection]?.config?.access?.admin
  if (typeof adminAccess === 'function') {
    try {
      return Boolean(await adminAccess({ req }))
    } catch (error) {
      // A throwing access function means "no" — never fail open here.
      req.payload.logger?.warn(
        `[admin-nav] access.admin threw for collection "${user.collection}": ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      )
      return false
    }
  }

  return true
}

/**
 * Guard for every admin-nav endpoint.
 *
 * @returns a Response to return immediately, or `null` when the request may proceed.
 */
export async function requireAdmin(req: PayloadRequest): Promise<Response | null> {
  if (!req?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await hasAdminAccess(req))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}
