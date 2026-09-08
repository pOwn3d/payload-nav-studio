import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config, PayloadRequest } from 'payload'

// Only the permission computation is faked: it needs a booted Payload instance.
// Everything under test (the filtering, the branding, the guard) stays real.
vi.mock('payload', () => ({ getAccessResults: vi.fn() }))

import { getAccessResults } from 'payload'
import { adminNavPlugin } from '../plugin.js'
import type { AdminNavPluginConfig, NavGroupConfig } from '../types.js'

const mockedAccess = vi.mocked(getAccessResults)

/** Each test gets its own user id: the rate limiter is a module-level Map. */
let seq = 0
const nextUserId = () => `nav-user-${++seq}`

type Handler = (req: PayloadRequest) => Promise<Response>

/** Build the plugin's config and pull one of the endpoints it registered. */
function endpointOf(path: string, pluginConfig: AdminNavPluginConfig): Handler {
  const built = adminNavPlugin(pluginConfig)({
    collections: [],
    globals: [],
  } as unknown as Config) as Config
  const endpoint = (built.endpoints ?? []).find(
    (e: { path: string; method: string }) => e.path === path && e.method === 'get',
  )
  if (!endpoint) throw new Error(`endpoint ${path} not registered`)
  return endpoint.handler as unknown as Handler
}

/** Minimal request double for an authenticated admin. */
function makeReq(options: {
  collections?: string[]
  globals?: string[]
  meta?: { title?: string; titleSuffix?: string }
  anonymous?: boolean
} = {}): PayloadRequest {
  return {
    user: options.anonymous ? null : { id: nextUserId(), collection: 'users' },
    payload: {
      config: {
        admin: { user: 'users', meta: options.meta ?? {} },
        collections: (options.collections ?? []).map((slug) => ({ slug })),
        globals: (options.globals ?? []).map((slug) => ({ slug })),
      },
      collections: {},
      logger: { error: () => {}, warn: () => {}, info: () => {} },
    },
  } as unknown as PayloadRequest
}

const item = (id: string, href: string, extra: Record<string, unknown> = {}) => ({
  id,
  href,
  label: id,
  icon: 'box',
  ...extra,
})

async function defaultNavOf(
  nav: NavGroupConfig[],
  req: PayloadRequest,
): Promise<{ status: number; body: any }> {
  const res = await endpointOf('/admin-nav/default-nav', { defaultNav: nav })(req)
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  mockedAccess.mockReset()
})

