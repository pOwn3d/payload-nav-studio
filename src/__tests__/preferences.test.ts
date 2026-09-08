import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import {
  createSavePreferencesHandler,
  createGetPreferencesHandler,
  createResetPreferencesHandler,
} from '../endpoints/preferences.js'

const COLLECTION = 'admin-nav-preferences'

/**
 * Each test gets its own user id: the rate limiter is a module-level Map keyed
 * by user, so sharing an id would make the suite order-dependent.
 */
let seq = 0
const nextUserId = () => `user-${++seq}`

interface Doubles {
  find: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  errors: string[]
}

/** Minimal request double: the guard reads config/collections, the handler reads body + Local API. */
function makeReq(options: {
  body?: unknown
  rawBody?: string
  /** Body served as a ReadableStream, the way a real fetch Request exposes it. */
  streamBody?: { chunk: string; times: number }
  contentLength?: number
  user?: { id: string; collection: string } | null
  existingDoc?: Record<string, unknown> | null
}): { req: PayloadRequest; doubles: Doubles } {
  const errors: string[] = []
  const existing = options.existingDoc ?? null
  const doubles: Doubles = {
    find: vi.fn(async () => ({ docs: existing ? [existing] : [] })),
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    errors,
  }

  const headers = new Headers()
  if (options.contentLength !== undefined) {
    headers.set('content-length', String(options.contentLength))
  }

  const user =
    options.user === undefined ? { id: nextUserId(), collection: 'users' } : options.user

  let body: ReadableStream<Uint8Array> | undefined
  if (options.streamBody) {
    const { chunk, times } = options.streamBody
    const encoded = new TextEncoder().encode(chunk)
    let sent = 0
    body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= times) {
          controller.close()
          return
        }
        sent++
        controller.enqueue(encoded)
      },
    })
  }

  const req = {
    user,
    headers,
    body,
    json: async () => {
      if (options.rawBody !== undefined) return JSON.parse(options.rawBody)
      return options.body
    },
    payload: {
      config: { admin: { user: 'users' } },
      collections: {},
      logger: { error: (msg: string) => errors.push(msg), warn: () => {} },
      find: doubles.find,
      create: doubles.create,
      update: doubles.update,
      delete: doubles.delete,
    },
  } as unknown as PayloadRequest

  return { req, doubles }
}

const save = createSavePreferencesHandler(COLLECTION)

/** A minimal valid entry — tests override only the field they are about. */
const entry = (over: Record<string, unknown> = {}) => ({
  id: 'pages',
  href: '/admin/collections/pages',
  label: 'Pages',
  icon: 'file-text',
  ...over,
})

const layoutWith = (items: unknown[], groupOver: Record<string, unknown> = {}) => ({
  version: 7,
  groups: [{ id: 'g1', title: 'Content', items, ...groupOver }],
})

async function patch(body: unknown, extra: Parameters<typeof makeReq>[0] = {}) {
  const { req, doubles } = makeReq({ body, ...extra })
  const res = await save(req)
  return { res, doubles, json: (await res.json()) as Record<string, unknown> }
}

describe('PATCH /preferences — garde d\'accès', () => {
  it('refuse une requête anonyme sans jamais lire le corps', async () => {
    const { req, doubles } = makeReq({ body: { navLayout: layoutWith([entry()]) }, user: null })

    const res = await save(req)

    expect(res.status).toBe(401)
    expect(doubles.find).not.toHaveBeenCalled()
  })

})

