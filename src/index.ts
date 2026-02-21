// Server-side exports — plugin, types, collection, icons
export { adminNavPlugin } from './plugin.js'
export { createAdminNavPreferencesCollection } from './collections/AdminNavPreferences.js'
export {
  createGetPreferencesHandler,
  createSavePreferencesHandler,
  createResetPreferencesHandler,
} from './endpoints/preferences.js'
export { getIconNames, getIconPath, iconPaths } from './icons.js'

// Types
export type {
  NavItemConfig,
  NavGroupConfig,
  NavLayout,
  AdminNavPluginConfig,
} from './types.js'
