# Changelog

All notable changes to `@consilioweb/payload-admin-nav` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.16.0] - 2026-09-07

Admin-only endpoints, permission filtering that actually runs, a white-label sidebar header, and an ESM-only package.

### Breaking

- **The sidebar header no longer displays "ConsilioWEB".** The brand header shipped in 0.15.0 with the plugin author's wordmark hardcoded into every consumer's admin panel, with no supported way to remove it (0.12.x and earlier rendered no header at all). The header now resolves the host's identity instead — `admin.meta.title`, then `admin.meta.titleSuffix` (Payload's own `- Payload` default is discarded) — and renders no brand block at all when the host declares neither. The collapse toggle is always rendered, brand or not. To set your own, use the new `brand` option: `adminNavPlugin({ brand: { wordmark: 'Acme', logoPath: '/admin-assets/logo.js#default' } })`; to keep the header empty, `brand: { wordmark: false, logoPath: false }`. A `wordmark` without a `logoPath` is still preceded by the plugin's own built-in mark (a neutral square + ring, no author identity). The host's `admin.components.graphics.Logo` is deliberately *not* used as a default: it is resolved by Payload's server-side importMap and cannot be reached by the client-side dynamic import used here. Anyone hiding the old wordmark through a CSS override can drop it.

- **Navigation items are now really filtered by user permissions.** The filtering announced in 0.12.0 never ran: it read `payload.auth.permissions`, which does not exist on `payload.auth`, so the guard was always false and the full nav was returned. `GET /default-nav` and `GET /discover` now compute permissions through `getAccessResults({ req })` and drop every entry — sub-items included, which were never filtered at all — whose `href` points at an `/admin/collections/<slug>` or `/admin/globals/<slug>` the user cannot read; a group left without a visible item disappears with it, and so does a parent that exists only to open its children — a parent with an `href` of its own stays, with an empty `children`. Items pointing at custom routes, or at a slug that is not a registered collection or global, are untouched, and a default Payload config (access granted to any logged-in user) sees no change. Restricted roles will see a shorter sidebar than on 0.15.0 — that is the intended behaviour, not a regression.

- **`PATCH /preferences` rejects payloads it used to accept.** A body announcing more than 256 KB (`Content-Length` > 262144) is refused with `413` before it is buffered — the check reads that header alone, so a chunked request that sends none is still buffered, bounded only by the per-entry caps below and not by a hard byte limit. `400` now covers: a `navLayout` without a `groups` array (the whole validator used to sit behind `if (layout.groups !== undefined)`, so such a body was stored as-is and read back as a broken layout); any item **or child** missing `href`, `label` or `icon`, or carrying an unusable type — `href` and `icon` must be strings, while `label` still accepts either a string or a per-language object (`{ fr: '…', en: '…' }`); more than 50 `children` on an entry; nesting deeper than 2 levels (items → children); and any `href` that is not a safe relative path — `//evil.com`, `/\evil.com` and tab/newline-obfuscated variants are now rejected alongside `javascript:`, `data:` and `vbscript:`. Stored layouts are not re-validated on read, but re-saving one whose items predate the required `icon`/`label` fields will now fail with `400`.

- **Importing a nav config into the customizer applies the same rules.** `isValidNavConfig` used to check only `id`, `href` and `label` on top-level items; a `nav-config.json` without `icon`, with an unsafe `href` or with unchecked nesting was accepted and then crashed the sidebar (`item.icon.startsWith('#')`). Such files are now refused at import.

- **`useNavPreferences().save()` returns `false` instead of writing a wrong version.** When the nav version is unknown, `save()` now fetches it once from `/default-nav`; if that also fails (server unreachable) it logs a warning, persists nothing and returns `false`. It previously fell back to `version: 1`, which the next mount read as a structure change and used to delete the layout that had just been saved. Callers that ignored the return value should now surface it.

- **CJS output removed.** No more `main`, no `dist/*.cjs`, no `dist/*.d.cts` and no `require` conditions in the `.`, `./client` and `./views` export subpaths. The package is `type: module` and the Payload 3 ecosystem it imports (`payload`, `payload/shared`, `@payloadcms/ui`, `@payloadcms/next`) is ESM-only, so those barrels could only ever throw `ERR_REQUIRE_ESM`. Any `require('@consilioweb/payload-admin-nav')` now fails at resolution instead; use `import`.

