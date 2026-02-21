'use client'

import React, { useState, useMemo } from 'react'
import { getIconNames, getIconPath } from '../icons.js'
import { usePluginTranslation } from '../hooks/usePluginTranslation.js'

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
  onClose: () => void
}

const IconButton: React.FC<{
  name: string
  isSelected: boolean
  onClick: () => void
}> = ({ name, isSelected, onClick }) => {
  const pathData = getIconPath(name)
  if (!pathData) return null
  const paths = pathData.split(/(?= M)/).map((p) => p.trim())

  return (
    <button
      onClick={onClick}
      title={name}
      style={{
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: isSelected ? '2px solid var(--theme-success-500)' : '1px solid var(--theme-elevation-200)',
        borderRadius: 6,
        backgroundColor: isSelected ? 'var(--theme-success-100)' : 'var(--theme-elevation-0)',
        cursor: 'pointer',
        color: 'var(--theme-text)',
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {paths.map((d, i) => <path key={i} d={d} />)}
      </svg>
    </button>
  )
}

export const IconPicker: React.FC<IconPickerProps> = ({ value, onChange, onClose }) => {
  const { t } = usePluginTranslation()
  const [search, setSearch] = useState('')
  const allIcons = useMemo(() => getIconNames(), [])

  const filtered = useMemo(() => {
    if (!search) return allIcons
    const q = search.toLowerCase()
    return allIcons.filter((name) => name.includes(q))
  }, [allIcons, search])

  return (
    <div style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      zIndex: 100,
      width: 300,
      maxHeight: 320,
      backgroundColor: 'var(--theme-elevation-0)',
      border: '1px solid var(--theme-elevation-200)',
      borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Search */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--theme-elevation-200)' }}>
        <input
          type="text"
          placeholder={t('plugin-admin-nav:searchIcon')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: 4,
            fontSize: 12,
            backgroundColor: 'var(--theme-input-bg)',
            color: 'var(--theme-text)',
            outline: 'none',
          }}
        />
      </div>

      {/* Color dot option */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--theme-elevation-200)' }}>
        <label style={{ fontSize: 11, color: 'var(--theme-elevation-500)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {t('plugin-admin-nav:dotColor')}
          <input
            type="color"
            value={value.startsWith('#') ? value : '#00E5FF'}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 24, height: 24, border: 'none', padding: 0, cursor: 'pointer' }}
          />
        </label>
      </div>

      {/* Icon grid */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 8,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
      }}>
        {filtered.map((name) => (
          <IconButton
            key={name}
            name={name}
            isSelected={value === name}
            onClick={() => { onChange(name); onClose() }}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--theme-elevation-400)' }}>
            {t('plugin-admin-nav:noIconFound')}
          </div>
        )}
      </div>

      {/* Close */}
      <div style={{ padding: 4, borderTop: '1px solid var(--theme-elevation-200)', textAlign: 'right' }}>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 11,
            color: 'var(--theme-elevation-500)',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          {t('plugin-admin-nav:close')}
        </button>
      </div>
    </div>
  )
}
