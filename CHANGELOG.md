# Changelog

All notable changes to `@consilioweb/admin-nav` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
