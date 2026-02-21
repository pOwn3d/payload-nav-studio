# Changelog

All notable changes to `@consilioweb/admin-nav` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/pOwn3d/payload-nav-studio/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/pOwn3d/payload-nav-studio/releases/tag/v0.1.0
