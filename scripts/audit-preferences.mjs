#!/usr/bin/env node

/**
 * Data remediation for the `admin-nav-preferences` collection.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two defects fixed in 0.17.0 left rows behind that the fix itself does not
 * clean up, and nothing else sweeps them:
 *
 *  1. Until 0.17.0 the collection's `create` rule required only `!!req.user`,
 *     true for an account on *any* auth collection, and the `user` relationship
 *     was writable from the request. Anyone authenticated anywhere could
 *     therefore create the administrator's row on their behalf — and, `user`
 *     being `unique`, squat the index so that administrator could never save
 *     their own preferences again (CHANGELOG 0.17.0, "Security", 2nd entry).
 *     The door is shut; the rows that went through it are still there.
 *
 *  2. `navLayout` and `collapsedGroups` were stored unvalidated on the
 *     collection's auto-generated REST route. Those rules now also run as field
 *     `validate`, but deliberately only on the value a request actually *sets*
 *     (`validateOnChange` in src/collections/AdminNavPreferences.ts): a legacy
 *     row is not rejected, it is neutralised at render time by
 *     `sanitizeNavGroups`. So a row can quietly render as something other than
 *     what it stores — or not render at all — with no signal anywhere.
 *
 * WHAT IT DOES
 * ------------
 * Read-only by default: it lists what it finds and changes nothing. `--fix`
 * applies the repairs, and says which ones it applied.
 *
 * HOW TO RUN IT
 * -------------
 *   npx admin-nav-audit-preferences            # report only
 *   npx admin-nav-audit-preferences --fix      # apply repairs
 *
 * It re-executes itself through the host's own `payload` CLI (`payload run`),
 * which is what loads `.env` and lets a TypeScript `payload.config.ts` be
 * imported. Run it from the root of the Payload app, not from the plugin, and
 * set `PAYLOAD_CONFIG_PATH` when the config is not where Payload's own
 * resolver looks for it.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SELF_PATH = fileURLToPath(import.meta.url)

/** Set by the parent process on the child it launches through `payload run`. */
const CHILD_MARKER = 'PAYLOAD_ADMIN_NAV_AUDIT_CHILD'

/**
 * Options travel to the child as an env var, not as argv.
 *
 * `payload run <script> --fix` never forwards `--fix`: the CLI parses its own
 * argv with minimist and rebuilds `process.argv` from the *positional* args
 * only (`args._.slice(2)` in payload/dist/bin/index.js), so every flag is
 * swallowed before the script is imported. A script reading its flags from
 * argv would silently run in report-only mode for someone who asked for --fix.
 */
const CHILD_ARGS = 'PAYLOAD_ADMIN_NAV_AUDIT_ARGS'

// ───────────────────────────── pure helpers ─────────────────────────────
// Everything below this line is deliberately free of I/O so it can be unit
// tested without a database.

/**
 * The four fields that identify this plugin's collection whatever it is called.
 *
 * The slug is a plugin option (`preferencesSlug`), so matching on the default
 * `admin-nav-preferences` alone would silently find nothing on any app that
 * renamed it — the worst possible outcome for an audit tool, since "0 rows to
 * fix" and "wrong collection" look identical on the terminal.
 */
const SIGNATURE_FIELDS = ['user', 'navLayout', 'collapsedGroups', 'version']

/**
 * Locate the preferences collection in a (sanitized) Payload config.
 *
 * @param {{ collections?: Array<{ slug?: string, fields?: Array<{ name?: string }> }> }} config
 * @param {string | null} explicitSlug `--collection=<slug>`, when the caller knows better.
 * @returns {{ slug: string, ownerSlug: string | null } | null}
 */
