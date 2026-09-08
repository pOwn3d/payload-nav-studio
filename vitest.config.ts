import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // The remediation script is a published artefact (`bin`), so its pure
    // helpers are covered like the rest of the package.
    include: ['src/**/*.test.ts', 'scripts/__tests__/**/*.test.mjs'],
  },
})
