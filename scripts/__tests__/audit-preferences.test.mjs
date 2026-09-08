import { describe, expect, it } from 'vitest'

import {
  analyseRow,
  findDuplicateOwners,
  findPreferencesCollection,
  ownerCollectionSlug,
  parseArgs,
  relationId,
  rendersAsStored,
  summarise,
} from '../audit-preferences.mjs'

import {
  sanitizeNavGroups,
  validateCollapsedGroups,
  validateNavLayout,
} from '../../src/utils/navLayoutValidation.ts'

/**
 * The audit has to judge rows with the very code that renders them, so the
 * tests wire the real validators rather than doubles. A double here would
 * happily pass while the script and the sidebar disagreed in production.
 */
const realDeps = (overrides = {}) => ({
  duplicateOwnerIds: new Set(),
  ownerExists: () => true,
  sanitizeNavGroups,
  validateCollapsedGroups,
  validateNavLayout,
  ...overrides,
})

const item = (id, over = {}) => ({ href: `/admin/${id}`, icon: 'box', id, label: id, ...over })
const group = (id, items) => ({ id, items, title: id })
const layout = (groups) => ({ groups })

describe('collection discovery', () => {
  const preferences = {
    slug: 'admin-nav-preferences',
    fields: [
      { name: 'user', relationTo: 'users', type: 'relationship' },
      { name: 'navLayout', type: 'json' },
      { name: 'collapsedGroups', type: 'json' },
      { name: 'version', type: 'number' },
    ],
  }

  it('finds the collection by its field signature, whatever its slug', () => {
    const renamed = { ...preferences, slug: 'sidebar-prefs' }
    expect(findPreferencesCollection({ collections: [renamed] })).toEqual({
      ownerSlug: 'users',
      slug: 'sidebar-prefs',
    })
  })

  it('reads the owner collection off `user.relationTo`, not from a default', () => {
    const custom = {
      ...preferences,
      fields: preferences.fields.map((f) => (f.name === 'user' ? { ...f, relationTo: 'staff' } : f)),
    }
    expect(findPreferencesCollection({ collections: [custom] }).ownerSlug).toBe('staff')
  })

  it('ignores a collection that only carries part of the signature', () => {
    const decoy = { slug: 'other', fields: [{ name: 'user' }, { name: 'navLayout' }] }
    expect(findPreferencesCollection({ collections: [decoy] })).toBeNull()
  })

  it('refuses to guess when two collections match', () => {
    const twin = { ...preferences, slug: 'twin' }
    expect(findPreferencesCollection({ collections: [preferences, twin] })).toBeNull()
  })

  it('honours an explicit slug over the signature', () => {
    const decoy = { slug: 'legacy-prefs', fields: [{ name: 'user', relationTo: 'admins' }] }
    expect(findPreferencesCollection({ collections: [preferences, decoy] }, 'legacy-prefs')).toEqual({
      ownerSlug: 'admins',
      slug: 'legacy-prefs',
    })
  })

  it('reports a polymorphic relationship as unusable rather than picking one target', () => {
    const poly = { fields: [{ name: 'user', relationTo: ['users', 'staff'] }] }
    expect(ownerCollectionSlug(poly)).toBeNull()
  })
})

describe('owner checks', () => {
  it('flags a row whose owner does not exist in the admin auth collection', () => {
    const result = analyseRow({ id: 1, user: 42 }, realDeps({ ownerExists: () => false }))
    expect(result.issues.map((i) => i.code)).toEqual(['foreign-owner'])
    expect(result.deletable).toBe(true)
  })

  it('leaves a row alone when its owner is a real admin', () => {
    const result = analyseRow({ id: 1, user: 7 }, realDeps())
    expect(result.issues).toEqual([])
    expect(result.deletable).toBe(false)
  })

  it('flags a row with no owner at all', () => {
    expect(analyseRow({ id: 1, user: null }, realDeps()).issues.map((i) => i.code)).toEqual([
      'no-owner',
    ])
  })

  it('reports a squatted owner but never marks it deletable', () => {
    const deps = realDeps({ duplicateOwnerIds: new Set(['7']) })
    const result = analyseRow({ id: 2, user: 7 }, deps)
    expect(result.issues.map((i) => i.code)).toEqual(['duplicate-owner'])
    // Deleting one of two rows for the same owner destroys a real layout half
    // the time; the script reports and stops.
    expect(result.deletable).toBe(false)
    expect(result.repair).toBeNull()
  })

  it('detects duplicates through both bare ids and populated relationships', () => {
    const rows = [{ user: 3 }, { user: { id: 3 } }, { user: 9 }]
    expect(findDuplicateOwners(rows)).toEqual(new Set(['3']))
  })

  it('reads an id out of a populated relationship', () => {
    expect(relationId({ id: 'abc', email: 'x@y.z' })).toBe('abc')
    expect(relationId('abc')).toBe('abc')
    expect(relationId(undefined)).toBeNull()
  })
})