describe('GET /default-nav — ce que l\'utilisateur a le droit de voir dans la sidebar', () => {
  it('refuse la cartographie du panel à une requête anonyme', async () => {
    mockedAccess.mockResolvedValue({} as never)

    const res = await endpointOf('/admin-nav/default-nav', { defaultNav: [] })(
      makeReq({ anonymous: true }),
    )

    expect(res.status).toBe(401)
  })

  it('affiche une collection que l\'utilisateur peut lire', async () => {
    mockedAccess.mockResolvedValue({ collections: { pages: { read: true } } } as never)

    const { body } = await defaultNavOf(
      [{ id: 'g', title: 'G', items: [item('pages', '/admin/collections/pages')] }],
      makeReq({ collections: ['pages'] }),
    )

    expect(body.defaultNav[0].items.map((i: any) => i.id)).toEqual(['pages'])
  })

  it('garde visible une collection dont la lecture est restreinte par une contrainte de requête', async () => {
    // Payload renvoie { permission: true, where } quand la fonction d'accès a
    // retourné un filtre : c'est un accès accordé, pas un refus.
    mockedAccess.mockResolvedValue({
      collections: { pages: { read: { permission: true, where: { author: { equals: 'u1' } } } } },
    } as never)

    const { body } = await defaultNavOf(
      [{ id: 'g', title: 'G', items: [item('pages', '/admin/collections/pages')] }],
      makeReq({ collections: ['pages'] }),
    )

    expect(body.defaultNav[0].items.map((i: any) => i.id)).toEqual(['pages'])
  })

  it('masque une collection dont la permission de lecture est absente du résultat', async () => {
    // Une clé absente signifie « refusé » : Payload retire les entrées refusées.
    mockedAccess.mockResolvedValue({ collections: { pages: { read: true } } } as never)

    const { body } = await defaultNavOf(
      [
        {
          id: 'g',
          title: 'G',
          items: [
            item('pages', '/admin/collections/pages'),
            item('secrets', '/admin/collections/secrets'),
          ],
        },
      ],
      makeReq({ collections: ['pages', 'secrets'] }),
    )

    expect(body.defaultNav[0].items.map((i: any) => i.id)).toEqual(['pages'])
  })

  it('fait disparaître un groupe dont plus aucun item n\'est lisible', async () => {
    mockedAccess.mockResolvedValue({ collections: {} } as never)

    const { body } = await defaultNavOf(
      [
        { id: 'hidden', title: 'Hidden', items: [item('secrets', '/admin/collections/secrets')] },
        { id: 'custom', title: 'Custom', items: [item('dash', '/admin/seo-dashboard')] },
      ],
      makeReq({ collections: ['secrets'] }),
    )

    expect(body.defaultNav.map((g: any) => g.id)).toEqual(['custom'])
  })

  it('applique la même règle aux globals', async () => {
    mockedAccess.mockResolvedValue({ globals: { header: { read: true } } } as never)

    const { body } = await defaultNavOf(
      [
        {
          id: 'g',
          title: 'G',
          items: [item('header', '/admin/globals/header'), item('footer', '/admin/globals/footer')],
        },
      ],
      makeReq({ globals: ['header', 'footer'] }),
    )

    expect(body.defaultNav[0].items.map((i: any) => i.id)).toEqual(['header'])
  })

  it('laisse visible une route custom, qui ne correspond à aucune entité de la config', async () => {
    mockedAccess.mockResolvedValue({ collections: {} } as never)

    const { body } = await defaultNavOf(
      [{ id: 'g', title: 'G', items: [item('customizer', '/admin/nav-customizer')] }],
      makeReq(),
    )

    expect(body.defaultNav[0].items.map((i: any) => i.id)).toEqual(['customizer'])
  })

  it('laisse visible un lien vers une collection inconnue de la config plutôt que de le supprimer', async () => {
    // L'absence de permission pour un slug non déclaré n'est pas un refus :
    // c'est un lien que ce plugin n'a pas à arbitrer.
    mockedAccess.mockResolvedValue({ collections: {} } as never)

    const { body } = await defaultNavOf(
      [{ id: 'g', title: 'G', items: [item('ghost', '/admin/collections/ghost')] }],
      makeReq({ collections: ['pages'] }),
    )

    expect(body.defaultNav[0].items.map((i: any) => i.id)).toEqual(['ghost'])
  })

  it('filtre aussi les sous-items : un enfant vers une collection interdite disparaît', async () => {
    mockedAccess.mockResolvedValue({ collections: { tickets: { read: true } } } as never)

    const { body } = await defaultNavOf(
      [
        {
          id: 'g',
          title: 'G',
          items: [
            item('support', '/admin/collections/tickets', {
              children: [
                item('open', '/admin/collections/tickets?status=open'),
                item('billing', '/admin/collections/invoices'),
              ],
            }),
          ],
        },
      ],
      makeReq({ collections: ['tickets', 'invoices'] }),
    )

    const parent = body.defaultNav[0].items[0]
    expect(parent.id).toBe('support')
    expect(parent.children.map((c: any) => c.id)).toEqual(['open'])
  })

  it('fait disparaître un parent purement dépliant quand tous ses enfants sont filtrés', async () => {
    // Un parent sans href propre n'existe que pour ouvrir ses enfants :
    // vidé, il ne laisse qu'une ligne morte dans la sidebar.
    mockedAccess.mockResolvedValue({ collections: {} } as never)

    const { body } = await defaultNavOf(
      [
        {
          id: 'g',
          title: 'G',
          items: [
            item('folder', '', { children: [item('secrets', '/admin/collections/secrets')] }),
            item('dash', '/admin/seo-dashboard'),
          ],
        },
      ],
      makeReq({ collections: ['secrets'] }),
    )

    expect(body.defaultNav[0].items.map((i: any) => i.id)).toEqual(['dash'])
  })

  it('garde un parent qui a sa propre destination, même vidé de ses enfants', async () => {
    mockedAccess.mockResolvedValue({ collections: { tickets: { read: true } } } as never)

    const { body } = await defaultNavOf(
      [
        {
          id: 'g',
          title: 'G',
          items: [
            item('support', '/admin/collections/tickets', {
              children: [item('billing', '/admin/collections/invoices')],
            }),
          ],
        },
      ],
      makeReq({ collections: ['tickets', 'invoices'] }),
    )

    const parent = body.defaultNav[0].items[0]
    expect(parent.id).toBe('support')
    expect(parent.children).toEqual([])
  })

  it('ne mute pas la nav par défaut partagée entre les requêtes', async () => {
    const nav: NavGroupConfig[] = [
      {
        id: 'g',
        title: 'G',
        items: [
          item('pages', '/admin/collections/pages'),
          item('secrets', '/admin/collections/secrets'),
        ] as never,
      },
    ]
    mockedAccess.mockResolvedValue({ collections: { pages: { read: true } } } as never)
    const handler = endpointOf('/admin-nav/default-nav', { defaultNav: nav })

    await handler(makeReq({ collections: ['pages', 'secrets'] }))
    mockedAccess.mockResolvedValue({
      collections: { pages: { read: true }, secrets: { read: true } },
    } as never)
    const res = await handler(makeReq({ collections: ['pages', 'secrets'] }))

    expect((await res.json()).defaultNav[0].items.map((i: any) => i.id)).toEqual([
      'pages',
      'secrets',
    ])
  })

  it('masque collections et globals quand le calcul des permissions échoue, et le trace', async () => {
    // Anciennement fail-open : une SEULE fonction d'accès de l'hôte qui lève
    // (un `throw`, ou un `user.roles.includes(...)` sur un `roles` undefined)
    // fait rejeter le `Promise.all` de getAccessResults et rendait la carte
    // complète du panel — silencieusement, le catch étant vide.
    mockedAccess.mockRejectedValue(new Error('permissions unavailable'))

    const warnings: string[] = []
    const req = makeReq({ collections: ['secrets'], globals: ['settings'] })
    ;(req.payload as unknown as { logger: { warn: (m: string) => void } }).logger.warn = (m) =>
      warnings.push(m)

    const { status, body } = await defaultNavOf(
      [
        {
          id: 'g',
          title: 'G',
          items: [
            item('secrets', '/admin/collections/secrets'),
            item('settings', '/admin/globals/settings'),
            item('seo', '/admin/seo-dashboard'),
          ],
        },
      ],
      req,
    )

    expect(status).toBe(200)
    // Les entités identifiables disparaissent ; les vues custom, que le
    // filtrage ne couvre de toute façon pas, restent atteignables.
    expect(body.defaultNav[0].items.map((i: any) => i.id)).toEqual(['seo'])
    expect(warnings.join('\n')).toContain('Permission computation failed')
  })

  it('vide entièrement la nav quand elle ne contient que des entités et que les permissions échouent', async () => {
    mockedAccess.mockRejectedValue(new Error('permissions unavailable'))

    const { body } = await defaultNavOf(
      [{ id: 'g', title: 'G', items: [item('secrets', '/admin/collections/secrets')] }],
      makeReq({ collections: ['secrets'] }),
    )

    expect(body.defaultNav).toEqual([])
  })

  it('ne fait PAS de fail-open quand les permissions se calculent et refusent tout', async () => {
    mockedAccess.mockResolvedValue({ collections: {}, globals: {} } as never)

    const { body } = await defaultNavOf(
      [{ id: 'g', title: 'G', items: [item('secrets', '/admin/collections/secrets')] }],
      makeReq({ collections: ['secrets'] }),
    )

    expect(body.defaultNav).toEqual([])
  })
})

