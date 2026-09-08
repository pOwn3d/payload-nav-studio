import { describe, expect, it } from 'vitest'
import type { CollectionConfig, PayloadRequest } from 'payload'
import { createAdminNavPreferencesCollection } from '../collections/AdminNavPreferences.js'

/**
 * The preferences collection is reachable on the auto-generated REST API:
 * `admin.hidden` hides the admin UI entry, never `/api/<slug>`. Everything here
 * guards that route, which used to bypass both the endpoint guard and the
 * endpoint's payload validation.
 */

const collection = createAdminNavPreferencesCollection('admin-nav-preferences', 'users')

/** Minimal request double — the access rules only read `req.user`. */
const reqOf = (user: { id: string | number; collection: string } | null): PayloadRequest =>
  ({ user }) as unknown as PayloadRequest

type AccessOp = 'read' | 'create' | 'update' | 'delete'
const accessOf = (op: AccessOp) =>
  (user: Parameters<typeof reqOf>[0]) =>
    (collection.access as Record<string, (args: { req: PayloadRequest }) => unknown>)[op]!({
      req: reqOf(user),
    })

const admin = { id: 3, collection: 'users' }
const customer = { id: 3, collection: 'customers' }

const fieldOf = (name: string) =>
  (collection.fields as Array<Record<string, any>>).find((f) => f.name === name)!

const beforeValidate = (collection.hooks!.beforeValidate as Array<(args: any) => unknown>)[0]!

describe('collection admin-nav-preferences — frontière entre collections d\'auth', () => {
  it('refuse toute opération à un utilisateur authentifié sur une autre collection', () => {
    // `!!req.user` était vrai pour un client front-office : la collection
    // n'avait jamais reçu l'équivalent du contrôle `user.collection` que
    // `requireAdmin` applique aux endpoints.
    for (const op of ['read', 'create', 'update', 'delete'] as AccessOp[]) {
      expect(accessOf(op)(customer)).toBe(false)
      expect(accessOf(op)(null)).toBe(false)
    }
  })

  it('ne laisse pas un id de front-office viser le document de l\'admin homonyme', () => {
    // Le champ `user` est un relationship mono-cible, donc stocké en id nu :
    // `{ user: { equals: 3 } }` désignait aussi bien le client #3 que l'admin #3.
    expect(accessOf('read')(admin)).toEqual({ user: { equals: 3 } })
    expect(accessOf('read')(customer)).toBe(false)
    expect(accessOf('update')(customer)).toBe(false)
    expect(accessOf('delete')(customer)).toBe(false)
  })

  it('respecte le userCollectionSlug configuré plutôt qu\'un "users" en dur', () => {
    const custom = createAdminNavPreferencesCollection('prefs', 'staff')
    const read = (custom.access as Record<string, (a: { req: PayloadRequest }) => unknown>).read!

    expect(read({ req: reqOf({ id: 1, collection: 'staff' }) })).toEqual({ user: { equals: 1 } })
    expect(read({ req: reqOf({ id: 1, collection: 'users' }) })).toBe(false)
  })
})

describe('collection admin-nav-preferences — propriété du document', () => {
  it('réécrit le champ user avec l\'auteur de la requête', () => {
    // Sans ça : création des préférences d\'autrui (et squat de l\'index unique,
    // qui empêche ensuite la victime d\'enregistrer les siennes), ou
    // réattribution de son propre document à un collègue.
    const out = beforeValidate({
      data: { user: 999, navLayout: { groups: [] } },
      req: reqOf(admin),
    }) as Record<string, unknown>

    expect(out.user).toBe(3)
  })

  it('laisse intactes les écritures serveur, qui portent le propriétaire elles-mêmes', () => {
    // `req.payload.create()` construit une requête neuve, sans utilisateur :
    // c'est le chemin des endpoints du plugin, en overrideAccess.
    const out = beforeValidate({ data: { user: 42 }, req: reqOf(null) }) as Record<string, unknown>

    expect(out.user).toBe(42)
  })

  it('rend le champ user non écrivable depuis une requête', () => {
    const access = fieldOf('user').access
    expect(access.create()).toBe(false)
    expect(access.update()).toBe(false)
  })

  it('écarte le user fourni par une requête venue d\'une autre collection d\'auth', () => {
    // Inatteignable en HTTP (access.create refuse d'abord), mais un hôte qui
    // appelle payload.create({ ..., req }) tourne en overrideAccess : ni la
    // règle d'accès ni le field-access ne s'exécutent, et le user fourni
    // passait tel quel.
    const out = beforeValidate({
      data: { user: 1, navLayout: { groups: [] } },
      req: reqOf(customer),
    }) as Record<string, unknown>

    expect(out).not.toHaveProperty('user')
    expect(out.navLayout).toEqual({ groups: [] })
  })
})

