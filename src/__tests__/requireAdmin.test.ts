import { describe, expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'
import { requireAdmin } from '../utils/requireAdmin.js'

/**
 * Minimal request double: only what `requireAdmin` actually reads.
 * `admin.user` is the collection Payload treats as the admin-panel identity;
 * `collections` is the runtime registry where `access.admin` is looked up.
 */
function makeReq(options: {
  user?: { id: string; collection: string } | null
  adminUserSlug?: string | undefined
  adminAccess?: unknown
}): { req: PayloadRequest; warnings: string[] } {
  const warnings: string[] = []
  const collections: Record<string, unknown> = {}
  if (options.adminAccess !== undefined) {
    collections[options.user?.collection ?? 'users'] = {
      config: { access: { admin: options.adminAccess } },
    }
  }

  const req = {
    user: options.user ?? null,
    payload: {
      config: { admin: { user: options.adminUserSlug } },
      collections,
      logger: { warn: (msg: string) => warnings.push(msg) },
    },
  } as unknown as PayloadRequest

  return { req, warnings }
}

const adminUser = { id: 'u1', collection: 'users' }

describe('requireAdmin — accès aux endpoints admin-nav', () => {
  it("refuse une requête anonyme avec un 401", async () => {
    const { req } = makeReq({ user: null, adminUserSlug: 'users' })

    const denied = await requireAdmin(req)

    expect(denied).not.toBeNull()
    expect(denied!.status).toBe(401)
    await expect(denied!.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it("laisse passer un utilisateur de la collection admin quand aucun access.admin n'est déclaré", async () => {
    const { req } = makeReq({ user: adminUser, adminUserSlug: 'users' })

    await expect(requireAdmin(req)).resolves.toBeNull()
  })

  it("refuse en 403 un utilisateur authentifié sur une AUTRE collection que config.admin.user", async () => {
    // Un client authentifié sur une collection front-office ne doit pas
    // pouvoir cartographier l'admin via /default-nav ou /discover.
    const { req } = makeReq({
      user: { id: 'c1', collection: 'customers' },
      adminUserSlug: 'users',
    })

    const denied = await requireAdmin(req)

    expect(denied!.status).toBe(403)
    await expect(denied!.json()).resolves.toEqual({ error: 'Forbidden' })
  })

  it("refuse en 403 quand l'hôte ne déclare aucune collection admin", async () => {
    // Sans admin.user, aucune identité ne peut être reconnue comme admin :
    // on ferme plutôt que de laisser passer le premier utilisateur venu.
    const { req } = makeReq({ user: adminUser, adminUserSlug: undefined })

    const denied = await requireAdmin(req)

    expect(denied!.status).toBe(403)
  })

  it("refuse en 403 quand access.admin de la collection répond non", async () => {
    const { req } = makeReq({
      user: adminUser,
      adminUserSlug: 'users',
      adminAccess: () => false,
    })

    const denied = await requireAdmin(req)

    expect(denied!.status).toBe(403)
  })

  it('laisse passer quand access.admin répond oui de façon asynchrone', async () => {
    const { req } = makeReq({
      user: adminUser,
      adminUserSlug: 'users',
      adminAccess: async () => true,
    })

    await expect(requireAdmin(req)).resolves.toBeNull()
  })

  it("refuse (fail-closed) quand access.admin échoue, en levant ou en rejetant", async () => {
    // Une fonction d'accès en erreur ne vaut jamais « oui » : une base
    // indisponible ne doit pas ouvrir la cartographie de l'admin.
    const sync = makeReq({
      user: adminUser,
      adminUserSlug: 'users',
      adminAccess: () => {
        throw new Error('db down')
      },
    })
    const denied = await requireAdmin(sync.req)
    expect(denied!.status).toBe(403)
    expect(sync.warnings.join('\n')).toContain('db down')

    const async_ = makeReq({
      user: adminUser,
      adminUserSlug: 'users',
      adminAccess: async () => {
        throw new Error('timeout')
      },
    })
    expect((await requireAdmin(async_.req))!.status).toBe(403)
  })

  it("laisse access.admin décider sur le rôle porté par l'utilisateur courant", async () => {
    const onlyEditors = ({ req }: { req: { user?: { role?: string } | null } }) =>
      req.user?.role === 'editor'
    const editor = makeReq({
      user: { ...adminUser, role: 'editor' } as never,
      adminUserSlug: 'users',
      adminAccess: onlyEditors,
    })
    const viewer = makeReq({
      user: { ...adminUser, role: 'viewer' } as never,
      adminUserSlug: 'users',
      adminAccess: onlyEditors,
    })

    await expect(requireAdmin(editor.req)).resolves.toBeNull()
    expect((await requireAdmin(viewer.req))!.status).toBe(403)
  })

  it("n'exige rien de plus quand access.admin n'est pas une fonction (valeur héritée mal typée)", async () => {
    // Une valeur non-fonction ne peut pas être évaluée : Payload lui-même
    // l'ignore, la garde ne doit pas transformer ça en 403 arbitraire.
    const { req } = makeReq({ user: adminUser, adminUserSlug: 'users', adminAccess: true })

    await expect(requireAdmin(req)).resolves.toBeNull()
  })
})