- **Supported environment narrowed to what the plugin actually runs on.** `react`/`react-dom`: `^18.0.0 || ^19.0.0` → `^19.0.0`; `next`: `^14.0.0 || ^15.0.0 || ^16.0.0` → `^15.4.11 || ^16.0.0`; `engines.node`: `>=18` → `^18.20.2 || >=20.9.0`. React 18, Next 14 and Next 15.0–15.4.10 installs now raise an `ERESOLVE` / peer warning; upgrade the host app rather than pinning an older release.

- **`@payloadcms/ui` and `@payloadcms/next` are no longer optional peers.** Both are imported statically, so declaring them optional turned a missing dependency into a `Cannot find module` at boot instead of an install-time error. Add them to your app if they are not already there (any Payload 3 admin app has them). `@payloadcms/translations` stays optional.

- **`@dnd-kit/core`, `@dnd-kit/sortable` and `@dnd-kit/utilities` removed from `peerDependencies`.** They are bundled into the customizer build and never resolved at runtime; declaring them as peers only produced `ERESOLVE` conflicts for apps on a different dnd-kit major. If you installed them solely for this plugin, you can drop them.

### Security

- **The six plugin endpoints are restricted to admin-panel users.** `GET/PATCH/DELETE /preferences`, `GET /badges`, `GET /default-nav` and `GET /discover` only checked `req.user`, so an account authenticated against *any* auth collection — front-office customers, members, subscribers — could read the complete map of the admin panel (collections, globals, custom views), read and overwrite its own preferences row, and drive `/badges`, whose badge resolvers run through the Local API without access control. A new `requireAdmin(req)` guard now runs first on all six: the user must belong to `config.admin.user` and pass that collection's `access.admin` when one is declared (a throwing `access.admin` counts as a denial). Unauthenticated requests still get `401`; authenticated non-admin ones now get `403`. Apps whose only auth collection is the admin one are unaffected.

### Added

- **`brand` option** (`AdminNavBrandConfig`) on `adminNavPlugin()`, with `wordmark?: string | false` and `logoPath?: string | false`. `GET /default-nav` returns the resolved `brand: { wordmark, logoPath }` — an additive field older clients ignore. The type is exported from the package root.
- **`isSafeHref(href)`** exported from both `@consilioweb/payload-admin-nav` and `@consilioweb/payload-admin-nav/client` — the single href rule now shared by the PATCH validator, the customizer import and `NavItemEditor`.
- Test suite: 78 vitest tests (`pnpm test`) covering the href rule, the permission filter, the PATCH validator, `requireAdmin` and the stored-layout migration decision.
- **Collapsible 72px rail** — Persistent icon-only mode (per-browser via `localStorage`). Shrinks the host Payload nav column by overriding `--nav-width` through `html:has(.admin-nav--rail)`. Active state, badges (amber dot) and presence (green dot) are preserved as corner overlays; the user avatar is pinned to the bottom (compact `NavUserProfile`, availability popover kept).
- Translation keys `collapseSidebar` / `expandSidebar` (fr + en).

### Changed

- **Visual refonte — Design System "ConsilioWEB v2"** — Sidebar navigation rebuilt to match the v2 mockups:
  - New brand header — built-in mark (ink square + teal ring) and a collapse toggle. The wordmark
    beside it is the host's own, resolved as described under Breaking; it is not the plugin author's.
  - "Tableau de bord" promoted to a primary item (blue resting accent, ink active state).
  - Section counters use the warm cream pill (`--nav-count-*`); items keep the soft-ink active background + left accent bar; Tickets sub-tree keeps colored status dots + mono badges; presence dot preserved.
  - Lighter SVG icons (17px, stroke 1.9) and refined spacing, aligned to Hanken Grotesk / JetBrains Mono.
  - New design tokens: `--nav-panel`, `--nav-dash`, `--nav-logo-ink`, `--nav-logo-ring`, `--nav-count-bg`, `--nav-count-text` (light + dark).

### Fixed

