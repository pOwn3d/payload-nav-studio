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
