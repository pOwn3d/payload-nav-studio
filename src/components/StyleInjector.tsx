'use client'

import React, { useEffect, useRef } from 'react'

// Import the CSS content as a string at build time.
// This is injected once into the document head to style all admin-nav components.
// NOTE: kept in sync with src/styles/admin-nav.css (the package "./styles" export).
const ADMIN_NAV_CSS = `/* ================================================================
   admin-nav.css — Single stylesheet for @consilioweb/payload-admin-nav
   BEM naming: .admin-nav__<element>--<modifier>

   DESIGN SYSTEM "ConsilioWEB Support v2"
   --------------------------------------
   - Ink primary (#1d2b4d) + Teal signature (#17807c)
   - Warm neutrals (very low saturation)
   - Hanken Grotesk (UI) + JetBrains Mono (meta: section labels, badges, kbd)
   - Active item = soft ink background + left accent bar
   - Tickets sub-tree keeps colored status dots
   - Presence dot (live)

   THEMING
   -------
   The plugin is AUTONOMOUS: it ships its own design tokens via \`--nav-*\`
   custom properties (design-system values as defaults) and maps them onto
   Payload's native \`var(--theme-*)\` tokens where relevant, so it stays
   configurable and dark-mode compatible without depending on any host
   \`--cw-*\` tokens.
   ================================================================ */

/* Fonts — loaded by the plugin so it renders correctly even when the host
   admin does not already provide Hanken Grotesk / JetBrains Mono.
   \`display=swap\` keeps the system fallback visible until the webfont loads,
   so nothing breaks if the import is blocked (offline / CSP). */

/* ── Theme tokens (light defaults from the design system) ── */
:root {
  /* Typography */
  --nav-font-sans: 'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --nav-font-mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', 'Menlo', monospace;

  /* Brand */
  --nav-accent: #1d2b4d; /* ink — active bar / brand */
  --nav-accent-soft: #eef1f7; /* ink soft — active background */
  --nav-accent-text: #1d2b4d; /* active label / icon color */
  --nav-teal: #17807c; /* signature teal */
  --nav-logo-ink: #1d2b4d; /* logo square (constant across themes) */
  --nav-logo-ring: #4fc7c0; /* logo teal ring */
  --nav-dash: #2f5fb0; /* "Tableau de bord" primary accent (resting) */

  /* Panel surface (sidebar background) */
  --nav-panel: var(--theme-elevation-0, #fcfbf9);

  /* Surfaces & lines (warm neutrals) */
  --nav-surface: var(--theme-input-bg, #ffffff);
  --nav-border: var(--theme-elevation-150, #ebe6dc);
  --nav-hover: var(--theme-elevation-50, #f1ede5);

  /* Text */
  --nav-text: var(--theme-elevation-800, #3a362f);
  --nav-icon: var(--theme-elevation-500, #7a7468);
  --nav-muted: var(--theme-elevation-450, #9a9389);
  --nav-section-label: var(--theme-elevation-450, #a89f8f);
  --nav-child-text: #5a6b8a; /* sub-item resting color (slate, ink family) */

  /* Badges (mono pill, sober) */
  --nav-badge-bg: var(--theme-elevation-100, #ece8e0);
  --nav-badge-text: var(--theme-elevation-600, #756f64);
  --nav-count-bg: #fbf0db; /* section counter pill (warm cream) */
  --nav-count-text: #9a6310;

  /* Status / semantic (used by live dot, alert badge, section counter) */
  --nav-status-amber: #d98a1f;
  --nav-status-green: #3a9b66;
  --nav-status-red: #cf4a3a;

  --admin-nav-transition: 0.15s ease;
  --admin-nav-radius: 8px;
}

/* ── Dark mode (Payload [data-theme=dark]) ── */
[data-theme='dark'] {
  --nav-accent: #7fd5cf; /* teal-leaning accent reads better on ink panel */
  --nav-accent-soft: #222c46; /* soft ink-navy */
  --nav-accent-text: #a9c0ee;
  --nav-dash: #9db9ee; /* dashboard primary (resting) on dark panel */

  --nav-panel: var(--theme-elevation-0, #14192a);

  --nav-surface: var(--theme-input-bg, #1b2236);
  --nav-border: var(--theme-elevation-150, #29304a);
  --nav-hover: var(--theme-elevation-100, #222a40);

  --nav-text: var(--theme-elevation-800, #cdd2e4);
  --nav-icon: var(--theme-elevation-500, #8b93ad);
  --nav-muted: var(--theme-elevation-450, #6b7388);
  --nav-section-label: var(--theme-elevation-450, #5d6580);
  --nav-child-text: #9aa6c4;

  --nav-badge-bg: var(--theme-elevation-100, #2a3350);
  --nav-badge-text: var(--theme-elevation-600, #9aa3bd);
  --nav-count-bg: #3a2f1c; /* warm amber, dark-adjusted */
  --nav-count-text: #e0b878;
}

/* ================================================================
   AdminNav — Sidebar navigation
   ================================================================ */

/* Hide the default Payload nav groups rendered alongside admin-nav.
   Target them explicitly: in @payloadcms/next's Nav, beforeNavLinks (this
   plugin), DefaultNavClient, afterNavLinks and .nav__controls are all direct
   siblings inside .nav__wrap. A general sibling wildcard therefore also hid the
   settings menu, the logout button, and every afterNavLinks component injected
   by other plugins. */
[data-admin-nav] ~ .nav-group,
[data-admin-nav] ~ .browse-by-folder-button {
  display: none !important;
}

.admin-nav {
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1 1 auto;
  padding: 4px 4px 14px;
  margin-bottom: 8px;
  font-family: var(--nav-font-sans);
  transition: opacity var(--admin-nav-transition);
}

.admin-nav--loading {
  opacity: 0;
  min-height: 200px;
}

/* ── Header: collapse toggle + brand logo ── */
.admin-nav__header {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 6px 8px 10px;
  flex: none;
}

.admin-nav__collapse-btn,
.admin-nav__rail-expand {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--nav-border);
  background: var(--nav-surface);
  color: var(--nav-icon);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
  padding: 0;
  transition: background-color var(--admin-nav-transition), border-color var(--admin-nav-transition);
}

.admin-nav__collapse-btn:hover,
.admin-nav__rail-expand:hover {
  background-color: var(--nav-hover);
  border-color: color-mix(in srgb, var(--nav-accent) 30%, var(--nav-border));
}

.admin-nav__collapse-btn:focus-visible,
.admin-nav__rail-expand:focus-visible {
  outline: 2px solid var(--nav-accent);
  outline-offset: 1px;
}

.admin-nav__brand {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.admin-nav__logo {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: var(--nav-logo-ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.admin-nav__logo-ring {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 2.2px solid var(--nav-logo-ring);
  box-sizing: border-box;
}

.admin-nav__wordmark {
  font-family: var(--nav-font-sans);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: -0.01em;
  color: var(--nav-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-nav__dashboard-link {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 10px;
  margin: 0 8px 4px;
  border-radius: var(--admin-nav-radius);
  border-left: 2px solid transparent;
  font-family: var(--nav-font-sans);
  font-weight: 600;
  font-size: 13.5px;
  text-decoration: none;
  color: var(--nav-dash);
  transition: background-color var(--admin-nav-transition), color var(--admin-nav-transition);
}

.admin-nav__dashboard-link:hover {
  background-color: var(--nav-hover);
}

.admin-nav__dashboard-link--active {
  border-left-color: var(--nav-accent);
  background-color: var(--nav-accent-soft);
  color: var(--nav-accent-text);
}

.admin-nav__group {
  margin-bottom: 2px;
}

.admin-nav__group-title {
  padding: 17px 10px 7px;
  font-family: var(--nav-font-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--nav-section-label);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
  width: 100%;
  background: none;
  border: none;
  text-align: left;
}

.admin-nav__group-title:focus-visible {
  outline: 2px solid var(--nav-accent);
  outline-offset: -2px;
  border-radius: 4px;
}

.admin-nav__group-title-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-nav__group-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 17px;
  padding: 0 7px;
  border-radius: 999px;
  font-family: var(--nav-font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  background-color: var(--nav-count-bg);
  color: var(--nav-count-text);
}

.admin-nav__group-chevron {
  margin-left: auto;
  transition: transform var(--admin-nav-transition);
  flex-shrink: 0;
}

.admin-nav__group-chevron--collapsed {
  transform: rotate(-90deg);
}

.admin-nav__item-link {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 8px 10px;
  margin: 1px 8px;
  border-radius: var(--admin-nav-radius);
  border-left: 2px solid transparent;
  font-family: var(--nav-font-sans);
  font-weight: 500;
  font-size: 13.5px;
  text-decoration: none;
  color: var(--nav-text);
  transition: background-color var(--admin-nav-transition), color var(--admin-nav-transition);
}

.admin-nav__item-link:hover {
  background-color: var(--nav-hover);
}

.admin-nav__item-link--active,
.admin-nav__item-link--has-active-child {
  border-left-color: var(--nav-accent);
  color: var(--nav-accent-text);
  font-weight: 600;
}

.admin-nav__item-link--active {
  background-color: var(--nav-accent-soft);
}

.admin-nav__item-link--active:hover,
.admin-nav__item-link--has-active-child:hover {
  background-color: var(--nav-accent-soft);
}

/* Item icon inherits the link color (ink when active, muted icon otherwise) */
.admin-nav__item-link .admin-nav__svg-icon {
  color: var(--nav-icon);
}

.admin-nav__item-link--active .admin-nav__svg-icon,
.admin-nav__item-link--has-active-child .admin-nav__svg-icon {
  color: var(--nav-accent-text);
}

.admin-nav__child-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px 6px 38px;
  margin: 1px 8px;
  border-radius: var(--admin-nav-radius);
  border-left: 2px solid transparent;
  font-family: var(--nav-font-sans);
  font-weight: 500;
  font-size: 13px;
  text-decoration: none;
  color: var(--nav-child-text);
  transition: background-color var(--admin-nav-transition), color var(--admin-nav-transition);
}

.admin-nav__child-link:hover {
  background-color: var(--nav-hover);
}

.admin-nav__child-link--active {
  background-color: var(--nav-accent-soft);
  color: var(--nav-accent-text);
  font-weight: 600;
}

.admin-nav__customize-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 16px;
  margin: 10px 8px 0;
  border-radius: var(--admin-nav-radius);
  font-family: var(--nav-font-sans);
  font-size: 11.5px;
  font-weight: 500;
  color: var(--nav-muted);
  text-decoration: none;
  transition: background-color var(--admin-nav-transition), color var(--admin-nav-transition);
  cursor: pointer;
  border: none;
  background: none;
  width: auto;
}

.admin-nav__customize-link:hover {
  background-color: var(--nav-hover);
  color: var(--nav-text);
}

.admin-nav__dot-icon {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.admin-nav__svg-icon {
  flex-shrink: 0;
}

/* ── Jump-to filter ── */
.admin-nav__jumpto {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 4px 8px 10px;
  padding: 8px 10px;
  border: 1px solid var(--nav-border);
  border-radius: 9px;
  background-color: var(--nav-surface);
  transition: border-color var(--admin-nav-transition), box-shadow var(--admin-nav-transition);
}

.admin-nav__jumpto:focus-within {
  border-color: var(--nav-accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--nav-accent) 30%, transparent);
}

.admin-nav__jumpto-icon {
  display: inline-flex;
  align-items: center;
  color: var(--nav-muted);
  flex-shrink: 0;
}

.admin-nav__jumpto-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  font-family: var(--nav-font-sans);
  font-size: 13px;
  color: var(--nav-text);
  outline: none;
  padding: 0;
}

.admin-nav__jumpto-input::placeholder {
  color: var(--nav-muted);
}

/* The input above clears its own outline, and the only remaining cue was the
   wrapper's :focus-within ring — a 1px border plus a 1px shadow at 30 % of the
   accent, which does not reach the 3:1 contrast WCAG 2.2 SC 2.4.11 asks of a
   focus indicator. This draws a solid one on the field itself, keyboard-only
   (:focus-visible) so a mouse click does not paint a ring. */
.admin-nav__jumpto-input:focus-visible {
  outline: 2px solid var(--nav-accent);
  outline-offset: 1px;
  border-radius: 4px;
}

/* Remove the native "X" button from search inputs in WebKit to keep our own UI */
.admin-nav__jumpto-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

.admin-nav__jumpto-kbd {
  font-family: var(--nav-font-mono);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--nav-muted);
  background-color: var(--theme-elevation-50, #fbfaf7);
  border: 1px solid var(--nav-border);
  border-radius: 5px;
  padding: 2px 6px;
  flex-shrink: 0;
}

.admin-nav__no-results {
  font-family: var(--nav-font-sans);
  font-size: 12.5px;
  color: var(--nav-muted);
  text-align: center;
  padding: 12px 16px;
  font-style: italic;
}

/* ── Item label (used to push live dot to the right) ── */
.admin-nav__item-label,
.admin-nav__child-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Live indicator dot (pulsing green presence) ── */
.admin-nav__live-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background-color: var(--nav-status-green);
  flex-shrink: 0;
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--nav-status-green) 55%, transparent);
  animation: admin-nav-live-pulse 2.4s ease-in-out infinite;
}

@keyframes admin-nav-live-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--nav-status-green) 50%, transparent);
  }
  70% {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--nav-status-green) 0%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--nav-status-green) 0%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-nav__live-dot {
    animation: none;
  }
}

/* ── Child badges (sober mono pill, or red if alert) ── */
.admin-nav__child-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 17px;
  padding: 0 7px;
  border-radius: 999px;
  font-family: var(--nav-font-mono);
  font-size: 10px;
  font-weight: 600;
  background-color: var(--nav-badge-bg);
  color: var(--nav-badge-text);
  flex-shrink: 0;
}

.admin-nav__child-badge--alert {
  background-color: color-mix(in srgb, var(--nav-status-red) 16%, transparent);
  color: color-mix(in srgb, var(--nav-status-red) 75%, var(--nav-text));
}

/* ── User profile (above the footer) ── */
.admin-nav__user {
  position: relative;
  margin: 8px;
}

.admin-nav__user-trigger {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 9px;
  border: 1px solid var(--nav-border);
  border-radius: 10px;
  background: var(--nav-surface);
  color: var(--nav-text);
  cursor: pointer;
  text-align: left;
  font-family: var(--nav-font-sans);
  transition: background-color var(--admin-nav-transition), border-color var(--admin-nav-transition);
}

.admin-nav__user-trigger:hover:not(:disabled) {
  background-color: var(--nav-hover);
  border-color: color-mix(in srgb, var(--nav-accent) 30%, var(--nav-border));
}

.admin-nav__user-trigger:disabled {
  cursor: default;
}

.admin-nav__user-trigger:focus-visible {
  outline: 2px solid var(--nav-accent);
  outline-offset: 1px;
}

.admin-nav__user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: var(--nav-accent);
  color: #fff;
  font-family: var(--nav-font-sans);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.admin-nav__user-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.admin-nav__user-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--nav-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-nav__user-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--nav-font-mono);
  font-size: 10px;
  color: var(--nav-muted);
}

.admin-nav__user-status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--nav-muted);
  border: 1.5px solid var(--nav-surface);
}

.admin-nav__user-status-dot--success {
  background-color: var(--nav-status-green);
}

.admin-nav__user-status-dot--warning {
  background-color: var(--nav-status-amber);
}

.admin-nav__user-status-dot--elevation-400 {
  background-color: var(--nav-muted);
}

.admin-nav__user-popover {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 50;
  background-color: var(--theme-elevation-0, #fff);
  border: 1px solid var(--nav-border);
  border-radius: 11px;
  box-shadow: 0 12px 34px rgba(33, 31, 27, 0.14);
  padding: 5px;
  display: flex;
  flex-direction: column;
}

.admin-nav__user-popover-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 11px;
  border: none;
  background: none;
  border-radius: 7px;
  font-family: var(--nav-font-sans);
  font-size: 12.5px;
  color: var(--nav-text);
  cursor: pointer;
  text-align: left;
}

.admin-nav__user-popover-item:hover:not(:disabled) {
  background-color: var(--nav-hover);
}

.admin-nav__user-popover-item:focus-visible {
  outline: 2px solid var(--nav-accent);
  outline-offset: -2px;
}

.admin-nav__user-popover-item--active {
  font-weight: 600;
  background-color: var(--nav-accent-soft);
  color: var(--nav-accent-text);
}

.admin-nav__user-popover-item:disabled {
  opacity: 0.5;
  cursor: default;
}

/* ================================================================
   Collapsed rail (72px) — icons only, badges/dots preserved
   ================================================================ */

/* Shrink the host Payload nav column when the rail is active.
   Payload sets \`--nav-width\` on :root and consumes it on \`.nav\`
   (width) and \`.template-default--nav-open\` (grid column). Overriding
   it on <html> via :has() cascades to all consumers. */
html:has(.admin-nav--rail) {
  --nav-width: 72px;
}

/* Remove the host nav__scroll inline padding so the 72px is fully usable */
html:has(.admin-nav--rail) .nav__scroll {
  --nav-padding-inline-start: 0px;
  --nav-padding-inline-end: 0px;
}

.admin-nav--rail {
  align-items: center;
  padding: 4px 0 10px;
  gap: 5px;
}

.admin-nav__rail-expand {
  margin-bottom: 6px;
}

.admin-nav__rail-item {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border-left: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--nav-icon);
  text-decoration: none;
  flex: none;
  transition: background-color var(--admin-nav-transition), color var(--admin-nav-transition);
}

.admin-nav__rail-item:hover {
  background-color: var(--nav-hover);
}

.admin-nav__rail-item--dash {
  color: var(--nav-dash);
}

.admin-nav__rail-item--active {
  background-color: var(--nav-accent-soft);
  border-left-color: var(--nav-accent);
  color: var(--nav-accent-text);
}

.admin-nav__rail-divider {
  width: 36px;
  height: 1px;
  background-color: var(--nav-border);
  margin: 6px 0;
  flex: none;
}

/* Overlay indicators (top-right corner of a rail icon) */
.admin-nav__rail-dot {
  position: absolute;
  top: 5px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--nav-panel);
  flex: none;
}

.admin-nav__rail-dot--amber {
  background-color: var(--nav-status-amber);
}

.admin-nav__rail-dot--green {
  background-color: var(--nav-status-green);
}

/* ── Compact user profile (rail footer avatar) ── */
.admin-nav__user--compact {
  margin: 6px 0 0;
  margin-top: auto;
}

.admin-nav__user-trigger--compact {
  width: auto;
  padding: 0;
  border: none;
  background: none;
}

.admin-nav__user-trigger--compact:hover:not(:disabled) {
  background: none;
  border: none;
}

.admin-nav__user--compact .admin-nav__user-avatar {
  position: relative;
  width: 32px;
  height: 32px;
}

.admin-nav__user-avatar-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--nav-panel);
}

.admin-nav__user--compact .admin-nav__user-popover {
  left: auto;
  right: 0;
  min-width: 170px;
}

/* ================================================================
   NavCustomizer — Drag & drop editor
   ================================================================ */

.admin-nav-customizer {
  max-width: 700px;
  margin: 0 auto;
  padding: 20px;
  font-family: var(--nav-font-sans);
}

.admin-nav-customizer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 12px;
}

.admin-nav-customizer__title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--theme-text);
  margin: 0;
}

.admin-nav-customizer__actions {
  display: flex;
  gap: 8px;
}

.admin-nav-customizer__hint {
  font-size: 12.5px;
  color: var(--theme-elevation-500);
  margin-bottom: 16px;
}

.admin-nav-customizer__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  align-items: center;
}

.admin-nav-customizer__separator {
  width: 1px;
  height: 20px;
  background-color: var(--theme-elevation-200);
  margin: 0 4px;
}

.admin-nav-customizer__search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
}

.admin-nav-customizer__search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--theme-elevation-200);
  border-radius: 9px;
  font-family: var(--nav-font-sans);
  font-size: 13px;
  color: var(--theme-text);
  background-color: var(--theme-input-bg, transparent);
  outline: none;
}

.admin-nav-customizer__search-input:focus {
  border-color: var(--nav-accent);
}

.admin-nav-customizer__no-results {
  font-size: 13px;
  color: var(--theme-elevation-400);
  text-align: center;
  padding: 20px 0;
}

.admin-nav-customizer__drag-overlay {
  padding: 8px 16px;
  border-radius: var(--admin-nav-radius);
  background-color: var(--theme-elevation-0);
  border: 1px solid var(--nav-accent);
  font-size: 13px;
  font-weight: 600;
  color: var(--theme-text);
  box-shadow: 0 12px 34px rgba(33, 31, 27, 0.16);
  cursor: grabbing;
}

.admin-nav-customizer__add-item-wrap {
  padding: 4px 8px;
}

/* ── Buttons ── */

.admin-nav-btn--primary {
  padding: 9px 18px;
  border: none;
  border-radius: 9px;
  background-color: var(--nav-accent);
  color: white;
  font-family: var(--nav-font-sans);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--admin-nav-transition);
}

.admin-nav-btn--primary:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--nav-accent) 85%, #000);
}

.admin-nav-btn--primary:disabled {
  background-color: var(--theme-elevation-300);
  cursor: not-allowed;
}

.admin-nav-btn--secondary {
  padding: 9px 18px;
  border: 1px solid var(--theme-elevation-200);
  border-radius: 9px;
  background: none;
  font-family: var(--nav-font-sans);
  font-size: 13px;
  cursor: pointer;
  color: var(--theme-text);
  transition: border-color var(--admin-nav-transition);
}

.admin-nav-btn--secondary:hover {
  border-color: var(--nav-accent);
}

.admin-nav-btn--outline {
  padding: 9px 18px;
  border: 1px dashed var(--theme-elevation-300);
  border-radius: 9px;
  background: none;
  font-family: var(--nav-font-sans);
  font-size: 13px;
  cursor: pointer;
  color: var(--theme-elevation-500);
  width: 100%;
  text-align: center;
}

.admin-nav-btn--outline-sm {
  padding: 4px 8px;
  border: 1px dashed var(--theme-elevation-250);
  border-radius: 6px;
  background: none;
  font-family: var(--nav-font-sans);
  font-size: 11px;
  cursor: pointer;
  color: var(--theme-elevation-500);
  width: 100%;
  text-align: center;
}

.admin-nav-btn--small {
  padding: 5px 10px;
  border: 1px solid var(--theme-elevation-200);
  border-radius: 7px;
  background: none;
  font-family: var(--nav-font-sans);
  font-size: 11px;
  cursor: pointer;
  color: var(--theme-elevation-600);
  white-space: nowrap;
}

.admin-nav-btn--small:disabled {
  opacity: 0.4;
  cursor: default;
}

.admin-nav-btn--small-discover {
  padding: 5px 10px;
  border: 1px solid var(--theme-elevation-200);
  border-radius: 7px;
  background-color: var(--theme-elevation-100);
  font-size: 11px;
  cursor: pointer;
  color: var(--theme-elevation-600);
  white-space: nowrap;
}

.admin-nav-btn--small-discover:disabled {
  opacity: 0.4;
  cursor: default;
}

/* ── Toast ── */

.admin-nav-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 20px;
  border-radius: 11px;
  color: white;
  font-family: var(--nav-font-sans);
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 12px 34px rgba(33, 31, 27, 0.18);
  transform: translateY(100px);
  opacity: 0;
  transition: transform 0.3s, opacity 0.3s;
  z-index: 2000;
  pointer-events: none;
}

.admin-nav-toast--visible {
  transform: translateY(0);
  opacity: 1;
}

.admin-nav-toast--success {
  background-color: var(--nav-status-green);
}

.admin-nav-toast--error {
  background-color: var(--nav-status-red);
}

/* ================================================================
   SortableGroup — Draggable group container
   ================================================================ */

.admin-nav-sortable-group {
  margin-bottom: 12px;
  border: 1px solid var(--nav-border);
  border-radius: 11px;
  overflow: hidden;
  background-color: var(--theme-elevation-0);
}

.admin-nav-sortable-group--hidden {
  background-color: var(--theme-elevation-50);
}

.admin-nav-sortable-group--dragging {
  opacity: 0.5;
}

.admin-nav-sortable-group__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background-color: var(--theme-elevation-50);
  border-bottom: 1px solid var(--nav-border);
  cursor: grab;
}

.admin-nav-sortable-group__title {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
  color: var(--theme-text);
}

.admin-nav-sortable-group__title--hidden {
  color: var(--theme-elevation-400);
  text-decoration: line-through;
}

.admin-nav-sortable-group__action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  color: var(--theme-elevation-500);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--admin-nav-transition);
}

.admin-nav-sortable-group__action-btn:hover {
  background-color: var(--theme-elevation-100);
}

.admin-nav-sortable-group__items {
  padding: 8px 0;
}

.admin-nav-sortable-group__items--hidden {
  padding: 4px 0;
  opacity: 0.5;
}

/* ================================================================
   SortableItem — Draggable item row
   ================================================================ */

.admin-nav-sortable-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  margin: 2px 8px;
  border-radius: var(--admin-nav-radius);
  background-color: transparent;
  cursor: grab;
}

.admin-nav-sortable-item:hover {
  background-color: var(--nav-hover);
}

.admin-nav-sortable-item--dragging {
  opacity: 0.4;
  background-color: var(--nav-accent-soft);
}

.admin-nav-sortable-item--invisible {
  opacity: 0.5;
}

.admin-nav-sortable-item__dot-icon {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}

.admin-nav-sortable-item__label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--theme-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-nav-sortable-item__label--hidden {
  color: var(--theme-elevation-400);
  text-decoration: line-through;
}

.admin-nav-sortable-item__badge {
  font-family: var(--nav-font-mono);
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 999px;
  background-color: var(--nav-badge-bg);
  color: var(--nav-badge-text);
}

.admin-nav-sortable-item__grip {
  flex-shrink: 0;
  color: var(--theme-elevation-400);
}

.admin-nav-sortable-item__action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  color: var(--theme-elevation-400);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.admin-nav-sortable-item__action-btn:hover {
  opacity: 1;
  color: var(--theme-text);
}

/* ================================================================
   IconPicker — Icon selection dropdown
   ================================================================ */

.admin-nav-icon-picker {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  width: 300px;
  max-height: 320px;
  background-color: var(--theme-elevation-0);
  border: 1px solid var(--nav-border);
  border-radius: 11px;
  box-shadow: 0 12px 34px rgba(33, 31, 27, 0.16);
  display: flex;
  flex-direction: column;
}

.admin-nav-icon-picker__search {
  padding: 8px;
  border-bottom: 1px solid var(--theme-elevation-200);
}

.admin-nav-icon-picker__search-input {
  width: 100%;
  padding: 7px 9px;
  border: 1px solid var(--theme-elevation-200);
  border-radius: 7px;
  font-family: var(--nav-font-sans);
  font-size: 12px;
  background-color: var(--theme-input-bg);
  color: var(--theme-text);
  outline: none;
}

.admin-nav-icon-picker__dot-option {
  padding: 4px 8px;
  border-bottom: 1px solid var(--theme-elevation-200);
}

.admin-nav-icon-picker__dot-label {
  font-size: 11px;
  color: var(--theme-elevation-500);
  display: flex;
  align-items: center;
  gap: 6px;
}

.admin-nav-icon-picker__color-input {
  width: 24px;
  height: 24px;
  border: none;
  padding: 0;
  cursor: pointer;
}

.admin-nav-icon-picker__grid {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.admin-nav-icon-picker__icon-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--theme-elevation-200);
  border-radius: 7px;
  background-color: var(--theme-elevation-0);
  cursor: pointer;
  color: var(--theme-text);
}

.admin-nav-icon-picker__icon-btn--selected {
  border: 2px solid var(--nav-accent);
  background-color: var(--nav-accent-soft);
}

.admin-nav-icon-picker__no-results {
  padding: 12px;
  font-size: 12px;
  color: var(--theme-elevation-400);
}

.admin-nav-icon-picker__footer {
  padding: 4px;
  border-top: 1px solid var(--theme-elevation-200);
  text-align: right;
}

.admin-nav-icon-picker__close-btn {
  background: none;
  border: none;
  font-size: 11px;
  color: var(--theme-elevation-500);
  cursor: pointer;
  padding: 4px 8px;
}

/* ================================================================
   Shared modal — Used by GroupEditor and NavItemEditor
   ================================================================ */

.admin-nav-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(33, 31, 27, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.admin-nav-modal {
  background-color: var(--theme-elevation-0);
  border-radius: 13px;
  padding: 24px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 12px 34px rgba(33, 31, 27, 0.2);
  font-family: var(--nav-font-sans);
}

.admin-nav-modal--sm {
  width: 380px;
}

.admin-nav-modal--md {
  width: 420px;
}

.admin-nav-modal__title {
  margin: 0 0 16px;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--theme-text);
}

.admin-nav-modal__field-group {
  margin-bottom: 12px;
}

.admin-nav-modal__field-group--relative {
  position: relative;
}

.admin-nav-modal__field-group--lg {
  margin-bottom: 16px;
}

.admin-nav-modal__field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.admin-nav-modal__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-elevation-500);
  margin-bottom: 4px;
  display: block;
}

.admin-nav-modal__label--inline {
  margin-bottom: 0;
}

.admin-nav-modal__input {
  width: 100%;
  padding: 7px 9px;
  border: 1px solid var(--theme-elevation-200);
  border-radius: 7px;
  font-family: var(--nav-font-sans);
  font-size: 13px;
  background-color: var(--theme-input-bg);
  color: var(--theme-text);
  outline: none;
}

.admin-nav-modal__input:focus {
  border-color: var(--nav-accent);
}

.admin-nav-modal__input--icon-btn {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
}

.admin-nav-modal__checkbox-label {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--theme-text);
  cursor: pointer;
}

.admin-nav-modal__multilang-toggle {
  font-size: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--theme-elevation-500);
  cursor: pointer;
}

.admin-nav-modal__multilang-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.admin-nav-modal__lang-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.admin-nav-modal__lang-code {
  font-family: var(--nav-font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--theme-elevation-400);
  width: 20px;
  text-align: center;
  text-transform: uppercase;
}

.admin-nav-modal__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* ================================================================
   NavItemEditor — Submenu children section
   ================================================================ */

.admin-nav-submenus {
  margin-bottom: 16px;
  border: 1px solid var(--theme-elevation-150);
  border-radius: 11px;
  padding: 12px;
  background-color: var(--theme-elevation-50);
}

.admin-nav-submenus__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.admin-nav-submenus__header--has-items {
  margin-bottom: 8px;
}

.admin-nav-submenus__title {
  font-family: var(--nav-font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-elevation-500);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.admin-nav-submenus__add-btn {
  font-size: 11px;
  font-weight: 600;
  color: var(--nav-teal);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 0;
}

.admin-nav-submenus__add-btn:disabled {
  color: var(--theme-elevation-300);
  cursor: default;
}

.admin-nav-submenus__empty {
  font-size: 11px;
  color: var(--theme-elevation-400);
  font-style: italic;
}

.admin-nav-submenus__child-wrapper {
  margin-bottom: 4px;
}

.admin-nav-submenus__child-wrapper:last-child {
  margin-bottom: 0;
}

.admin-nav-submenus__child-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  border-radius: 6px;
  background-color: var(--theme-elevation-0);
  border: 1px solid var(--theme-elevation-100);
}

.admin-nav-submenus__child-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.admin-nav-submenus__child-bullet {
  font-size: 10px;
  color: var(--theme-elevation-400);
  flex-shrink: 0;
  width: 8px;
  text-align: center;
}

.admin-nav-submenus__child-label {
  font-size: 12px;
  color: var(--theme-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-nav-submenus__child-label em {
  color: var(--theme-elevation-300);
}

.admin-nav-submenus__child-href {
  font-family: var(--nav-font-mono);
  font-size: 10px;
  color: var(--theme-elevation-400);
  flex-shrink: 0;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-nav-submenus__child-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.admin-nav-submenus__child-action-btn {
  background: none;
  border: none;
  font-size: 12px;
  padding: 0 2px;
  color: var(--theme-elevation-500);
}

.admin-nav-submenus__child-action-btn--disabled {
  color: var(--theme-elevation-200);
  cursor: default;
}

.admin-nav-submenus__child-action-btn--enabled {
  cursor: pointer;
}

.admin-nav-submenus__child-action-btn--delete {
  cursor: pointer;
  color: var(--nav-status-red);
}

/* Inline edit form for children */
.admin-nav-submenus__edit-form {
  padding: 8px;
  border-radius: 7px;
  background-color: var(--theme-elevation-0);
  border: 1px solid var(--theme-elevation-200);
}

.admin-nav-submenus__edit-field {
  margin-bottom: 6px;
}

.admin-nav-submenus__edit-field--last {
  margin-bottom: 8px;
}

.admin-nav-submenus__edit-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--theme-elevation-500);
  margin-bottom: 4px;
  display: block;
}

.admin-nav-submenus__edit-input {
  width: 100%;
  padding: 5px 7px;
  border: 1px solid var(--theme-elevation-200);
  border-radius: 6px;
  font-family: var(--nav-font-sans);
  font-size: 12px;
  background-color: var(--theme-input-bg);
  color: var(--theme-text);
  outline: none;
}

.admin-nav-submenus__edit-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.admin-nav-submenus__edit-cancel {
  font-size: 11px;
  padding: 4px 10px;
  border: 1px solid var(--theme-elevation-200);
  border-radius: 6px;
  background: none;
  cursor: pointer;
  color: var(--theme-text);
}

.admin-nav-submenus__edit-ok {
  font-size: 11px;
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  background-color: var(--nav-accent);
  color: white;
  font-weight: 600;
  cursor: pointer;
}

/* ── NavItemEditor icon preview ── */

.admin-nav-modal__icon-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

.admin-nav-modal__icon-name {
  font-size: 12px;
  color: var(--theme-elevation-500);
}

/* ── Utilities ── */

.admin-nav-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.admin-nav-file-input--hidden {
  display: none;
}
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