- **The Payload sidebar's own controls are no longer hidden.** `[data-admin-nav] ~ *` matched every sibling of the plugin's nav inside `.nav__wrap`: it removed the logout button, the Payload 3.60+ settings menu and every `afterNavLinks` component injected by other plugins. The rule now targets `.nav-group` and `.browse-by-folder-button` only, fixed in both copies (`src/styles/admin-nav.css` and the inline stylesheet in `StyleInjector.tsx`).
- **A saved layout could be silently deleted on the next page load.** Two paths produced a version mismatch out of thin air and fired the fire-and-forget `DELETE /preferences`: `save()` guessing `version: 1` (see Breaking), and the PATCH handler rewriting a legitimate `version: 0` — the nav fingerprint is an unsigned djb2 hash, so `0` is a valid value — to `1` through `|| 1`. `save()` and `reset()` now also write the version into the client cache, so the next mount no longer starts without one.
- **An unknown icon name is now visible.** A name absent from the registry rendered nothing at all, leaving the item silently icon-less; it now falls back to the `box` glyph and logs one warning per name outside production.
- **A parallel build could publish a component without its `"use client"` directive.** tsup runs the entries of `defineConfig([...])` in parallel, and the post-build step walked the shared `dist/components` directory — one pass rewrote files another was still flushing, and the idempotence guard then froze the truncated result. Each pass now prepends the directive to the explicit list of files it produced and fails the build if one is missing; a new `pnpm verify:dist` re-checks the directives, the barrels that must *not* carry them and the three entrypoints, after `build` and in `prepublishOnly`.
- **Documented icon names that did not exist.** The README advertised "70+" icons and listed names absent from the registry (`menu`, `compass`, `map`, `navigation`, `briefcase`, `trending-up`, `corner-down-right`…), two of them in the Advanced Example that integrators copy. The list now mirrors `src/icons.ts` exactly (61 icons) and the example uses `bar-chart-3` and `shuffle`. The `navFooterSlot` and `brand` options are documented in the options table.

## [0.12.0] - 2026-04-08

### Added
- CSS stylesheet with BEM naming and custom properties for theming
- StyleInjector component for runtime CSS injection
- `beforeunload` guard warns about unsaved changes
- IconPicker closes on click outside
- Shared icon components (EyeIcon, PencilIcon, TrashIcon, GripIcon, etc.)
- Cache TTL (60s) to skip redundant server fetches
- Permission-based nav filtering on default-nav endpoint
- Import JSON file size limit (1MB max)
- PATCH body validation (items: href, label, icon, id with limits)
- URL validation in NavItemEditor (rejects javascript:, data:)

### Changed
- Undo/redo refactored from nested useState to useReducer (atomic state updates)
- CSS migrated from inline styles to BEM classes with custom properties
- SVG icons deduplicated into shared Icons.tsx
- Self-reference import replaced by relative import
- peerDependencies: payload, react, react-dom now required (not optional)
- Rate limiter timer uses .unref()

### Removed
- Dead code: `renderIconSvg` function

## [0.11.0] - 2026-03-12

### Added
- **`admin.custom.navHidden` convention** — Plugin authors can set `admin: { custom: { navHidden: true } }` on collections/globals to hide them from the nav by default while keeping their admin route functional. Unlike `admin.hidden: true` (which causes 404), `navHidden` only affects the sidebar — users can re-enable the item in the Customizer and the link will work.

### Changed
- Auto-discover now reads `admin.custom.navHidden` and sets `visible: false` on matching items

## [0.10.0] - 2026-03-12

### Changed
- **Hidden collections/globals excluded from discovery** — Collections and globals with `admin.hidden: true` are no longer included in auto-discover results. In Payload 3, hidden collections have no admin UI route (`/admin/collections/xxx` → 404), so linking to them was broken. These internal plugin collections are managed via their custom admin views, which are still discovered normally.
- Removed `hiddenByDefault` field from `NavItemConfig` and associated badge/sync logic (no longer needed)

## [0.9.2] - 2026-03-12

### Fixed
- **Discover syncs hidden flags on existing items** — Clicking Discover now updates `hiddenByDefault` and `visible` flags on items already in the nav (not just new items), so users with saved preferences from older versions get the correct badges and hidden state without needing to reset

## [0.9.1] - 2026-03-12

### Fixed
- **SVG eye icon path** — Fixed malformed `<path d>` in SortableItem and SortableGroup visibility toggle icons (14 values instead of required 16 for smooth curveto command), eliminating `Expected number` console errors and potential React #418 hydration mismatches

## [0.9.0] - 2026-03-12

### Added
- **Hidden-by-default support** — Collections and globals with `admin.hidden: true` are now auto-discovered with `visible: false` and a `hiddenByDefault: true` flag, so users don't have to manually hide them after each discover
- **"hidden" badge in Customizer** — Items originating from hidden collections/globals show a red "hidden" badge in the nav Customizer, visually distinguishing them from items manually hidden by the user

### Changed
- `NavItemConfig` type gains optional `hiddenByDefault?: boolean` field

## [0.8.0] - 2026-03-12