describe('GET /default-nav — métadonnées servies au client', () => {
  it('signale la présence de compteurs seulement quand un résolveur est déclaré', async () => {
    mockedAccess.mockResolvedValue({ collections: {} } as never)
    const withoutBadge = await defaultNavOf(
      [{ id: 'g', title: 'G', items: [item('dash', '/admin/dash')] }],
      makeReq(),
    )
    const withBadge = await defaultNavOf(
      [
        {
          id: 'g',
          title: 'G',
          groupBadge: async () => 3,
          items: [item('dash', '/admin/dash')] as never,
        },
      ],
      makeReq(),
    )

    expect(withoutBadge.body.hasBadges).toBe(false)
    expect(withBadge.body.hasBadges).toBe(true)
  })
})

describe('GET /default-nav — identité affichée en tête de sidebar', () => {
  const nav: NavGroupConfig[] = [
    { id: 'g', title: 'G', items: [item('dash', '/admin/dash')] as never },
  ]

  async function brandOf(pluginConfig: AdminNavPluginConfig, req: PayloadRequest) {
    mockedAccess.mockResolvedValue({ collections: {} } as never)
    const res = await endpointOf('/admin-nav/default-nav', { defaultNav: nav, ...pluginConfig })(req)
    return (await res.json()).brand
  }

  it('affiche l\'identité de l\'hôte lue sur admin.meta.title', async () => {
    const brand = await brandOf({}, makeReq({ meta: { title: 'Acme Admin' } }))

    expect(brand).toEqual({ wordmark: 'Acme Admin', logoPath: null })
  })

  it('n\'affiche rien quand l\'hôte n\'a pas d\'identité propre', async () => {
    // Le suffixe « - Payload » est celui que Payload injecte lui-même :
    // c'est l'identité du framework, pas celle du site.
    const brand = await brandOf({}, makeReq({ meta: { titleSuffix: '- Payload' } }))

    expect(brand.wordmark).toBeNull()
  })

  it('retombe sur le suffixe de titre de l\'hôte, nettoyé de son séparateur', async () => {
    const brand = await brandOf({}, makeReq({ meta: { titleSuffix: ' — Acme' } }))

    expect(brand.wordmark).toBe('Acme')
  })

  it("laisse le consommateur reprendre la main sur l'identité affichée", async () => {
    const forced = await brandOf(
      { brand: { wordmark: '  Studio  ', logoPath: ' /logo.js ' } },
      makeReq({ meta: { title: 'Acme Admin' } }),
    )
    expect(forced).toEqual({ wordmark: 'Studio', logoPath: '/logo.js' })

    const disabled = await brandOf(
      { brand: { wordmark: false } },
      makeReq({ meta: { title: 'Acme Admin' } }),
    )
    expect(disabled.wordmark).toBeNull()
  })
})

