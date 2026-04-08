// Client-side barrel — re-exports only, NO "use client" here.
// Each component file has its own "use client" directive (added by tsup onSuccess).
//
// IMPORTANT: NavCustomizer, SortableGroup, SortableItem are NOT re-exported here
// because they bundle @dnd-kit (which uses createContext). Turbopack evaluates barrel
// re-exports in SSR context even when they point to "use client" files, causing
// createContext to crash. These components are only used via the views entry and
// are imported directly by NavCustomizerView — never through this barrel.
export { default as AdminNav } from './components/AdminNav.js'
export { GroupEditor } from './components/GroupEditor.js'
export { NavItemEditor } from './components/NavItemEditor.js'
export { IconPicker } from './components/IconPicker.js'
export { useNavPreferences } from './hooks/useNavPreferences.js'
export { usePluginTranslation } from './hooks/usePluginTranslation.js'
export { resolveLabel, isMultiLang } from './utils.js'
export type { PluginAdminNavTranslationKeys } from './translations/keys.js'
