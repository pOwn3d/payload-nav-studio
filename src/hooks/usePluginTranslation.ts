import { useTranslation } from '@payloadcms/ui'
import type { PluginAdminNavTranslationKeys } from '../translations/keys.js'

/**
 * Typed wrapper around Payload's useTranslation that includes
 * the plugin-admin-nav translation keys.
 */
export const usePluginTranslation = () => {
  return useTranslation<Record<string, never>, PluginAdminNavTranslationKeys>()
}