export function findPreferencesCollection(config, explicitSlug = null) {
  const collections = Array.isArray(config?.collections) ? config.collections : []

  const matches = explicitSlug
    ? collections.filter((collection) => collection?.slug === explicitSlug)
    : collections.filter((collection) => {
        const names = new Set(
          (Array.isArray(collection?.fields) ? collection.fields : [])
            .map((field) => field?.name)
            .filter(Boolean),
        )
        return SIGNATURE_FIELDS.every((name) => names.has(name))
      })

  if (matches.length !== 1) return null

  return { slug: matches[0].slug, ownerSlug: ownerCollectionSlug(matches[0]) }
}

/**
 * The auth collection a preferences row is supposed to point at.
 *
 * Read off the `user` field's `relationTo` rather than assumed to be `users`:
 * `userCollectionSlug` is a plugin option too, and a wrong guess here turns
 * every legitimate row into a false "foreign owner" report.
 *
 * @param {{ fields?: Array<{ name?: string, relationTo?: unknown }> }} collection
 * @returns {string | null}
 */
export function ownerCollectionSlug(collection) {
  const fields = Array.isArray(collection?.fields) ? collection.fields : []
  const userField = fields.find((field) => field?.name === 'user')
  return typeof userField?.relationTo === 'string' ? userField.relationTo : null
}

/** A single-target relationship is stored as a bare id — or as a populated doc. */
export function relationId(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'object' && 'id' in value) return value.id ?? null
  return null
}

/**
 * Classify one row.
 *
 * @param {Record<string, unknown>} row
 * @param {{
 *   ownerExists: (id: string | number) => boolean,
 *   duplicateOwnerIds: Set<string>,
 *   sanitizeNavGroups: (value: unknown) => unknown[] | null,
 *   validateNavLayout: (value: unknown) => string | null,
 *   validateCollapsedGroups: (value: unknown) => string | null,
 * }} deps
 * @returns {{ id: unknown, owner: unknown, issues: Array<{ code: string, detail: string }>, repair: Record<string, unknown> | null, deletable: boolean }}
 */
export function analyseRow(row, deps) {
  const issues = []
  let repair = null
  let deletable = false

  const owner = relationId(row?.user)

  if (owner === null || owner === '') {
    issues.push({ code: 'no-owner', detail: 'the `user` relationship is empty' })
    deletable = true
  } else if (!deps.ownerExists(owner)) {
    issues.push({
      code: 'foreign-owner',
      detail: `no document \`${owner}\` in the admin auth collection — the row cannot belong to an admin-panel user`,
    })
    deletable = true
  } else if (deps.duplicateOwnerIds.has(String(owner))) {
    // Never auto-deleted: with two rows for one owner, deleting the wrong one
    // destroys a legitimate layout. The unique index is supposed to make this
    // impossible; when it shows up, a human decides.
    issues.push({
      code: 'duplicate-owner',
      detail: `several rows point at user \`${owner}\` — the \`unique\` index on \`user\` is not enforced here`,
    })
  }

  const navLayout = row?.navLayout
  if (navLayout !== null && navLayout !== undefined) {
    const layoutError = deps.validateNavLayout(navLayout)
    const storedGroups = navLayout?.groups
    const sanitized = deps.sanitizeNavGroups(storedGroups)

    if (Array.isArray(storedGroups) && storedGroups.length > 0 && sanitized === null) {
      issues.push({
        code: 'layout-rejected',
        detail: 'nothing in `navLayout.groups` survives the read-side check — this user silently gets the default nav',
      })
      repair = { ...(repair ?? {}), navLayout: null }
    } else if (sanitized !== null && !rendersAsStored(storedGroups, sanitized)) {
      issues.push({
        code: 'layout-filtered',
        detail:
          'what `navLayout.groups` stores is not what renders — entries or keys are dropped on the way out',
      })
      repair = { ...(repair ?? {}), navLayout: { ...navLayout, groups: sanitized } }
    } else if (layoutError) {
      // Shape survives the sanitizer but the write-side rule refuses it: the
      // owner can still read their sidebar and can no longer save a change
      // that touches this field.
      issues.push({ code: 'layout-invalid', detail: layoutError })
      repair = {
        ...(repair ?? {}),
        // Nothing usable left (a `navLayout` that is not even an object, for
        // instance): clearing it hands the owner the default nav and a row they
        // can save again, which beats a row nobody can write to.
        navLayout: sanitized === null ? null : { ...navLayout, groups: sanitized },
      }
    }
  }

  const collapsed = row?.collapsedGroups
  if (collapsed !== null && collapsed !== undefined) {
    const collapsedError = deps.validateCollapsedGroups(collapsed)
    if (collapsedError) {
      issues.push({ code: 'collapsed-invalid', detail: collapsedError })
      repair = {
        ...(repair ?? {}),
        collapsedGroups: Array.isArray(collapsed)
          ? collapsed.filter((entry) => typeof entry === 'string' && entry.length <= 100).slice(0, 50)
          : [],
      }
    }
  }

  return { id: row?.id, owner, issues, repair, deletable }
}

