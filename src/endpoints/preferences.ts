import type { PayloadHandler } from 'payload'
import { rateLimit, rateLimitResponse } from '../utils/rateLimiter.js'
import { requireAdmin } from '../utils/requireAdmin.js'
import { isSafeHref } from '../utils.js'

/**
 * Hard ceiling on the PATCH body.
 *
 * `req.json()` buffers the whole body in memory: Payload only caps multipart
 * uploads and Next caps nothing on route handlers, so an unbounded body blows
 * the heap and takes the CMS down — and a 30 req/min limit does not help when
 * one request is enough.
 *
 * Enforced from `Content-Length`, which every JSON client sets. A chunked body
 * without that header cannot be pre-checked here; the nested caps below still
 * bound what can be persisted.
 */
const MAX_BODY_BYTES = 256 * 1024
const MAX_GROUPS = 50
const MAX_ITEMS_PER_GROUP = 100
const MAX_CHILDREN = 50
const MAX_ID_LENGTH = 100
const MAX_LABEL_LENGTH = 200
const MAX_ICON_LENGTH = 50
/** Items → children. Deeper nesting is not part of the nav model. */
const MAX_ENTRY_DEPTH = 2

/** Validate a label (string or per-language record). Returns an error message or null. */
function validateLabel(label: unknown, path: string): string | null {
  if (typeof label === 'string') {
    return label.length > MAX_LABEL_LENGTH ? `${path}.label exceeds ${MAX_LABEL_LENGTH} chars` : null
  }
  if (typeof label === 'object' && label !== null && !Array.isArray(label)) {
    for (const [lang, value] of Object.entries(label as Record<string, unknown>)) {
      if (typeof value !== 'string') return `${path}.label.${lang} must be a string`
      if (value.length > MAX_LABEL_LENGTH) {
        return `${path}.label.${lang} exceeds ${MAX_LABEL_LENGTH} chars`
      }
    }
    return null
  }
  return `${path}.label is required and must be a string or a per-language object`
}

/**
 * Validate one nav entry (item or child) and, recursively, its children.
 *
 * `href` and `icon` are required *strings*: the nav mounted in `beforeNavLinks`
 * calls `item.href.includes('?')` and `item.icon.startsWith('#')`, so a missing
 * value crashes the whole admin sidebar. Empty strings stay legal — that is how
 * the customizer stores a parent entry that only opens its children.
 */
function validateNavEntry(entry: unknown, path: string, depth: number): string | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return `${path} must be an object`
  }
  const item = entry as Record<string, unknown>

  if (typeof item.id !== 'string' || item.id.length === 0 || item.id.length > MAX_ID_LENGTH) {
    return `${path}.id must be a non-empty string (max ${MAX_ID_LENGTH} chars)`
  }

  if (typeof item.href !== 'string') return `${path}.href is required and must be a string`
  if (!isSafeHref(item.href)) {
    return `${path}.href must be a relative path starting with '/' (no external or scripted URL)`
  }

  const labelError = validateLabel(item.label, path)
  if (labelError) return labelError

  if (typeof item.icon !== 'string' || item.icon.length > MAX_ICON_LENGTH) {
    return `${path}.icon is required and must be a string (max ${MAX_ICON_LENGTH} chars)`
  }

  if (item.children !== undefined && item.children !== null) {
    if (!Array.isArray(item.children)) return `${path}.children must be an array`
    if (depth >= MAX_ENTRY_DEPTH) return `${path}.children exceeds the maximum nesting depth`
    if (item.children.length > MAX_CHILDREN) {
      return `${path}.children exceeds maximum of ${MAX_CHILDREN} entries`
    }
    for (let k = 0; k < item.children.length; k++) {
      const childError = validateNavEntry(item.children[k], `${path}.children[${k}]`, depth + 1)
      if (childError) return childError
    }
  }

  return null
}

