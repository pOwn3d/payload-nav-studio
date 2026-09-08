import { describe, expect, it } from 'vitest'
import { sanitizeNavGroups } from '../utils/navLayoutValidation.js'

/**
 * Read-side defense. `isSafeHref` only ever ran on the write paths (PATCH,
 * file import, editor input); the sidebar rendered whatever came back from the
 * database straight into `<Link href>`. Any layout that reached the row another
 * way — the collection's REST route, a migration, a restored backup, a version
 * of this plugin older than the write-side validation — went through untouched.
 */

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'pages',
  href: '/admin/collections/pages',
  label: 'Pages',
  icon: 'file-text',
  ...over,
})

const group = (items: unknown[], over: Record<string, unknown> = {}) => ({
  id: 'g1',
  title: 'Contenu',
  items,
  ...over,
})

describe('sanitizeNavGroups — ce qui est rendu dans la sidebar', () => {
  it('retire un href hors domaine déguisé en entrée légitime', () => {
    const out = sanitizeNavGroups([
      group([
        entry({ id: 'users', href: 'https://evil.tld/admin/login', label: 'Utilisateurs', icon: 'users' }),
        entry(),
      ]),
    ])

    expect(out![0]!.items.map((i) => i.id)).toEqual(['pages'])
  })

  it('retire les href scriptés et protocol-relative', () => {
    // `/<TAB>/evil.com` : le parseur WHATWG retire la tabulation avant de
    // résoudre, la navigation part donc vers https://evil.com/.
    for (const href of ['javascript:alert(1)', 'data:text/html,x', '//evil.com', '/\t/evil.com', '/\\evil.com']) {
      const out = sanitizeNavGroups([group([entry({ href })])])
      expect(out).toBeNull()
    }
  })

  it('retire une entrée dont icon ou href n\'est pas une chaîne : la sidebar les déréférence sans garde', () => {
    // `icon.startsWith('#')` et `item.href.includes('?')` lèvent un TypeError
    // dans un composant monté en beforeNavLinks, donc sur toutes les pages du
    // panel — et le lien « Personnaliser » qui permettrait de réinitialiser
    // vit dans cette même sidebar.
    const badIcon = entry({ id: 'a', icon: 42 })
    const noHref = entry({ id: 'b' })
    delete (noHref as Record<string, unknown>).href

    const out = sanitizeNavGroups([group([badIcon, noHref, entry()])])

    expect(out![0]!.items.map((i) => i.id)).toEqual(['pages'])
  })

  it('ne perd pas un item valide à cause d\'un seul enfant corrompu', () => {
    const out = sanitizeNavGroups([
      group([entry({ children: [entry({ id: 'ok' }), entry({ id: 'ko', href: 'javascript:x' })] })]),
    ])

    expect(out![0]!.items[0]!.children!.map((c) => c.id)).toEqual(['ok'])
  })

  it('écarte un groupe dont le titre n\'est pas rendable par React', () => {
    expect(sanitizeNavGroups([group([entry()], { title: { fr: { nested: 'x' } } })])).toBeNull()
    expect(sanitizeNavGroups([group([entry()], { title: { fr: 'Contenu' } })])).not.toBeNull()
  })

  it('borne les volumes stockés hors endpoint', () => {
    const many = Array.from({ length: 120 }, (_, i) => entry({ id: `i${i}` }))
    expect(sanitizeNavGroups([group(many)])![0]!.items).toHaveLength(100)

    const manyGroups = Array.from({ length: 80 }, (_, i) => group([entry({ id: `i${i}` })], { id: `g${i}` }))
    expect(sanitizeNavGroups(manyGroups)).toHaveLength(50)
  })

  it('rend null sur une entrée inexploitable, pour retomber sur la nav par défaut', () => {
    expect(sanitizeNavGroups(null)).toBeNull()
    expect(sanitizeNavGroups('nope')).toBeNull()
    expect(sanitizeNavGroups([])).toBeNull()
    expect(sanitizeNavGroups([group([])])).not.toBeNull()
  })

  it('laisse passer un layout légitime sans le modifier', () => {
    const layout = [group([entry({ children: [entry({ id: 'drafts', href: '/admin/collections/pages?draft=1' })] })])]

    expect(sanitizeNavGroups(layout)).toEqual(layout)
  })
})

describe('sanitizeNavGroups — ce qui sort du modèle de nav', () => {
  it('ne recopie pas les clés que le modèle ne décrit pas', () => {
    // La validation ne lit que id/href/label/icon/children : tout autre clé
    // traversait sans être ni lue ni retirée, du document jusqu'au
    // `JSON.stringify` du cache de session et jusqu'à React.
    const out = sanitizeNavGroups([
      group([entry({ junk: 'A'.repeat(1000), onClick: 'alert(1)' })], { junkGroup: 'x' }),
    ])

    const item = out![0]!.items[0]! as unknown as Record<string, unknown>
    expect(Object.keys(item).sort()).toEqual(['href', 'icon', 'id', 'label'])
    expect(Object.keys(out![0]! as unknown as Record<string, unknown>).sort()).toEqual([
      'id',
      'items',
      'title',
    ])
  })

  it('conserve les champs du modèle, y compris les drapeaux et les enfants', () => {
    // Le filtrage par liste blanche ne doit rien coûter à un layout légitime.
    const out = sanitizeNavGroups([
      group(
        [
          entry({
            matchPrefix: true,
            visible: false,
            live: true,
            children: [entry({ id: 'child', href: '/admin/collections/pages?a=1', alert: true })],
          }),
        ],
        { visible: true, defaultCollapsed: true },
      ),
    ])

    const item = out![0]!.items[0]! as unknown as Record<string, unknown>
    expect(item.matchPrefix).toBe(true)
    expect(item.visible).toBe(false)
    expect(item.live).toBe(true)
    expect((item.children as Record<string, unknown>[])[0]!.alert).toBe(true)
    expect((out![0]! as unknown as Record<string, unknown>).defaultCollapsed).toBe(true)
    expect((out![0]! as unknown as Record<string, unknown>).visible).toBe(true)
  })

  it('accepte un titre de groupe porté par l\'alias `label`', () => {
    const out = sanitizeNavGroups([{ id: 'g1', label: 'Contenu', items: [entry()] }])

    expect((out![0]! as unknown as Record<string, unknown>).label).toBe('Contenu')
  })
})
