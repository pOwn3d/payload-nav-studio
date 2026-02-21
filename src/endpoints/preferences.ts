import type { PayloadHandler } from 'payload'

/**
 * GET handler — retrieve current user's nav preferences.
 * Returns the navLayout or null if no custom layout is saved.
 */
export function createGetPreferencesHandler(collectionSlug: string): PayloadHandler {
  return async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      })
    } catch {
      return Response.json({ navLayout: null, version: null })
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

    let body: Record<string, unknown>
    try {
      body = await req.json!() as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { navLayout } = body
    if (!navLayout || typeof navLayout !== 'object') {
      return Response.json({ error: 'navLayout is required' }, { status: 400 })
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

      if (existingDoc) {
        // Update existing
        await req.payload.update({
          collection: collectionSlug as any,
          id: existingDoc.id as string | number,
          data: {
            navLayout,
            version: ((navLayout as Record<string, unknown>).version as number) || 1,
          } as any,
        })
      } else {
        // Create new
        await req.payload.create({
          collection: collectionSlug as any,
          data: {
            user: req.user.id,
            navLayout,
            version: ((navLayout as Record<string, unknown>).version as number) || 1,
          } as any,
        })
      }

      return Response.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
