import { defineConfig, type Options } from 'tsup'
import { writeFileSync, readFileSync, rmSync } from 'fs'

const CLIENT_BANNER = '"use client";\n'

// Shared externals for server/views entries — @dnd-kit is external (not needed on server)
const serverExternals = [
  'payload',
  '@payloadcms/ui',
  '@payloadcms/next',
  '@payloadcms/next/templates',
  'react',
  'react-dom',
  'react/jsx-runtime',
  'next',
  'next/navigation',
  'next/link',
  '@dnd-kit/core',
  '@dnd-kit/sortable',
  '@dnd-kit/utilities',
  '@consilioweb/admin-nav',
  '@consilioweb/admin-nav/client',
]

// Client externals — @dnd-kit is NOT external here (bundled into client.js)
// because consumers may not have @dnd-kit installed
const clientExternals = [
  'payload',
  '@payloadcms/ui',
  '@payloadcms/next',
  '@payloadcms/next/templates',
  'react',
  'react-dom',
  'react/jsx-runtime',
  'next',
  'next/navigation',
  'next/link',
  '@consilioweb/admin-nav',
  '@consilioweb/admin-nav/client',
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
  external: serverExternals,
  clean: false, // Cleaned above
}

export default defineConfig([
  // Server entry — plugin + types + collection
  {
    ...sharedConfig,
    entry: { index: 'src/index.ts' },
  },
  // Client entry — React components
  // @dnd-kit is bundled into client.js (noExternal) because consumers don't install it
  // "use client" is prepended via onSuccess because tsup strips module-level directives
  {
    ...sharedConfig,
    external: clientExternals,
    noExternal: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities', '@dnd-kit/accessibility'],
    entry: { client: 'src/client.ts' },
    onSuccess: async () => {
      for (const file of ['dist/client.js', 'dist/client.cjs']) {
        const content = readFileSync(file, 'utf-8')
        writeFileSync(file, CLIENT_BANNER + content)
      }
      console.log('✓ Prepended "use client" to client bundles')
    },
  },
  // Views entry — server components with DefaultTemplate
  {
    ...sharedConfig,
    entry: { views: 'src/views.ts' },
  },
])
