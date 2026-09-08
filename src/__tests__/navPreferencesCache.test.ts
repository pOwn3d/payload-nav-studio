import { describe, expect, it } from 'vitest'
import {
  cacheOwnerKey,
  isCacheFresh,
  readCache,
  type NavCacheStorage,
} from '../hooks/useNavPreferences.js'

/**
 * Le cache de la sidebar a deux étages — sessionStorage (durée de l'onglet) et
 * des variables de module (durée du contexte JS) — et aucun des deux n'est lié
 * à une session Payload : la déconnexion puis la reconnexion se font dans le
 * même onglet, par navigation client. Deux conséquences, toutes deux couvertes
 * ici : le cache d'un compte ne doit pas être servi au suivant, et ce qui en
 * ressort doit repasser par `sanitizeNavGroups` — le fetch, seul endroit où il
 * tournait, est justement court-circuité pendant 60 s.
 */

/** Clés du contrat de stockage (constantes privées du module). */
const K = {
  owner: 'admin-nav-owner',
  layout: 'admin-nav-layout',
  defaultNav: 'admin-nav-default',
  isCustom: 'admin-nav-is-custom',
  collapsed: 'admin-nav-collapsed',
  version: 'admin-nav-version',
  ts: 'admin-nav-cache-ts',
}

const storageOf = (entries: Record<string, string>): NavCacheStorage => ({
  getItem: (k) => entries[k] ?? null,
  setItem: (k, v) => {
    entries[k] = v
  },
  removeItem: (k) => {
    delete entries[k]
  },
})

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'pages',
  href: '/admin/collections/pages',
  label: 'Pages',
  icon: 'file-text',
  ...over,
})

const group = (items: unknown[]) => ({ id: 'g1', title: 'Contenu', items })

const cacheOf = (layout: unknown, over: Record<string, string> = {}) =>
  storageOf({
    [K.owner]: 'users:3',
    [K.layout]: JSON.stringify(layout),
    [K.defaultNav]: JSON.stringify([group([entry()])]),
    [K.isCustom]: '1',
    [K.collapsed]: JSON.stringify(['content']),
    [K.version]: '7',
    [K.ts]: String(Date.now()),
    ...over,
  })

describe('cacheOwnerKey — identité du cache', () => {
  it("distingue deux comptes de même id dans des collections différentes", () => {
    // Même piège que côté collection : un relationship mono-cible est stocké en
    // id nu, l'admin #3 et le client #3 se confondent si on ne garde que l'id.
    expect(cacheOwnerKey({ id: 3, collection: 'users' })).not.toBe(
      cacheOwnerKey({ id: 3, collection: 'customers' }),
    )
  })

  it('rend null tant que le lecteur est inconnu, ce qui désactive le cache', () => {
    expect(cacheOwnerKey(null)).toBeNull()
    expect(cacheOwnerKey(undefined)).toBeNull()
    expect(cacheOwnerKey({ collection: 'users' })).toBeNull()
  })
})

describe('readCache — appartenance du cache', () => {
  it("ne sert pas à un compte le cache laissé par le précédent dans le même onglet", () => {
    // La déconnexion Payload est une navigation client : sessionStorage
    // survivait, et avec elle le defaultNav déjà filtré aux permissions du
    // premier compte — c'est-à-dire la carte des collections qu'il pouvait lire.
    const storage = cacheOf([group([entry()])])

    expect(readCache('users:4', storage)).toBeNull()
    expect(readCache('customers:3', storage)).toBeNull()
    expect(readCache('users:3', storage)).not.toBeNull()
  })

  it('ne lit rien quand le lecteur est inconnu', () => {
    expect(readCache(null, cacheOf([group([entry()])]))).toBeNull()
  })
})

describe('readCache — assainissement de ce qui ressort du cache', () => {
  it('retire du cache une entrée que sanitizeNavGroups aurait retirée du fetch', () => {
    // Un layout empoisonné avant correctif, chargé une fois par la victime, se
    // retrouvait en sessionStorage et était rendu tel quel dans <Link href> à
    // chaque rechargement de l'onglet.
    const storage = cacheOf([
      group([entry({ id: 'evil', href: 'https://evil.tld/admin/login' }), entry()]),
    ])

    const cached = readCache('users:3', storage)

    expect(cached!.layout[0]!.items.map((i) => i.id)).toEqual(['pages'])
  })

  it('rend null quand rien ne survit, pour retomber sur la nav par défaut', () => {
    const storage = cacheOf([group([entry({ icon: 42 })])])

    expect(readCache('users:3', storage)).toBeNull()
  })

  it('laisse intact un cache légitime, versions et groupes repliés compris', () => {
    const layout = [group([entry()])]
    const cached = readCache('users:3', cacheOf(layout))

    expect(cached).toEqual({
      layout,
      defaultNav: [group([entry()])],
      isCustom: true,
      collapsedGroups: ['content'],
      navVersion: 7,
    })
  })
})

describe('isCacheFresh — court-circuit du fetch', () => {
  const now = 1_700_000_000_000

  it("n'autorise pas un compte à sauter le fetch grâce à l'horodatage d'un autre", () => {
    // C'est ce court-circuit qui rendait la fuite durable : sans lui le premier
    // fetch corrigeait tout, avec lui le mauvais cache tenait une minute.
    const storage = cacheOf([group([entry()])], { [K.ts]: String(now - 1_000) })

    expect(isCacheFresh('users:4', now, storage)).toBe(false)
    expect(isCacheFresh(null, now, storage)).toBe(false)
    expect(isCacheFresh('users:3', now, storage)).toBe(true)
  })

  it('laisse repartir le fetch au-delà du TTL', () => {
    const storage = cacheOf([group([entry()])], { [K.ts]: String(now - 60_001) })

    expect(isCacheFresh('users:3', now, storage)).toBe(false)
  })
})