/** Validate a full navLayout payload. Returns an error message or null. */
function validateNavLayout(navLayout: unknown): string | null {
  if (typeof navLayout !== 'object' || navLayout === null || Array.isArray(navLayout)) {
    return 'navLayout must be an object'
  }

  const layout = navLayout as Record<string, unknown>

  // A navLayout without groups used to skip every check below and be persisted
  // as-is, producing a stored layout the customizer cannot read back.
  if (!Array.isArray(layout.groups)) return 'navLayout.groups must be an array'
  if (layout.groups.length > MAX_GROUPS) {
    return `navLayout.groups exceeds maximum of ${MAX_GROUPS} groups`
  }

  for (let i = 0; i < layout.groups.length; i++) {
    const groupPath = `navLayout.groups[${i}]`
    const group = layout.groups[i] as Record<string, unknown> | undefined
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      return `${groupPath} must be an object`
    }

    // Groups can use either 'title' or 'label' for the group name
    const groupTitle = group.title ?? group.label
    if (groupTitle === undefined || groupTitle === null) {
      return `${groupPath}.title is required`
    }
    if (typeof groupTitle !== 'string' && typeof groupTitle !== 'object') {
      return `${groupPath}.title must be a string or object`
    }

    if (!Array.isArray(group.items)) return `${groupPath}.items must be an array`
    if (group.items.length > MAX_ITEMS_PER_GROUP) {
      return `${groupPath}.items exceeds maximum of ${MAX_ITEMS_PER_GROUP} items`
    }

    for (let j = 0; j < group.items.length; j++) {
      const itemError = validateNavEntry(group.items[j], `${groupPath}.items[${j}]`, 1)
      if (itemError) return itemError
    }
  }

  return null
}

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
    // Authenticated is not enough: these endpoints are admin-panel only.
    const denied = await requireAdmin(req)
    if (denied) return denied

    const userId = getUserId(req)
    const { allowed, retryAfter } = rateLimit(`admin-nav:get:${userId}`, 60, 60_000)
    if (!allowed) return rateLimitResponse(retryAfter)

    try {
      const result = await req.payload.find({
        collection: collectionSlug as any,
        where: { user: { equals: userId } },
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
    const denied = await requireAdmin(req)
    if (denied) return denied

    const userId = getUserId(req)
    const { allowed, retryAfter } = rateLimit(`admin-nav:patch:${userId}`, 30, 60_000)
    if (!allowed) return rateLimitResponse(retryAfter)

    // Reject oversized bodies before buffering them into memory.
    const contentLength = Number(req.headers?.get('content-length') ?? Number.NaN)
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return Response.json(
        { error: `Payload too large (max ${MAX_BODY_BYTES} bytes)` },
        { status: 413 },
      )
    }

    let body: Record<string, unknown>
    try {
      body = await req.json!() as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { navLayout, collapsedGroups } = body

    // At least one of navLayout or collapsedGroups must be provided
    if (navLayout === undefined && collapsedGroups === undefined) {
      return Response.json({ error: 'navLayout or collapsedGroups is required' }, { status: 400 })
    }

    // Validate navLayout structure if provided
    if (navLayout !== undefined && navLayout !== null) {
      const layoutError = validateNavLayout(navLayout)
      if (layoutError) return Response.json({ error: layoutError }, { status: 400 })
    }

    // Validate collapsedGroups if provided
    if (collapsedGroups !== undefined && !Array.isArray(collapsedGroups)) {
      return Response.json({ error: 'collapsedGroups must be an array' }, { status: 400 })
    }

    try {
      // Check if user already has preferences
      const existing = await req.payload.find({
        collection: collectionSlug as any,
        where: { user: { equals: userId } },
        limit: 1,
        depth: 0,
      })

      const existingDoc = existing.docs[0] as Record<string, unknown> | undefined

      // Build the update data — only include provided fields
      const updateData: Record<string, unknown> = {}
      if (navLayout && typeof navLayout === 'object') {
        updateData.navLayout = navLayout
        // `|| 1` also rewrote a legitimate version 0 (the nav fingerprint is an
        // unsigned djb2 hash, so 0 is a valid value) into 1, which the client
        // then reads back as a version mismatch and wipes the layout.
        const layoutVersion = (navLayout as Record<string, unknown>).version
        updateData.version =
          typeof layoutVersion === 'number' && Number.isFinite(layoutVersion) ? layoutVersion : 1
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
            user: userId,
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
    const denied = await requireAdmin(req)
    if (denied) return denied

    const userId = getUserId(req)
    const { allowed, retryAfter } = rateLimit(`admin-nav:delete:${userId}`, 30, 60_000)
    if (!allowed) return rateLimitResponse(retryAfter)

    try {
      const existing = await req.payload.find({
        collection: collectionSlug as any,
        where: { user: { equals: userId } },
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