/**
 * Does the stored value render exactly as stored?
 *
 * Compared on a key-sorted serialization rather than on a hand-written
 * structural walk. A walk that counts groups and items misses what the 0.17.0
 * sanitizer mostly does — it rebuilds each entry key by key, so an arbitrary
 * blob parked under an arbitrary key, or a flag stored as `"yes"` instead of
 * `true`, disappears at render time without changing any count. Sorting the
 * keys is what keeps this from firing on every row: `pickEntryKeys` emits its
 * keys in its own fixed order, which almost never matches the stored one.
 */
export function rendersAsStored(stored, sanitized) {
  if (!Array.isArray(stored) || !Array.isArray(sanitized)) return false
  return canonical(stored) === canonical(sanitized)
}

/** JSON with object keys sorted, so key order is not a difference. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

/** Owner ids that appear on more than one row. */
export function findDuplicateOwners(rows) {
  const seen = new Map()
  for (const row of rows) {
    const owner = relationId(row?.user)
    if (owner === null || owner === '') continue
    const key = String(owner)
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  return new Set([...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key))
}

/** Group findings by issue code, for the summary line. */
export function summarise(results) {
  const counts = {}
  for (const result of results) {
    for (const issue of result.issues) {
      counts[issue.code] = (counts[issue.code] ?? 0) + 1
    }
  }
  return counts
}

/** Minimal flag parsing; no dependency for four options. */
export function parseArgs(argv) {
  const args = { fix: false, collection: null, help: false, limit: 500 }
  for (const arg of argv) {
    if (arg === '--fix') args.fix = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else if (arg.startsWith('--collection=')) args.collection = arg.slice('--collection='.length)
    else if (arg.startsWith('--batch=')) {
      const value = Number.parseInt(arg.slice('--batch='.length), 10)
      if (Number.isFinite(value) && value > 0) args.limit = Math.min(value, 1000)
    }
  }
  return args
}

const USAGE = `
admin-nav-audit-preferences — audit and repair \`admin-nav-preferences\` rows

  npx admin-nav-audit-preferences               report only, changes nothing
  npx admin-nav-audit-preferences --fix         apply the repairs listed below

Options
  --collection=<slug>   the preferences collection, when it was renamed
  --batch=<n>           rows read per page (default 500, max 1000)
  --help                this text

What --fix does
  no-owner / foreign-owner   deletes the row (it cannot belong to an admin-panel user)
  layout-rejected            clears \`navLayout\` so the owner falls back to the default nav
  layout-filtered / invalid  rewrites \`navLayout.groups\` to what already renders,
                             or clears it when nothing usable is left
  collapsed-invalid          drops the entries the validator refuses
  duplicate-owner            never touched — deleting the wrong twin destroys a real layout

Environment
  PAYLOAD_CONFIG_PATH   path to payload.config.ts, when auto-detection fails

Run it from the root of your Payload app.
`

// ─────────────────────────────── the run ───────────────────────────────

/**
 * Import the plugin's own read-side rules from the built package next to this
 * script, so the audit judges rows with exactly the code that renders them.
 */
async function loadValidators() {
  const distUrl = pathToFileURL(
    path.join(path.dirname(SELF_PATH), '..', 'dist', 'utils', 'navLayoutValidation.js'),
  ).href
  return import(distUrl)
}

async function loadHostPayload() {
  const { getPayload } = await import('payload')

  // `PAYLOAD_CONFIG_PATH` first, and not only as a convenience: `findConfig()`
  // walks up from `compilerOptions.rootDir`, and a *relative* rootDir with no
  // `paths['@payload-config']` entry makes that walk never terminate — it stops
  // at `path.parse(dir).root`, which is `''` for a relative path, so `dirname`
  // keeps returning `'.'` forever. Apps scaffolded from Payload's own template
  // declare `@payload-config` and never reach that branch; this env var is the
  // escape hatch for the ones that do.
  let configPath = process.env.PAYLOAD_CONFIG_PATH
    ? path.resolve(process.cwd(), process.env.PAYLOAD_CONFIG_PATH)
    : null

  if (!configPath) {
    const { findConfig } = await import('payload/node')
    configPath = findConfig()
  }

  const imported = await import(pathToFileURL(configPath).href)
  const config = await (imported.default ?? imported)
  return getPayload({ config })
}

async function run(argv) {
  const args = parseArgs(argv)
  if (args.help) {
    console.log(USAGE)
    return 0
  }

  const { sanitizeNavGroups, validateNavLayout, validateCollapsedGroups } = await loadValidators()
  const payload = await loadHostPayload()

  try {
    const target = findPreferencesCollection(payload.config, args.collection)
    if (!target) {
      console.error(
        args.collection
          ? `✗ No collection \`${args.collection}\` in this Payload config.`
          : '✗ Could not identify the admin-nav preferences collection in this Payload config.\n' +
              '  Is the plugin registered? If its slug was changed, pass --collection=<slug>.',
      )
      return 1
    }
    if (!target.ownerSlug) {
      console.error(
        `✗ \`${target.slug}.user\` has no single \`relationTo\`; this script cannot tell which auth collection owns a row.`,
      )
      return 1
    }

    console.log(`Collection : ${target.slug}`)
    console.log(`Owners in  : ${target.ownerSlug}`)
    console.log(args.fix ? 'Mode       : FIX (writes)' : 'Mode       : report only (no writes)')
    console.log('')

    // Read every row. `overrideAccess` is the point: the rows this looks for
    // are precisely the ones the access rules now refuse to show anybody.
    const rows = []
    let page = 1
    for (;;) {
      const result = await payload.find({
        collection: target.slug,
        depth: 0,
        limit: args.limit,
        overrideAccess: true,
        page,
      })
      rows.push(...result.docs)
      if (!result.hasNextPage) break
      page += 1
    }

    const ownerIds = [...new Set(rows.map((row) => relationId(row?.user)).filter((id) => id !== null && id !== ''))]
    const existing = new Set()
    for (let i = 0; i < ownerIds.length; i += 100) {
      const chunk = ownerIds.slice(i, i + 100)
      const found = await payload.find({
        collection: target.ownerSlug,
        depth: 0,
        limit: chunk.length,
        overrideAccess: true,
        pagination: false,
        where: { id: { in: chunk } },
      })
      for (const doc of found.docs) existing.add(String(doc.id))
    }

    const deps = {
      duplicateOwnerIds: findDuplicateOwners(rows),
      ownerExists: (id) => existing.has(String(id)),
      sanitizeNavGroups,
      validateCollapsedGroups,
      validateNavLayout,
    }

    const results = rows.map((row) => analyseRow(row, deps)).filter((result) => result.issues.length > 0)

    console.log(`${rows.length} row(s) read, ${results.length} with something to report.`)
    console.log('')

    for (const result of results) {
      console.log(`• row ${String(result.id)} (user ${String(result.owner)})`)
      for (const issue of result.issues) console.log(`    [${issue.code}] ${issue.detail}`)
    }

    if (results.length > 0) {
      console.log('')
      const counts = summarise(results)
      console.log('Summary:', Object.entries(counts).map(([code, n]) => `${code}=${n}`).join('  '))
    }

    if (!args.fix) {
      if (results.length > 0) {
        console.log('')
        console.log('Nothing was written. Re-run with --fix to apply the repairs (see --help).')
      }
      return 0
    }

    let deleted = 0
    let updated = 0
    for (const result of results) {
      if (result.deletable) {
        await payload.delete({ collection: target.slug, id: result.id, overrideAccess: true })
        deleted += 1
        console.log(`  deleted row ${String(result.id)}`)
        continue
      }
      if (result.repair) {
        await payload.update({
          collection: target.slug,
          id: result.id,
          data: result.repair,
          overrideAccess: true,
        })
        updated += 1
        console.log(`  repaired row ${String(result.id)} (${Object.keys(result.repair).join(', ')})`)
      }
    }

    console.log('')
    console.log(`✓ ${deleted} row(s) deleted, ${updated} row(s) repaired.`)
    const untouched = results.filter((r) => !r.deletable && !r.repair).length
    if (untouched > 0) {
      console.log(`  ${untouched} row(s) reported but deliberately left alone (see --help).`)
    }
    return 0
  } finally {
    if (typeof payload.destroy === 'function') await payload.destroy()
  }
}

// ───────────────────── entrypoint / re-exec plumbing ─────────────────────

/**
 * Locate the host's `payload` CLI.
 *
 * The worker half has to run under the loader that CLI installs: a plain
 * `node scripts/audit-preferences.mjs` cannot import a `payload.config.ts`, and
 * would not load `.env` either.
 */
function findPayloadBin() {
  try {
    const entry = fileURLToPath(import.meta.resolve('payload'))
    let dir = path.dirname(entry)
    for (let depth = 0; depth < 8; depth += 1) {
      const candidate = path.join(dir, 'bin.js')
      const manifest = path.join(dir, 'package.json')
      if (fs.existsSync(candidate) && fs.existsSync(manifest)) return candidate
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  } catch {
    /* falls through to the message below */
  }
  return null
}

function relaunchThroughPayloadCli(argv) {
  const bin = findPayloadBin()
  if (!bin) {
    console.error(
      '✗ Could not find the `payload` CLI from here.\n' +
        '  Run this from the root of your Payload app, or invoke the worker directly:\n' +
        `      ${CHILD_MARKER}=1 ${CHILD_ARGS}='${JSON.stringify(argv)}' npx payload run ${SELF_PATH}`,
    )
    return 1
  }

  const child = spawnSync(process.execPath, [bin, 'run', SELF_PATH], {
    env: { ...process.env, [CHILD_ARGS]: JSON.stringify(argv), [CHILD_MARKER]: '1' },
    stdio: 'inherit',
  })
  return child.status ?? 1
}

/** Flags handed over by the parent, falling back to argv for a direct call. */
function childArgs() {
  const raw = process.env[CHILD_ARGS]
  if (!raw) return process.argv.slice(2)
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const isChild = process.env[CHILD_MARKER] === '1'
const isDirectCli =
  typeof process.argv[1] === 'string' && path.resolve(process.argv[1]) === SELF_PATH

if (isChild) {
  process.exitCode = await run(childArgs())
} else if (isDirectCli) {
  const argv = process.argv.slice(2)
  // Answered here rather than in the child: --help must not need a database, a
  // config, or the second of the two node startups.
  if (parseArgs(argv).help) {
    console.log(USAGE)
    process.exitCode = 0
  } else {
    process.exitCode = relaunchThroughPayloadCli(argv)
  }
}
// Imported (tests): neither branch runs, and the pure helpers above are usable
// on their own.
