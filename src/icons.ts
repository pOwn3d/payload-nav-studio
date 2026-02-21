/**
 * Built-in SVG icon registry.
 * Inline SVG paths — no external dependency (Lucide-compatible viewBox 0 0 24 24).
 * Each icon is a <path d="..."/> string for a 24x24 viewBox.
 */

const iconPaths: Record<string, string> = {
  // Navigation & Layout
  'home': 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  'layout-dashboard': 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
  'settings': 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',

  // Content
  'file-text': 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  'newspaper': 'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2 M18 14h-8 M15 18h-5 M10 6h8v4h-8V6z',
  'image': 'M21 3H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.5 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm13.5 9l-5-6.5-3 3.5-2-2L3 19',
  'tag': 'M12 2H2v10l9.17 9.17a2 2 0 0 0 2.83 0l7.17-7.17a2 2 0 0 0 0-2.83L12 2zM7 7h.01',
  'calendar': 'M16 2v4 M8 2v4 M3 10h18 M21 6H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z',

  // Support
  'ticket': 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z M13 5v2 M13 17v2 M13 11v2',
  'message-square': 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  'users': 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  'folder-kanban': 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z M8 10v4 M12 10v2 M16 10v6',
  'file-up': 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6 M12 12v6 M15 15l-3-3-3 3',
  'mail-search': 'M20 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8 M22 22l-2.5-2.5 M4 8l8 5 8-5 M18 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  'shield-check': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',

  // Management
  'receipt': 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z M16 8H8 M16 12H8 M10 16H8',
  'clock': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2',
  'mail': 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6',
  'clipboard-list': 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z M12 11h4 M12 16h4 M8 11h.01 M8 16h.01',

  // Configuration
  'panel-top': 'M3 3h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M3 9h18',
  'panel-bottom': 'M3 3h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M3 15h18',
  'user-cog': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M19.82 16.18l-.47.36a.87.87 0 0 0 0 1.4l.47.36a1.52 1.52 0 0 1-.75 2.62l-.58.08a.87.87 0 0 0-.7 1l.08.58a1.52 1.52 0 0 1-2.26 1.52l-.36-.47a.87.87 0 0 0-1.4 0l-.36.47a1.52 1.52 0 0 1-2.26-1.52l.08-.58a.87.87 0 0 0-.7-1l-.58-.08a1.52 1.52 0 0 1-.75-2.62l.47-.36a.87.87 0 0 0 0-1.4l-.47-.36a1.52 1.52 0 0 1 .75-2.62l.58-.08a.87.87 0 0 0 .7-1l-.08-.58a1.52 1.52 0 0 1 2.26-1.52l.36.47a.87.87 0 0 0 1.4 0l.36-.47A1.52 1.52 0 0 1 22 14.74l-.08.58a.87.87 0 0 0 .7 1l.58.08a1.52 1.52 0 0 1 .75 2.62z',

  // SEO
  'search-check': 'M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M21 21l-4.35-4.35 M8 11l2 2 4-4',
  'bar-chart-3': 'M18 20V10 M12 20V4 M6 20v-6',
  'shuffle': 'M16 3h5v5 M4 20L21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5',
  'layers': 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  'activity': 'M22 12h-4l-3 9L9 3l-3 9H2',
  'search': 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M21 21l-4.35-4.35',
  'file-code-2': 'M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4 M14 2v6h6 M9 18l3-3-3-3 M4 12l-3 3 3 3',
  'git-branch': 'M6 3v12 M18 9a3 3 0 1 0 0 6 M6 21a3 3 0 1 0 0-6 M18 9a9 9 0 0 1-9 9',

  // Misc
  'plus': 'M12 5v14 M5 12h14',
  'minus': 'M5 12h14',
  'x': 'M18 6L6 18 M6 6l12 12',
  'check': 'M20 6L9 17l-5-5',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  'grip-vertical': 'M9 4h.01 M9 9h.01 M9 14h.01 M9 19h.01 M15 4h.01 M15 9h.01 M15 14h.01 M15 19h.01',
  'eye': 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'eye-off': 'M9.88 9.88a3 3 0 1 0 4.24 4.24 M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68 M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61 M1 1l22 22',
  'pencil': 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z M15 5l4 4',
  'trash-2': 'M3 6h18 M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6 M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2 M10 11v6 M14 11v6',
  'save': 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8',
  'rotate-ccw': 'M1 4v6h6 M3.51 15a9 9 0 1 0 2.13-9.36L1 10',
  'move': 'M5 9l-3 3 3 3 M9 5l3-3 3 3 M15 19l-3 3-3-3 M19 9l3 3-3 3 M2 12h20 M12 2v20',
  'palette': 'M12 2a10 10 0 0 0-8.66 15A2 2 0 0 0 5.07 19H6a2 2 0 0 1 2 2 2 2 0 0 0 2 2 10 10 0 0 0 2-20z M6 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M10 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M15 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M18 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  'box': 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12',
  'star': 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  'heart': 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  'zap': 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  'globe': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  'link': 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  'external-link': 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3',
}

/** Get all available icon names */
export function getIconNames(): string[] {
  return Object.keys(iconPaths)
}

/** Get the SVG path data for a given icon name */
export function getIconPath(name: string): string | undefined {
  return iconPaths[name]
}

/** Render an SVG icon as a React element string (for use in components) */
export function renderIconSvg(name: string, size: number = 16): string {
  const path = iconPaths[name]
  if (!path) return ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path.split(' M').map((p, i) => `<path d="${i > 0 ? 'M' : ''}${p}"/>`).join('')}</svg>`
}

export { iconPaths }
