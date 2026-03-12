import type { PayloadHandler } from 'payload'
import { rateLimit, rateLimitResponse } from '../utils/rateLimiter.js'

/** Extract user ID from request (works with object or primitive) */
function getUserId(req: { user?: unknown }): string | number {
  if (!req.user) return ''
  if (typeof req.user === 'object' && req.user !== null) return (req.user as any).id
  return req.user as string | number
}

/**
 * GET handler — retrieve current user's nav preferences.
 * Returns the navLayout or null if no custom layout is saved.
 */
export function createGetPreferencesHandler(collectionSlug: string): PayloadHandler {
  return async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserId(req)
    const { allowed, retryAfter } = rateLimit(`admin-nav:get:${userId}`, 60, 60_000)
    if (!allowed) return rateLimitResponse(retryAfter)

    try {
      const result = await req.payload.find({
        collection: collectionSlug as any,
        where: { user: { equals: req.user.id } },
        limit: 1,
        depth: 0,
      })

      const doc = result.docs[0] as Record<string, unknown> | undefined
      return Response.json({
        navLayout: doc?.navLayout ?? null,
        version: doc?.version ?? null,
        collapsedGroups: (doc?.collapsedGroups as string[] | undefined) ?? [],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[admin-nav] GET preferences failed: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}

/**
 * PATCH handler — save/update current user's nav preferences.
 * Expects JSON body: { navLayout: NavLayout }
 */
export function createSavePreferencesHandler(collectionSlug: string): PayloadHandler {
  return async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserId(req)
    const { allowed, retryAfter } = rateLimit(`admin-nav:patch:${userId}`, 30, 60_000)
    if (!allowed) return rateLimitResponse(retryAfter)

    let body: Record<string, unknown>
    try {
      body = await req.json!() as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { navLayout, collapsedGroups } = body

    // At least one of navLayout or collapsedGroups must be provided
    if (!navLayout && !collapsedGroups) {
      return Response.json({ error: 'navLayout or collapsedGroups is required' }, { status: 400 })
    }

    // Validate navLayout structure if provided
    if (navLayout !== undefined && navLayout !== null) {
      if (typeof navLayout !== 'object' || Array.isArray(navLayout)) {
        return Response.json({ error: 'navLayout must be an object' }, { status: 400 })
      }

      const layout = navLayout as Record<string, unknown>
      if (layout.groups !== undefined) {
        if (!Array.isArray(layout.groups)) {
          return Response.json({ error: 'navLayout.groups must be an array' }, { status: 400 })
        }

        for (let i = 0; i < layout.groups.length; i++) {
          const group = layout.groups[i] as Record<string, unknown> | undefined
          if (!group || typeof group !== 'object') {
            return Response.json({ error: `navLayout.groups[${i}] must be an object` }, { status: 400 })
          }
          if (group.label === undefined || group.label === null) {
            return Response.json({ error: `navLayout.groups[${i}].label is required` }, { status: 400 })
          }
          if (typeof group.label !== 'string' && typeof group.label !== 'object') {
            return Response.json({ error: `navLayout.groups[${i}].label must be a string or object` }, { status: 400 })
          }
          if (!Array.isArray(group.items)) {
            return Response.json({ error: `navLayout.groups[${i}].items must be an array` }, { status: 400 })
          }
        }
      }
    }

    // Validate collapsedGroups if provided
    if (collapsedGroups !== undefined && !Array.isArray(collapsedGroups)) {
      return Response.json({ error: 'collapsedGroups must be an array' }, { status: 400 })
    }

    try {
      // Check if user already has preferences
      const existing = await req.payload.find({
        collection: collectionSlug as any,
        where: { user: { equals: req.user.id } },
        limit: 1,
        depth: 0,
      })

      const existingDoc = existing.docs[0] as Record<string, unknown> | undefined

      // Build the update data — only include provided fields
      const updateData: Record<string, unknown> = {}
      if (navLayout && typeof navLayout === 'object') {
        updateData.navLayout = navLayout
        updateData.version = ((navLayout as Record<string, unknown>).version as number) || 1
      }
      if (Array.isArray(collapsedGroups)) {
        updateData.collapsedGroups = collapsedGroups
      }

      if (existingDoc) {
        // Update existing
        await req.payload.update({
          collection: collectionSlug as any,
          id: existingDoc.id as string | number,
          data: updateData as any,
        })
      } else {
        // Create new
        await req.payload.create({
          collection: collectionSlug as any,
          data: {
            user: req.user.id,
            ...updateData,
          } as any,
        })
      }

      return Response.json({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[admin-nav] PATCH preferences failed: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}

/**
 * DELETE handler — reset current user's nav preferences (back to default).
 */
export function createResetPreferencesHandler(collectionSlug: string): PayloadHandler {
  return async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = getUserId(req)
    const { allowed, retryAfter } = rateLimit(`admin-nav:delete:${userId}`, 30, 60_000)
    if (!allowed) return rateLimitResponse(retryAfter)

    try {
      const existing = await req.payload.find({
        collection: collectionSlug as any,
        where: { user: { equals: req.user.id } },
        limit: 1,
        depth: 0,
      })

      const existingDoc = existing.docs[0] as Record<string, unknown> | undefined

      if (existingDoc) {
        await req.payload.delete({
          collection: collectionSlug as any,
          id: existingDoc.id as string | number,
        })
      }

      return Response.json({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      req.payload.logger.error(`[admin-nav] DELETE preferences failed: ${message}`)
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
