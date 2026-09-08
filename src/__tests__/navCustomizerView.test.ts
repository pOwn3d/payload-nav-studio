import { describe, expect, it, vi } from 'vitest'
import type { AdminViewServerProps } from 'payload'

/**
 * `redirect()` from Next never returns — it throws a control-flow error that the
 * framework catches. The double reproduces that contract so a view that *fails*
 * to redirect is observable: it returns an element instead of throwing.
 */
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`)
  },
}))

/**
 * The real template pulls in `.scss` and the whole @payloadcms/next server tree.
 * All the test needs to know is whether the view got as far as rendering it.
 */
vi.mock('@payloadcms/next/templates', () => ({
  DefaultTemplate: () => null,
}))

vi.mock('../views/NavCustomizerViewClient.js', () => ({
  NavCustomizerViewClient: () => null,
}))

const { NavCustomizerView } = await import('../views/NavCustomizerView.js')

type Actor = { id: string; collection: string; role?: string } | null

function makeProps(options: {
  user: Actor
  /** Collection Payload treats as the admin-panel identity. */
  adminUserSlug?: string
  /** `access.admin` declared on that collection, if any. */
  adminAccess?: unknown
  routes?: { admin?: string }
  adminRoutes?: { login?: string; unauthorized?: string }
}): AdminViewServerProps {
  const collections: Record<string, unknown> = {}
  if (options.adminAccess !== undefined && options.user) {
    collections[options.user.collection] = {
      config: { access: { admin: options.adminAccess } },
    }
  }

  const req = {
    user: options.user,
    i18n: {},
    payload: {
      collections,
      logger: { warn: () => {} },
      config: {
        admin: {
          user: options.adminUserSlug ?? 'users',
          routes: {
            login: '/login',
            unauthorized: '/unauthorized',
            ...(options.adminRoutes ?? {}),
          },
        },
        routes: { admin: '/admin', ...(options.routes ?? {}) },
        custom: { adminNav: { basePath: '/api/admin-nav' } },
      },
    },
  }

  return {
    initPageResult: {
      req,
      permissions: { canAccessAdmin: false },
      visibleEntities: { collections: [], globals: [] },
      locale: undefined,
    },
  } as unknown as AdminViewServerProps
}

/** Runs the view and reports the redirect it performed, or `null` if it rendered. */
async function redirectOf(props: AdminViewServerProps): Promise<string | null> {
  try {
    await NavCustomizerView(props)
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.startsWith('REDIRECT:')) return message.slice('REDIRECT:'.length)
    throw error
  }
}

describe('NavCustomizerView — accès à la vue /admin/nav-customizer', () => {
  it("redirige un visiteur anonyme vers la page de connexion de l'hôte", async () => {
    expect(await redirectOf(makeProps({ user: null }))).toBe('/admin/login')
  })

  it("refuse un compte authentifié sur une collection front-office", async () => {
    // Payload ne garde PAS les vues custom : `RootPage` saute sa redirection
    // `canAccessAdmin` dès que `isCustomAdminView` matche le chemin. Un simple
    // POST /api/customers/login pose le cookie `payload-token` partagé, donc ce
    // compte arrive ici authentifié. Le laisser passer livrerait le shell admin
    // ET la clientConfig complète (schémas de champs de toutes les collections
    // et globals) — plus que ce que /default-nav et /discover lui refusent.
    const props = makeProps({
      user: { id: 'c1', collection: 'customers' },
      adminUserSlug: 'users',
    })

    expect(await redirectOf(props)).toBe('/admin/unauthorized')
  })

  it("refuse un membre de la collection admin recalé par access.admin", async () => {
    const props = makeProps({
      user: { id: 'u1', collection: 'users', role: 'viewer' },
      adminUserSlug: 'users',
      adminAccess: ({ req }: { req: { user?: { role?: string } | null } }) =>
        req.user?.role === 'editor',
    })

    expect(await redirectOf(props)).toBe('/admin/unauthorized')
  })

  it("ferme aussi quand l'hôte ne déclare aucune collection admin", async () => {
    const props = makeProps({
      user: { id: 'u1', collection: 'users' },
      adminUserSlug: undefined as unknown as string,
    })
    // `adminUserSlug` par défaut vaut 'users' dans le double : on le retire.
    ;(props.initPageResult.req.payload.config.admin as { user?: string }).user = undefined

    expect(await redirectOf(props)).toBe('/admin/unauthorized')
  })

  it('fail-closed quand access.admin lève', async () => {
    const props = makeProps({
      user: { id: 'u1', collection: 'users' },
      adminUserSlug: 'users',
      adminAccess: () => {
        throw new Error('db down')
      },
    })

    expect(await redirectOf(props)).toBe('/admin/unauthorized')
  })

  it("suit les routes de l'hôte plutôt qu'un /admin/login codé en dur", async () => {
    const anonymous = makeProps({
      user: null,
      routes: { admin: '/panel' },
      adminRoutes: { login: '/sign-in', unauthorized: '/no-access' },
    })
    expect(await redirectOf(anonymous)).toBe('/panel/sign-in')

    const customer = makeProps({
      user: { id: 'c1', collection: 'customers' },
      adminUserSlug: 'users',
      routes: { admin: '/panel' },
      adminRoutes: { login: '/sign-in', unauthorized: '/no-access' },
    })
    expect(await redirectOf(customer)).toBe('/panel/no-access')
  })

  it('laisse passer un administrateur légitime (la fonctionnalité reste)', async () => {
    const noAccessFn = makeProps({
      user: { id: 'u1', collection: 'users' },
      adminUserSlug: 'users',
    })
    expect(await redirectOf(noAccessFn)).toBeNull()

    const allowed = makeProps({
      user: { id: 'u1', collection: 'users', role: 'editor' },
      adminUserSlug: 'users',
      adminAccess: async ({ req }: { req: { user?: { role?: string } | null } }) =>
        req.user?.role === 'editor',
    })
    expect(await redirectOf(allowed)).toBeNull()
  })

  it("transmet le basePath publié sur la config au composant client", async () => {
    const props = makeProps({ user: { id: 'u1', collection: 'users' }, adminUserSlug: 'users' })

    const element = (await NavCustomizerView(props)) as React.ReactElement<{
      children: React.ReactElement<{ basePath: string }>
    }>

    expect(element.props.children.props.basePath).toBe('/api/admin-nav')
  })
})
