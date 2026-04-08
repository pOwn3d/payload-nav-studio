'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
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
      className={`admin-nav-icon-picker__icon-btn${isSelected ? ' admin-nav-icon-picker__icon-btn--selected' : ''}`}
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
  const containerRef = useRef<HTMLDivElement>(null)
  const allIcons = useMemo(() => getIconNames(), [])

  const filtered = useMemo(() => {
    if (!search) return allIcons
    const q = search.toLowerCase()
    return allIcons.filter((name) => name.includes(q))
  }, [allIcons, search])

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={containerRef} className="admin-nav-icon-picker">
      {/* Search */}
      <div className="admin-nav-icon-picker__search">
        <input
          type="text"
          placeholder={t('plugin-admin-nav:searchIcon')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          className="admin-nav-icon-picker__search-input"
        />
      </div>

      {/* Color dot option */}
      <div className="admin-nav-icon-picker__dot-option">
        <label className="admin-nav-icon-picker__dot-label">
          {t('plugin-admin-nav:dotColor')}
          <input
            type="color"
            value={value.startsWith('#') ? value : '#00E5FF'}
            onChange={(e) => onChange(e.target.value)}
            className="admin-nav-icon-picker__color-input"
          />
        </label>
      </div>

      {/* Icon grid */}
      <div className="admin-nav-icon-picker__grid">
        {filtered.map((name) => (
          <IconButton
            key={name}
            name={name}
            isSelected={value === name}
            onClick={() => { onChange(name); onClose() }}
          />
        ))}
        {filtered.length === 0 && (
          <div className="admin-nav-icon-picker__no-results">
            {t('plugin-admin-nav:noIconFound')}
          </div>
        )}
      </div>

      {/* Close */}
      <div className="admin-nav-icon-picker__footer">
        <button onClick={onClose} className="admin-nav-icon-picker__close-btn">
          {t('plugin-admin-nav:close')}
        </button>
      </div>
    </div>
  )
}
