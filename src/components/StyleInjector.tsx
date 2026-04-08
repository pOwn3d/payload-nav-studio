'use client'

import React, { useEffect, useRef } from 'react'

// Import the CSS content as a string at build time.
// This is injected once into the document head to style all admin-nav components.
const ADMIN_NAV_CSS = `/* ================================================================
   admin-nav.css — Single stylesheet for @consilioweb/admin-nav
   BEM naming: .admin-nav__<element>--<modifier>
   All themeable values use --admin-nav-* custom properties.
   ================================================================ */

:root {
  --admin-nav-active-border: var(--theme-elevation-500);
  --admin-nav-active-bg: var(--theme-elevation-100);
  --admin-nav-active-text: var(--theme-text);
  --admin-nav-group-label: var(--theme-elevation-500);
  --admin-nav-transition: 0.15s ease;
}

[data-admin-nav] ~ * { display: none !important; }

.admin-nav { padding-bottom: 12px; margin-bottom: 8px; border-bottom: 1px solid var(--theme-elevation-200); transition: opacity var(--admin-nav-transition); }
.admin-nav--loading { opacity: 0; min-height: 200px; }

.admin-nav__dashboard-link { display: flex; align-items: center; gap: 8px; padding: 8px 16px; margin: 0 8px 8px; border-radius: 6px; border-left: 3px solid transparent; font-weight: 600; font-size: 13px; text-decoration: none; color: var(--theme-text); transition: background-color var(--admin-nav-transition), color var(--admin-nav-transition); }
.admin-nav__dashboard-link--active { border-left-color: var(--admin-nav-active-border); background-color: var(--admin-nav-active-bg); color: var(--admin-nav-active-text); }

.admin-nav__group { margin-bottom: 6px; }
.admin-nav__group-title { padding: 4px 16px; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; color: var(--admin-nav-group-label); cursor: pointer; display: flex; align-items: center; justify-content: space-between; user-select: none; }
.admin-nav__group-chevron { transition: transform var(--admin-nav-transition); }
.admin-nav__group-chevron--collapsed { transform: rotate(-90deg); }

.admin-nav__item-link { display: flex; align-items: center; gap: 8px; padding: 7px 16px; margin: 2px 8px; border-radius: 6px; border-left: 3px solid transparent; font-weight: 500; font-size: 13px; text-decoration: none; color: var(--theme-text); transition: background-color var(--admin-nav-transition), color var(--admin-nav-transition); }
.admin-nav__item-link--active, .admin-nav__item-link--has-active-child { border-left-color: var(--admin-nav-active-border); color: var(--admin-nav-active-text); font-weight: 600; }
.admin-nav__item-link--active { background-color: var(--admin-nav-active-bg); }

.admin-nav__child-link { display: flex; align-items: center; gap: 6px; padding: 5px 16px 5px 36px; margin: 1px 8px; border-radius: 6px; border-left: 3px solid transparent; font-weight: 400; font-size: 12px; text-decoration: none; color: var(--theme-elevation-500); transition: background-color var(--admin-nav-transition), color var(--admin-nav-transition); }
.admin-nav__child-link--active { border-left-color: var(--admin-nav-active-border); background-color: var(--admin-nav-active-bg); color: var(--admin-nav-active-text); font-weight: 600; }

.admin-nav__customize-link { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 6px 16px; margin: 8px 8px 0; border-radius: 6px; font-size: 11px; color: var(--theme-elevation-500); text-decoration: none; transition: color var(--admin-nav-transition); cursor: pointer; border: none; background: none; width: 100%; }
.admin-nav__dot-icon { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.admin-nav__svg-icon { flex-shrink: 0; }

/* NavCustomizer */
.admin-nav-customizer { max-width: 700px; margin: 0 auto; padding: 20px; }
.admin-nav-customizer__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; gap: 12px; }
.admin-nav-customizer__title { font-size: 20px; font-weight: 700; color: var(--theme-text); margin: 0; }
.admin-nav-customizer__actions { display: flex; gap: 8px; }
.admin-nav-customizer__hint { font-size: 12px; color: var(--theme-elevation-500); margin-bottom: 16px; }
.admin-nav-customizer__toolbar { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; align-items: center; }
.admin-nav-customizer__separator { width: 1px; height: 20px; background-color: var(--theme-elevation-200); margin: 0 4px; }
.admin-nav-customizer__search { display: flex; align-items: center; gap: 6px; margin-bottom: 16px; }
.admin-nav-customizer__search-input { flex: 1; padding: 7px 12px; border: 1px solid var(--theme-elevation-200); border-radius: 6px; font-size: 13px; color: var(--theme-text); background-color: var(--theme-input-bg, transparent); outline: none; }
.admin-nav-customizer__no-results { font-size: 13px; color: var(--theme-elevation-400); text-align: center; padding: 20px 0; }
.admin-nav-customizer__drag-overlay { padding: 8px 16px; border-radius: 6px; background-color: var(--theme-elevation-100); border: 1px solid var(--theme-elevation-300); font-size: 13px; font-weight: 600; color: var(--theme-text); box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: grabbing; }
.admin-nav-customizer__add-item-wrap { padding: 4px 8px; }

/* Buttons */
.admin-nav-btn--primary { padding: 8px 16px; border: none; border-radius: 6px; background-color: var(--theme-success-500); color: white; font-size: 13px; font-weight: 600; cursor: pointer; }
.admin-nav-btn--primary:disabled { background-color: var(--theme-elevation-300); cursor: not-allowed; }
.admin-nav-btn--secondary { padding: 8px 16px; border: 1px solid var(--theme-elevation-200); border-radius: 6px; background: none; font-size: 13px; cursor: pointer; color: var(--theme-text); }
.admin-nav-btn--outline { padding: 8px 16px; border: 1px dashed var(--theme-elevation-300); border-radius: 6px; background: none; font-size: 13px; cursor: pointer; color: var(--theme-elevation-500); width: 100%; text-align: center; }
.admin-nav-btn--outline-sm { padding: 4px 8px; border: 1px dashed var(--theme-elevation-250); border-radius: 6px; background: none; font-size: 11px; cursor: pointer; color: var(--theme-elevation-500); width: 100%; text-align: center; }
.admin-nav-btn--small { padding: 5px 10px; border: 1px solid var(--theme-elevation-200); border-radius: 5px; background: none; font-size: 11px; cursor: pointer; color: var(--theme-elevation-600); white-space: nowrap; }
.admin-nav-btn--small:disabled { opacity: 0.4; cursor: default; }
.admin-nav-btn--small-discover { padding: 5px 10px; border: 1px solid var(--theme-elevation-200); border-radius: 5px; background-color: var(--theme-elevation-100); font-size: 11px; cursor: pointer; color: var(--theme-elevation-600); white-space: nowrap; }
.admin-nav-btn--small-discover:disabled { opacity: 0.4; cursor: default; }

/* Toast */
.admin-nav-toast { position: fixed; bottom: 24px; right: 24px; padding: 10px 20px; border-radius: 8px; color: white; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transform: translateY(100px); opacity: 0; transition: transform 0.3s, opacity 0.3s; z-index: 2000; pointer-events: none; }
.admin-nav-toast--visible { transform: translateY(0); opacity: 1; }
.admin-nav-toast--success { background-color: var(--theme-success-500); }
.admin-nav-toast--error { background-color: var(--theme-error-500); }

/* SortableGroup */
.admin-nav-sortable-group { margin-bottom: 12px; border: 1px solid var(--theme-elevation-200); border-radius: 8px; overflow: hidden; background-color: var(--theme-elevation-0); }
.admin-nav-sortable-group--hidden { background-color: var(--theme-elevation-50); }
.admin-nav-sortable-group--dragging { opacity: 0.5; }
.admin-nav-sortable-group__header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background-color: var(--theme-elevation-100); border-bottom: 1px solid var(--theme-elevation-200); cursor: grab; }
.admin-nav-sortable-group__title { flex: 1; font-weight: 600; font-size: 13px; color: var(--theme-text); }
.admin-nav-sortable-group__title--hidden { color: var(--theme-elevation-400); text-decoration: line-through; }
.admin-nav-sortable-group__action-btn { background: none; border: none; cursor: pointer; padding: 4px; border-radius: 4px; color: var(--theme-elevation-500); display: flex; align-items: center; justify-content: center; }
.admin-nav-sortable-group__items { padding: 8px 0; }
.admin-nav-sortable-group__items--hidden { padding: 4px 0; opacity: 0.5; }

/* SortableItem */
.admin-nav-sortable-item { display: flex; align-items: center; gap: 8px; padding: 6px 12px; margin: 2px 8px; border-radius: 6px; background-color: transparent; cursor: grab; }
.admin-nav-sortable-item--dragging { opacity: 0.4; background-color: var(--theme-elevation-150); }
.admin-nav-sortable-item--invisible { opacity: 0.5; }
.admin-nav-sortable-item__dot-icon { display: inline-block; width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
.admin-nav-sortable-item__label { flex: 1; font-size: 13px; font-weight: 500; color: var(--theme-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-nav-sortable-item__label--hidden { color: var(--theme-elevation-400); text-decoration: line-through; }
.admin-nav-sortable-item__badge { font-size: 10px; padding: 1px 5px; border-radius: 8px; background-color: var(--theme-elevation-200); color: var(--theme-elevation-600); }
.admin-nav-sortable-item__grip { flex-shrink: 0; color: var(--theme-elevation-400); }
.admin-nav-sortable-item__action-btn { background: none; border: none; cursor: pointer; padding: 2px; border-radius: 4px; color: var(--theme-elevation-400); display: flex; align-items: center; justify-content: center; opacity: 0.7; }

/* IconPicker */
.admin-nav-icon-picker { position: absolute; top: 100%; left: 0; z-index: 100; width: 300px; max-height: 320px; background-color: var(--theme-elevation-0); border: 1px solid var(--theme-elevation-200); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; flex-direction: column; }
.admin-nav-icon-picker__search { padding: 8px; border-bottom: 1px solid var(--theme-elevation-200); }
.admin-nav-icon-picker__search-input { width: 100%; padding: 6px 8px; border: 1px solid var(--theme-elevation-200); border-radius: 4px; font-size: 12px; background-color: var(--theme-input-bg); color: var(--theme-text); outline: none; }
.admin-nav-icon-picker__dot-option { padding: 4px 8px; border-bottom: 1px solid var(--theme-elevation-200); }
.admin-nav-icon-picker__dot-label { font-size: 11px; color: var(--theme-elevation-500); display: flex; align-items: center; gap: 6px; }
.admin-nav-icon-picker__color-input { width: 24px; height: 24px; border: none; padding: 0; cursor: pointer; }
.admin-nav-icon-picker__grid { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
.admin-nav-icon-picker__icon-btn { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--theme-elevation-200); border-radius: 6px; background-color: var(--theme-elevation-0); cursor: pointer; color: var(--theme-text); }
.admin-nav-icon-picker__icon-btn--selected { border: 2px solid var(--theme-success-500); background-color: var(--theme-success-100); }
.admin-nav-icon-picker__no-results { padding: 12px; font-size: 12px; color: var(--theme-elevation-400); }
.admin-nav-icon-picker__footer { padding: 4px; border-top: 1px solid var(--theme-elevation-200); text-align: right; }
.admin-nav-icon-picker__close-btn { background: none; border: none; font-size: 11px; color: var(--theme-elevation-500); cursor: pointer; padding: 4px 8px; }

/* Shared modal */
.admin-nav-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.admin-nav-modal { background-color: var(--theme-elevation-0); border-radius: 12px; padding: 24px; max-width: 90vw; max-height: 85vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
.admin-nav-modal--sm { width: 380px; }
.admin-nav-modal--md { width: 420px; }
.admin-nav-modal__title { margin: 0 0 16px; font-size: 16px; font-weight: 600; color: var(--theme-text); }
.admin-nav-modal__field-group { margin-bottom: 12px; }
.admin-nav-modal__field-group--relative { position: relative; }
.admin-nav-modal__field-group--lg { margin-bottom: 16px; }
.admin-nav-modal__field-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.admin-nav-modal__label { font-size: 11px; font-weight: 600; color: var(--theme-elevation-500); margin-bottom: 4px; display: block; }
.admin-nav-modal__label--inline { margin-bottom: 0; }
.admin-nav-modal__input { width: 100%; padding: 6px 8px; border: 1px solid var(--theme-elevation-200); border-radius: 4px; font-size: 13px; background-color: var(--theme-input-bg); color: var(--theme-text); outline: none; }
.admin-nav-modal__input--icon-btn { cursor: pointer; display: flex; align-items: center; gap: 8px; text-align: left; }
.admin-nav-modal__checkbox-label { font-size: 12px; display: flex; align-items: center; gap: 8px; color: var(--theme-text); cursor: pointer; }
.admin-nav-modal__multilang-toggle { font-size: 10px; display: flex; align-items: center; gap: 4px; color: var(--theme-elevation-500); cursor: pointer; }
.admin-nav-modal__multilang-fields { display: flex; flex-direction: column; gap: 6px; }
.admin-nav-modal__lang-row { display: flex; align-items: center; gap: 6px; }
.admin-nav-modal__lang-code { font-size: 10px; font-weight: 600; color: var(--theme-elevation-400); width: 20px; text-align: center; text-transform: uppercase; }
.admin-nav-modal__actions { display: flex; gap: 8px; justify-content: flex-end; }
.admin-nav-modal__icon-dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; }
.admin-nav-modal__icon-name { font-size: 12px; color: var(--theme-elevation-500); }

/* Submenus */
.admin-nav-submenus { margin-bottom: 16px; border: 1px solid var(--theme-elevation-150); border-radius: 8px; padding: 12px; background-color: var(--theme-elevation-50); }
.admin-nav-submenus__header { display: flex; align-items: center; justify-content: space-between; }
.admin-nav-submenus__header--has-items { margin-bottom: 8px; }
.admin-nav-submenus__title { font-size: 11px; font-weight: 600; color: var(--theme-elevation-500); text-transform: uppercase; letter-spacing: 0.5px; }
.admin-nav-submenus__add-btn { font-size: 11px; font-weight: 600; color: var(--theme-success-500); background: none; border: none; cursor: pointer; padding: 2px 0; }
.admin-nav-submenus__add-btn:disabled { color: var(--theme-elevation-300); cursor: default; }
.admin-nav-submenus__empty { font-size: 11px; color: var(--theme-elevation-400); font-style: italic; }
.admin-nav-submenus__child-wrapper { margin-bottom: 4px; }
.admin-nav-submenus__child-wrapper:last-child { margin-bottom: 0; }
.admin-nav-submenus__child-row { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 4px; background-color: var(--theme-elevation-0); border: 1px solid var(--theme-elevation-100); }
.admin-nav-submenus__child-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.admin-nav-submenus__child-bullet { font-size: 10px; color: var(--theme-elevation-400); flex-shrink: 0; width: 8px; text-align: center; }
.admin-nav-submenus__child-label { font-size: 12px; color: var(--theme-text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-nav-submenus__child-label em { color: var(--theme-elevation-300); }
.admin-nav-submenus__child-href { font-size: 10px; color: var(--theme-elevation-400); flex-shrink: 0; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-nav-submenus__child-actions { display: flex; gap: 2px; flex-shrink: 0; }
.admin-nav-submenus__child-action-btn { background: none; border: none; font-size: 12px; padding: 0 2px; color: var(--theme-elevation-500); }
.admin-nav-submenus__child-action-btn--disabled { color: var(--theme-elevation-200); cursor: default; }
.admin-nav-submenus__child-action-btn--enabled { cursor: pointer; }
.admin-nav-submenus__child-action-btn--delete { cursor: pointer; color: var(--theme-error-500); }
.admin-nav-submenus__edit-form { padding: 8px; border-radius: 4px; background-color: var(--theme-elevation-0); border: 1px solid var(--theme-elevation-200); }
.admin-nav-submenus__edit-field { margin-bottom: 6px; }
.admin-nav-submenus__edit-field--last { margin-bottom: 8px; }
.admin-nav-submenus__edit-label { font-size: 10px; font-weight: 600; color: var(--theme-elevation-500); margin-bottom: 4px; display: block; }
.admin-nav-submenus__edit-input { width: 100%; padding: 4px 6px; border: 1px solid var(--theme-elevation-200); border-radius: 4px; font-size: 12px; background-color: var(--theme-input-bg); color: var(--theme-text); outline: none; }
.admin-nav-submenus__edit-actions { display: flex; gap: 6px; justify-content: flex-end; }
.admin-nav-submenus__edit-cancel { font-size: 11px; padding: 3px 10px; border: 1px solid var(--theme-elevation-200); border-radius: 4px; background: none; cursor: pointer; color: var(--theme-text); }
.admin-nav-submenus__edit-ok { font-size: 11px; padding: 3px 10px; border: none; border-radius: 4px; background-color: var(--theme-success-500); color: white; font-weight: 600; cursor: pointer; }

.admin-nav-file-input--hidden { display: none; }
`

const STYLE_ID = 'admin-nav-styles'

/**
 * StyleInjector — Injects the admin-nav stylesheet into the document head.
 * Uses a unique ID to ensure only one instance is created, even with React
 * strict mode or multiple mounts.
 */
export const StyleInjector: React.FC = () => {
  const injectedRef = useRef(false)

  useEffect(() => {
    if (injectedRef.current) return
    if (typeof document === 'undefined') return
    if (document.getElementById(STYLE_ID)) {
      injectedRef.current = true
      return
    }

    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = ADMIN_NAV_CSS
    document.head.appendChild(style)
    injectedRef.current = true
  }, [])

  return null
}
