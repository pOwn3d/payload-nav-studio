'use client'

import React, { useEffect, useState } from 'react'

/**
 * NavFooterSlot — Renders a consumer-provided component at the bottom of
 * the nav, replacing the default "Customize" link.
 *
 * The `path` must be in the form `@/path/to/Component` (resolved via the
 * consumer's tsconfig path aliases). An optional `#export` suffix selects
 * a named export. If no suffix is provided, the default export is used.
 *
 * If the import fails (or the module shape is unexpected), the children
 * passed to this component are rendered as fallback. This means the
 * caller can pass the default Customize link as fallback and we'll never
 * leave the user with an empty footer.
 *
 * NOTE: Because path resolution happens at runtime, the consumer must
 * actually have the module installed/aliased. webpack/Turbopack require
 * the import path to be statically analyzable, so we accept only a small
 * set of well-known prefixes you can adapt to your project layout.
 */
const NavFooterSlot: React.FC<{
  path: string
  fallback: React.ReactNode
  /** Name of the option that provided `path`, used in the failure warning. */
  slot?: string
}> = ({ path, fallback, slot = 'navFooterSlot' }) => {
  const [Component, setComponent] = useState<React.ComponentType | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Parse `@/path#export` syntax
    const hashIdx = path.indexOf('#')
    const exportName = hashIdx >= 0 ? path.slice(hashIdx + 1) : 'default'

    // Dynamic import. The path must be resolvable at runtime by the bundler.
    // In Next.js / Payload setups the alias `@/...` typically maps to `src/`.
    import(/* webpackIgnore: true */ /* @vite-ignore */ path.replace(/#.*$/, ''))
      .then((mod) => {
        if (cancelled) return
        const C = (mod?.[exportName] ?? mod?.default) as React.ComponentType | undefined
        if (typeof C === 'function' || (typeof C === 'object' && C !== null)) {
          setComponent(() => C)
        } else {
          setFailed(true)
        }
      })
      .catch((err) => {
        if (cancelled) return
        // eslint-disable-next-line no-console
        console.warn(`[admin-nav] ${slot} failed to load "${path}":`, err)
        setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [path, slot])

  if (failed) return <>{fallback}</>
  if (!Component) return null // suspense-free placeholder; fallback shows on failure only
  return <Component />
}

export default NavFooterSlot
