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

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  fontSize: 13,
  backgroundColor: 'var(--theme-input-bg)',
  color: 'var(--theme-text)',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--theme-elevation-500)',
  marginBottom: 4,
  display: 'block',
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

  // Available languages from Payload i18n
  const availableLangs = Object.keys(
    (i18n as unknown as { translations?: Record<string, unknown> }).translations || { [i18n.language]: true },
  )

  const handleSave = () => {
    const finalLabel = getFinalLabel()
    onSave({
      ...item,
      label: finalLabel || item.label,
      href: href.trim() || item.href,
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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}
    onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'var(--theme-elevation-0)',
          borderRadius: 12,
          padding: 24,
          width: 420,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--theme-text)' }}>
          {t('plugin-admin-nav:editItem')}
        </h3>

        {/* Label */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>{t('plugin-admin-nav:labelField')}</label>
            <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--theme-elevation-500)', cursor: 'pointer' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {availableLangs.map((lang) => (
                <div key={lang} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--theme-elevation-400)', width: 20, textAlign: 'center', textTransform: 'uppercase' }}>{lang}</span>
                  <input
                    type="text"
                    value={labelRecord[lang] || ''}
                    onChange={(e) => setLabelRecord((prev) => ({ ...prev, [lang]: e.target.value }))}
                    style={fieldStyle}
                    autoFocus={lang === i18n.language}
                  />
                </div>
              ))}
            </div>
          ) : (
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} style={fieldStyle} />
          )}
        </div>

        {/* URL */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>{t('plugin-admin-nav:urlField')}</label>
          <input type="text" value={href} onChange={(e) => setHref(e.target.value)} style={fieldStyle} />
        </div>

        {/* Icon */}
        <div style={{ marginBottom: 12, position: 'relative' }}>
          <label style={labelStyle}>{t('plugin-admin-nav:iconField')}</label>
          <button
            onClick={() => setShowIconPicker(!showIconPicker)}
            style={{
              ...fieldStyle,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textAlign: 'left',
            }}
          >
            {icon.startsWith('#') ? (
              <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', backgroundColor: icon }} />
            ) : (
              <span style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>{icon}</span>
            )}
          </button>
          {showIconPicker && (
            <IconPicker value={icon} onChange={setIcon} onClose={() => setShowIconPicker(false)} />
          )}
        </div>

        {/* matchPrefix */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--theme-text)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={matchPrefix}
              onChange={(e) => setMatchPrefix(e.target.checked)}
            />
            {t('plugin-admin-nav:matchPrefix')}
          </label>
        </div>

        {/* Children / Sous-menus */}
        <div style={{
          marginBottom: 16,
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 8,
          padding: 12,
          backgroundColor: 'var(--theme-elevation-50)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: children.length > 0 ? 8 : 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-elevation-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('plugin-admin-nav:submenus')} ({children.length})
            </span>
            <button
              type="button"
              onClick={addChild}
              disabled={editingChildIndex !== null}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: editingChildIndex !== null ? 'var(--theme-elevation-300)' : 'var(--theme-success-500)',
                background: 'none',
                border: 'none',
                cursor: editingChildIndex !== null ? 'default' : 'pointer',
                padding: '2px 0',
              }}
            >
              {t('plugin-admin-nav:addSubmenu')}
            </button>
          </div>

          {children.length === 0 && editingChildIndex === null && (
            <div style={{ fontSize: 11, color: 'var(--theme-elevation-400)', fontStyle: 'italic' }}>
              {t('plugin-admin-nav:noSubmenus')}
            </div>
          )}

          {children.map((child, index) => (
            <div key={child.id} style={{ marginBottom: index < children.length - 1 ? 4 : 0 }}>
              {/* Child display row */}
              {editingChildIndex !== index && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 6px',
                  borderRadius: 4,
                  backgroundColor: 'var(--theme-elevation-0)',
                  border: '1px solid var(--theme-elevation-100)',
                }}>
                  {/* Icon dot or icon name */}
                  {child.icon.startsWith('#') ? (
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: child.icon, flexShrink: 0 }} />
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--theme-elevation-400)', flexShrink: 0, width: 8, textAlign: 'center' }}>●</span>
                  )}
                  {/* Label + href */}
                  <span style={{ fontSize: 12, color: 'var(--theme-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {resolveLabel(child.label, i18n.language, i18n.fallbackLanguage as string) || <em style={{ color: 'var(--theme-elevation-300)' }}>{t('plugin-admin-nav:noLabel')}</em>}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--theme-elevation-400)', flexShrink: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {child.href}
                  </span>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button type="button" onClick={() => moveChild(index, -1)} disabled={index === 0} title={t('plugin-admin-nav:moveUp')}
                      style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', fontSize: 12, padding: '0 2px', color: index === 0 ? 'var(--theme-elevation-200)' : 'var(--theme-elevation-500)' }}>↑</button>
                    <button type="button" onClick={() => moveChild(index, 1)} disabled={index === children.length - 1} title={t('plugin-admin-nav:moveDown')}
                      style={{ background: 'none', border: 'none', cursor: index === children.length - 1 ? 'default' : 'pointer', fontSize: 12, padding: '0 2px', color: index === children.length - 1 ? 'var(--theme-elevation-200)' : 'var(--theme-elevation-500)' }}>↓</button>
                    <button type="button" onClick={() => startEditChild(index)} title={t('plugin-admin-nav:edit')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '0 2px', color: 'var(--theme-elevation-500)' }}>✏️</button>
                    <button type="button" onClick={() => removeChild(index)} title={t('plugin-admin-nav:delete')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '0 2px', color: 'var(--theme-error-500)' }}>✕</button>
                  </div>
                </div>
              )}

              {/* Inline edit form */}
              {editingChildIndex === index && (
                <div style={{
                  padding: 8,
                  borderRadius: 4,
                  backgroundColor: 'var(--theme-elevation-0)',
                  border: '1px solid var(--theme-elevation-200)',
                }}>
                  <div style={{ marginBottom: 6 }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>{t('plugin-admin-nav:labelField')}</label>
                    <input type="text" value={childDraft.label} onChange={(e) => setChildDraft({ ...childDraft, label: e.target.value })}
                      style={{ ...fieldStyle, fontSize: 12, padding: '4px 6px' }} autoFocus placeholder={t('plugin-admin-nav:childLabelPlaceholder')} />
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>{t('plugin-admin-nav:urlField')}</label>
                    <input type="text" value={childDraft.href} onChange={(e) => setChildDraft({ ...childDraft, href: e.target.value })}
                      style={{ ...fieldStyle, fontSize: 12, padding: '4px 6px' }} placeholder={t('plugin-admin-nav:childUrlPlaceholder')} />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>{t('plugin-admin-nav:childIconLabel')}</label>
                    <input type="text" value={childDraft.icon} onChange={(e) => setChildDraft({ ...childDraft, icon: e.target.value })}
                      style={{ ...fieldStyle, fontSize: 12, padding: '4px 6px' }} placeholder={t('plugin-admin-nav:childIconPlaceholder')} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={cancelEditChild}
                      style={{ fontSize: 11, padding: '3px 10px', border: '1px solid var(--theme-elevation-200)', borderRadius: 4, background: 'none', cursor: 'pointer', color: 'var(--theme-text)' }}>
                      {t('plugin-admin-nav:cancel')}
                    </button>
                    <button type="button" onClick={saveChild}
                      style={{ fontSize: 11, padding: '3px 10px', border: 'none', borderRadius: 4, backgroundColor: 'var(--theme-success-500)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                      {t('plugin-admin-nav:ok')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--theme-elevation-200)',
              borderRadius: 6,
              background: 'none',
              fontSize: 13,
              cursor: 'pointer',
              color: 'var(--theme-text)',
            }}
          >
            {t('plugin-admin-nav:cancel')}
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              backgroundColor: 'var(--theme-success-500)',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('plugin-admin-nav:save')}
          </button>
        </div>
      </div>
    </div>
  )
}
