import type { CollectionConfig } from 'payload'

/**
 * Creates the AdminNavPreferences collection.
 * Stores per-user navigation layout customizations.
 */
export function createAdminNavPreferencesCollection(
  slug: string = 'admin-nav-preferences',
  userCollectionSlug: string = 'users',
): CollectionConfig {
  return {
    slug,
    admin: {
      hidden: true,
    },
    access: {
      // Users can only read their own preferences
      read: ({ req }) => {
        if (!req.user) return false
        return { user: { equals: req.user.id } }
      },
      // Users can only create their own preferences
      create: ({ req }) => !!req.user,
      // Users can only update their own preferences
      update: ({ req }) => {
        if (!req.user) return false
        return { user: { equals: req.user.id } }
      },
      // Users can only delete their own preferences
      delete: ({ req }) => {
        if (!req.user) return false
        return { user: { equals: req.user.id } }
      },
    },
    fields: [
      {
        name: 'user',
        type: 'relationship',
        relationTo: userCollectionSlug,
        required: true,
        unique: true,
        index: true,
      },
      {
        name: 'navLayout',
        type: 'json',
        required: true,
      },
      {
        name: 'version',
        type: 'number',
        defaultValue: 1,
      },
    ],
  }
}