describe('GET /discover — découverte à chaud de la config finale', () => {
  it('n\'expose que les collections lisibles par l\'appelant', async () => {
    mockedAccess.mockResolvedValue({ collections: { pages: { read: true } } } as never)
    const handler = endpointOf('/admin-nav/discover', {})

    const res = await handler(makeReq({ collections: ['pages', 'secrets'] }))
    const body = await res.json()
    const ids = body.groups.flatMap((g: any) => g.items.map((i: any) => i.id))

    expect(res.status).toBe(200)
    expect(ids).toContain('pages')
    expect(ids).not.toContain('secrets')
  })
})

// Regression: `endpointBasePath` used to be a dead option. The plugin registered
// its routes under the configured prefix while AdminNav, NavCustomizer and
// useNavPreferences all called `/api/admin-nav` literally — so setting the
// option moved the endpoints and the sidebar simply stopped loading.
describe('endpointBasePath — le client suit reellement le prefixe configure', () => {
  const build = (pluginConfig: Parameters<typeof adminNavPlugin>[0]) =>
    adminNavPlugin(pluginConfig)({ collections: [], globals: [] } as never)

  it('publie le prefixe resolu sur la config, pour les composants serveur', () => {
    const built = build({ endpointBasePath: '/custom-nav' }) as {
      custom?: { adminNav?: { basePath?: string } }
    }
    expect(built.custom?.adminNav?.basePath).toBe('/api/custom-nav')
  })

  it('retombe sur le prefixe par defaut quand l option n est pas fournie', () => {
    const built = build({}) as { custom?: { adminNav?: { basePath?: string } } }
    expect(built.custom?.adminNav?.basePath).toBe('/api/admin-nav')
  })

  it('passe le prefixe a AdminNav en clientProps plutot que de le laisser deviner', () => {
    const built = build({ endpointBasePath: '/custom-nav' }) as {
      admin?: { components?: { beforeNavLinks?: unknown[] } }
    }
    const injected = built.admin?.components?.beforeNavLinks?.[0] as {
      path?: string
      clientProps?: { basePath?: string }
    }
    expect(injected.path).toContain('#AdminNav')
    expect(injected.clientProps?.basePath).toBe('/api/custom-nav')
  })

  it('enregistre bien les endpoints sous le prefixe configure', () => {
    const built = build({ endpointBasePath: '/custom-nav' }) as {
      endpoints?: { path: string }[]
    }
    const paths = (built.endpoints ?? []).map((e) => e.path)
    expect(paths).toContain('/custom-nav/default-nav')
    expect(paths.every((p) => !p.startsWith('/admin-nav/'))).toBe(true)
  })
})

