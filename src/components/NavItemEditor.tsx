'use client'

import React, { useState } from 'react'
import { IconPicker } from './IconPicker.js'
import type { NavItemConfig } from '../types.js'

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
  const [label, setLabel] = useState(item.label)
  const [href, setHref] = useState(item.href)
  const [icon, setIcon] = useState(item.icon)
  const [matchPrefix, setMatchPrefix] = useState(item.matchPrefix ?? false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [children, setChildren] = useState<NavItemConfig[]>(item.children || [])
  const [editingChildIndex, setEditingChildIndex] = useState<number | null>(null)
  const [childDraft, setChildDraft] = useState<{ label: string; href: string; icon: string }>({ label: '', href: '', icon: '#888888' })

  const handleSave = () => {
    onSave({
      ...item,
      label: label.trim() || item.label,
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
    setChildDraft({ label: child.label, href: child.href, icon: child.icon })
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
    if (editingChildIndex !== null && !children[editingChildIndex].label) {
      // Was a new empty child — remove it
      removeChild(editingChildIndex)
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
          Modifier l'item
        </h3>

        {/* Label */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Label</label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} style={fieldStyle} />
        </div>

        {/* URL */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>URL</label>
          <input type="text" value={href} onChange={(e) => setHref(e.target.value)} style={fieldStyle} />
        </div>

        {/* Icon */}
        <div style={{ marginBottom: 12, position: 'relative' }}>
          <label style={labelStyle}>Icône</label>
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
            Match prefix (actif si l'URL commence par le href)
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
              Sous-menus ({children.length})
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
              + Ajouter
            </button>
          </div>

          {children.length === 0 && editingChildIndex === null && (
            <div style={{ fontSize: 11, color: 'var(--theme-elevation-400)', fontStyle: 'italic' }}>
              Aucun sous-menu
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
                    {child.label || <em style={{ color: 'var(--theme-elevation-300)' }}>sans label</em>}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--theme-elevation-400)', flexShrink: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {child.href}
                  </span>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button type="button" onClick={() => moveChild(index, -1)} disabled={index === 0} title="Monter"
                      style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', fontSize: 12, padding: '0 2px', color: index === 0 ? 'var(--theme-elevation-200)' : 'var(--theme-elevation-500)' }}>↑</button>
                    <button type="button" onClick={() => moveChild(index, 1)} disabled={index === children.length - 1} title="Descendre"
                      style={{ background: 'none', border: 'none', cursor: index === children.length - 1 ? 'default' : 'pointer', fontSize: 12, padding: '0 2px', color: index === children.length - 1 ? 'var(--theme-elevation-200)' : 'var(--theme-elevation-500)' }}>↓</button>
                    <button type="button" onClick={() => startEditChild(index)} title="Modifier"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '0 2px', color: 'var(--theme-elevation-500)' }}>✏️</button>
                    <button type="button" onClick={() => removeChild(index)} title="Supprimer"
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
                    <label style={{ ...labelStyle, fontSize: 10 }}>Label</label>
                    <input type="text" value={childDraft.label} onChange={(e) => setChildDraft({ ...childDraft, label: e.target.value })}
                      style={{ ...fieldStyle, fontSize: 12, padding: '4px 6px' }} autoFocus placeholder="Ex: Tickets ouverts" />
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>URL</label>
                    <input type="text" value={childDraft.href} onChange={(e) => setChildDraft({ ...childDraft, href: e.target.value })}
                      style={{ ...fieldStyle, fontSize: 12, padding: '4px 6px' }} placeholder="Ex: /admin/collections/tickets?status=open" />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Icône (nom ou #couleur)</label>
                    <input type="text" value={childDraft.icon} onChange={(e) => setChildDraft({ ...childDraft, icon: e.target.value })}
                      style={{ ...fieldStyle, fontSize: 12, padding: '4px 6px' }} placeholder="#00E5FF ou ChevronRight" />
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={cancelEditChild}
                      style={{ fontSize: 11, padding: '3px 10px', border: '1px solid var(--theme-elevation-200)', borderRadius: 4, background: 'none', cursor: 'pointer', color: 'var(--theme-text)' }}>
                      Annuler
                    </button>
                    <button type="button" onClick={saveChild}
                      style={{ fontSize: 11, padding: '3px 10px', border: 'none', borderRadius: 4, backgroundColor: 'var(--theme-success-500)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                      OK
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
            Annuler
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
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  )
}
