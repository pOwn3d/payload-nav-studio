import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NavGroupConfig } from '../types.js'
import {
  computeNavFingerprint,
  dedupeNavItems,
  isSafeHref,
  isMultiLang,
  resolveLabel,
} from '../utils.js'

const TAB = String.fromCharCode(9)
const LF = String.fromCharCode(10)
const CR = String.fromCharCode(13)

/** Small nav builder so each test states only what it is actually about. */
function nav(overrides: Partial<NavGroupConfig>[] = []): NavGroupConfig[] {
  const base: NavGroupConfig[] = [
    {
      id: 'content',
      title: 'Content',
      items: [
        { id: 'pages', href: '/admin/collections/pages', label: 'Pages', icon: 'file-text' },
        { id: 'posts', href: '/admin/collections/posts', label: 'Posts', icon: 'newspaper' },
      ],
    },
  ]
  return overrides.length ? (overrides as NavGroupConfig[]) : base
}

describe('isSafeHref — ce qui a le droit de finir dans un href de nav', () => {
  it('accepte un chemin interne du panel admin', () => {
    expect(isSafeHref('/admin/collections/pages')).toBe(true)
    expect(isSafeHref('/admin/nav-customizer?tab=groups#top')).toBe(true)
  })

  it('accepte un href vide : une entrée parente qui ne fait qu\'ouvrir ses enfants', () => {
    expect(isSafeHref('')).toBe(true)
    expect(isSafeHref('   ')).toBe(true)
  })

  it('refuse les URL scriptées quelles que soient la casse et les espaces autour', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false)
    expect(isSafeHref('  JavaScript:alert(1)  ')).toBe(false)
    expect(isSafeHref('VBScript:msgbox(1)')).toBe(false)
    expect(isSafeHref('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false)
  })

  it('refuse une navigation hors site déguisée en chemin relatif', () => {
    // Le « doit commencer par / » seul laisse passer //evil.com : le navigateur
    // le lit comme protocol-relative et quitte le site.
    expect(isSafeHref('//evil.com')).toBe(false)
    expect(isSafeHref('/' + '\\' + 'evil.com')).toBe(false)
  })

  it("refuse tout ce qui n'est pas un chemin absolu du site", () => {
    expect(isSafeHref('https://evil.com/admin')).toBe(false)
    expect(isSafeHref('mailto:contact@example.com')).toBe(false)
    expect(isSafeHref('admin/collections/pages')).toBe(false)
    expect(isSafeHref('../../etc/passwd')).toBe(false)
  })

  it('laisse passer un %09 encodé, qui reste bien dans le chemin du site', () => {
    // Contre-exemple du cas suivant : une tabulation *encodée* n'est pas
    // retirée par le parseur d'URL, l'href reste donc same-origin.
    expect(isSafeHref('/%09/evil.com')).toBe(true)
  })

  // BUG : une tabulation / un saut de ligne *brut* entre les deux slashs est
  // supprimé par le parseur d'URL du navigateur (WHATWG URL, « remove all
  // ASCII tab or newline »), donc `/<TAB>/evil.com` se résout en
  // `https://evil.com/`. Vérifié : new URL('/<TAB>/evil.com', base).href
  // === 'https://evil.com/'. Le href est rendu tel quel dans un <Link href>
  // par AdminNav, donc le clic (ou l'ouverture dans un nouvel onglet) part
  // hors site. La garde `startsWith('//')` ne voit pas cette variante.
  it('devrait refuser //evil.com camouflé par un caractère de contrôle interne', () => {
    expect(isSafeHref('/' + TAB + '/evil.com')).toBe(false)
    expect(isSafeHref('/' + LF + '/evil.com')).toBe(false)
    expect(isSafeHref('/' + CR + '/evil.com')).toBe(false)
  })
})

