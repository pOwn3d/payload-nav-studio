#!/usr/bin/env node
/**
 * Post-build contract check on `dist/`.
 *
 * The RSC boundary of this package is carried by a `"use client"` directive that
 * esbuild strips and tsup re-adds after the fact. Nothing used to check the
 * result, so a corrupted or directive-less bundle could be published as-is.
 * This runs after `build` (and before `publish`) and fails loudly instead.
 */

import { existsSync, readFileSync } from 'node:fs'

/** Files that MUST start with the "use client" directive. */
const MUST_HAVE_DIRECTIVE = [
  'dist/components/AdminNav.js',
  'dist/components/GroupEditor.js',
  'dist/components/NavItemEditor.js',
  'dist/components/IconPicker.js',
  'dist/components/Icons.js',
  'dist/components/StyleInjector.js',
  'dist/components/NavUserProfile.js',
  'dist/components/NavFooterSlot.js',
  'dist/components/NavCustomizer.js',
  'dist/components/SortableGroup.js',
  'dist/components/SortableItem.js',
  'dist/hooks/useNavPreferences.js',
  'dist/hooks/usePluginTranslation.js',
  'dist/views/NavCustomizerViewClient.js',
]

/**
 * Files that MUST NOT carry it: the client barrel (Turbopack evaluates barrel
 * re-exports in SSR context) and the server component view.
 */
const MUST_NOT_HAVE_DIRECTIVE = [
  'dist/client.js',
  'dist/views/NavCustomizerView.js',
  // Server-only admin gate the view imports by relative path. The views pass is
  // `bundle: false`, so this file has to be emitted on its own — a missing entry
  // would ship a view whose import resolves to nothing.
  'dist/utils/requireAdmin.js',
]

/** Public entrypoints, as declared by the `exports` map. */
const ENTRYPOINTS = ['index', 'client', 'views']

const errors = []

const startsWithDirective = (content) =>
  content.startsWith('"use client"') || content.startsWith("'use client'")

for (const file of MUST_HAVE_DIRECTIVE) {
  if (!existsSync(file)) {
    errors.push(`missing: ${file}`)
    continue
  }
  const content = readFileSync(file, 'utf-8')
  if (!startsWithDirective(content)) {
    errors.push(`missing "use client" on the first line: ${file}`)
  }
  if (content.trim().length === 0) {
    errors.push(`empty output (truncated build?): ${file}`)
  }
}

for (const file of MUST_NOT_HAVE_DIRECTIVE) {
  if (!existsSync(file)) {
    errors.push(`missing: ${file}`)
    continue
  }
  if (startsWithDirective(readFileSync(file, 'utf-8'))) {
    errors.push(`unexpected "use client": ${file}`)
  }
}

for (const entry of ENTRYPOINTS) {
  for (const ext of ['js', 'd.ts']) {
    const file = `dist/${entry}.${ext}`
    if (!existsSync(file)) errors.push(`missing entrypoint artifact: ${file}`)
  }
}

// The package is ESM-only: a CJS artifact would resolve `payload` (ESM-only)
// through require() and throw ERR_REQUIRE_ESM.
for (const entry of ENTRYPOINTS) {
  for (const ext of ['cjs', 'd.cts']) {
    const file = `dist/${entry}.${ext}`
    if (existsSync(file)) errors.push(`unexpected CJS artifact: ${file}`)
  }
}

if (errors.length > 0) {
  console.error('✗ verify:dist failed:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log(`✓ verify:dist — ${MUST_HAVE_DIRECTIVE.length} client files, ${ENTRYPOINTS.length} entrypoints OK`)
