import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * The stylesheet exists twice: `src/styles/admin-nav.css` (the package's
 * `./styles` export, for hosts that import it themselves) and a copy inlined in
 * `StyleInjector.tsx` (what the sidebar actually injects at runtime). A fix
 * applied to one and not the other ships as fixed and behaves as broken, which
 * is exactly what happened to the focus indicator below.
 */
const CSS_FILE = new URL('../styles/admin-nav.css', import.meta.url)
const INJECTOR_FILE = new URL('../components/StyleInjector.tsx', import.meta.url)

const css = readFileSync(CSS_FILE, 'utf-8')
const injector = readFileSync(INJECTOR_FILE, 'utf-8')

/** The CSS embedded in the template literal of StyleInjector. */
const injected = injector.slice(
  injector.indexOf('const ADMIN_NAV_CSS = `') + 'const ADMIN_NAV_CSS = `'.length,
  injector.lastIndexOf('`'),
)

/** Selectors declared by a stylesheet, comments and whitespace removed. */
function selectorsOf(sheet: string): string[] {
  return sheet
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .flatMap((block) => {
      const head = block.split('{')[0]
      return head.includes(':') && !head.trim().startsWith('@') && block.indexOf('{') === -1
        ? []
        : head.split(',').map((selector) => selector.trim().replace(/\s+/g, ' '))
    })
    .filter((selector) => selector.length > 0 && !selector.startsWith('@'))
}

describe('the jump-to input has a focus indicator', () => {
  // It sets `outline: none` on itself, and the only remaining cue was the
  // wrapper's `:focus-within` — a 1px border plus a 1px shadow at 30 % of the
  // accent, which does not meet the 3:1 contrast WCAG 2.2 SC 2.4.11 asks for.
  for (const [name, sheet] of [
    ['admin-nav.css', css],
    ['StyleInjector.tsx', injected],
  ] as const) {
    it(`is declared in ${name}`, () => {
      const rule = sheet.match(/\.admin-nav__jumpto-input:focus-visible\s*\{([^}]*)\}/)
      expect(rule, `no :focus-visible rule for .admin-nav__jumpto-input in ${name}`).not.toBeNull()

      const body = rule![1]
      expect(body).toMatch(/outline:\s*[^;]*solid/)
      expect(body).not.toMatch(/outline:\s*none/)
    })
  }

  it('still clears the native outline, so the rule above is load-bearing', () => {
    // Guards the test itself: if someone simply dropped `outline: none` from
    // the base rule, the browser default would be back and the assertions above
    // would keep passing for the wrong reason.
    expect(css).toMatch(/\.admin-nav__jumpto-input\s*\{[^}]*outline:\s*none/)
  })
})

describe('the two copies of the stylesheet stay in sync', () => {
  it('declares the same selectors on both sides', () => {
    const inFile = new Set(selectorsOf(css))
    const inInjector = new Set(selectorsOf(injected))

    const onlyInFile = [...inFile].filter((selector) => !inInjector.has(selector))
    const onlyInInjector = [...inInjector].filter((selector) => !inFile.has(selector))

    expect({ onlyInFile, onlyInInjector }).toEqual({ onlyInFile: [], onlyInInjector: [] })
  })

  it('compares something rather than two empty sets', () => {
    expect(selectorsOf(css).length).toBeGreaterThan(100)
  })
})
