import type { NavGroupConfig } from '../types.js'
import { isSafeHref } from '../utils.js'

/**
 * Shape rules for the only thing this plugin persists: a per-user `navLayout`.
 *
 * They used to live inside the PATCH endpoint, which made the endpoint the only
 * gate. It never was the only door: the preferences collection is exposed on the
 * auto-generated REST API (`admin.hidden` hides the UI, never `/api/<slug>`), and
 * a layout can also arrive from a migration, a seed script or a restored backup.
 * Sharing the rules lets the collection validate its own writes and lets the
 * sidebar re-check what it reads back, so a layout written around the endpoint
 * is neither stored nor rendered.
 */

/**
 * Hard ceiling on the PATCH body.
 *
 * `req.json()` buffers the whole body in memory: Payload only caps multipart
 * uploads and Next caps nothing on route handlers, so an unbounded body blows
 * the heap and takes the CMS down — and a 30 req/min limit does not help when
 * one request is enough.
 */
export const MAX_BODY_BYTES = 256 * 1024
export const MAX_GROUPS = 50
export const MAX_ITEMS_PER_GROUP = 100
export const MAX_CHILDREN = 50
export const MAX_ID_LENGTH = 100
export const MAX_LABEL_LENGTH = 200
export const MAX_ICON_LENGTH = 50
/** Items → children. Deeper nesting is not part of the nav model. */
export const MAX_ENTRY_DEPTH = 2

/**
 * Serialized size of a value, or `null` when it cannot be serialized.
 *
 * The nested caps bound the *shape*, never the volume: 50 groups x 100 items x
 * 50 children, each carrying a 200-char label, is ~87 MB of perfectly valid
 * JSON, and a key the entry model does not describe is not inspected at all —
 * so `{"junk": "<50 MB of A>"}` inside an otherwise valid item passed. That is
 * the whole point of `MAX_BODY_BYTES` on the endpoint, and the collection's
 * REST route had no equivalent: the row was persisted, then re-read and
 * re-serialized on every `GET /admin-nav/preferences`.
 *
 * Measured in UTF-16 code units rather than bytes: `Buffer` does not exist in
 * the browser and this module is imported by the sidebar. A multi-byte
 * character therefore counts as one, which only makes the ceiling stricter in
 * characters than in bytes — never looser than the byte the endpoint counts.
 */
function serializedLength(value: unknown): number | null {
  try {
    const json = JSON.stringify(value)
    return typeof json === 'string' ? json.length : null
  } catch {
    // Circular structure, a BigInt, or a string past the engine's max length.
    return null
  }
}

/** Validate a label (string or per-language record). Returns an error message or null. */
export function validateLabel(label: unknown, path: string): string | null {
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
export function validateNavEntry(entry: unknown, path: string, depth: number): string | null {
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
export function validateNavLayout(navLayout: unknown): string | null {
  if (typeof navLayout !== 'object' || navLayout === null || Array.isArray(navLayout)) {
    return 'navLayout must be an object'
  }

  // Volume before shape: the same ceiling the PATCH endpoint enforces on the
  // wire, applied to what actually gets stored, so the collection's REST route
  // stops being the unbounded door the endpoint no longer is.
  const size = serializedLength(navLayout)
  if (size === null) return 'navLayout must be JSON-serializable'
  if (size > MAX_BODY_BYTES) return `navLayout exceeds maximum size of ${MAX_BODY_BYTES} bytes`

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

/**
 * Validate the `collapsedGroups` list. Same reasoning as `navLayout`: on the
 * collection's REST route it is an unbounded `json` field, so it needs its own
 * ceiling rather than relying on the endpoint's body cap.
 */
export function validateCollapsedGroups(value: unknown): string | null {
  if (!Array.isArray(value)) return 'collapsedGroups must be an array'
  if (value.length > MAX_GROUPS) {
    return `collapsedGroups exceeds maximum of ${MAX_GROUPS} entries`
  }
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.length > MAX_ID_LENGTH) {
      return `collapsedGroups entries must be strings (max ${MAX_ID_LENGTH} chars)`
    }
  }
  return null
}

/**
 * Keys the nav model actually describes, and the only ones the sidebar reads.
 *
 * `validateNavEntry` inspects `id`, `href`, `label`, `icon` and `children` and
 * lets everything else through untouched, so an entry could carry an arbitrary
 * payload under an arbitrary key. Copying only what is known is what keeps that
 * out of the browser; the flags are kept only when they are the booleans the
 * components test, since a flag is never a place to store data.
 */
const ENTRY_STRING_KEYS = ['id', 'href', 'icon'] as const
const ENTRY_FLAG_KEYS = ['matchPrefix', 'visible', 'live', 'alert'] as const
const GROUP_FLAG_KEYS = ['visible', 'defaultCollapsed'] as const

function pickEntryKeys(source: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const key of ENTRY_STRING_KEYS) {
    if (typeof source[key] === 'string') picked[key] = source[key]
  }
  // `label` is a string or a per-language record; `validateLabel` judges it.
  if (source.label !== undefined) picked.label = source.label
  for (const key of ENTRY_FLAG_KEYS) {
    if (typeof source[key] === 'boolean') picked[key] = source[key]
  }
  return picked
}

