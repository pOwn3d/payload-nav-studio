'use client'

// Import from our own package's client entry — tsup keeps this external,
// preserving the RSC boundary (this file = client, NavCustomizerView wrapper = server)
// @ts-ignore — self-reference via package exports
export { NavCustomizer as NavCustomizerViewClient } from '@consilioweb/admin-nav/client'
