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
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  target: 'es2022',
  external: [...baseExternals, '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
  clean: false,
}

/**
 * Recursively prepend "use client" to all .js files in a directory.
 * Skips files that already have it and explicitly skips barrel files.
 */
async function prependUseClient(...dirs: string[]) {
  const { readdirSync, readFileSync, writeFileSync, statSync, existsSync } = await import('fs')
  const { join } = await import('path')

  function walk(dir: string) {
    if (!existsSync(dir)) return
    for (const file of readdirSync(dir)) {
      const path = join(dir, file)
      if (statSync(path).isDirectory()) { walk(path); continue }
      if (!file.endsWith('.js') && !file.endsWith('.cjs')) continue
      if (file === 'client.js' || file === 'client.cjs') continue
      const content = readFileSync(path, 'utf-8')
      if (!content.startsWith('"use client"') && !content.startsWith("'use client'")) {
        writeFileSync(path, '"use client";\n' + content)
      }
    }
  }
  dirs.forEach(walk)
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
      await prependUseClient('dist/components', 'dist/hooks')
      console.log('✓ [non-dnd] Prepended "use client" to component/hook files')
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
      await prependUseClient('dist/components')
      console.log('✓ [dnd] Prepended "use client" to dnd component files')
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
      const { readFileSync, writeFileSync } = await import('fs')
      const clientFile = 'dist/views/NavCustomizerViewClient.js'
      const content = readFileSync(clientFile, 'utf-8')
      if (!content.startsWith('"use client"')) {
        writeFileSync(clientFile, '"use client";\n' + content)
      }
      console.log('✓ [views] Prepended "use client" to NavCustomizerViewClient only')
    },
  },
])
