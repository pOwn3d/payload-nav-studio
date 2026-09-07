import { describe, expect, it } from 'vitest'
import { resolveLayout } from '../hooks/useNavPreferences.js'
import type { NavGroupConfig } from '../types.js'

const defaultNav: NavGroupConfig[] = [
  {
    id: 'content',
    title: 'Content',
    items: [{ id: 'pages', href: '/admin/collections/pages', label: 'Pages', icon: 'file-text' }],
  },
]

const storedGroups: NavGroupConfig[] = [
  {
    id: 'mine',
    title: 'Mon menu',
    items: [{ id: 'posts', href: '/admin/collections/posts', label: 'Articles', icon: 'newspaper' }],
  },
]

describe('resolveLayout — arbitrage entre la nav par défaut et la nav personnalisée', () => {
  it('affiche la nav personnalisée quand elle correspond à la structure servie', () => {
    const result = resolveLayout({
      storedVersion: 42,
      currentVersion: 42,
      storedGroups,
      defaultNav,
    })

    expect(result.layout).toBe(storedGroups)
    expect(result.isCustom).toBe(true)
    expect(result.discardStored).toBe(false)
  })

  it('jette la personnalisation quand la structure de la nav a changé', () => {
    const result = resolveLayout({
      storedVersion: 42,
      currentVersion: 43,
      storedGroups,
      defaultNav,
    })

    expect(result.layout).toBe(defaultNav)
    expect(result.isCustom).toBe(false)
    expect(result.discardStored).toBe(true)
  })

  it("ne jette JAMAIS la personnalisation quand la version courante est inconnue", () => {
    // Serveur injoignable ou réponse incomplète : ne pas détruire le seul
    // élément que ce plugin persiste sur la foi d'une comparaison impossible.
    const result = resolveLayout({
      storedVersion: 42,
      currentVersion: undefined,
      storedGroups,
      defaultNav,
    })

    expect(result.layout).toBe(storedGroups)
    expect(result.isCustom).toBe(true)
    expect(result.discardStored).toBe(false)
  })

  it("conserve une personnalisation enregistrée avant l'existence du versionnage", () => {
    const result = resolveLayout({
      storedVersion: null,
      currentVersion: 43,
      storedGroups,
      defaultNav,
    })

    expect(result.layout).toBe(storedGroups)
    expect(result.discardStored).toBe(false)
  })

  it('traite la version 0 comme une version légitime, pas comme une absence', () => {
    // L'empreinte est un djb2 non signé : 0 est une valeur possible. La traiter
    // comme « pas de version » relançait une migration à chaque chargement.
    const same = resolveLayout({
      storedVersion: 0,
      currentVersion: 0,
      storedGroups,
      defaultNav,
    })

    expect(same.discardStored).toBe(false)
    expect(same.layout).toBe(storedGroups)
  })

  it('détecte bien une migration depuis la version 0 vers une autre', () => {
    const migrated = resolveLayout({
      storedVersion: 0,
      currentVersion: 7,
      storedGroups,
      defaultNav,
    })

    expect(migrated.discardStored).toBe(true)
    expect(migrated.layout).toBe(defaultNav)
  })

  it("affiche la nav par défaut, sans migration, quand l'utilisateur n'a rien personnalisé", () => {
    const result = resolveLayout({
      storedVersion: null,
      currentVersion: 43,
      storedGroups: null,
      defaultNav,
    })

    expect(result.layout).toBe(defaultNav)
    expect(result.isCustom).toBe(false)
    expect(result.discardStored).toBe(false)
  })
})