describe('stored layouts', () => {
  it('reports a layout the read-side check rejects wholesale', () => {
    // `javascript:` is exactly what `isSafeHref` refuses, so no entry survives
    // and the owner silently gets the default nav.
    const row = {
      id: 1,
      navLayout: layout([group('g', [item('i', { href: 'javascript:alert(1)' })])]),
      user: 7,
    }
    const result = analyseRow(row, realDeps())
    expect(result.issues.map((i) => i.code)).toContain('layout-rejected')
    expect(result.repair).toEqual({ navLayout: null })
  })

  it('reports a layout that renders partially, and repairs it to what renders', () => {
    const row = {
      id: 1,
      navLayout: layout([group('g', [item('good'), item('bad', { href: '//evil.example' })])]),
      user: 7,
    }
    const result = analyseRow(row, realDeps())
    expect(result.issues.map((i) => i.code)).toContain('layout-filtered')
    expect(result.repair.navLayout.groups[0].items.map((i) => i.id)).toEqual(['good'])
  })

  it("the repair it writes is one the collection's own validator accepts", () => {
    // The whole point of --fix: the row must become savable by its owner again.
    const row = {
      id: 1,
      navLayout: layout([group('g', [item('good'), item('bad', { icon: 42 })])]),
      user: 7,
    }
    const { repair } = analyseRow(row, realDeps())
    expect(validateNavLayout(repair.navLayout)).toBeNull()
  })

  it('says nothing about a layout that is already clean', () => {
    const row = { id: 1, navLayout: layout([group('g', [item('a'), item('b')])]), user: 7 }
    expect(analyseRow(row, realDeps()).issues).toEqual([])
  })

  it('counts a dropped child as a change even when the parent survives', () => {
    const row = {
      id: 1,
      navLayout: layout([
        group('g', [item('parent', { children: [item('kid'), item('bad', { icon: null })] })]),
      ]),
      user: 7,
    }
    const result = analyseRow(row, realDeps())
    expect(result.issues.map((i) => i.code)).toContain('layout-filtered')
  })

  it('treats an unknown key stored on an entry as a change', () => {
    // `sanitizeNavGroups` rebuilds entries key by key, so a blob parked under an
    // arbitrary key never reaches the browser — but it stays in the row, and no
    // count changes. This is the case a structural walk misses.
    const row = {
      id: 1,
      navLayout: layout([group('g', [item('a', { payload: 'x'.repeat(50) })])]),
      user: 7,
    }
    const result = analyseRow(row, realDeps())
    expect(result.issues.map((i) => i.code)).toContain('layout-filtered')
    expect(result.repair.navLayout.groups[0].items[0]).not.toHaveProperty('payload')
  })

  it('treats a non-boolean flag as a change — it is dropped at render time', () => {
    const row = { id: 1, navLayout: layout([group('g', [item('a', { visible: 'yes' })])]), user: 7 }
    const result = analyseRow(row, realDeps())
    expect(result.issues.map((i) => i.code)).toContain('layout-filtered')
  })

  it('clears a navLayout that is not even an object', () => {
    // The owner cannot save this row: the field validator refuses the value it
    // is handed back on every update. Clearing it is what unblocks them.
    const row = { id: 1, navLayout: 'not-a-layout', user: 7 }
    const result = analyseRow(row, realDeps())
    expect(result.issues.map((i) => i.code)).toEqual(['layout-invalid'])
    expect(result.repair).toEqual({ navLayout: null })
  })

  it('reports an oversized collapsedGroups and trims it', () => {
    const row = { collapsedGroups: ['ok', 42, 'x'.repeat(200)], id: 1, user: 7 }
    const result = analyseRow(row, realDeps())
    expect(result.issues.map((i) => i.code)).toContain('collapsed-invalid')
    expect(result.repair.collapsedGroups).toEqual(['ok'])
  })
})

describe('rendersAsStored', () => {
  it('is false when an entry disappears', () => {
    expect(rendersAsStored([group('g', [item('a'), item('b')])], [group('g', [item('a')])])).toBe(
      false,
    )
  })

  it('is true when nothing was dropped', () => {
    expect(rendersAsStored([group('g', [item('a')])], [group('g', [item('a')])])).toBe(true)
  })

  it('is false when a group id changed position', () => {
    expect(
      rendersAsStored([group('a', []), group('b', [])], [group('b', []), group('a', [])]),
    ).toBe(false)
  })

  it('is not fooled by key order — otherwise every single row would be reported', () => {
    expect(
      rendersAsStored(
        [{ id: 'g', items: [], title: 'g' }],
        [{ items: [], title: 'g', id: 'g' }],
      ),
    ).toBe(true)
  })
})

describe('cli surface', () => {
  it('defaults to report-only', () => {
    expect(parseArgs([])).toStrictEqual({ collection: null, fix: false, help: false, limit: 500 })
  })

  it('parses the documented flags', () => {
    expect(parseArgs(['--fix', '--collection=nav', '--batch=42'])).toMatchObject({
      collection: 'nav',
      fix: true,
      limit: 42,
    })
  })

  it('ignores a nonsense batch size rather than reading zero rows a page', () => {
    expect(parseArgs(['--batch=0']).limit).toBe(500)
    expect(parseArgs(['--batch=nope']).limit).toBe(500)
  })

  it('caps the batch size', () => {
    expect(parseArgs(['--batch=99999']).limit).toBe(1000)
  })
})

describe('summarise', () => {
  it('counts issues by code across rows', () => {
    const results = [
      { issues: [{ code: 'foreign-owner' }, { code: 'layout-filtered' }] },
      { issues: [{ code: 'foreign-owner' }] },
    ]
    expect(summarise(results)).toEqual({ 'foreign-owner': 2, 'layout-filtered': 1 })
  })
})