describe('computeNavFingerprint — quand une préférence utilisateur doit être invalidée', () => {
  it('donne la même empreinte pour deux structures identiques', () => {
    expect(computeNavFingerprint(nav())).toBe(computeNavFingerprint(nav()))
  })

  it("change d'empreinte quand un href d'item change", () => {
    const before = computeNavFingerprint(nav())
    const after = computeNavFingerprint([
      {
        id: 'content',
        title: 'Content',
        items: [
          { id: 'pages', href: '/admin/collections/landing', label: 'Pages', icon: 'file-text' },
          { id: 'posts', href: '/admin/collections/posts', label: 'Posts', icon: 'newspaper' },
        ],
      },
    ])

    expect(after).not.toBe(before)
  })

  it("change d'empreinte quand un groupe est renommé au niveau de son id", () => {
    const after = computeNavFingerprint([{ ...nav()[0]!, id: 'editorial' }])

    expect(after).not.toBe(computeNavFingerprint(nav()))
  })

  it("change d'empreinte quand un sous-item est ajouté", () => {
    const withChild = computeNavFingerprint([
      {
        ...nav()[0]!,
        items: [
          {
            id: 'pages',
            href: '/admin/collections/pages',
            label: 'Pages',
            icon: 'file-text',
            children: [
              { id: 'drafts', href: '/admin/collections/pages?draft=1', label: 'Drafts', icon: 'file' },
            ],
          },
          nav()[0]!.items[1]!,
        ],
      },
    ])

    expect(withChild).not.toBe(computeNavFingerprint(nav()))
  })

  it("NE change PAS d'empreinte quand seul un libellé est retouché", () => {
    // Traduire ou reformuler un libellé ne doit pas effacer la personnalisation
    // de tous les utilisateurs : seule la structure (ids + hrefs) compte.
    const renamed = computeNavFingerprint([
      {
        ...nav()[0]!,
        title: 'Contenu éditorial',
        items: [
          { id: 'pages', href: '/admin/collections/pages', label: 'Pages du site', icon: 'layout' },
          { id: 'posts', href: '/admin/collections/posts', label: 'Articles', icon: 'newspaper' },
        ],
      },
    ])

    expect(renamed).toBe(computeNavFingerprint(nav()))
  })

  it('produit un entier non signé, 0 compris — 0 est une version valide', () => {
    const fingerprint = computeNavFingerprint(nav())

    expect(Number.isInteger(fingerprint)).toBe(true)
    expect(fingerprint).toBeGreaterThanOrEqual(0)
    expect(computeNavFingerprint([])).toBeGreaterThanOrEqual(0)
  })
})

describe('dedupeNavItems — un même item déclaré dans deux groupes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ne garde que la première occurrence, dans le groupe où elle a été déclarée', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const groups: NavGroupConfig[] = [
      {
        id: 'content',
        title: 'Content',
        items: [{ id: 'pages', href: '/admin/collections/pages', label: 'Pages', icon: 'file-text' }],
      },
      {
        id: 'settings',
        title: 'Settings',
        items: [
          { id: 'pages', href: '/admin/collections/pages', label: 'Pages', icon: 'file-text' },
          { id: 'users', href: '/admin/collections/users', label: 'Users', icon: 'user-cog' },
        ],
      },
    ]

    const result = dedupeNavItems(groups)

    expect(result[0]!.items.map((i) => i.id)).toEqual(['pages'])
    expect(result[1]!.items.map((i) => i.id)).toEqual(['users'])
  })

  it('conserve les groupes devenus vides plutôt que de les supprimer en silence', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const groups: NavGroupConfig[] = [
      { id: 'a', title: 'A', items: [{ id: 'x', href: '/admin/x', label: 'X', icon: 'box' }] },
      { id: 'b', title: 'B', items: [{ id: 'x', href: '/admin/x', label: 'X', icon: 'box' }] },
    ]

    const result = dedupeNavItems(groups)

    expect(result).toHaveLength(2)
    expect(result[1]!.items).toEqual([])
  })

  it('ne mute pas la configuration fournie par le consommateur', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const groups: NavGroupConfig[] = [
      { id: 'a', title: 'A', items: [{ id: 'x', href: '/admin/x', label: 'X', icon: 'box' }] },
      { id: 'b', title: 'B', items: [{ id: 'x', href: '/admin/x', label: 'X', icon: 'box' }] },
    ]

    dedupeNavItems(groups)

    expect(groups[1]!.items).toHaveLength(1)
  })

})

describe('resolveLabel — libellés multilingues', () => {
  it('rend la langue demandée quand elle existe', () => {
    expect(resolveLabel({ fr: 'Pages', en: 'Pages EN' }, 'en')).toBe('Pages EN')
  })

  it('retombe sur la langue de repli, puis sur la première valeur, puis sur une chaîne vide', () => {
    expect(resolveLabel({ fr: 'Pages' }, 'de', 'fr')).toBe('Pages')
    expect(resolveLabel({ es: 'Páginas' }, 'de', 'fr')).toBe('Páginas')
    expect(resolveLabel({}, 'fr')).toBe('')
  })

  it('laisse passer une chaîne simple telle quelle', () => {
    expect(resolveLabel('Pages', 'fr')).toBe('Pages')
    expect(isMultiLang('Pages')).toBe(false)
    expect(isMultiLang({ fr: 'Pages' })).toBe(true)
  })
})
