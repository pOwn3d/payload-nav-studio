<!-- Header Banner -->
<div align="center">

  <a href="https://git.io/typing-svg">
    <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=32&duration=3000&pause=1000&color=3B82F6&center=true&vCenter=true&width=700&lines=%40consilioweb%2Fadmin-nav;Payload+CMS+Sidebar+Plugin;Drag+%26+Drop+%7C+Per-User+Prefs;70%2B+Icons+%7C+Fully+Customizable" alt="Typing SVG" />
  </a>

  <br><br>

  <!-- Badges -->
  <a href="https://www.npmjs.com/package/@consilioweb/admin-nav"><img src="https://img.shields.io/npm/v/@consilioweb/admin-nav?style=for-the-badge&logo=npm&logoColor=white&color=CB3837" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@consilioweb/admin-nav"><img src="https://img.shields.io/npm/dw/@consilioweb/admin-nav?style=for-the-badge&logo=npm&logoColor=white&color=CB3837" alt="npm downloads"></a>
  <img src="https://img.shields.io/badge/Payload%20CMS-3.x-0F172A?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDdWMTdMMTIgMjJMMjAgMTdWN0wxMiAyWiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=&logoColor=white" alt="Payload CMS 3">
  <img src="https://img.shields.io/badge/Drag%20%26%20Drop-dnd--kit-8B5CF6?style=for-the-badge" alt="dnd-kit">
  <img src="https://img.shields.io/badge/Icons-70%2B%20SVG-10B981?style=for-the-badge" alt="70+ Icons">
  <a href="https://github.com/pOwn3d/payload-nav-studio/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-7C3AED?style=for-the-badge" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <a href="https://github.com/pOwn3d/payload-nav-studio/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/pOwn3d/payload-nav-studio/ci.yml?branch=main&style=for-the-badge&logo=github-actions&logoColor=white" alt="CI"></a>
  <a href="https://github.com/pOwn3d/payload-nav-studio"><img src="https://img.shields.io/github/stars/pOwn3d/payload-nav-studio?style=for-the-badge&logo=github&color=181717" alt="GitHub stars"></a>

</div>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## About

> **@consilioweb/admin-nav** — A fully customizable admin sidebar navigation plugin for Payload CMS 3. Drag & drop reordering, per-user preferences stored in the database, 70+ built-in SVG icons, nested sub-items, and a dedicated admin view to customize everything visually.

<table>
  <tr>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/drag-and-drop.png" width="50"/><br>
      <b>Drag & Drop</b><br>
      <sub>Reorder groups & items</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/user-group-man-man.png" width="50"/><br>
      <b>Per-User Prefs</b><br>
      <sub>Stored in database</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/paint-palette.png" width="50"/><br>
      <b>70+ Icons</b><br>
      <sub>Lucide-compatible SVG</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://img.icons8.com/color/96/api-settings.png" width="50"/><br>
      <b>REST API</b><br>
      <sub>Preferences CRUD</sub>
    </td>
  </tr>
</table>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Overview

`@consilioweb/admin-nav` replaces the default Payload CMS admin sidebar with a fully customizable navigation system. Each admin user gets their own layout preferences, persisted in the database. The plugin provides a visual editor (`/admin/nav-customizer`) where users can drag & drop groups and items, toggle visibility, edit labels and icons, create custom entries, and organize nested sub-menus — all without touching code.

### Screenshots

