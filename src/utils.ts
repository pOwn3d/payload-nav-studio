import type { NavGroupConfig } from './types.js'

/**
 * Check if a label is a multi-language record.
 */
export function isMultiLang(
  label: string | Record<string, string>,
): label is Record<string, string> {
  return typeof label === 'object' && label !== null
}

/**
 * Resolve a potentially multi-language label to a string.
 * Falls back to: lang → fallback → first available value → empty string.
 */
export function resolveLabel(
  label: string | Record<string, string>,
  lang: string,
  fallback?: string,
): string {
  if (typeof label === 'string') return label
  return label[lang] ?? (fallback ? label[fallback] : undefined) ?? Object.values(label)[0] ?? ''
}

/**
 * Compute a numeric fingerprint from a nav structure.
 * Used to detect when the defaultNav config has changed so that
 * stale per-user preferences can be automatically reset.
 *
 * The fingerprint is a simple djb2 hash of the serialized group/item IDs and hrefs.
 * It is intentionally NOT a cryptographic hash — just a fast structural signature.
 */
export function computeNavFingerprint(groups: NavGroupConfig[]): number {
  // Build a lightweight structural key from group IDs and item IDs/hrefs
  const parts: string[] = []
  for (const group of groups) {
    parts.push(`g:${group.id}`)
    for (const item of group.items) {
      parts.push(`i:${item.id}:${item.href}`)
      if (item.children) {
        for (const child of item.children) {
          parts.push(`c:${child.id}:${child.href}`)
        }
      }
    }
  }
  const str = parts.join('|')

  // djb2 hash
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  // Return positive integer
  return hash >>> 0
}
