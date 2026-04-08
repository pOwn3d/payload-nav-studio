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

  // Available languages from Payload i18n (i18next exposes .languages at runtime)
  const i18nLanguages = (i18n as unknown as { languages?: string[] }).languages
  const availableLangs = i18nLanguages?.filter((l) => l !== 'cimode') || [i18n.language]

  return (
    <div className="admin-nav-modal-overlay" onClick={onCancel}>
      <div className="admin-nav-modal admin-nav-modal--sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="admin-nav-modal__title">
          {isNew ? t('plugin-admin-nav:newGroup') : t('plugin-admin-nav:editGroup')}
        </h3>

        {/* Title */}
        <div className="admin-nav-modal__field-group">
          <div className="admin-nav-modal__field-row">
            <label className="admin-nav-modal__label admin-nav-modal__label--inline">{t('plugin-admin-nav:titleField')}</label>
            <label className="admin-nav-modal__multilang-toggle">
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
            <div className="admin-nav-modal__multilang-fields">
              {availableLangs.map((lang) => (
                <div key={lang} className="admin-nav-modal__lang-row">
                  <span className="admin-nav-modal__lang-code">{lang}</span>
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
                    className="admin-nav-modal__input"
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
              className="admin-nav-modal__input"
            />
          )}
        </div>

        {/* ID */}
        <div className="admin-nav-modal__field-group">
          <label className="admin-nav-modal__label">{t('plugin-admin-nav:idField')}</label>
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder={t('plugin-admin-nav:idPlaceholder')}
            className="admin-nav-modal__input"
            disabled={!isNew}
          />
        </div>

        {/* Default collapsed */}
        <div className="admin-nav-modal__field-group--lg">
          <label className="admin-nav-modal__checkbox-label">
            <input
              type="checkbox"
              checked={defaultCollapsed}
              onChange={(e) => setDefaultCollapsed(e.target.checked)}
            />
            {t('plugin-admin-nav:defaultCollapsed')}
          </label>
        </div>

        {/* Actions */}
        <div className="admin-nav-modal__actions">
          <button onClick={onCancel} className="admin-nav-btn--secondary">
            {t('plugin-admin-nav:cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!resolvedTitle.trim()}
            className="admin-nav-btn--primary"
          >
            {isNew ? t('plugin-admin-nav:create') : t('plugin-admin-nav:save')}
          </button>
        </div>
      </div>
    </div>
  )
}
