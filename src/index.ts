// Server-side exports — plugin, types, collection, icons, utils
export { adminNavPlugin } from './plugin.js'
export { autoDiscoverNav } from './autoDiscover.js'
export { createAdminNavPreferencesCollection } from './collections/AdminNavPreferences.js'
export {
  createGetPreferencesHandler,
  createSavePreferencesHandler,
  createResetPreferencesHandler,
} from './endpoints/preferences.js'
export { getIconNames, getIconPath, iconPaths } from './icons.js'
export { resolveLabel, isMultiLang, computeNavFingerprint } from './utils.js'

// Types
export type {
  LocalizedString,
  NavItemConfig,
  NavGroupConfig,
  NavLayout,
  AdminNavPluginConfig,
} from './types.js'
