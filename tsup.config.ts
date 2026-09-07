import { defineConfig, type Options } from 'tsup'
import { rmSync } from 'fs'

const baseExternals = [
  'payload',
  'payload/shared',
  '@payloadcms/ui',
  '@payloadcms/translations',
  '@payloadcms/next',
  '@payloadcms/next/templates',
  'react',
  'react-dom',
  'react/jsx-runtime',
  'next',
  'next/navigation',
  'next/link',
  '@consilioweb/payload-admin-nav',
  '@consilioweb/payload-admin-nav/client',
]

// Clean dist once before parallel builds start
rmSync('dist', { recursive: true, force: true })

const sharedConfig: Partial<Options> = {
  // ESM only: the package is `type: module` and the whole Payload 3 ecosystem
  // (payload, payload/shared, @payloadcms/ui, @payloadcms/next) is ESM-only with
  // no `require` condition. The CJS barrels tsup used to emit could only ever
  // throw ERR_REQUIRE_ESM, both on their own `./*.js` chunks and on payload.
  format: ['esm'],
  dts: true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  target: 'es2022',
  external: [...baseExternals, '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
  clean: false,
}

/** Client files produced by pass 2 (non-dnd components + hooks). */
const NON_DND_CLIENT_FILES = [
  'dist/components/AdminNav.js',
  'dist/components/GroupEditor.js',
  'dist/components/NavItemEditor.js',
  'dist/components/IconPicker.js',
  'dist/components/Icons.js',
  'dist/components/StyleInjector.js',
  'dist/components/NavUserProfile.js',
  'dist/components/NavFooterSlot.js',
  'dist/hooks/useNavPreferences.js',
  'dist/hooks/usePluginTranslation.js',
]

/** Client files produced by pass 3 (dnd-kit components, bundled). */
const DND_CLIENT_FILES = [
  'dist/components/NavCustomizer.js',
  'dist/components/SortableGroup.js',
  'dist/components/SortableItem.js',
]

/** Client file produced by pass 4 (the RSC view's client half). */
const VIEW_CLIENT_FILES = ['dist/views/NavCustomizerViewClient.js']

/**
 * Prepend "use client" to an explicit list of built files.
 *
 * esbuild drops the directive from the sources, so it has to be re-added after
 * the build. It must be done per-pass and never by walking a directory:
 * `defineConfig([...])` runs its entries in PARALLEL, and a walker over the
 * shared `dist/components` directory read (and rewrote) files another pass was
 * still flushing — the idempotence guard below then froze the truncated result
 * for good. Each pass now only touches the files it produced itself, and a
 * missing file fails the build instead of shipping a component without its
 * directive.
 */
async function prependUseClient(label: string, files: string[]) {
  const { readFileSync, writeFileSync, existsSync } = await import('fs')

  const missing: string[] = []
  for (const file of files) {
    if (!existsSync(file)) {
      missing.push(file)
      continue
    }
    const content = readFileSync(file, 'utf-8')
    if (content.startsWith('"use client"') || content.startsWith("'use client'")) continue
    writeFileSync(file, '"use client";\n' + content)
  }

  if (missing.length > 0) {
    throw new Error(`[${label}] missing built files: ${missing.join(', ')}`)
  }
  console.log(`✓ [${label}] Prepended "use client" to ${files.length} file(s)`)
}

export default defineConfig([
  // 1. Server entry — plugin + types + collection
  {
    ...sharedConfig,
    entry: { index: 'src/index.ts' },
  },

  // 2. Client — non-dnd components + utilities (bundle: false, individual files)
  //    Each component gets its own "use client" directive.
  //    The barrel client.ts does NOT get "use client" (matches Payload official pattern).
  {
    ...sharedConfig,
    entry: [
      'src/client.ts',
      'src/components/AdminNav.tsx',
      'src/components/GroupEditor.tsx',
      'src/components/NavItemEditor.tsx',
      'src/components/IconPicker.tsx',
      'src/components/Icons.tsx',
      'src/components/StyleInjector.tsx',
      'src/components/NavUserProfile.tsx',
      'src/components/NavFooterSlot.tsx',
      'src/hooks/useNavPreferences.ts',
      'src/hooks/usePluginTranslation.ts',
      'src/icons.ts',
      'src/utils.ts',
      'src/types.ts',
      'src/translations/keys.ts',
      'src/translations/en.ts',
      'src/translations/fr.ts',
      'src/translations/index.ts',
    ],
    bundle: false,
    onSuccess: async () => {
      await prependUseClient('non-dnd', NON_DND_CLIENT_FILES)
    },
  },

  // 3. Client — dnd-kit components (BUNDLED with @dnd-kit inlined)
  //    @dnd-kit has no "use client" directive, so it MUST be bundled inside
  //    our "use client" files to work with Turbopack SSR.
  {
    ...sharedConfig,
    entry: {
      'components/NavCustomizer': 'src/components/NavCustomizer.tsx',
      'components/SortableGroup': 'src/components/SortableGroup.tsx',
      'components/SortableItem': 'src/components/SortableItem.tsx',
    },
    external: baseExternals, // @dnd-kit NOT in externals → gets bundled
    noExternal: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities', '@dnd-kit/accessibility'],
    bundle: true,
    onSuccess: async () => {
      await prependUseClient('dnd', DND_CLIENT_FILES)
    },
  },

  // 4. Views — server component wrapper (bundle: false to avoid inlining dnd-kit)
  {
    ...sharedConfig,
    entry: [
      'src/views.ts',
      'src/views/NavCustomizerView.tsx',
      'src/views/NavCustomizerViewClient.tsx',
    ],
    bundle: false,
    onSuccess: async () => {
      // ONLY NavCustomizerViewClient must have "use client"
      // NavCustomizerView is an RSC (server component) — must NOT have "use client"
      await prependUseClient('views', VIEW_CLIENT_FILES)
    },
  },
])
