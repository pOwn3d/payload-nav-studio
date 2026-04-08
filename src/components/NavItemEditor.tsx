'use client'

import React, { useState } from 'react'
import { IconPicker } from './IconPicker.js'
import { usePluginTranslation } from '../hooks/usePluginTranslation.js'
import type { NavItemConfig, LocalizedString } from '../types.js'
import { isMultiLang, resolveLabel } from '../utils.js'

interface NavItemEditorProps {
  item: NavItemConfig
  onSave: (item: NavItemConfig) => void
  onCancel: () => void
}

export const NavItemEditor: React.FC<NavItemEditorProps> = ({ item, onSave, onCancel }) => {
  const { t, i18n } = usePluginTranslation()

  // Multi-lang state for label
  const [useMultiLang, setUseMultiLang] = useState(() => isMultiLang(item.label))
  const [label, setLabel] = useState(() => resolveLabel(item.label, i18n.language, i18n.fallbackLanguage as string))
  const [labelRecord, setLabelRecord] = useState<Record<string, string>>(() => {
    if (isMultiLang(item.label)) return { ...item.label }
    const fallback = resolveLabel(item.label, i18n.language, i18n.fallbackLanguage as string)
    return { [i18n.language]: fallback }
  })

  const [href, setHref] = useState(item.href)
  const [icon, setIcon] = useState(item.icon)
  const [matchPrefix, setMatchPrefix] = useState(item.matchPrefix ?? false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [children, setChildren] = useState<NavItemConfig[]>(item.children || [])
  const [editingChildIndex, setEditingChildIndex] = useState<number | null>(null)
  const [childDraft, setChildDraft] = useState<{ label: string; href: string; icon: string }>({ label: '', href: '', icon: '#888888' })

  const getResolvedLabel = (): string => {
    if (useMultiLang) return labelRecord[i18n.language] || Object.values(labelRecord).find(Boolean) || ''
    return label
  }

  const getFinalLabel = (): LocalizedString => {
    if (useMultiLang) {
      const filtered: Record<string, string> = {}
      for (const [k, v] of Object.entries(labelRecord)) {
        if (v.trim()) filtered[k] = v.trim()
      }
      return Object.keys(filtered).length > 0 ? filtered : ''
    }
    return label.trim()
  }

  // Available languages from Payload i18n (i18next exposes .languages at runtime)
  const i18nLanguages = (i18n as unknown as { languages?: string[] }).languages
  const availableLangs = i18nLanguages?.filter((l) => l !== 'cimode') || [i18n.language]

  const handleSave = () => {
    // Validate href — must start with '/' or be empty, reject dangerous protocols
    const trimmedHref = href.trim()
    if (trimmedHref) {
      const hrefLower = trimmedHref.toLowerCase()
      if (!hrefLower.startsWith('/')) {
        alert('URL must start with /')
        return
      }
      if (hrefLower.startsWith('javascript:') || hrefLower.startsWith('data:')) {
        alert('Forbidden URL protocol')
        return
      }
    }

    const finalLabel = getFinalLabel()
    onSave({
      ...item,
      label: finalLabel || item.label,
      href: trimmedHref || item.href,
      icon,
      matchPrefix,
      children: children.length > 0 ? children : undefined,
    })
  }

  const addChild = () => {
    const newChild: NavItemConfig = {
      id: `child-${Date.now()}`,
      label: '',
      href: '',
      icon: '#888888',
    }
    setChildren([...children, newChild])
    setEditingChildIndex(children.length)
    setChildDraft({ label: '', href: '', icon: '#888888' })
  }

  const startEditChild = (index: number) => {
    const child = children[index]
    setEditingChildIndex(index)
    setChildDraft({
      label: resolveLabel(child.label, i18n.language, i18n.fallbackLanguage as string),
      href: child.href,
      icon: child.icon,
    })
  }

  const saveChild = () => {
    if (editingChildIndex === null) return
    const trimmedLabel = childDraft.label.trim()
    const trimmedHref = childDraft.href.trim()
    if (!trimmedLabel) {
      // If label is empty, remove the child (was a cancelled new child)
      removeChild(editingChildIndex)
      return
    }
    const updated = [...children]
    updated[editingChildIndex] = {
      ...updated[editingChildIndex],
      label: trimmedLabel,
      href: trimmedHref,
      icon: childDraft.icon || '#888888',
    }
    setChildren(updated)
    setEditingChildIndex(null)
  }

  const cancelEditChild = () => {
    if (editingChildIndex !== null) {
      const childLabel = resolveLabel(children[editingChildIndex].label, i18n.language, i18n.fallbackLanguage as string)
      if (!childLabel) {
        // Was a new empty child — remove it
        removeChild(editingChildIndex)
      }
    }
    setEditingChildIndex(null)
  }

  const removeChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index))
    if (editingChildIndex === index) setEditingChildIndex(null)
  }

  const moveChild = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= children.length) return
    const updated = [...children]
    ;[updated[index], updated[target]] = [updated[target], updated[index]]
    setChildren(updated)
    if (editingChildIndex === index) setEditingChildIndex(target)
    else if (editingChildIndex === target) setEditingChildIndex(index)
  }

  return (
    <div className="admin-nav-modal-overlay" onClick={onCancel}>
      <div className="admin-nav-modal admin-nav-modal--md" onClick={(e) => e.stopPropagation()}>
        <h3 className="admin-nav-modal__title">
          {t('plugin-admin-nav:editItem')}
        </h3>

        {/* Label */}
        <div className="admin-nav-modal__field-group">
          <div className="admin-nav-modal__field-row">
            <label className="admin-nav-modal__label admin-nav-modal__label--inline">{t('plugin-admin-nav:labelField')}</label>
            <label className="admin-nav-modal__multilang-toggle">
              <input
                type="checkbox"
                checked={useMultiLang}
                onChange={(e) => {
                  setUseMultiLang(e.target.checked)
                  if (e.target.checked && label.trim()) {
                    setLabelRecord((prev) => ({ ...prev, [i18n.language]: label.trim() }))
                  } else if (!e.target.checked) {
                    setLabel(getResolvedLabel())
                  }
                }}
              />
              {t('plugin-admin-nav:multiLang')}
            </label>
          </div>

          {useMultiLang ? (
            <div className="admin-nav-modal__multilang-fields">
              {availableLangs.map((lang) => (
                <div key={lang} className="admin-nav-modal__lang-row">
                  <span className="admin-nav-modal__lang-code">{lang}</span>
                  <input
                    type="text"
                    value={labelRecord[lang] || ''}
                    onChange={(e) => setLabelRecord((prev) => ({ ...prev, [lang]: e.target.value }))}
                    className="admin-nav-modal__input"
                    autoFocus={lang === i18n.language}
                  />
                </div>
              ))}
            </div>
          ) : (
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className="admin-nav-modal__input" />
          )}
        </div>

        {/* URL */}
        <div className="admin-nav-modal__field-group">
          <label className="admin-nav-modal__label">{t('plugin-admin-nav:urlField')}</label>
          <input type="text" value={href} onChange={(e) => setHref(e.target.value)} className="admin-nav-modal__input" />
        </div>

        {/* Icon */}
        <div className="admin-nav-modal__field-group admin-nav-modal__field-group--relative">
          <label className="admin-nav-modal__label">{t('plugin-admin-nav:iconField')}</label>
          <button
            onClick={() => setShowIconPicker(!showIconPicker)}
            className="admin-nav-modal__input admin-nav-modal__input--icon-btn"
          >
            {icon.startsWith('#') ? (
              <span className="admin-nav-modal__icon-dot" style={{ backgroundColor: icon }} />
            ) : (
              <span className="admin-nav-modal__icon-name">{icon}</span>
            )}
          </button>
          {showIconPicker && (
            <IconPicker value={icon} onChange={setIcon} onClose={() => setShowIconPicker(false)} />
          )}
        </div>

        {/* matchPrefix */}
        <div className="admin-nav-modal__field-group--lg">
          <label className="admin-nav-modal__checkbox-label">
            <input
              type="checkbox"
              checked={matchPrefix}
              onChange={(e) => setMatchPrefix(e.target.checked)}
            />
            {t('plugin-admin-nav:matchPrefix')}
          </label>
        </div>

        {/* Children / Sous-menus */}
        <div className="admin-nav-submenus">
          <div className={`admin-nav-submenus__header${children.length > 0 ? ' admin-nav-submenus__header--has-items' : ''}`}>
            <span className="admin-nav-submenus__title">
              {t('plugin-admin-nav:submenus')} ({children.length})
            </span>
            <button
              type="button"
              onClick={addChild}
              disabled={editingChildIndex !== null}
              className="admin-nav-submenus__add-btn"
            >
              {t('plugin-admin-nav:addSubmenu')}
            </button>
          </div>

          {children.length === 0 && editingChildIndex === null && (
            <div className="admin-nav-submenus__empty">
              {t('plugin-admin-nav:noSubmenus')}
            </div>
          )}

          {children.map((child, index) => (
            <div key={child.id} className="admin-nav-submenus__child-wrapper">
              {/* Child display row */}
              {editingChildIndex !== index && (
                <div className="admin-nav-submenus__child-row">
                  {/* Icon dot or icon name */}
                  {child.icon.startsWith('#') ? (
                    <span className="admin-nav-submenus__child-dot" style={{ backgroundColor: child.icon }} />
                  ) : (
                    <span className="admin-nav-submenus__child-bullet">&#x25CF;</span>
                  )}
                  {/* Label + href */}
                  <span className="admin-nav-submenus__child-label">
                    {resolveLabel(child.label, i18n.language, i18n.fallbackLanguage as string) || <em>{t('plugin-admin-nav:noLabel')}</em>}
                  </span>
                  <span className="admin-nav-submenus__child-href">
                    {child.href}
                  </span>
                  {/* Action buttons */}
                  <div className="admin-nav-submenus__child-actions">
                    <button type="button" onClick={() => moveChild(index, -1)} disabled={index === 0} title={t('plugin-admin-nav:moveUp')}
                      className={`admin-nav-submenus__child-action-btn ${index === 0 ? 'admin-nav-submenus__child-action-btn--disabled' : 'admin-nav-submenus__child-action-btn--enabled'}`}>&#x2191;</button>
                    <button type="button" onClick={() => moveChild(index, 1)} disabled={index === children.length - 1} title={t('plugin-admin-nav:moveDown')}
                      className={`admin-nav-submenus__child-action-btn ${index === children.length - 1 ? 'admin-nav-submenus__child-action-btn--disabled' : 'admin-nav-submenus__child-action-btn--enabled'}`}>&#x2193;</button>
                    <button type="button" onClick={() => startEditChild(index)} title={t('plugin-admin-nav:edit')}
                      className="admin-nav-submenus__child-action-btn admin-nav-submenus__child-action-btn--enabled">&#x270F;&#xFE0F;</button>
                    <button type="button" onClick={() => removeChild(index)} title={t('plugin-admin-nav:delete')}
                      className="admin-nav-submenus__child-action-btn admin-nav-submenus__child-action-btn--delete">&#x2715;</button>
                  </div>
                </div>
              )}

              {/* Inline edit form */}
              {editingChildIndex === index && (
                <div className="admin-nav-submenus__edit-form">
                  <div className="admin-nav-submenus__edit-field">
                    <label className="admin-nav-submenus__edit-label">{t('plugin-admin-nav:labelField')}</label>
                    <input type="text" value={childDraft.label} onChange={(e) => setChildDraft({ ...childDraft, label: e.target.value })}
                      className="admin-nav-submenus__edit-input" autoFocus placeholder={t('plugin-admin-nav:childLabelPlaceholder')} />
                  </div>
                  <div className="admin-nav-submenus__edit-field">
                    <label className="admin-nav-submenus__edit-label">{t('plugin-admin-nav:urlField')}</label>
                    <input type="text" value={childDraft.href} onChange={(e) => setChildDraft({ ...childDraft, href: e.target.value })}
                      className="admin-nav-submenus__edit-input" placeholder={t('plugin-admin-nav:childUrlPlaceholder')} />
                  </div>
                  <div className="admin-nav-submenus__edit-field--last">
                    <label className="admin-nav-submenus__edit-label">{t('plugin-admin-nav:childIconLabel')}</label>
                    <input type="text" value={childDraft.icon} onChange={(e) => setChildDraft({ ...childDraft, icon: e.target.value })}
                      className="admin-nav-submenus__edit-input" placeholder={t('plugin-admin-nav:childIconPlaceholder')} />
                  </div>
                  <div className="admin-nav-submenus__edit-actions">
                    <button type="button" onClick={cancelEditChild} className="admin-nav-submenus__edit-cancel">
                      {t('plugin-admin-nav:cancel')}
                    </button>
                    <button type="button" onClick={saveChild} className="admin-nav-submenus__edit-ok">
                      {t('plugin-admin-nav:ok')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="admin-nav-modal__actions">
          <button onClick={onCancel} className="admin-nav-btn--secondary">
            {t('plugin-admin-nav:cancel')}
          </button>
          <button onClick={handleSave} className="admin-nav-btn--primary">
            {t('plugin-admin-nav:save')}
          </button>
        </div>
      </div>
    </div>
  )
}
