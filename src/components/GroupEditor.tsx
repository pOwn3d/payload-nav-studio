'use client'

import React, { useState } from 'react'
import { usePluginTranslation } from '../hooks/usePluginTranslation.js'
import type { NavGroupConfig, LocalizedString } from '../types.js'
import { isMultiLang, resolveLabel } from '../utils.js'

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
  const { t, i18n } = usePluginTranslation()
  const isNew = !group

  // Multi-lang state
  const [useMultiLang, setUseMultiLang] = useState(() => group ? isMultiLang(group.title) : false)

  // Simple string title
  const [title, setTitle] = useState(() => {
    if (!group) return ''
    return resolveLabel(group.title, i18n.language, i18n.fallbackLanguage as string)
  })

  // Multi-lang title record
  const [titleRecord, setTitleRecord] = useState<Record<string, string>>(() => {
    if (group && isMultiLang(group.title)) return { ...group.title }
    const fallback = group ? resolveLabel(group.title, i18n.language, i18n.fallbackLanguage as string) : ''
    return { [i18n.language]: fallback }
  })

  const [id, setId] = useState(group?.id || '')
  const [defaultCollapsed, setDefaultCollapsed] = useState(group?.defaultCollapsed ?? false)

  const getResolvedTitle = (): string => {
    if (useMultiLang) {
      return titleRecord[i18n.language] || Object.values(titleRecord).find(Boolean) || ''
    }
    return title
  }

  const getFinalTitle = (): LocalizedString => {
    if (useMultiLang) {
      // Filter empty values
      const filtered: Record<string, string> = {}
      for (const [k, v] of Object.entries(titleRecord)) {
        if (v.trim()) filtered[k] = v.trim()
      }
      return Object.keys(filtered).length > 0 ? filtered : ''
    }
    return title.trim()
  }

  const handleSave = () => {
    const finalTitle = getFinalTitle()
    const resolvedForId = typeof finalTitle === 'string' ? finalTitle : getResolvedTitle()
    const groupId = id.trim() || resolvedForId.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!resolvedForId || !groupId) return

    onSave({
      id: groupId,
      title: finalTitle,
      items: group?.items || [],
      visible: group?.visible ?? true,
      defaultCollapsed,
    })
  }

  const resolvedTitle = getResolvedTitle()

  // Available languages from Payload i18n
  const availableLangs = Object.keys(
    (i18n as unknown as { translations?: Record<string, unknown> }).translations || { [i18n.language]: true },
  )

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
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--theme-text)' }}>
          {isNew ? t('plugin-admin-nav:newGroup') : t('plugin-admin-nav:editGroup')}
        </h3>

        {/* Title */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>{t('plugin-admin-nav:titleField')}</label>
            <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--theme-elevation-500)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useMultiLang}
                onChange={(e) => {
                  setUseMultiLang(e.target.checked)
                  if (e.target.checked && title.trim()) {
                    setTitleRecord((prev) => ({ ...prev, [i18n.language]: title.trim() }))
                  } else if (!e.target.checked) {
                    setTitle(getResolvedTitle())
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
                    value={titleRecord[lang] || ''}
                    onChange={(e) => {
                      setTitleRecord((prev) => ({ ...prev, [lang]: e.target.value }))
                      if (isNew && lang === i18n.language) {
                        setId(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
                      }
                    }}
                    placeholder={t('plugin-admin-nav:titlePlaceholder')}
                    autoFocus={lang === i18n.language}
                    style={fieldStyle}
                  />
                </div>
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (isNew) setId(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
              }}
              placeholder={t('plugin-admin-nav:titlePlaceholder')}
              autoFocus
              style={fieldStyle}
            />
          )}
        </div>

        {/* ID */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>{t('plugin-admin-nav:idField')}</label>
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder={t('plugin-admin-nav:idPlaceholder')}
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
            {t('plugin-admin-nav:defaultCollapsed')}
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
            {t('plugin-admin-nav:cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!resolvedTitle.trim()}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              backgroundColor: resolvedTitle.trim() ? 'var(--theme-success-500)' : 'var(--theme-elevation-300)',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: resolvedTitle.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {isNew ? t('plugin-admin-nav:create') : t('plugin-admin-nav:save')}
          </button>
        </div>
      </div>
    </div>
  )
}