describe('PATCH /preferences — bornes du corps de requête', () => {
  it('rejette en 413 un corps annoncé au-delà de 256 Ko avant de le bufferiser', async () => {
    const { req } = makeReq({ contentLength: 256 * 1024 + 1, body: {} })
    const jsonSpy = vi.spyOn(req as unknown as { json: () => Promise<unknown> }, 'json')

    const res = await save(req)

    expect(res.status).toBe(413)
    expect(jsonSpy).not.toHaveBeenCalled()
    // Pile sur la limite, la requête passe.
    expect((await patch({ collapsedGroups: [] }, { contentLength: 256 * 1024 })).res.status).toBe(200)
  })

  it('refuse un layout hors gabarit même quand le transport ne l\'a pas compté', async () => {
    // Le plafond de transport ne couvre que cette route ; le même document
    // s'écrit aussi par la route REST de la collection, une migration ou un
    // seed. La règle de volume vit donc avec les règles de forme, dans le
    // validateur partagé : ce corps respecte tous les plafonds imbriqués
    // (50 groupes x 100 items) et pèse pourtant plus de 256 Ko.
    const oversized = {
      version: 7,
      groups: Array.from({ length: 50 }, (_, g) => ({
        id: `g${g}`,
        title: 'Content',
        items: Array.from({ length: 100 }, (_, i) =>
          entry({ id: `i${g}-${i}`, label: 'L'.repeat(200) }),
        ),
      })),
    }

    const { res, doubles, json } = await patch({ navLayout: oversized })

    expect(res.status).toBe(400)
    expect(String(json.error)).toContain('exceeds maximum size')
    expect(doubles.create).not.toHaveBeenCalled()
    expect(doubles.update).not.toHaveBeenCalled()
  })

  it('coupe un corps chunked sans Content-Length dès le dépassement, sans le bufferiser', async () => {
    // Le plafond ne s'appliquait qu'en présence d'un Content-Length :
    // `Number(null)` vaut NaN, `Number.isFinite(NaN)` est faux, et l'exécution
    // tombait sur un `req.json()` qui bufferisait tout le flux. Une seule
    // requête suffisait à épuiser le tas — le rate limit n'y peut rien.
    const { req, doubles } = makeReq({
      streamBody: { chunk: 'x'.repeat(64 * 1024), times: 64 }, // 4 Mo annoncés nulle part
    })
    const jsonSpy = vi.spyOn(req as unknown as { json: () => Promise<unknown> }, 'json')

    const res = await save(req)

    expect(res.status).toBe(413)
    expect(jsonSpy).not.toHaveBeenCalled()
    expect(doubles.find).not.toHaveBeenCalled()
  })

  it('lit normalement un corps chunked qui tient dans le plafond', async () => {
    const payload = JSON.stringify({ collapsedGroups: ['content'] })
    const { req, doubles } = makeReq({ streamBody: { chunk: payload, times: 1 } })

    const res = await save(req)

    expect(res.status).toBe(200)
    expect(doubles.create.mock.calls[0]![0].data.collapsedGroups).toEqual(['content'])
  })

  it('retombe sur req.json() quand le flux est déjà verrouillé, sans 500 non maîtrisé', async () => {
    // `stream.getReader()` était appelé hors du try : sur un flux qu'une autre
    // couche a déjà verrouillé ou consommé, la TypeError remontait hors du
    // handler — 500 non maîtrisé — et le repli annoncé n'était jamais atteint.
    const { req, doubles } = makeReq({ body: { collapsedGroups: ['content'] } })
    ;(req as unknown as { body: unknown }).body = {
      getReader: () => {
        throw new TypeError('ReadableStream is locked')
      },
    }

    const res = await save(req)

    expect(res.status).toBe(200)
    expect(doubles.create.mock.calls[0]![0].data.collapsedGroups).toEqual(['content'])
  })

  it('répond 400 sur un corps JSON illisible', async () => {
    const { req } = makeReq({ rawBody: '{not json' })

    const res = await save(req)

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid JSON body')
  })

  it('exige au moins navLayout ou collapsedGroups', async () => {
    const { res, json } = await patch({})

    expect(res.status).toBe(400)
    expect(json.error).toContain('required')
  })
})

describe('PATCH /preferences — forme du navLayout', () => {
  it('refuse un navLayout sans tableau groups plutôt que de le stocker tel quel', async () => {
    // Sans cette règle, un layout illisible était persisté et le customizer
    // ne pouvait plus le relire.
    const { res, doubles } = await patch({ navLayout: { version: 1 } })

    expect(res.status).toBe(400)
    expect(doubles.create).not.toHaveBeenCalled()
  })

  it('refuse un layout au-delà des plafonds de taille (50 groupes, 100 items, 50 enfants)', async () => {
    const groups = Array.from({ length: 51 }, (_, i) => ({ id: `g${i}`, title: 'G', items: [] }))
    const tooManyGroups = await patch({ navLayout: { version: 1, groups } })
    expect(tooManyGroups.res.status).toBe(400)
    expect(tooManyGroups.json.error).toContain('50 groups')

    const items = Array.from({ length: 101 }, (_, i) => entry({ id: `i${i}` }))
    expect((await patch({ navLayout: layoutWith(items) })).res.status).toBe(400)

    const children = Array.from({ length: 51 }, (_, i) => entry({ id: `c${i}` }))
    expect((await patch({ navLayout: layoutWith([entry({ children })]) })).res.status).toBe(400)
  })

  it('exige un titre de groupe, sous forme de title ou de label', async () => {
    const untitled = await patch({
      navLayout: { version: 1, groups: [{ id: 'g1', items: [] }] },
    })
    expect(untitled.res.status).toBe(400)

    const labelled = await patch({
      navLayout: { version: 1, groups: [{ id: 'g1', label: 'Contenu', items: [] }] },
    })
    expect(labelled.res.status).toBe(200)
  })
})

