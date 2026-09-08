import type { PayloadHandler, PayloadRequest } from 'payload'
import { rateLimit, rateLimitResponse } from '../utils/rateLimiter.js'
import { requireAdmin } from '../utils/requireAdmin.js'
import {
  MAX_BODY_BYTES,
  validateCollapsedGroups,
  validateNavLayout,
} from '../utils/navLayoutValidation.js'

/**
 * Read the JSON body without ever buffering more than `MAX_BODY_BYTES`.
 *
 * The `Content-Length` pre-check alone was bypassable: a `Transfer-Encoding:
 * chunked` request carries no such header, `Number(null)` is `NaN`, the guard
 * fell through and `req.json()` buffered the whole stream. Next puts no limit on
 * App Router route handlers and Payload only caps multipart uploads, so a single
 * request was enough to exhaust the heap. The nested caps below do not help:
 * they run *after* the parse.
 *
 * The stream is therefore consumed with a running byte counter and abandoned as
 * soon as it goes over. Payload does not pre-read the body of a custom endpoint
 * (`addDataAndFileToRequest` only runs on collection/global routes), so
 * `req.body` is still readable here; the `req.json()` path stays as a fallback
 * for any runtime that exposes no readable stream.
 */
async function readBoundedJsonBody(
  req: PayloadRequest,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  const tooLarge = () => ({
    ok: false as const,
    response: Response.json(
      { error: `Payload too large (max ${MAX_BODY_BYTES} bytes)` },
      { status: 413 },
    ),
  })

  // Cheap shortcut for the honest clients, which all announce their length.
  const contentLength = Number(req.headers?.get('content-length') ?? Number.NaN)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return tooLarge()
  }

  const stream = (req as unknown as { body?: ReadableStream<Uint8Array> | null }).body
  let raw: string | null = null

  // `getReader()` throws on a stream another layer has already locked or
  // consumed. Called outside the guard below it escaped this function and the
  // handler entirely — an uncontrolled 500 — and the `req.json()` fallback the
  // comment above promises was never reached. Acquire it inside the guard so a
  // locked stream degrades to that fallback instead.
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  try {
    if (stream && typeof stream.getReader === 'function') {
      reader = stream.getReader()
    }
  } catch {
    reader = null
  }

  if (reader) {
    const chunks: Uint8Array[] = []
    let received = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue
        received += value.byteLength
        if (received > MAX_BODY_BYTES) {
          await reader.cancel().catch(() => {})
          return tooLarge()
        }
        chunks.push(value)
      }
    } catch {
      return { ok: false, response: Response.json({ error: 'Invalid JSON body' }, { status: 400 }) }
    } finally {
      reader.releaseLock?.()
    }

    const merged = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }
    raw = new TextDecoder().decode(merged)
  }

  try {
    const parsed = raw !== null ? JSON.parse(raw) : await req.json!()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, response: Response.json({ error: 'Invalid JSON body' }, { status: 400 }) }
    }
    return { ok: true, body: parsed as Record<string, unknown> }
  } catch {
    return { ok: false, response: Response.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  }
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
    const read = await readBoundedJsonBody(req)
    if (!read.ok) return read.response

    const { navLayout, collapsedGroups } = read.body

    // At least one of navLayout or collapsedGroups must be provided
    if (navLayout === undefined && collapsedGroups === undefined) {
      return Response.json({ error: 'navLayout or collapsedGroups is required' }, { status: 400 })
    }

    // Validate navLayout structure if provided
    if (navLayout !== undefined && navLayout !== null) {
      const layoutError = validateNavLayout(navLayout)
      if (layoutError) return Response.json({ error: layoutError }, { status: 400 })
    }

    // Validate collapsedGroups if provided.
    //
    // Same rule as the collection field, not a looser one: `Array.isArray`
    // alone accepted bodies the field then refused, and a field-level
    // ValidationError lands in the catch below as an opaque 500 instead of a
    // diagnosable 400.
    if (collapsedGroups !== undefined) {
      const collapsedError = validateCollapsedGroups(collapsedGroups)
      if (collapsedError) return Response.json({ error: collapsedError }, { status: 400 })
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