describe('GET /badges — les compteurs suivent les mêmes permissions que la nav', () => {
  /** Nav de support : un badge de groupe, un badge d'enfant, tous deux sur `tickets`. */
  const supportNav = (
    groupBadge: () => Promise<number>,
    childBadge: () => Promise<number>,
  ): NavGroupConfig[] => [
    {
      id: 'support',
      title: 'Support',
      groupBadge,
      items: [
        item('tickets', '/admin/collections/tickets', {
          children: [
            item('tickets-urgent', '/admin/collections/tickets?priority=high', { childBadge }),
          ],
        }),
      ],
    } as unknown as NavGroupConfig,
  ]

  async function badgesOf(
    nav: NavGroupConfig[],
    req: PayloadRequest,
  ): Promise<{ status: number; body: any }> {
    const res = await endpointOf('/admin-nav/badges', { defaultNav: nav })(req)
    return { status: res.status, body: await res.json() }
  }

  it('ne rend ni l\'id ni le compteur d\'une entrée que /default-nav cache à cet utilisateur', async () => {
    // Le membre du staff passe `requireAdmin` mais n'a pas le droit `read` sur
    // `tickets`. L'endpoint itérait sur le defaultNav entier et exécutait les
    // résolveurs via la Local API (overrideAccess) : il rendait à la fois
    // l'existence des sections masquées et leurs métriques métier.
    mockedAccess.mockResolvedValue({ collections: {} } as never)
    const groupBadge = vi.fn(async () => 37)
    const childBadge = vi.fn(async () => 4)

    const { status, body } = await badgesOf(
      supportNav(groupBadge, childBadge),
      makeReq({ collections: ['tickets'] }),
    )

    expect(status).toBe(200)
    expect(body).toEqual({ groups: {}, children: {} })
    // Pas seulement filtré à la sortie : la requête métier n'est jamais lancée.
    expect(groupBadge).not.toHaveBeenCalled()
    expect(childBadge).not.toHaveBeenCalled()
  })

  it('rend les compteurs des entrées que l\'utilisateur a le droit de lire', async () => {
    mockedAccess.mockResolvedValue({ collections: { tickets: { read: true } } } as never)
    const groupBadge = vi.fn(async () => 37)
    const childBadge = vi.fn(async () => 4)

    const { body } = await badgesOf(
      supportNav(groupBadge, childBadge),
      makeReq({ collections: ['tickets'] }),
    )

    expect(body).toEqual({ groups: { support: 37 }, children: { 'tickets-urgent': 4 } })
  })

  it('coupe le badge d\'un enfant interdit sans toucher au badge du groupe qui reste visible', async () => {
    mockedAccess.mockResolvedValue({ collections: { tickets: { read: true } } } as never)
    const groupBadge = vi.fn(async () => 12)
    const allowedChild = vi.fn(async () => 3)
    const deniedChild = vi.fn(async () => 99)

    const { body } = await badgesOf(
      [
        {
          id: 'support',
          title: 'Support',
          groupBadge,
          items: [
            item('tickets', '/admin/collections/tickets', {
              children: [
                item('open', '/admin/collections/tickets?status=open', { childBadge: allowedChild }),
                item('invoices', '/admin/collections/invoices', { childBadge: deniedChild }),
              ],
            }),
          ],
        } as unknown as NavGroupConfig,
      ],
      makeReq({ collections: ['tickets', 'invoices'] }),
    )

    expect(body).toEqual({ groups: { support: 12 }, children: { open: 3 } })
    expect(deniedChild).not.toHaveBeenCalled()
  })

  it('refuse la requête anonyme avant tout calcul de permission', async () => {
    const groupBadge = vi.fn(async () => 1)

    const res = await endpointOf('/admin-nav/badges', {
      defaultNav: supportNav(groupBadge, async () => 0),
    })(makeReq({ anonymous: true }))

    expect(res.status).toBe(401)
    expect(groupBadge).not.toHaveBeenCalled()
  })
})