### Added
- **Discover button** — New "Discover" button in the Customizer toolbar that scans ALL available routes at runtime (collections, globals, custom views from all plugins) and merges missing items into the current navigation
- **Runtime discover endpoint** — `GET /api/admin-nav/discover` runs auto-discover against the final Payload config (after all plugins have loaded), solving the build-time ordering issue where plugins registered after admin-nav were invisible
- **i18n** — Added discover-related translation keys (EN/FR)

### Fixed
- **Plugin views not discovered** — Views from SEO Analyzer, Maintenance, and other plugins were missing because auto-discover ran at config build time (before those plugins registered). The new runtime endpoint fixes this completely.

## [0.7.0] - 2026-03-12

### Added
- **Plugin-aware auto-discover** — Detects installed plugins (SEO Analyzer, Maintenance, etc.) by inspecting view component package paths and groups their collections, globals, and views together automatically
- **Hidden items inclusion** — Collections and globals with `admin.hidden: true` are now included in the navigation (they were hidden for default nav compatibility, admin-nav replaces the entire nav)
- **Smart view grouping** — Custom admin views are grouped with their parent plugin instead of a generic "Views" group
- **Localized group names** — `admin.group` as `{ en: '...', fr: '...' }` records are now properly handled
- **New icons** — Added `wrench`, `bell`, `history`, `gauge`, `target`, `sitemap`, `webhook`, `code`, `user-cog` to the built-in icon registry
- **Extended slug→icon mappings** — SEO and Maintenance collection/view slugs now have dedicated icon assignments

### Changed
- CSS now hides ALL afterNavLinks siblings (`[data-admin-nav] ~ *`) — plugins' own nav sections are replaced by admin-nav's unified navigation
- `autoDiscover` uses `capitalizeGroupName()` with known abbreviation uppercasing (SEO, CRM, API, etc.)

## [0.6.2] - 2026-03-12

### Fixed
- **SVG icon fix** — Corrected malformed `eye` icon SVG path (was causing `Expected number` console errors)
- **PATCH 400 fix** — Preferences validation now accepts `title` (used by auto-discover) in addition to `label` for group names
- **Hydration fix** — Replaced `useEffect` DOM manipulation with CSS `<style>` injection to hide default Payload nav, eliminating React #418 hydration mismatch errors

### Changed
- Default Payload nav hiding now uses CSS selector `[data-admin-nav] ~ [class]:not([style])` — more reliable and no client-side flash

## [0.6.1] - 2026-03-12

### Fixed
- **Double nav fix** — AdminNav now hides Payload's default nav groups (Collections, Globals) that render alongside the custom navigation, preventing duplicate menu entries

### Changed
- Added `data-admin-nav` attribute to container for DOM identification

## [0.6.0] - 2026-03-12

### Added
- Auto-discovery improvements for collections and globals

## [0.5.0] - 2026-03-12

### Added
- Rate limiting on all endpoints (60/min GET, 30/min PATCH/DELETE per user)
- Input validation on PATCH preferences: validates `navLayout` structure, `groups` array, group `label` and `items` types
- `src/utils/rateLimiter.ts` — shared in-memory rate limiter with auto-cleanup

### Changed
- Replaced `console.log` calls in `plugin.ts` with `payload.logger` (removed verbose init logs)
- Error handling in `preferences.ts` now uses `req.payload.logger.error()` and returns proper 500 responses
- Auth check added on GET `default-nav` endpoint (was unprotected)

### Fixed
- GET preferences catch block now returns 500 with error message instead of silently returning null

## [0.2.0] - 2026-02-21

### Changed
- Professional theme with improved contrasts, font sizes, and opacity
- Unified admin navigation with consistent styling
- Dashboard date display fix

### Fixed
- Database removed from git tracking to protect production data
- Readability improvements across all dashboard views

## [0.1.0] - 2026-02-20

### Added
- Initial release
- Drag & drop sidebar navigation with @dnd-kit
- Per-user preferences stored in database
- 70+ built-in SVG icons (Lucide-compatible)
- Nav Customizer admin view (`/admin/nav-customizer`)
- Show/hide groups and items
- Custom groups and items creation
- Nested sub-items with icon or color dot
- Group and item editor modals
- Icon picker with search and color support
- API endpoints: GET, PATCH, DELETE preferences
- `useNavPreferences` React hook
- TypeScript strict mode, full type exports

[0.16.0]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.15.0...v0.16.0
[0.12.0]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.9.2...v0.10.0
[0.9.2]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.6.2...v0.7.0
[0.6.2]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.2.0...v0.5.0
[0.2.0]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/pOwn3d/payload-nav-studio/releases/tag/v0.1.0