function pickGroupKeys(source: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  if (typeof source.id === 'string') picked.id = source.id
  // `title` and its `label` alias are both accepted upstream; keep whichever
  // came in, so a group that only carries the alias keeps rendering as before.
  if (source.title !== undefined) picked.title = source.title
  if (source.label !== undefined) picked.label = source.label
  for (const key of GROUP_FLAG_KEYS) {
    if (typeof source[key] === 'boolean') picked[key] = source[key]
  }
  return picked
}

/**
 * Drop every entry a stored layout should never have contained.
 *
 * Read-side counterpart of `validateNavLayout`. The sidebar renders whatever it
 * reads back straight into `<Link href>` and dereferences `item.href` and
 * `item.icon` without a guard, so a layout that reached the database around the
 * endpoint (REST route, migration, restored backup, or simply a version of this
 * plugin that predates the write-side validation) is a stored open-redirect and
 * a persistent crash of a component mounted in `beforeNavLinks`.
 *
 * Filtering rather than rejecting wholesale is deliberate: a legitimate layout
 * carrying one stale entry keeps the rest of the user's customization.
 *
 * @returns the surviving groups, or `null` when nothing usable remains — the
 *   caller then falls back to the default nav.
 */
export function sanitizeNavGroups(value: unknown): NavGroupConfig[] | null {
  if (!Array.isArray(value)) return null

  const sanitizeEntries = (entries: unknown, depth: number): Record<string, unknown>[] => {
    if (!Array.isArray(entries)) return []
    const kept: Record<string, unknown>[] = []

    for (const raw of entries.slice(0, depth === 1 ? MAX_ITEMS_PER_GROUP : MAX_CHILDREN)) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
      const source = raw as Record<string, unknown>
      // Rebuilt key by key instead of spread: the spread carried every key the
      // model does not describe — the very keys `validateNavEntry` never looks
      // at — from the row to `writeCache`'s `JSON.stringify` and to React.
      const entry = pickEntryKeys(source)

      // Children are cleaned first so the parent is judged on its own fields:
      // one bad child must not take a whole valid item down with it.
      if (source.children !== undefined && source.children !== null) {
        if (depth < MAX_ENTRY_DEPTH) {
          entry.children = sanitizeEntries(source.children, depth + 1)
        }
      }

      if (validateNavEntry(entry, 'entry', depth) !== null) continue
      kept.push(entry)
    }

    return kept
  }

  const groups: NavGroupConfig[] = []

  for (const raw of value.slice(0, MAX_GROUPS)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const group = raw as Record<string, unknown>

    if (typeof group.id !== 'string' || group.id.length === 0 || group.id.length > MAX_ID_LENGTH) {
      continue
    }
    // Stricter than the write-side rule on purpose: `validateNavLayout` accepts
    // any object as a title, but the sidebar hands it to `resolveLabel` and then
    // to React, which throws on a non-string leaf.
    if (validateLabel(group.title ?? group.label, 'group') !== null) continue

    const items = sanitizeEntries(group.items, 1)
    // A group emptied by the filtering is a poisoned husk: it would render a
    // section header with nothing under it. A group that was already empty is a
    // legitimate state of the customizer and is kept.
    if (items.length === 0 && Array.isArray(group.items) && group.items.length > 0) continue

    groups.push({ ...pickGroupKeys(group), items } as unknown as NavGroupConfig)
  }

  return groups.length > 0 ? groups : null
}