describe('collection admin-nav-preferences — validation des champs json', () => {
  const validate = (name: string) => fieldOf(name).validate as (v: unknown) => true | string

  it('refuse par la route REST un layout que l\'endpoint PATCH aurait refusé', () => {
    const navLayout = validate('navLayout')

    expect(
      navLayout({
        groups: [
          {
            id: 'g',
            title: 'Contenu',
            items: [
              { id: 'i', href: 'https://evil.tld/admin/login', icon: 'users', label: 'Utilisateurs' },
            ],
          },
        ],
      }),
    ).toContain('href')

    expect(navLayout({ groups: 'nope' })).toContain('groups')
    expect(
      navLayout({ groups: Array.from({ length: 51 }, (_, i) => ({ id: `g${i}`, title: 'G', items: [] })) }),
    ).toContain('50 groups')
  })

  it('refuse un volume que les plafonds imbriqués laissaient passer', () => {
    // Les plafonds bornaient la forme, jamais la taille : 50 groupes x 100
    // items x un label de 200 caracteres reste « valide » et pèse des dizaines
    // de Mo, et une clé hors modèle n'était même pas inspectée. La route REST
    // de la collection restait donc l'écriture non bornée que l'endpoint
    // n'était plus — persistée, puis relue et resérialisée à chaque GET.
    const navLayout = validate('navLayout')

    const fatButWellFormed = {
      groups: Array.from({ length: 50 }, (_, g) => ({
        id: `g${g}`,
        title: 'G',
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `i${g}-${i}`,
          href: '/admin/collections/pages',
          icon: 'file',
          label: 'L'.repeat(200),
        })),
      })),
    }
    expect(navLayout(fatButWellFormed)).toContain('exceeds maximum size')

    const junkKey = {
      groups: [
        {
          id: 'g',
          title: 'Contenu',
          items: [
            {
              id: 'i',
              href: '/admin/collections/pages',
              icon: 'file',
              label: 'Pages',
              junk: 'A'.repeat(300 * 1024),
            },
          ],
        },
      ],
    }
    expect(navLayout(junkKey)).toContain('exceeds maximum size')
  })

  it('refuse un layout non sérialisable plutôt que de laisser lever la validation', () => {
    const navLayout = validate('navLayout')
    const circular: Record<string, unknown> = { groups: [] }
    circular.self = circular

    expect(navLayout(circular)).toContain('JSON-serializable')
  })

  it('accepte un layout légitime et l\'absence de layout', () => {
    const navLayout = validate('navLayout')

    expect(navLayout(undefined)).toBe(true)
    expect(navLayout(null)).toBe(true)
    expect(
      navLayout({
        version: 7,
        groups: [
          { id: 'g', title: 'Contenu', items: [{ id: 'pages', href: '/admin/collections/pages', icon: 'file', label: 'Pages' }] },
        ],
      }),
    ).toBe(true)
  })

  it('borne collapsedGroups, sinon champ json libre sur la route REST', () => {
    const collapsed = validate('collapsedGroups')

    expect(collapsed([])).toBe(true)
    expect(collapsed(['content'])).toBe(true)
    expect(collapsed('content')).toContain('array')
    expect(collapsed([{ big: 'x' }])).toContain('strings')
    expect(collapsed(Array.from({ length: 51 }, (_, i) => `g${i}`))).toContain('50')
  })
})

describe('collection admin-nav-preferences — mises à jour partielles', () => {
  /** Validate tel que Payload l'appelle : valeur + options de champ. */
  const validateField = (name: string) =>
    fieldOf(name).validate as (
      v: unknown,
      o?: { operation?: string; previousValue?: unknown },
    ) => true | string

  /** Une ligne écrite avant l'existence de ces règles. */
  const legacyLayout = {
    groups: [
      {
        id: 'g',
        title: 'Contenu',
        items: [{ id: 'i', href: 'https://evil.tld/admin/login', icon: 'users', label: 'Users' }],
      },
    ],
  }

  it("ne fige pas une ligne existante que la règle n'a jamais laissée écrire", () => {
    // Payload revalide le document FUSIONNÉ : un champ absent de la requête est
    // recomplété depuis la ligne stockée (getFallbackValue) puis revalidé. Une
    // règle inconditionnelle rendait donc immuable la ligne même que le
    // correctif visait — plus moyen de replier un groupe, et le PATCH répondait
    // 500 sur un corps qu'il venait d'accepter.
    const navLayout = validateField('navLayout')

    expect(
      navLayout(legacyLayout, { operation: 'update', previousValue: legacyLayout }),
    ).toBe(true)
    // Payload recopie la valeur (cloneDataFromOriginalDoc) : ce n'est pas la
    // même référence, la comparaison doit être structurelle.
    expect(
      navLayout(structuredClone(legacyLayout), {
        operation: 'update',
        previousValue: legacyLayout,
      }),
    ).toBe(true)

    const collapsed = validateField('collapsedGroups')
    const legacyCollapsed = [{ not: 'a string' }]
    expect(
      collapsed(structuredClone(legacyCollapsed), {
        operation: 'update',
        previousValue: legacyCollapsed,
      }),
    ).toBe(true)
  })

  it('refuse toujours une valeur que la requête change, création comme mise à jour', () => {
    // L'autre moitié de la contrainte : la route REST ne redevient pas un
    // moyen de STOCKER un href hors domaine ou un icon non-string.
    const navLayout = validateField('navLayout')

    expect(navLayout(legacyLayout, { operation: 'create' })).toContain('href')
    expect(
      navLayout(legacyLayout, { operation: 'update', previousValue: { groups: [] } }),
    ).toContain('href')
    expect(navLayout(legacyLayout, { operation: 'update', previousValue: undefined })).toContain(
      'href',
    )

    const collapsed = validateField('collapsedGroups')
    expect(collapsed([{ big: 'x' }], { operation: 'update', previousValue: [] })).toContain(
      'strings',
    )
  })
})