| Nav Customizer | Drag & Drop |
|:---:|:---:|
| ![Nav Customizer](https://raw.githubusercontent.com/pOwn3d/payload-nav-studio/main/docs/screenshots/nav-customizer.png) | ![Drag & Drop](https://raw.githubusercontent.com/pOwn3d/payload-nav-studio/main/docs/screenshots/drag-drop.png) |

| Item Editor (with sub-menus) | Group Editor |
|:---:|:---:|
| ![Item Editor](https://raw.githubusercontent.com/pOwn3d/payload-nav-studio/main/docs/screenshots/item-editor.png) | ![Group Editor](https://raw.githubusercontent.com/pOwn3d/payload-nav-studio/main/docs/screenshots/group-editor.png) |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Built-in Icons](#built-in-icons)
- [API Endpoints](#api-endpoints)
- [Components](#components)
- [Package Exports](#package-exports)
- [Requirements](#requirements)
- [Uninstall](#uninstall)
- [License](#license)

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Features

### Drag & Drop Navigation

Powered by [@dnd-kit](https://dndkit.com/), the navigation supports:

- **Group reordering** — drag entire sections up and down
- **Item reordering** — move items within or across groups
- **Touch & keyboard support** — accessible on all devices
- **Visual drag overlay** — see what you're moving in real-time

### Per-User Preferences

- Each admin user has their own navigation layout
- Preferences are stored in a dedicated Payload collection
- Changes persist across sessions and devices
- One-click reset to defaults

### Visual Customization

- **Show/hide** any group or item
- **Edit labels** — rename anything in the sidebar
- **Edit URLs** — change where items link to
- **Custom icons** — pick from 70+ SVG icons or use color dots
- **Create groups** — add new sections to organize your nav
- **Create items** — add custom links to any group
- **Nested sub-items** — create dropdown sub-menus with their own icons
- **Collapse groups** — set groups to start collapsed by default

### 70+ Built-in Icons

Inline SVG icons (Lucide-compatible, 24x24 viewBox) — zero external dependencies:

- **Navigation** — home, layout-dashboard, settings, menu, compass
- **Content** — file-text, newspaper, image, tag, calendar
- **Support** — ticket, message-square, users, shield-check, mail-search
- **Management** — receipt, briefcase, wallet, credit-card, truck
- **Config** — database, globe, palette, key, monitor
- **SEO** — search, trending-up, bar-chart, link, award
- **Misc** — heart, star, bell, zap, gift, rocket, and many more

### Admin View

The plugin adds a dedicated view at `/admin/nav-customizer` with:

- Full drag & drop interface
- Group editor modal (title, ID, collapse state)
- Item editor modal (label, URL, icon, prefix match, sub-items)
- Icon picker with search and color mode
- Toast notifications for save/reset feedback
- Responsive layout

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Installation

```bash
pnpm add @consilioweb/admin-nav
```

Or with npm/yarn:

```bash
npm install @consilioweb/admin-nav
yarn add @consilioweb/admin-nav
```

> **Note:** `@dnd-kit` is bundled into the client bundle — you do **not** need to install it separately.

### Peer Dependencies

| Package | Version | Required |
|---------|---------|----------|
| `payload` | `^3.0.0` | **Yes** |
| `@payloadcms/next` | `^3.0.0` | Optional (admin views) |
| `@payloadcms/ui` | `^3.0.0` | Optional (admin UI) |
| `next` | `^14.0.0 \|\| ^15.0.0` | Optional (admin UI) |
| `react` | `^18.0.0 \|\| ^19.0.0` | Optional (admin UI) |
| `react-dom` | `^18.0.0 \|\| ^19.0.0` | Optional (admin UI) |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Quick Start

Add the plugin to your `payload.config.ts`:

```ts
import { buildConfig } from 'payload'
import { adminNavPlugin } from '@consilioweb/admin-nav'

export default buildConfig({
  // ... your existing config
  plugins: [
    adminNavPlugin({
      defaultNav: [
        {
          id: 'content',
          title: 'Content',
          items: [
            { id: 'pages', href: '/admin/collections/pages', label: 'Pages', icon: 'file-text' },
            { id: 'posts', href: '/admin/collections/posts', label: 'Posts', icon: 'newspaper' },
            { id: 'media', href: '/admin/collections/media', label: 'Media', icon: 'image' },
          ],
        },
        {
          id: 'settings',
          title: 'Settings',
          items: [
            { id: 'users', href: '/admin/collections/users', label: 'Users', icon: 'users' },
            { id: 'settings', href: '/admin/globals/settings', label: 'Settings', icon: 'settings' },
          ],
        },
      ],
    }),
  ],
})
```

That's it. The plugin will automatically:

1. Add a `admin-nav-preferences` collection to store per-user layouts
2. Register API endpoints under `/api/admin-nav/`
3. Inject the `AdminNav` component into the sidebar via `beforeNavLinks`
4. Add the Nav Customizer view at `/admin/nav-customizer`

> **Important:** After installing, run `pnpm generate:importmap` to register the new components.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Configuration

### `AdminNavPluginConfig`

```ts
adminNavPlugin({
  defaultNav: [],                           // Required — initial sidebar structure
  afterNav: [],                             // Component paths to render after the nav
  collectionSlug: 'admin-nav-preferences',  // Preferences collection slug
  userCollectionSlug: 'users',              // User collection for the relationship
  endpointBasePath: '/admin-nav',           // API endpoint prefix
  addCustomizerView: true,                  // Add /admin/nav-customizer view
  navComponentPath: undefined,              // Override AdminNav component path
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultNav` | `NavGroupConfig[]` | — | **Required.** Initial sidebar structure with groups and items |
| `afterNav` | `string[]` | `[]` | Component paths to render after the navigation |
| `collectionSlug` | `string` | `'admin-nav-preferences'` | Collection slug for preferences storage |
| `userCollectionSlug` | `string` | `'users'` | User collection slug for the relationship |
| `endpointBasePath` | `string` | `'/admin-nav'` | Base path for API endpoints |
| `addCustomizerView` | `boolean` | `true` | Whether to add the Nav Customizer admin view |
| `navComponentPath` | `string` | `'@consilioweb/admin-nav/client#AdminNav'` | Override the AdminNav component path (for `file:` or `link:` installs) |

### Types

#### `NavGroupConfig`

```ts
interface NavGroupConfig {
  id: string              // Unique group ID
  title: string           // Section header label
  items: NavItemConfig[]  // Items in this group
  visible?: boolean       // Whether the group is visible (default: true)
  defaultCollapsed?: boolean // Start collapsed (default: false)
}
```

#### `NavItemConfig`

```ts
interface NavItemConfig {
  id: string                   // Unique item ID
  href: string                 // Admin URL path
  label: string                // Display label
  icon: string                 // Icon name or '#RRGGBB' for color dot
  matchPrefix?: boolean        // Activate on pathname.startsWith(href)
  children?: NavItemConfig[]   // Nested sub-items
  visible?: boolean            // Whether visible (default: true)
}
```

#### `NavLayout`

```ts
interface NavLayout {
  groups: NavGroupConfig[]  // Ordered list of groups
  version: number           // Schema version for future migrations
}
```

### Advanced Example

```ts
adminNavPlugin({
  defaultNav: [
    {
      id: 'content',
      title: 'Content',
      items: [
        { id: 'pages', href: '/admin/collections/pages', label: 'Pages', icon: 'file-text' },
        { id: 'posts', href: '/admin/collections/posts', label: 'Blog', icon: 'newspaper' },
        { id: 'media', href: '/admin/collections/media', label: 'Media', icon: 'image' },
      ],
    },
    {
      id: 'seo',
      title: 'SEO',
      defaultCollapsed: true,
      items: [
        { id: 'seo-dashboard', href: '/admin/seo', label: 'Dashboard', icon: 'trending-up', matchPrefix: true },
        { id: 'sitemap', href: '/admin/sitemap-audit', label: 'Sitemap', icon: 'globe' },
        { id: 'redirects', href: '/admin/redirects', label: 'Redirects', icon: 'corner-down-right' },
      ],
    },
    {
      id: 'support',
      title: 'Support',
      items: [
        {
          id: 'tickets',
          href: '/admin/collections/tickets',
          label: 'Tickets',
          icon: 'ticket',
          matchPrefix: true,
          children: [
            { id: 'open', href: '/admin/collections/tickets?status=open', label: 'Open', icon: '#EF4444' },
            { id: 'closed', href: '/admin/collections/tickets?status=closed', label: 'Closed', icon: '#22C55E' },
          ],
        },
      ],
    },
    {
      id: 'admin',
      title: 'Administration',
      items: [
        { id: 'users', href: '/admin/collections/users', label: 'Users', icon: 'users' },
        { id: 'nav-customizer', href: '/admin/nav-customizer', label: 'Customize Nav', icon: 'palette' },
      ],
    },
  ],
  // For file: or link: protocol installs, override the component path:
  // navComponentPath: '@/components/admin/AdminNavWrapper#AdminNav',
})
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Built-in Icons

The plugin includes 70+ inline SVG icons with zero external dependencies. All icons use a 24x24 viewBox and are Lucide-compatible.

Use any icon name in `NavItemConfig.icon`:

```ts
{ id: 'pages', href: '/admin/collections/pages', label: 'Pages', icon: 'file-text' }
```

For color dots instead of icons, use a hex color:

```ts
{ id: 'urgent', href: '...', label: 'Urgent', icon: '#EF4444' }
```

<details>
<summary><strong>Full icon list (70+)</strong></summary>

| Category | Icons |
|----------|-------|
| **Navigation** | `home`, `layout-dashboard`, `settings`, `menu`, `compass`, `map`, `navigation` |
| **Content** | `file-text`, `newspaper`, `image`, `tag`, `calendar`, `bookmark`, `clipboard` |
| **Support** | `ticket`, `message-square`, `users`, `shield-check`, `mail-search`, `folder-kanban`, `file-up` |
| **Management** | `receipt`, `briefcase`, `wallet`, `credit-card`, `truck`, `package`, `shopping-cart` |
| **Config** | `database`, `globe`, `palette`, `key`, `monitor`, `server`, `cloud` |
| **SEO** | `search`, `trending-up`, `bar-chart`, `link`, `award`, `target`, `activity` |
| **Misc** | `heart`, `star`, `bell`, `zap`, `gift`, `rocket`, `flag`, `coffee`, `music`, `camera` |

</details>

### Programmatic Access

```ts
import { getIconNames, getIconPath, iconPaths } from '@consilioweb/admin-nav'

// Get all available icon names
const names = getIconNames() // ['home', 'file-text', ...]

// Get the SVG path data for an icon
const path = getIconPath('home') // 'M3 9l9-7 9 7v11a2...'

// Access the full registry
console.log(Object.keys(iconPaths).length) // 70+
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## API Endpoints

All endpoints are prefixed with the configured `endpointBasePath` (default: `/admin-nav`). All endpoints require an authenticated admin user.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin-nav/preferences` | Get the current user's navigation preferences |
| `PATCH` | `/admin-nav/preferences` | Save the current user's navigation layout |
| `DELETE` | `/admin-nav/preferences` | Reset to default navigation |
| `GET` | `/admin-nav/default-nav` | Get the plugin's default nav config |

### `useNavPreferences` Hook

For custom components that need to interact with nav preferences:

```ts
import { useNavPreferences } from '@consilioweb/admin-nav/client'

function MyComponent() {
  const { layout, isLoaded, isSaving, isCustom, save, reset, reload } = useNavPreferences()

  if (!isLoaded) return <p>Loading...</p>

  return (
    <div>
      <p>Groups: {layout.groups.length}</p>
      <p>Custom layout: {isCustom ? 'Yes' : 'No'}</p>
      <button onClick={reset}>Reset to defaults</button>
    </div>
  )
}
```

| Property | Type | Description |
|----------|------|-------------|
| `layout` | `NavLayout` | Current navigation layout (user's or default) |
| `isLoaded` | `boolean` | Whether preferences have been fetched |
| `isSaving` | `boolean` | Whether a save operation is in progress |
| `isCustom` | `boolean` | Whether the user has customized their nav |
| `save` | `(layout: NavLayout) => Promise<void>` | Save a new layout |
| `reset` | `() => Promise<void>` | Reset to default navigation |
| `reload` | `() => Promise<void>` | Reload preferences from server |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Components

### Client Components

| Component | Description |
|-----------|-------------|
| `AdminNav` | Main sidebar navigation component (injected via `beforeNavLinks`) |
| `NavCustomizer` | Full drag & drop editor for the navigation layout |
| `SortableGroup` | Draggable group component (used by NavCustomizer) |
| `SortableItem` | Draggable item component (used by NavCustomizer) |
| `GroupEditor` | Modal for editing group properties |
| `NavItemEditor` | Modal for editing item properties and sub-items |
| `IconPicker` | Icon selection dropdown with search and color mode |

### Server Views

| Component | Path | Description |
|-----------|------|-------------|
| `NavCustomizerView` | `/admin/nav-customizer` | Admin view wrapping the NavCustomizer in Payload's DefaultTemplate |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Package Exports

```ts
// Main entry — plugin, collection, endpoints, icons, types
import {
  adminNavPlugin,
  createAdminNavPreferencesCollection,
  createGetPreferencesHandler,
  createSavePreferencesHandler,
  createResetPreferencesHandler,
  getIconNames,
  getIconPath,
  iconPaths,
} from '@consilioweb/admin-nav'
import type {
  NavItemConfig,
  NavGroupConfig,
  NavLayout,
  AdminNavPluginConfig,
} from '@consilioweb/admin-nav'

// Client components — React components for Payload admin UI
import {
  AdminNav,
  NavCustomizer,
  SortableGroup,
  SortableItem,
  GroupEditor,
  NavItemEditor,
  IconPicker,
  useNavPreferences,
} from '@consilioweb/admin-nav/client'

// Server views — admin views wrapped in DefaultTemplate
import { NavCustomizerView } from '@consilioweb/admin-nav/views'
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Requirements

- **Node.js** >= 18
- **Payload CMS** 3.x
- **React** 18.x or 19.x (for admin UI components)
- **Database**: Any Payload-supported adapter (SQLite, PostgreSQL, MongoDB)

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Uninstall

1. Remove the plugin from your `payload.config.ts`
2. Uninstall the package:

```bash
pnpm remove @consilioweb/admin-nav
```

3. Regenerate the importmap:

```bash
pnpm generate:importmap
```

### Data cleanup (optional)

The `admin-nav-preferences` collection data remains in your database after uninstall. To remove it:

**SQLite:**
```sql
DROP TABLE IF EXISTS admin_nav_preferences;
```

**PostgreSQL:**
```sql
DROP TABLE IF EXISTS "admin-nav-preferences" CASCADE;
```

**MongoDB:**
```js
db.getCollection('admin-nav-preferences').drop()
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## License

[MIT](LICENSE)

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

<div align="center">

### Author

**Made with passion by [ConsilioWEB](https://consilioweb.fr)**

<a href="https://www.linkedin.com/in/christophe-lopez/">
  <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn">
</a>
<a href="https://github.com/pOwn3d">
  <img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
</a>
<a href="https://consilioweb.fr">
  <img src="https://img.shields.io/badge/Website-consilioweb.fr-3B82F6?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Website">
</a>

<br><br>

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" width="100%"/>

</div>
