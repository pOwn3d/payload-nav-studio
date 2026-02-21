'use client'

import React, { useState } from 'react'
import type { NavGroupConfig } from '../types.js'

interface GroupEditorProps {
  group?: NavGroupConfig
  onSave: (group: NavGroupConfig) => void
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

export const GroupEditor: React.FC<GroupEditorProps> = ({ group, onSave, onCancel }) => {
  const isNew = !group
  const [title, setTitle] = useState(group?.title || '')
  const [id, setId] = useState(group?.id || '')
  const [defaultCollapsed, setDefaultCollapsed] = useState(group?.defaultCollapsed ?? false)

  const handleSave = () => {
    const groupId = id.trim() || title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!title.trim() || !groupId) return

    onSave({
      id: groupId,
      title: title.trim(),
      items: group?.items || [],
      visible: group?.visible ?? true,
      defaultCollapsed,
    })
  }

  return (
    <div
      style={{
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
          width: 380,
          maxWidth: '90vw',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--theme-text)' }}>
          {isNew ? 'Nouveau groupe' : 'Modifier le groupe'}
        </h3>

        {/* Title */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Titre</label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (isNew) setId(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
            }}
            placeholder="ex: Mon groupe"
            autoFocus
            style={fieldStyle}
          />
        </div>

        {/* ID */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>ID (unique)</label>
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="ex: mon-groupe"
            style={fieldStyle}
            disabled={!isNew}
          />
        </div>

        {/* Default collapsed */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--theme-text)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={defaultCollapsed}
              onChange={(e) => setDefaultCollapsed(e.target.checked)}
            />
            Replié par défaut
          </label>
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
            disabled={!title.trim()}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              backgroundColor: title.trim() ? 'var(--theme-success-500)' : 'var(--theme-elevation-300)',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: title.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {isNew ? 'Créer' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}
