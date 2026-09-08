import type { CollectionConfig, PayloadRequest } from 'payload'
import {
  validateCollapsedGroups,
  validateNavLayout,
} from '../utils/navLayoutValidation.js'

/**
 * Whether the request comes from the auth collection these preferences belong to.
 *
 * `!!req.user` is not that check. This collection is exposed on the auto-generated
 * REST API — `admin.hidden` hides the admin UI entry, never `/api/<slug>` — and
 * `req.user` is true for anyone authenticated against *any* auth collection of the
 * site (customers, members, subscribers). The endpoints guard themselves with
 * `requireAdmin`, which compares `user.collection`; the collection never had the
 * equivalent, so the REST route was a way around both the access rules and the
 * payload validation.
 */
function isOwnerCollection(req: PayloadRequest, userCollectionSlug: string): boolean {
  return Boolean(req.user) && req.user?.collection === userCollectionSlug
}

/**
 * The two `ValidateOptions` entries this file reads. Declared structurally so
 * the validators stay assignable to Payload's `Validate` without importing its
 * generics.
 */
interface FieldValidateOptions {
  operation?: string
  previousValue?: unknown
}

/** Structural equality, good enough for the two plain JSON fields here. */
function isUnchanged(value: unknown, previousValue: unknown): boolean {
  if (value === previousValue) return true
  try {
    return JSON.stringify(value ?? null) === JSON.stringify(previousValue ?? null)
  } catch {
    return false
  }
}

/**
 * Apply a write-side rule to the value a request actually sets, and only then.
 *
 * Payload revalidates the *merged* document on every update: a field left out
 * of the request is refilled from the stored row (`getFallbackValue` in
 * `fields/hooks/beforeValidate/promise.js`) and handed to `validate` again. A
 * rule applied unconditionally therefore judges rows it never saw written —
 * exactly the rows these rules were added for, since a layout that reached the
 * database around the endpoint is the whole point of the read-side
 * `sanitizeNavGroups`. Such a row would become immutable: its owner could no
 * longer even collapse a group, and `PATCH /api/admin-nav/preferences` would
 * answer 500 on a body it had just accepted.
 *
 * So the rule guards the transition, not the state. A new or modified value is
 * checked as strictly as before — the REST route is still not a way to store a
 * scripted `href` or a non-string `icon` — while an untouched legacy value is
 * left alone and neutralised at render time instead.
 */
function validateOnChange(
  check: (value: unknown) => string | null,
): (value: unknown, options?: FieldValidateOptions) => string | true {
  return (value, options) => {
    if (options?.operation === 'update' && isUnchanged(value, options.previousValue)) return true
    if (value === undefined || value === null) return true
    return check(value) ?? true
  }
}

/**
 * Creates the AdminNavPreferences collection.
 * Stores per-user navigation layout customizations.
 */
export function createAdminNavPreferencesCollection(
  slug: string = 'admin-nav-preferences',
  userCollectionSlug: string = 'users',
): CollectionConfig {
  /**
   * Ownership constraint used by read/update/delete.
   *
   * `{ user: { equals: req.user.id } }` alone is not ownership: a single-target
   * `relationship` is stored as a bare id, so the constraint compares two
   * integers regardless of the collection they came from. With auto-incremented
   * ids (SQLite, Postgres) front-office customer #3 and administrator #3 are
   * indistinguishable to that query, and the customer reads, rewrites and
   * deletes the administrator's sidebar. Constraining the collection first is
   * what makes the id meaningful.
   */
  const ownDocumentOnly = ({ req }: { req: PayloadRequest }) => {
    if (!isOwnerCollection(req, userCollectionSlug)) return false
    return { user: { equals: req.user!.id } }
  }

  return {
    slug,
    admin: {
      hidden: true,
    },
    access: {
      // Users can only read their own preferences
      read: ownDocumentOnly,
      // Only the admin auth collection may own preferences at all
      create: ({ req }) => isOwnerCollection(req, userCollectionSlug),
      // Users can only update their own preferences
      update: ownDocumentOnly,
      // Users can only delete their own preferences
      delete: ownDocumentOnly,
    },
    hooks: {
      /**
       * Bind the document to its owner server-side.
       *
       * `user` is a plain relationship: Payload's relationship validation only
       * checks the *format* of the id (`isValidID`), never its existence nor who
       * sends it. Without this hook, an authenticated request could create the
       * administrator's preferences on their behalf (and squat the `unique`
       * index so the administrator can never save their own), or re-assign an
       * existing document to a colleague by PATCHing `user`.
       *
       * Requests with no `req.user` are the plugin's own Local API calls
       * (`req.payload.create/update` builds a fresh request, so they run with
       * `overrideAccess: true` and no user): they pass the owner explicitly and
       * are left alone.
       */
      beforeValidate: [
        ({ data, req }) => {
          if (!data) return data
          if (!req?.user) return data
          if (!isOwnerCollection(req, userCollectionSlug)) {
            // Authenticated, but not against the collection these preferences
            // belong to. Unreachable over HTTP (`access.create/update` refuses
            // first), but a host calling `payload.create({ ..., req })` runs
            // with `overrideAccess: true` and skips both that and the field
            // access below. Dropping the key rather than trusting it makes
            // `required` fail on create and refills from the row on update.
            const { user: _ignored, ...rest } = data as Record<string, unknown>
            return rest
          }
          return { ...data, user: req.user.id }
        },
      ],
    },
    fields: [
      {
        name: 'user',
        type: 'relationship',
        relationTo: userCollectionSlug,
        required: true,
        unique: true,
        index: true,
        access: {
          // Belt to the hook's braces: the owner is decided server-side, so the
          // field is never writable from a request. Local API writes run with
          // `overrideAccess: true` and skip field access, so the plugin's own
          // endpoints are unaffected.
          create: () => false,
          update: () => false,
        },
      },
      {
        name: 'navLayout',
        type: 'json',
        /**
         * The same rules the PATCH endpoint applies, so the collection's REST
         * route stops being a way to store a layout the endpoint would refuse:
         * an off-site or scripted `href`, a non-string `icon` that crashes the
         * sidebar on every admin page, or an unbounded blob.
         */
        validate: validateOnChange(validateNavLayout),
      },
      {
        name: 'collapsedGroups',
        type: 'json',
        defaultValue: [],
        validate: validateOnChange(validateCollapsedGroups),
      },
      {
        name: 'version',
        type: 'number',
        defaultValue: 1,
      },
    ],
  }
}