describe('PATCH /preferences — profondeur d\'imbrication', () => {
  it("s'arrête aux enfants : deux niveaux passent, trois sont refusés", async () => {
    const twoLevels = await patch({
      navLayout: layoutWith([entry({ children: [entry({ id: 'drafts' })] })]),
    })
    expect(twoLevels.res.status).toBe(200)

    const threeLevels = await patch({
      navLayout: layoutWith([
        entry({ children: [entry({ id: 'drafts', children: [entry({ id: 'deep' })] })] }),
      ]),
    })
    expect(threeLevels.res.status).toBe(400)
    expect(threeLevels.json.error).toContain('nesting depth')
  })
})

describe('PATCH /preferences — href des entrées', () => {
  it('refuse un href scripté, y compris sur un enfant', async () => {
    const onItem = await patch({
      navLayout: layoutWith([entry({ href: 'javascript:alert(1)' })]),
    })
    expect(onItem.res.status).toBe(400)

    const onChild = await patch({
      navLayout: layoutWith([entry({ children: [entry({ id: 'c', href: 'data:text/html,x' })] })]),
    })
    expect(onChild.res.status).toBe(400)

    const offSite = await patch({ navLayout: layoutWith([entry({ href: '//evil.com' })]) })
    expect(offSite.res.status).toBe(400)
    expect(offSite.json.error).toContain('href')
  })

  it('accepte un href vide, qui décrit un parent purement dépliant', async () => {
    const { res } = await patch({
      navLayout: layoutWith([entry({ href: '', children: [entry({ id: 'c' })] })]),
    })

    expect(res.status).toBe(200)
  })
})

describe('PATCH /preferences — champs requis des entrées', () => {
  it('refuse une entrée sans href ni icon : la sidebar les déréférence sans garde au rendu', async () => {
    const noHref = entry()
    delete (noHref as Record<string, unknown>).href
    expect((await patch({ navLayout: layoutWith([noHref]) })).res.status).toBe(400)

    const noIcon = entry()
    delete (noIcon as Record<string, unknown>).icon
    expect((await patch({ navLayout: layoutWith([noIcon]) })).res.status).toBe(400)
  })

  it('refuse un id vide ou plus long que 100 caractères', async () => {
    expect((await patch({ navLayout: layoutWith([entry({ id: '' })]) })).res.status).toBe(400)
    expect(
      (await patch({ navLayout: layoutWith([entry({ id: 'x'.repeat(101) })]) })).res.status,
    ).toBe(400)
  })

  it('refuse un libellé multilingue dont une traduction n\'est pas une chaîne', async () => {
    const { res, json } = await patch({
      navLayout: layoutWith([entry({ label: { fr: 'Pages', en: 42 } })]),
    })

    expect(res.status).toBe(400)
    expect(json.error).toContain('label.en')

    const valid = await patch({
      navLayout: layoutWith([entry({ label: { fr: 'Pages', en: 'Pages' } })]),
    })
    expect(valid.res.status).toBe(200)
  })
})

describe('PATCH /preferences — persistance', () => {
  it('crée le document avec la version portée par le layout', async () => {
    const { res, doubles } = await patch({ navLayout: layoutWith([entry()]) })

    expect(res.status).toBe(200)
    expect(doubles.create).toHaveBeenCalledTimes(1)
    expect(doubles.create.mock.calls[0]![0].data).toMatchObject({ version: 7 })
  })

  it('conserve la version 0 au lieu de la réécrire en 1', async () => {
    // L'empreinte est un djb2 non signé : 0 est légitime. Réécrit en 1, le
    // client relisait un désaccord de version et effaçait le layout.
    const { doubles } = await patch({
      navLayout: { version: 0, groups: [{ id: 'g1', title: 'C', items: [entry()] }] },
    })

    expect(doubles.create.mock.calls[0]![0].data.version).toBe(0)
  })

  it('retombe sur 1 quand le layout ne porte aucune version exploitable', async () => {
    const { doubles } = await patch({
      navLayout: { groups: [{ id: 'g1', title: 'C', items: [entry()] }] },
    })

    expect(doubles.create.mock.calls[0]![0].data.version).toBe(1)
  })

  it('met à jour le document existant au lieu d\'en créer un second', async () => {
    const { doubles } = await patch(
      { navLayout: layoutWith([entry()]) },
      { existingDoc: { id: 'pref-1', navLayout: null } },
    )

    expect(doubles.create).not.toHaveBeenCalled()
    expect(doubles.update).toHaveBeenCalledTimes(1)
    expect(doubles.update.mock.calls[0]![0]).toMatchObject({ id: 'pref-1' })
  })

  it('enregistre les groupes repliés seuls sans toucher au layout', async () => {
    const { res, doubles } = await patch({ collapsedGroups: ['content'] })

    expect(res.status).toBe(200)
    const data = doubles.create.mock.calls[0]![0].data
    expect(data.collapsedGroups).toEqual(['content'])
    expect(data).not.toHaveProperty('navLayout')
  })

  it('refuse des groupes repliés qui ne sont pas un tableau', async () => {
    const { res } = await patch({ collapsedGroups: 'content' })

    expect(res.status).toBe(400)
  })

  it('applique aux groupes repliés la règle exacte du champ, en 400 et non en 500', async () => {
    // L'endpoint ne vérifiait que `Array.isArray` alors que le champ de la
    // collection borne aussi le type et la taille des entrées : un corps
    // accepté ici mais refusé là levait une ValidationError, attrapée par le
    // catch de persistance et rendue en 500 opaque.
    const notStrings = await patch({ collapsedGroups: [{ id: 'content' }] })
    expect(notStrings.res.status).toBe(400)
    expect(notStrings.json.error).toContain('strings')
    expect(notStrings.doubles.create).not.toHaveBeenCalled()

    const tooLong = await patch({ collapsedGroups: ['x'.repeat(101)] })
    expect(tooLong.res.status).toBe(400)

    const tooMany = await patch({
      collapsedGroups: Array.from({ length: 51 }, (_, i) => `g${i}`),
    })
    expect(tooMany.res.status).toBe(400)
    expect(tooMany.json.error).toContain('50')
  })

  it('rend un 500 sans faire fuiter la stack quand la base est indisponible', async () => {
    const { req, doubles } = makeReq({ body: { collapsedGroups: [] } })
    doubles.find.mockRejectedValueOnce(new Error('SQLITE_BUSY'))

    const res = await save(req)

    expect(res.status).toBe(500)
    expect(doubles.errors.join('\n')).toContain('SQLITE_BUSY')
  })
})

describe('GET et DELETE /preferences', () => {
  it('rend un layout nul et aucun groupe replié quand rien n\'a été enregistré', async () => {
    const { req } = makeReq({})

    const res = await createGetPreferencesHandler(COLLECTION)(req)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ navLayout: null, version: null, collapsedGroups: [] })
  })

  it('rend le layout enregistré avec sa version', async () => {
    const { req } = makeReq({
      existingDoc: { id: 'p1', navLayout: { groups: [], version: 7 }, version: 7, collapsedGroups: ['a'] },
    })

    const res = await createGetPreferencesHandler(COLLECTION)(req)

    expect(await res.json()).toEqual({
      navLayout: { groups: [], version: 7 },
      version: 7,
      collapsedGroups: ['a'],
    })
  })

  it('supprime la personnalisation au reset, et reste idempotent quand il n\'y en a pas', async () => {
    const withDoc = makeReq({ existingDoc: { id: 'p1' } })
    const first = await createResetPreferencesHandler(COLLECTION)(withDoc.req)
    expect(first.status).toBe(200)
    expect(withDoc.doubles.delete).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))

    const empty = makeReq({})
    const second = await createResetPreferencesHandler(COLLECTION)(empty.req)
    expect(second.status).toBe(200)
    expect(empty.doubles.delete).not.toHaveBeenCalled()
  })
})
